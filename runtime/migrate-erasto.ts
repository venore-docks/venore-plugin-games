import { eq, sql } from "drizzle-orm";
import { getSetting, setSetting } from "@venore/plugin-sdk/settings";
import {
  athletes,
  competitions,
  liveChannels,
  matchBoosts,
  matchEvents,
  matchLive,
  matches,
  modalities,
  modalityEntries,
  participants,
  powerBoosts,
  stageGroupMembers,
  stageGroups,
  stages,
  votePolls,
  votes,
} from "../database/schema";
import { defaultModalityRules } from "../shared/modality-rules";
import { normalizeLegacyGoals } from "../shared/legacy-events";
import { GAMES_SETTINGS } from "../shared/settings";
import type { SlotSource } from "../shared/tournament";
import { db, type Tx } from "./db";
import { resolveModalitySlots } from "./modalities";
import { fail, ok, type OperationResult } from "./result";

// Migração única do plugin Erasto League (schema erasto_league) pra uma competição do games:
// uma competição "Erasto League" com a modalidade Futsal, equipes/atletas com os MESMOS ids e
// slugs (links antigos redirecionam — routes/public/legacy-redirects.tsx), confrontos + partidas
// viram jogos (o id da partida é preservado quando existia), lances (correções negativas viram
// "desfazer" — shared/legacy-events.ts), power plays com rótulo copiado, votos da torcida com a
// mesma identidade de aparelho (o cookie antigo continua valendo — runtime/votes.ts) e as
// configurações. Lê o schema antigo por SQL cru: é uma ferramenta de migração única, não uma
// dependência entre plugins. Idempotente: se a competição "erasto-league" já existe, não repete.

const SLUG = "erasto-league";

type Row = Record<string, unknown>;

async function rows(tx: Tx | typeof db, query: ReturnType<typeof sql>): Promise<Row[]> {
  const result = await tx.execute(query);
  return (result as unknown as { rows: Row[] }).rows;
}

const str = (value: unknown): string | null => (typeof value === "string" && value.length > 0 ? value : null);
const num = (value: unknown): number => (typeof value === "number" ? value : Number(value) || 0);
const date = (value: unknown): Date | null => (value instanceof Date ? value : typeof value === "string" ? new Date(value) : null);
const dateText = (value: unknown): string | null => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return typeof value === "string" && value ? value.slice(0, 10) : null;
};

async function legacyAvailable(): Promise<boolean> {
  const [row] = await rows(db, sql`select to_regclass('erasto_league.teams') is not null as present`);
  return row?.present === true;
}

export async function getErastoMigrationStatus(): Promise<{ available: boolean; alreadyMigrated: boolean; counts: Record<string, number> }> {
  const available = await legacyAvailable();
  const [existing] = await db.select({ id: competitions.id }).from(competitions).where(eq(competitions.slug, SLUG));
  if (!available) return { available, alreadyMigrated: Boolean(existing), counts: {} };
  const [counts] = await rows(
    db,
    sql`select
      (select count(*)::int from erasto_league.teams) as equipes,
      (select count(*)::int from erasto_league.players) as atletas,
      (select count(*)::int from erasto_league.matches) as partidas,
      (select count(*)::int from erasto_league.fixtures) as confrontos,
      (select count(*)::int from erasto_league.match_events) as lances,
      (select count(*)::int from erasto_league.match_fan_votes) as votos_jogo,
      (select count(*)::int from erasto_league.favorite_team_votes) as votos_favorito`,
  );
  return { available, alreadyMigrated: Boolean(existing), counts: Object.fromEntries(Object.entries(counts ?? {}).map(([key, value]) => [key, num(value)])) };
}

async function legacySetting(key: string): Promise<unknown> {
  const result = await getSetting({ key: `erasto-league.${key}`, skipCache: true });
  return result.success && result.data ? result.data.value : undefined;
}

const PHASE_ROUND: Record<string, number> = { quarterfinal: 1, semifinal: 2, final: 3 };
const PHASE_LABEL: Record<string, string> = { quarterfinal: "Quartas de final", semifinal: "Semifinal", final: "Final" };

