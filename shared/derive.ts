import type {
  AthleteView,
  CompetitionSnapshot,
  MatchEventView,
  MatchView,
  ModalityView,
  ParticipantView,
  StageView,
} from "../contracts/types";
import { getSportProfile } from "./sport-profiles";
import { computeStandings, rankAcrossGroups, type StandingRow } from "./standings";
import { matchWinner } from "./slot-resolution";
import {
  computeOverall,
  placementsFromEventResults,
  placementsFromKnockout,
  placementsFromStandings,
  type OverallRow,
  type Placement,
} from "./placement";
import { fixtureEpoch } from "./timezone";

// Derivações puras sobre o snapshot (classificação, colocação, quadro geral, artilharia, agenda).
// Memoizadas por snapshot (WeakMap): o snapshot é imutável e compartilhado entre requests até a
// versão mudar, então cada cálculo roda uma vez por versão por processo.

const memo = new WeakMap<CompetitionSnapshot, Map<string, unknown>>();

function remember<T>(snapshot: CompetitionSnapshot, key: string, compute: () => T): T {
  let store = memo.get(snapshot);
  if (!store) {
    store = new Map();
    memo.set(snapshot, store);
  }
  if (store.has(key)) return store.get(key) as T;
  const value = compute();
  store.set(key, value);
  return value;
}

export function indexes(snapshot: CompetitionSnapshot) {
  return remember(snapshot, "indexes", () => ({
    participants: new Map(snapshot.participants.map((p) => [p.id, p])),
    participantsBySlug: new Map(snapshot.participants.map((p) => [p.slug, p])),
    athletes: new Map(snapshot.athletes.map((a) => [a.id, a])),
    athletesBySlug: new Map(snapshot.athletes.map((a) => [a.slug, a])),
    modalities: new Map(snapshot.modalities.map((m) => [m.id, m])),
    modalitiesBySlug: new Map(snapshot.modalities.map((m) => [m.slug, m])),
    matches: new Map(snapshot.matches.map((m) => [m.id, m])),
    eventsByMatch: groupBy(snapshot.events, (e) => e.matchId),
    boostsByMatch: groupBy(snapshot.boosts, (b) => b.matchId),
    athletesByParticipant: groupBy(snapshot.athletes, (a) => a.participantId),
  }));
}

function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return map;
}

// ---- Ordem cronológica ----

export function compareMatchesChronologically(a: MatchView, b: MatchView): number {
  const ea = fixtureEpoch(a.scheduledDate, a.scheduledTime);
  const eb = fixtureEpoch(b.scheduledDate, b.scheduledTime);
  if (ea !== eb) return (ea ?? Number.MAX_SAFE_INTEGER) - (eb ?? Number.MAX_SAFE_INTEGER);
  return a.sortOrder - b.sortOrder || (a.matchKey ?? "").localeCompare(b.matchKey ?? "") || a.id.localeCompare(b.id);
}

export function matchesOf(snapshot: CompetitionSnapshot, modalityId?: string): MatchView[] {
  return remember(snapshot, `matches:${modalityId ?? "*"}`, () =>
    snapshot.matches.filter((match) => match.status !== "cancelled" && (!modalityId || match.modalityId === modalityId)).sort(compareMatchesChronologically),
  );
}

export function liveMatches(snapshot: CompetitionSnapshot): MatchView[] {
  return matchesOf(snapshot).filter((match) => match.status === "live");
}

// Próximos jogos ainda não disputados. Jogo agendado cujo horário passou há mais de 3h sem
// resultado sai da lista (esquecido/remarcado) — mesma folga do plugin antigo.
const STALE_AFTER_MS = 3 * 60 * 60 * 1000;

export function upcomingMatches(snapshot: CompetitionSnapshot, now: number, modalityId?: string): MatchView[] {
  return matchesOf(snapshot, modalityId).filter((match) => {
    if (match.status !== "scheduled") return false;
    const epoch = fixtureEpoch(match.scheduledDate, match.scheduledTime);
    return epoch === null || epoch + STALE_AFTER_MS > now;
  });
}

export function finishedMatches(snapshot: CompetitionSnapshot, modalityId?: string): MatchView[] {
  return remember(snapshot, `finished:${modalityId ?? "*"}`, () =>
    snapshot.matches
      .filter((match) => match.status === "finished" && (!modalityId || match.modalityId === modalityId))
      .sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? "") || compareMatchesChronologically(b, a)),
  );
}

// ---- Classificação ----

function cardsFor(snapshot: CompetitionSnapshot, matchIds: Set<string>) {
  const cards = new Map<string, { participantId: string; yellow: number; red: number }>();
  const { matches } = indexes(snapshot);
  for (const event of snapshot.events) {
    if (!matchIds.has(event.matchId)) continue;
    if (event.kind !== "yellow_card" && event.kind !== "red_card") continue;
    const match = matches.get(event.matchId);
    const participantId = event.side === "home" ? match?.homeId : match?.awayId;
    if (!participantId) continue;
    const row = cards.get(participantId) ?? { participantId, yellow: 0, red: 0 };
    if (event.kind === "yellow_card") row.yellow += 1;
    else row.red += 1;
    cards.set(participantId, row);
  }
  return [...cards.values()];
}

