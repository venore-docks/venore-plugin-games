import { cache } from "react";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { getCache, setCache } from "@venore/plugin-sdk";
import { getMediaAssetUrls } from "@venore/plugin-sdk/media";
import { getSetting } from "@venore/plugin-sdk/settings";
import {
  athletes,
  competitions,
  liveChannels,
  matchBoosts,
  matchEvents,
  matches,
  modalities,
  modalityEntries,
  modalityPlacements,
  participants,
  powerBoosts,
  scoreAdjustments,
  stageGroupMembers,
  stageGroups,
  stageResults,
  stages,
  votePolls,
} from "../database/schema";
import type {
  CompetitionSnapshot,
  MatchSide,
  MatchStatus,
  ModalityStatus,
  PollKind,
  PollOpenMode,
  StageStatus,
} from "../contracts/types";
import { getSportProfile, isSportProfileKey } from "../shared/sport-profiles";
import { resolveModalityRules } from "../shared/modality-rules";
import { isStageType } from "../shared/tournament";
import { isUuid } from "../shared/ids";
import { GAMES_SETTINGS } from "../shared/settings";
import { db } from "./db";

// Leitura pública = SNAPSHOT da competição inteira, recarregado só quando competitions.data_version
// muda (toda escrita do plugin sobe a versão na mesma transação — runtime/db.ts bumpDataVersion).
// Custo por visita: 1 SELECT da versão. Recarga: ~15 SELECTs em lote + 2 chamadas de mídia em
// lote, independente de quantas equipes/jogos/imagens existam. Todos os blocos de uma página leem
// o mesmo objeto (cache() do React por request). O cache é por processo (getCache do SDK);
// instâncias diferentes convergem pela versão, sem invalidação explícita.

const SNAPSHOT_TTL_SECONDS = 60 * 60;
// Largura de exibição de brasão/foto: a maior em que aparecem no site (perfil 96px; densidade 2x
// do host → variante de ~200px). Imagens geradas (capa/story) vão pela URL original.
const DISPLAY_IMAGE_WIDTH = 96;

type CachedSnapshot = { version: number; snapshot: CompetitionSnapshot };

type SnapshotGlobal = typeof globalThis & { __gamesSnapshotLoads?: Map<string, Promise<CompetitionSnapshot>> };

function inflight(): Map<string, Promise<CompetitionSnapshot>> {
  const g = globalThis as SnapshotGlobal;
  if (!g.__gamesSnapshotLoads) g.__gamesSnapshotLoads = new Map();
  return g.__gamesSnapshotLoads;
}

const ACTIVE_ID_CACHE_KEY = "games:active-competition-id";

// Competição mostrada no site: setting (cache do host com invalidação entre instâncias) ou, sem
// setting válido, a mais recente.
export async function resolveActiveCompetitionId(): Promise<string | null> {
  const setting = await getSetting({ key: GAMES_SETTINGS.activeCompetitionId.key });
  const configured = setting.success && setting.data ? setting.data.value : null;
  if (isUuid(configured)) return configured;

  const cached = getCache<string>(ACTIVE_ID_CACHE_KEY);
  if (cached) return cached;
  const [row] = await db.select({ id: competitions.id }).from(competitions).orderBy(desc(competitions.createdAt)).limit(1);
  if (row) setCache(ACTIVE_ID_CACHE_KEY, row.id, 30);
  return row?.id ?? null;
}

export async function readCompetitionVersion(competitionId: string): Promise<number | null> {
  const [row] = await db.select({ version: competitions.dataVersion }).from(competitions).where(eq(competitions.id, competitionId));
  return row ? Number(row.version) : null;
}