export async function migrateFromErastoLeague(): Promise<OperationResult<{ competitionId: string; counts: Record<string, number> }>> {
  if (!(await legacyAvailable())) return fail("games.migrate.unavailable", "Não há dados do Erasto League neste banco.");
  const [existing] = await db.select({ id: competitions.id }).from(competitions).where(eq(competitions.slug, SLUG));
  if (existing) return fail("games.migrate.already_done", "A migração já foi feita (existe a competição erasto-league).");

  const [periodMinutes, periodCount, logoMediaId, favoriteOpen] = await Promise.all([
    legacySetting("periodMinutes"),
    legacySetting("periodCount"),
    legacySetting("logoMediaId"),
    legacySetting("favoriteTeamVotingOpen"),
  ]);

  const counts: Record<string, number> = {};
  const competitionId = await db.transaction(async (tx) => {
    const [teamRows, playerRows, matchRows, fixtureRows, eventRows, boostRows, catalogRows, matchVoteRows, favoriteVoteRows, stateRows] = await Promise.all([
      rows(tx, sql`select * from erasto_league.teams order by name`),
      rows(tx, sql`select * from erasto_league.players`),
      rows(tx, sql`select * from erasto_league.matches`),
      rows(tx, sql`select * from erasto_league.fixtures order by sort_order, scheduled_date nulls last, scheduled_time nulls last`),
      rows(tx, sql`select * from erasto_league.match_events`),
      rows(tx, sql`select * from erasto_league.match_boosts`),
      rows(tx, sql`select * from erasto_league.power_boosts`),
      rows(tx, sql`select * from erasto_league.match_fan_votes`),
      rows(tx, sql`select * from erasto_league.favorite_team_votes`),
      rows(tx, sql`select * from erasto_league.match_state`),
    ]);

    const [competition] = await tx
      .insert(competitions)
      .values({ slug: SLUG, name: "Erasto League", logoMediaId: str(logoMediaId), overallEnabled: false })
      .returning({ id: competitions.id });
    const competitionId = competition.id;
    await tx.insert(liveChannels).values({ competitionId, key: "principal", name: "Principal" });

    const rules = {
      ...defaultModalityRules("futsal"),
      periodMinutes: num(periodMinutes) || 10,
      periodCount: num(periodCount) || 2,
      allowHalfPoints: true,
      // Ordem do Erasto League: pontos → saldo → vitórias → nome.
      tiebreakers: ["goal_diff", "wins", "name"],
    };
    const [modality] = await tx
      .insert(modalities)
      .values({ competitionId, slug: "futsal", name: "Futsal", emoji: "⚽", sportProfile: "futsal", rules, status: "in_progress" })
      .returning({ id: modalities.id });

    // Equipes e atletas com os mesmos ids/slugs.
    if (teamRows.length > 0) {
      await tx.insert(participants).values(
        teamRows.map((team, index) => ({
          id: String(team.id),
          competitionId,
          slug: String(team.slug),
          name: String(team.name),
          crestMediaId: str(team.crest_media_id),
          primaryColor: str(team.primary_color),
          secondaryColor: str(team.secondary_color),
          description: str(team.description),
          foundedDate: dateText(team.founded_date),
          sortOrder: index,
        })),
      );
      await tx.insert(modalityEntries).values(teamRows.map((team, index) => ({ modalityId: modality.id, participantId: String(team.id), seed: index + 1 })));
    }
    if (playerRows.length > 0) {
      await tx.insert(athletes).values(
        playerRows.map((player) => ({
          id: String(player.id),
          competitionId,
          participantId: String(player.team_id),
          slug: String(player.slug),
          name: String(player.name),
          number: player.number === null ? null : num(player.number),
          gender: str(player.gender),
          position: str(player.position),
          isCaptain: player.is_captain === true,
          photoMediaId: str(player.photo_media_id),
          bio: str(player.bio),
        })),
      );
    }
    counts.equipes = teamRows.length;
    counts.atletas = playerRows.length;

    // Fases a partir dos confrontos: grupos (pontos corridos) e mata-mata.
    const groupFixtures = fixtureRows.filter((fixture) => fixture.phase === "group");
    const knockoutFixtures = fixtureRows.filter((fixture) => fixture.phase !== "group");
    let groupStageId: string | null = null;
    const groupIdByName = new Map<string, string>();
    let stageIndex = 0;
    if (groupFixtures.length > 0) {
      const groupNames = [...new Set(groupFixtures.map((fixture) => str(fixture.group_name) ?? "A"))].sort();
      const [stage] = await tx
        .insert(stages)
        .values({ modalityId: modality.id, stageIndex: stageIndex++, type: "round_robin", name: "Fase de grupos", config: { groupCount: groupNames.length, doubleRound: false } })
        .returning({ id: stages.id });
      groupStageId = stage.id;
      for (const [index, name] of groupNames.entries()) {
        const [group] = await tx.insert(stageGroups).values({ stageId: stage.id, name, sortOrder: index }).returning({ id: stageGroups.id });
        groupIdByName.set(name, group.id);
        const members = new Set<string>();
        for (const fixture of groupFixtures.filter((f) => (str(f.group_name) ?? "A") === name)) {
          if (str(fixture.home_team_id)) members.add(String(fixture.home_team_id));
          if (str(fixture.away_team_id)) members.add(String(fixture.away_team_id));
        }
        if (members.size > 0) await tx.insert(stageGroupMembers).values([...members].map((participantId) => ({ groupId: group.id, participantId })));
      }
    }
    let knockoutStageId: string | null = null;
    if (knockoutFixtures.length > 0) {
      const firstRound = Math.min(...knockoutFixtures.map((fixture) => PHASE_ROUND[String(fixture.phase)] ?? 1));
      const firstRoundGames = knockoutFixtures.filter((fixture) => (PHASE_ROUND[String(fixture.phase)] ?? 1) === firstRound).length;
      const [stage] = await tx
        .insert(stages)
        .values({ modalityId: modality.id, stageIndex: stageIndex++, type: "knockout", name: "Mata-mata", config: { size: Math.max(2, firstRoundGames * 2), thirdPlace: false, seeds: [] } })
        .returning({ id: stages.id });
      knockoutStageId = stage.id;
    }

    // Jogos: confronto (+ partida vinculada) → um jogo. Id da partida preservado (URLs antigas).
    const matchById = new Map(matchRows.map((match) => [String(match.id), match]));
    const usedMatchIds = new Set<string>();
    const newMatchIds = new Map<string, string>(); // id antigo da partida → id novo (igual)
    let knockoutCounter = 0;
    const statusOf = (legacy: Row | undefined): "scheduled" | "live" | "finished" =>
      !legacy ? "scheduled" : legacy.status === "finished" ? "finished" : legacy.status === "in_progress" ? "live" : "scheduled";

    let insertedMatches = 0;
    const insertMatch = async (values: typeof matches.$inferInsert) => {
      await tx.insert(matches).values(values);
      insertedMatches += 1;
    };

    for (const [order, fixture] of fixtureRows.entries()) {
      const legacyMatchId = str(fixture.match_id);
      const legacy = legacyMatchId ? matchById.get(legacyMatchId) : undefined;
      if (legacy?.status === "cancelled") continue;
      const id = legacy ? String(legacy.id) : String(fixture.id);
      if (legacy) usedMatchIds.add(String(legacy.id));
      const isGroup = fixture.phase === "group";
      const home = str(fixture.home_team_id) ?? (legacy ? str(legacy.home_team_id) : null);
      const away = str(fixture.away_team_id) ?? (legacy ? str(legacy.away_team_id) : null);
      await insertMatch({
        id,
        competitionId,
        modalityId: modality.id,
        stageId: isGroup ? groupStageId : knockoutStageId,
        groupId: isGroup ? (groupIdByName.get(str(fixture.group_name) ?? "A") ?? null) : null,
        matchKey: isGroup ? null : `J${++knockoutCounter}`,
        roundLabel: str(fixture.round_label) ?? (isGroup ? null : PHASE_LABEL[String(fixture.phase)] ?? null),
        bracketRound: isGroup ? null : (PHASE_ROUND[String(fixture.phase)] ?? 1),
        homeParticipantId: home,
        awayParticipantId: away,
        homeSource: home ? ({ type: "participant", participantId: home } satisfies SlotSource) : null,
        awaySource: away ? ({ type: "participant", participantId: away } satisfies SlotSource) : null,
        homeLabel: str(fixture.home_label),
        awayLabel: str(fixture.away_label),
        slotsLocked: !isGroup,
        scheduledDate: dateText(fixture.scheduled_date),
        scheduledTime: str(fixture.scheduled_time),
        status: statusOf(legacy),
        homeScore: legacy ? num(legacy.home_score) : 0,
        awayScore: legacy ? num(legacy.away_score) : 0,
        mvpAthleteId: legacy ? str(legacy.mvp_player_id) : null,
        mvpNote: legacy ? str(legacy.mvp_note) : null,
        youtubeUrl: legacy ? str(legacy.youtube_url) : null,
        coverPhotoMediaId: legacy ? str(legacy.cover_media_id) : null,
        startedAt: legacy ? date(legacy.started_at) : null,
        finishedAt: legacy ? date(legacy.finished_at) : null,
        sortOrder: order,
      });
      if (legacy) newMatchIds.set(String(legacy.id), id);
    }
    // Partidas sem confronto (amistosos, jogos antes da tabela).
    for (const legacy of matchRows) {
      const id = String(legacy.id);
      if (usedMatchIds.has(id) || legacy.status === "cancelled") continue;
      await insertMatch({
        id,
        competitionId,
        modalityId: modality.id,
        roundLabel: str(legacy.label) ?? "Amistoso",
        homeParticipantId: String(legacy.home_team_id),
        awayParticipantId: String(legacy.away_team_id),
        homeSource: { type: "participant", participantId: String(legacy.home_team_id) },
        awaySource: { type: "participant", participantId: String(legacy.away_team_id) },
        status: statusOf(legacy),
        homeScore: num(legacy.home_score),
        awayScore: num(legacy.away_score),
        mvpAthleteId: str(legacy.mvp_player_id),
        mvpNote: str(legacy.mvp_note),
        youtubeUrl: str(legacy.youtube_url),
        coverPhotoMediaId: str(legacy.cover_media_id),
        startedAt: date(legacy.started_at),
        finishedAt: date(legacy.finished_at),
      });
      newMatchIds.set(id, id);
    }
    counts.jogos = insertedMatches;

    // Lances: gols com correção normalizada; cartões/faltas como estão.
    const eventsByMatch = new Map<string, Row[]>();
    for (const event of eventRows) {
      const matchId = newMatchIds.get(String(event.match_id));
      if (!matchId) continue;
      const list = eventsByMatch.get(matchId) ?? [];
      list.push(event);
      eventsByMatch.set(matchId, list);
    }
    let eventCount = 0;
    for (const [matchId, list] of eventsByMatch) {
      const goals = normalizeLegacyGoals(
        list
          .filter((event) => event.kind === "goal")
          .map((event) => ({ id: String(event.id), side: event.side === "away" ? "away" : "home", amount: num(event.amount), createdAt: date(event.created_at)?.getTime() ?? 0 })),
      );
      const keptGoals = new Map(goals.map((goal) => [goal.id, goal.amount]));
      const values = list
        .filter((event) => event.kind !== "goal" || keptGoals.has(String(event.id)))
        .map((event) => ({
          id: String(event.id),
          matchId,
          kind: String(event.kind),
          side: event.side === "away" ? "away" : "home",
          athleteId: str(event.player_id),
          amount: event.kind === "goal" ? (keptGoals.get(String(event.id)) ?? 1) : 1,
          clockMs: event.minute_ms === null ? null : num(event.minute_ms),
          createdAt: date(event.created_at) ?? new Date(),
        }));
      if (values.length > 0) await tx.insert(matchEvents).values(values);
      eventCount += values.length;
    }
    counts.lances = eventCount;

    // Power plays: catálogo + usos com rótulo copiado.
    const catalogByKey = new Map(catalogRows.map((boost) => [String(boost.key), boost]));
    if (catalogRows.length > 0) {
      await tx.insert(powerBoosts).values(
        catalogRows.map((boost, index) => ({ competitionId, label: String(boost.label), emoji: str(boost.emoji) ?? "⚡", description: str(boost.description), sortOrder: index })),
      );
    }
    const boostValues = boostRows
      .filter((boost) => newMatchIds.has(String(boost.match_id)))
      .map((boost) => {
        const catalog = catalogByKey.get(String(boost.boost_key));
        return {
          matchId: newMatchIds.get(String(boost.match_id))!,
          side: boost.side === "away" ? "away" : "home",
          label: catalog ? String(catalog.label) : String(boost.boost_key),
          emoji: catalog ? (str(catalog.emoji) ?? "⚡") : "⚡",
          clockMs: boost.minute_ms === null ? null : num(boost.minute_ms),
          createdAt: date(boost.created_at) ?? new Date(),
        };
      });
    if (boostValues.length > 0) await tx.insert(matchBoosts).values(boostValues);
    counts.power_plays = boostValues.length;

    // Partida em andamento continua ao vivo no canal principal.
    const current = stateRows[0];
    const liveId = current && str(current.current_match_id) ? newMatchIds.get(String(current.current_match_id)) : undefined;
    if (liveId) {
      await tx.insert(matchLive).values({
        matchId: liveId,
        clockRunning: current.clock_running === true,
        clockAnchorMs: current.clock_anchor_ms === null ? null : num(current.clock_anchor_ms),
        clockAccumulatedMs: num(current.clock_accumulated_ms),
        label: str(current.label) ?? "",
      });
      await tx.update(liveChannels).set({ currentMatchId: liveId }).where(eq(liveChannels.competitionId, competitionId));
    }

    // Votos da torcida (mesma identidade de aparelho).
    const pollByMatch = new Map<string, string>();
    for (const matchId of new Set(matchVoteRows.map((vote) => newMatchIds.get(String(vote.match_id))).filter((id): id is string => Boolean(id)))) {
      const [poll] = await tx.insert(votePolls).values({ competitionId, kind: "match_athlete", matchId, title: "Craque da torcida" }).returning({ id: votePolls.id });
      pollByMatch.set(matchId, poll.id);
    }
    // Todo jogo já iniciado tem votação (mesmo sem votos ainda).
    for (const [, matchId] of newMatchIds) {
      if (pollByMatch.has(matchId)) continue;
      const legacy = matchById.get(matchId);
      if (!legacy || legacy.status === "cancelled") continue;
      const [poll] = await tx.insert(votePolls).values({ competitionId, kind: "match_athlete", matchId, title: "Craque da torcida" }).returning({ id: votePolls.id });
      pollByMatch.set(matchId, poll.id);
    }
    const matchVotes = matchVoteRows
      .filter((vote) => pollByMatch.has(newMatchIds.get(String(vote.match_id)) ?? ""))
      .map((vote) => ({
        pollId: pollByMatch.get(newMatchIds.get(String(vote.match_id))!)!,
        choiceId: String(vote.player_id),
        voterKey: String(vote.voter_key),
        ipHash: str(vote.ip_hash),
        uaHash: str(vote.ua_hash),
        ticketNonce: str(vote.ticket_nonce) ?? `legacy-${String(vote.id)}`,
        voidedAt: date(vote.voided_at),
        createdAt: date(vote.created_at) ?? new Date(),
      }));
    for (let index = 0; index < matchVotes.length; index += 500) await tx.insert(votes).values(matchVotes.slice(index, index + 500));
    counts.votos_jogo = matchVotes.length;

    const [favoritePoll] = await tx
      .insert(votePolls)
      .values({ competitionId, kind: "participant", title: "Time favorito", openMode: favoriteOpen === false ? "closed" : "auto" })
      .returning({ id: votePolls.id });
    const favoriteVotes = favoriteVoteRows.map((vote) => ({
      pollId: favoritePoll.id,
      choiceId: String(vote.team_id),
      voterKey: String(vote.voter_key),
      ipHash: str(vote.ip_hash),
      uaHash: str(vote.ua_hash),
      ticketNonce: str(vote.ticket_nonce) ?? `legacy-${String(vote.id)}`,
      voidedAt: date(vote.voided_at),
      createdAt: date(vote.created_at) ?? new Date(),
      updatedAt: date(vote.updated_at) ?? new Date(),
    }));
    for (let index = 0; index < favoriteVotes.length; index += 500) await tx.insert(votes).values(favoriteVotes.slice(index, index + 500));
    counts.votos_favorito = favoriteVotes.length;

    await tx.execute(sql`
      insert into games.vote_tallies (poll_id, choice_id, count)
      select v.poll_id, v.choice_id, count(*)::int from games.votes v
      join games.vote_polls p on p.id = v.poll_id
      where p.competition_id = ${competitionId} and v.voided_at is null
      group by v.poll_id, v.choice_id
    `);

    // Status das fases a partir dos jogos migrados.
    await resolveModalitySlots(tx, modality.id);
    return competitionId;
  });

  // Configurações (fora da transação: o setSetting do host tem a própria escrita).
  const copy = async (legacyKey: string, key: string) => {
    const value = await legacySetting(legacyKey);
    if (value !== undefined && value !== null && value !== "") await setSetting({ key, value });
  };
  await Promise.all([
    copy("accentColor", GAMES_SETTINGS.accentColor.key),
    copy("youtubeChannelId", GAMES_SETTINGS.youtubeChannelId.key),
    copy("goalFlashSeconds", GAMES_SETTINGS.goalFlashSeconds.key),
    copy("fanVoteWindowHours", GAMES_SETTINGS.fanVoteWindowHours.key),
    copy("voteWaitBaseSeconds", GAMES_SETTINGS.voteWaitBaseSeconds.key),
    copy("voteWaitStepSeconds", GAMES_SETTINGS.voteWaitStepSeconds.key),
    copy("voteWaitMaxSeconds", GAMES_SETTINGS.voteWaitMaxSeconds.key),
    copy("voteMaxPerNetwork", GAMES_SETTINGS.voteMaxPerNetwork.key),
  ]);
  await setSetting({ key: GAMES_SETTINGS.activeCompetitionId.key, value: competitionId });

  return ok({ competitionId, counts });
}