export type GroupStandings = { groupId: string; groupName: string; rows: StandingRow[]; matches: MatchView[]; complete: boolean };

export function stageStandings(snapshot: CompetitionSnapshot, modality: ModalityView, stage: StageView): GroupStandings[] {
  return remember(snapshot, `standings:${stage.id}`, () => {
    const { participants } = indexes(snapshot);
    const stageMatches = snapshot.matches.filter((match) => match.stageId === stage.id && match.status !== "cancelled");
    return stage.groups.map((group) => {
      const groupMatches = stageMatches.filter((match) => match.groupId === group.id);
      const finished = groupMatches.filter((match) => match.status === "finished" && match.homeId && match.awayId);
      const members = group.participantIds
        .map((id) => participants.get(id))
        .filter((p): p is ParticipantView => Boolean(p))
        .map((p) => ({ id: p.id, name: p.name }));
      const rows = computeStandings(
        members,
        finished.map((match) => ({ homeId: match.homeId!, awayId: match.awayId!, homeScore: match.homeScore, awayScore: match.awayScore })),
        modality.rules,
        cardsFor(snapshot, new Set(finished.map((match) => match.id))),
      );
      return {
        groupId: group.id,
        groupName: group.name,
        rows,
        matches: groupMatches.sort(compareMatchesChronologically),
        complete: groupMatches.length > 0 && groupMatches.every((match) => match.status === "finished"),
      };
    });
  });
}

// ---- Colocação final da modalidade ----

export function modalityPlacements(snapshot: CompetitionSnapshot, modality: ModalityView): Placement[] {
  if (modality.frozenPlacements.length > 0) return modality.frozenPlacements;
  return remember(snapshot, `placements:${modality.id}`, () => computeModalityPlacements(snapshot, modality));
}

function computeModalityPlacements(snapshot: CompetitionSnapshot, modality: ModalityView): Placement[] {
  const stagesDesc = [...modality.stages].sort((a, b) => b.index - a.index);
  const placements: Placement[] = [];
  const placed = new Set<string>();

  for (const stage of stagesDesc) {
    let stagePlacements: Placement[] = [];
    if (stage.type === "single_event") {
      const value = (result: StageView["results"][number]) =>
        result.value ?? (result.judgeScores && result.judgeScores.length > 0 ? result.judgeScores.reduce((sum, v) => sum + v, 0) / result.judgeScores.length : null);
      const lowerIsBetter = modality.rules.lowerIsBetter || getSportProfile(modality.sportProfile).eventResult?.kind === "placement";
      stagePlacements = placementsFromEventResults(stage.results.map((result) => ({ participantId: result.participantId, value: value(result) })), lowerIsBetter);
    } else if (stage.type === "knockout") {
      const stageMatches = snapshot.matches.filter((match) => match.stageId === stage.id && match.status !== "cancelled");
      stagePlacements = placementsFromKnockout(
        stageMatches.map((match) => ({
          key: match.matchKey ?? match.id,
          round: match.bracketRound ?? 1,
          isThirdPlace: match.isThirdPlace,
          homeId: match.homeId,
          awayId: match.awayId,
          winnerId: match.status === "finished" ? matchWinner({ ...match, decidedWinnerId: match.decidedWinnerId }).winnerId : null,
        })),
      );
    } else {
      const groups = stageStandings(snapshot, modality, stage);
      stagePlacements =
        groups.length === 1 ? placementsFromStandings(groups[0].rows) : rankAcrossGroups(groups.map((g) => g.rows)).map((row, index) => ({ participantId: row.participantId, position: index + 1 }));
    }

    // Fases mais avançadas mandam; quem caiu antes entra depois, na ordem da fase anterior
    // (empate dentro da fase continua dividindo a posição).
    const remaining = stagePlacements.filter((placement) => !placed.has(placement.participantId));
    const offset = placements.length;
    remaining.forEach((placement, index) => {
      const tiedWithPrevious = index > 0 && remaining[index - 1].position === placement.position;
      const position = tiedWithPrevious ? placements[placements.length - 1].position : offset + index + 1;
      placements.push({ participantId: placement.participantId, position });
      placed.add(placement.participantId);
    });
  }
  return placements;
}

// Modalidade tem resultado final? (todas as fases encerradas ou admin congelou.)
export function isModalityComplete(snapshot: CompetitionSnapshot, modality: ModalityView): boolean {
  if (modality.status === "finished" || modality.frozenPlacements.length > 0) return true;
  if (modality.stages.length === 0) return false;
  return modality.stages.every((stage) => stage.status === "finished");
}

// ---- Quadro geral ----