export async function getCompetitionSnapshot(competitionId: string): Promise<CompetitionSnapshot | null> {
  if (!isUuid(competitionId)) return null;
  const version = await readCompetitionVersion(competitionId);
  if (version === null) return null;

  const key = `games:snapshot:${competitionId}`;
  const cached = getCache<CachedSnapshot>(key);
  if (cached && cached.version === version) return cached.snapshot;

  // Uma recarga por processo por versão, mesmo com várias visitas chegando juntas.
  const loadKey = `${competitionId}:${version}`;
  const loads = inflight();
  let promise = loads.get(loadKey);
  if (!promise) {
    promise = loadSnapshot(competitionId, version).finally(() => loads.delete(loadKey));
    loads.set(loadKey, promise);
  }
  const snapshot = await promise;
  setCache(key, { version, snapshot } satisfies CachedSnapshot, SNAPSHOT_TTL_SECONDS);
  return snapshot;
}

// Por request: breadcrumb, metadata e todos os blocos da página compartilham a mesma chamada.
export const getActiveSnapshot = cache(async (): Promise<CompetitionSnapshot | null> => {
  const id = await resolveActiveCompetitionId();
  return id ? getCompetitionSnapshot(id) : null;
});

export const getSnapshotById = cache((competitionId: string) => getCompetitionSnapshot(competitionId));

async function resolveUrls(ids: (string | null | undefined)[], displayWidth?: number): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => typeof id === "string" && id.length > 0))];
  if (unique.length === 0) return {};
  const result = await getMediaAssetUrls({ ids: unique, displayWidth });
  return result.success ? result.data : {};
}

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