export function overallTable(snapshot: CompetitionSnapshot): OverallRow[] {
  return remember(snapshot, "overall", () =>
    computeOverall(
      snapshot.participants.map((p) => ({ id: p.id, name: p.name })),
      snapshot.modalities
        .filter((modality) => snapshot.competition.overallIncludesPartial || isModalityComplete(snapshot, modality))
        .map((modality) => ({
          modalityId: modality.id,
          weight: modality.weight,
          pointsTable: modality.pointsTable,
          placements: isModalityComplete(snapshot, modality) || snapshot.competition.overallIncludesPartial ? modalityPlacements(snapshot, modality) : [],
        })),
      snapshot.competition.pointsTable,
      snapshot.adjustments.map((adjustment) => ({ participantId: adjustment.participantId, points: adjustment.points, modalityId: adjustment.modalityId })),
    ),
  );
}

// ---- Estatísticas de atletas ----

export type AthleteRankingRow = { athlete: AthleteView; participant: ParticipantView | null; value: number };

export function scoringEvents(snapshot: CompetitionSnapshot, modalityId?: string): MatchEventView[] {
  const { matches, modalities } = indexes(snapshot);
  return snapshot.events.filter((event) => {
    const match = matches.get(event.matchId);
    if (!match || match.status === "cancelled") return false;
    if (modalityId && match.modalityId !== modalityId) return false;
    const modality = modalities.get(match.modalityId);
    const profile = getSportProfile(modality?.sportProfile ?? "pontos");
    return profile.eventKinds.some((kind) => kind.key === event.kind && kind.scores) && event.amount > 0;
  });
}

export function topScorers(snapshot: CompetitionSnapshot, modalityId?: string): AthleteRankingRow[] {
  return remember(snapshot, `scorers:${modalityId ?? "*"}`, () => {
    const totals = new Map<string, number>();
    for (const event of scoringEvents(snapshot, modalityId)) {
      if (!event.athleteId) continue;
      totals.set(event.athleteId, (totals.get(event.athleteId) ?? 0) + event.amount);
    }
    return rankingRows(snapshot, totals);
  });
}

export function topMvps(snapshot: CompetitionSnapshot, modalityId?: string): AthleteRankingRow[] {
  return remember(snapshot, `mvps:${modalityId ?? "*"}`, () => {
    const totals = new Map<string, number>();
    for (const match of snapshot.matches) {
      if (match.status !== "finished" || !match.mvpAthleteId) continue;
      if (modalityId && match.modalityId !== modalityId) continue;
      totals.set(match.mvpAthleteId, (totals.get(match.mvpAthleteId) ?? 0) + 1);
    }
    return rankingRows(snapshot, totals);
  });
}

function rankingRows(snapshot: CompetitionSnapshot, totals: Map<string, number>): AthleteRankingRow[] {
  const { athletes, participants } = indexes(snapshot);
  return [...totals.entries()]
    .map(([athleteId, value]) => {
      const athlete = athletes.get(athleteId);
      return athlete ? { athlete, participant: participants.get(athlete.participantId) ?? null, value } : null;
    })
    .filter((row): row is AthleteRankingRow => row !== null && row.value > 0)
    .sort((a, b) => b.value - a.value || a.athlete.name.localeCompare(b.athlete.name, "pt-BR"));
}

export type ParticipantRecord = { played: number; won: number; drawn: number; lost: number; scored: number; conceded: number; yellow: number; red: number };

// Recorde da equipe em jogos (todas as modalidades de placar, ou uma).
export function participantRecord(snapshot: CompetitionSnapshot, participantId: string, modalityId?: string): ParticipantRecord {
  return remember(snapshot, `record:${participantId}:${modalityId ?? "*"}`, () => {
    const record: ParticipantRecord = { played: 0, won: 0, drawn: 0, lost: 0, scored: 0, conceded: 0, yellow: 0, red: 0 };
    const finished = finishedMatches(snapshot, modalityId).filter((match) => match.homeId === participantId || match.awayId === participantId);
    for (const match of finished) {
      const isHome = match.homeId === participantId;
      const own = isHome ? match.homeScore : match.awayScore;
      const other = isHome ? match.awayScore : match.homeScore;
      record.played += 1;
      record.scored += own;
      record.conceded += other;
      const { winnerId } = matchWinner({ ...match });
      if (winnerId === participantId) record.won += 1;
      else if (winnerId) record.lost += 1;
      else record.drawn += 1;
    }
    const { eventsByMatch } = indexes(snapshot);
    for (const match of finished) {
      const side = match.homeId === participantId ? "home" : "away";
      for (const event of eventsByMatch.get(match.id) ?? []) {
        if (event.side !== side) continue;
        if (event.kind === "yellow_card") record.yellow += 1;
        if (event.kind === "red_card") record.red += 1;
      }
    }
    return record;
  });
}

export function participantName(snapshot: CompetitionSnapshot, participantId: string | null, fallback: string | null = null): string {
  if (!participantId) return fallback ?? "A definir";
  return indexes(snapshot).participants.get(participantId)?.name ?? fallback ?? "A definir";
}