async function loadSnapshot(competitionId: string, version: number): Promise<CompetitionSnapshot> {
  const [competitionRow] = await db.select().from(competitions).where(eq(competitions.id, competitionId));
  if (!competitionRow) throw new Error(`Competição ${competitionId} sumiu durante a carga do snapshot.`);

  const [
    participantRows,
    athleteRows,
    modalityRows,
    matchRows,
    boostCatalogRows,
    adjustmentRows,
    pollRows,
    channelRows,
  ] = await Promise.all([
    db.select().from(participants).where(eq(participants.competitionId, competitionId)).orderBy(asc(participants.sortOrder), asc(participants.name)),
    db.select().from(athletes).where(eq(athletes.competitionId, competitionId)).orderBy(asc(athletes.name)),
    db.select().from(modalities).where(eq(modalities.competitionId, competitionId)).orderBy(asc(modalities.sortOrder), asc(modalities.name)),
    db.select().from(matches).where(eq(matches.competitionId, competitionId)),
    db.select().from(powerBoosts).where(eq(powerBoosts.competitionId, competitionId)).orderBy(asc(powerBoosts.sortOrder), asc(powerBoosts.label)),
    db.select().from(scoreAdjustments).where(eq(scoreAdjustments.competitionId, competitionId)).orderBy(desc(scoreAdjustments.createdAt)),
    db.select().from(votePolls).where(eq(votePolls.competitionId, competitionId)),
    db.select().from(liveChannels).where(eq(liveChannels.competitionId, competitionId)).orderBy(asc(liveChannels.key)),
  ]);

  const modalityIds = modalityRows.map((row) => row.id);
  const matchIds = matchRows.map((row) => row.id);

  const [entryRows, placementRows, stageRows, eventRows, boostRows] = await Promise.all([
    modalityIds.length ? db.select().from(modalityEntries).where(inArray(modalityEntries.modalityId, modalityIds)) : Promise.resolve([]),
    modalityIds.length ? db.select().from(modalityPlacements).where(inArray(modalityPlacements.modalityId, modalityIds)) : Promise.resolve([]),
    modalityIds.length ? db.select().from(stages).where(inArray(stages.modalityId, modalityIds)).orderBy(asc(stages.stageIndex)) : Promise.resolve([]),
    matchIds.length ? db.select().from(matchEvents).where(inArray(matchEvents.matchId, matchIds)).orderBy(asc(matchEvents.createdAt)) : Promise.resolve([]),
    matchIds.length ? db.select().from(matchBoosts).where(inArray(matchBoosts.matchId, matchIds)).orderBy(asc(matchBoosts.createdAt)) : Promise.resolve([]),
  ]);

  const stageIds = stageRows.map((row) => row.id);
  const [groupRows, resultRows] = await Promise.all([
    stageIds.length ? db.select().from(stageGroups).where(inArray(stageGroups.stageId, stageIds)).orderBy(asc(stageGroups.sortOrder), asc(stageGroups.name)) : Promise.resolve([]),
    stageIds.length ? db.select().from(stageResults).where(inArray(stageResults.stageId, stageIds)) : Promise.resolve([]),
  ]);
  const groupIds = groupRows.map((row) => row.id);
  const memberRows = groupIds.length ? await db.select().from(stageGroupMembers).where(inArray(stageGroupMembers.groupId, groupIds)) : [];

  const [smallUrls, fullUrls] = await Promise.all([
    resolveUrls([...participantRows.map((row) => row.crestMediaId), ...athleteRows.map((row) => row.photoMediaId), competitionRow.logoMediaId], DISPLAY_IMAGE_WIDTH),
    resolveUrls([...matchRows.flatMap((row) => [row.coverImageMediaId, row.storyImageMediaId]), ...modalityRows.map((row) => row.coverMediaId)]),
  ]);
  const small = (id: string | null) => (id ? (smallUrls[id] ?? null) : null);
  const full = (id: string | null) => (id ? (fullUrls[id] ?? null) : null);

  const membersByGroup = new Map<string, string[]>();
  for (const member of memberRows) {
    const list = membersByGroup.get(member.groupId) ?? [];
    list.push(member.participantId);
    membersByGroup.set(member.groupId, list);
  }

  return {
    version,
    loadedAt: Date.now(),
    competition: {
      id: competitionRow.id,
      slug: competitionRow.slug,
      name: competitionRow.name,
      description: competitionRow.description,
      logoMediaId: competitionRow.logoMediaId,
      logoUrl: small(competitionRow.logoMediaId),
      overallEnabled: competitionRow.overallEnabled,
      pointsTable: Array.isArray(competitionRow.pointsTable) ? competitionRow.pointsTable : [],
      overallIncludesPartial: competitionRow.overallIncludesPartial,
    },
    participants: participantRows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      shortName: row.shortName,
      crestMediaId: row.crestMediaId,
      crestUrl: small(row.crestMediaId),
      primaryColor: row.primaryColor,
      secondaryColor: row.secondaryColor,
      description: row.description,
      foundedDate: row.foundedDate,
      sortOrder: row.sortOrder,
    })),
    athletes: athleteRows.map((row) => ({
      id: row.id,
      slug: row.slug,
      participantId: row.participantId,
      name: row.name,
      number: row.number,
      gender: row.gender,
      position: row.position,
      isCaptain: row.isCaptain,
      photoMediaId: row.photoMediaId,
      photoUrl: small(row.photoMediaId),
      bio: row.bio,
    })),
    modalities: modalityRows.map((row) => {
      const profileKey = isSportProfileKey(row.sportProfile) ? row.sportProfile : getSportProfile(row.sportProfile).key;
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        emoji: row.emoji,
        description: row.description,
        coverMediaId: row.coverMediaId,
        coverUrl: full(row.coverMediaId),
        sportProfile: profileKey,
        rules: resolveModalityRules(profileKey, row.rules),
        weight: row.weight,
        pointsTable: Array.isArray(row.pointsTable) && row.pointsTable.length > 0 ? row.pointsTable : null,
        status: row.status as ModalityStatus,
        sortOrder: row.sortOrder,
        entries: entryRows
          .filter((entry) => entry.modalityId === row.id)
          .sort((a, b) => a.seed - b.seed)
          .map((entry) => ({ participantId: entry.participantId, seed: entry.seed })),
        stages: stageRows
          .filter((stage) => stage.modalityId === row.id && isStageType(stage.type))
          .map((stage) => ({
            id: stage.id,
            index: stage.stageIndex,
            type: stage.type as CompetitionSnapshot["modalities"][number]["stages"][number]["type"],
            name: stage.name,
            config: stage.config ?? {},
            status: stage.status as StageStatus,
            groups: groupRows
              .filter((group) => group.stageId === stage.id)
              .map((group) => ({ id: group.id, name: group.name, participantIds: membersByGroup.get(group.id) ?? [] })),
            results: resultRows
              .filter((result) => result.stageId === stage.id)
              .map((result) => ({ participantId: result.participantId, value: result.value, judgeScores: result.judgeScores ?? null, note: result.note })),
          })),
        frozenPlacements: placementRows
          .filter((placement) => placement.modalityId === row.id)
          .sort((a, b) => a.position - b.position)
          .map((placement) => ({ participantId: placement.participantId, position: placement.position })),
      };
    }),
    matches: matchRows.map((row) => ({
      id: row.id,
      modalityId: row.modalityId,
      stageId: row.stageId,
      groupId: row.groupId,
      matchKey: row.matchKey,
      roundNumber: row.roundNumber,
      roundLabel: row.roundLabel,
      bracketRound: row.bracketRound,
      bracketPosition: row.bracketPosition,
      isThirdPlace: row.isThirdPlace,
      homeId: row.homeParticipantId,
      awayId: row.awayParticipantId,
      homeLabel: row.homeLabel,
      awayLabel: row.awayLabel,
      homeSource: row.homeSource ?? null,
      awaySource: row.awaySource ?? null,
      slotsLocked: row.slotsLocked,
      scheduledDate: row.scheduledDate,
      scheduledTime: row.scheduledTime ? row.scheduledTime.slice(0, 5) : null,
      venue: row.venue,
      status: row.status as MatchStatus,
      homeScore: row.homeScore,
      awayScore: row.awayScore,
      sets: row.sets ?? null,
      decidedWinnerId: row.decidedWinnerId,
      resultNote: row.resultNote,
      mvpAthleteId: row.mvpAthleteId,
      mvpNote: row.mvpNote,
      youtubeUrl: row.youtubeUrl,
      coverPhotoMediaId: row.coverPhotoMediaId,
      coverImageUrl: full(row.coverImageMediaId),
      storyImageUrl: full(row.storyImageMediaId),
      startedAt: iso(row.startedAt),
      finishedAt: iso(row.finishedAt),
      sortOrder: row.sortOrder,
    })),
    events: eventRows.map((row) => ({
      id: row.id,
      matchId: row.matchId,
      kind: row.kind,
      side: row.side as MatchSide,
      athleteId: row.athleteId,
      amount: row.amount,
      clockMs: row.clockMs,
      period: row.period,
      createdAt: row.createdAt.toISOString(),
    })),
    boosts: boostRows.map((row) => ({ id: row.id, matchId: row.matchId, side: row.side as MatchSide, label: row.label, emoji: row.emoji, clockMs: row.clockMs })),
    boostCatalog: boostCatalogRows.map((row) => ({ id: row.id, label: row.label, emoji: row.emoji, description: row.description, sortOrder: row.sortOrder })),
    adjustments: adjustmentRows.map((row) => ({
      id: row.id,
      participantId: row.participantId,
      modalityId: row.modalityId,
      points: row.points,
      reason: row.reason,
      createdAt: row.createdAt.toISOString(),
    })),
    // Contagens NÃO entram aqui: voto não sobe a versão (senão cada voto recarregaria o snapshot
    // inteiro no pico da votação). Parcial vem de runtime/vote-tallies.ts, com cache curto.
    polls: pollRows.map((row) => ({ id: row.id, kind: row.kind as PollKind, matchId: row.matchId, title: row.title, openMode: row.openMode as PollOpenMode })),
    channels: channelRows.map((row) => ({ id: row.id, key: row.key, name: row.name, currentMatchId: row.currentMatchId, teaser: row.teaser })),
  };
}
