import type { AthleteView, CompetitionSnapshot, MatchEventView, MatchView, ModalityView, ParticipantView } from "../../../contracts/types";
import { resolveModalityRules } from "../../../shared/modality-rules";

// Snapshot mínimo pros testes das telas ao vivo: futsal com um grupo de 3 equipes, um jogo
// encerrado (2×1, com gols atribuídos e craque), um ao vivo e um agendado.

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const IDS = {
  competition: uuid(1),
  modality: uuid(2),
  stage: uuid(3),
  group: uuid(4),
  teams: [uuid(10), uuid(11), uuid(12)],
  athletes: [uuid(20), uuid(21), uuid(22)],
  matches: { finished: uuid(30), live: uuid(31), scheduled: uuid(32) },
  polls: { finished: uuid(40), live: uuid(41), favorite: uuid(42) },
};

function participant(index: number): ParticipantView {
  return {
    id: IDS.teams[index],
    slug: `turma-${index}`,
    name: `Turma ${index + 1}`,
    shortName: index === 0 ? "T1" : null,
    crestMediaId: null,
    crestUrl: null,
    primaryColor: "#22c55e",
    secondaryColor: null,
    description: null,
    foundedDate: null,
    sortOrder: index,
  };
}

function athlete(index: number, team: number): AthleteView {
  return { id: IDS.athletes[index], slug: `atleta-${index}`, participantId: IDS.teams[team], name: `Atleta ${index + 1}`, number: index + 1, gender: null, position: null, isCaptain: false, photoMediaId: null, photoUrl: null, bio: null };
}

function match(id: string, home: number, away: number, overrides: Partial<MatchView>): MatchView {
  return {
    id,
    modalityId: IDS.modality,
    stageId: IDS.stage,
    groupId: IDS.group,
    matchKey: null,
    roundNumber: 1,
    roundLabel: "1ª rodada",
    bracketRound: null,
    bracketPosition: null,
    isThirdPlace: false,
    homeId: IDS.teams[home],
    awayId: IDS.teams[away],
    homeLabel: null,
    awayLabel: null,
    homeSource: null,
    awaySource: null,
    slotsLocked: false,
    scheduledDate: "2026-10-10",
    scheduledTime: "10:00",
    venue: "Quadra 1",
    status: "scheduled",
    homeScore: 0,
    awayScore: 0,
    sets: null,
    decidedWinnerId: null,
    resultNote: null,
    mvpAthleteId: null,
    mvpNote: null,
    youtubeUrl: null,
    coverPhotoMediaId: null,
    coverImageUrl: null,
    storyImageUrl: null,
    startedAt: null,
    finishedAt: null,
    sortOrder: 0,
    ...overrides,
  };
}

function goal(id: number, matchId: string, side: "home" | "away", athleteId: string | null): MatchEventView {
  return { id: uuid(id), matchId, kind: "goal", side, athleteId, amount: 1, clockMs: 60_000, period: 1, createdAt: new Date(id * 1000).toISOString() };
}

export function buildFixtureSnapshot(): CompetitionSnapshot {
  const modality: ModalityView = {
    id: IDS.modality,
    slug: "futsal",
    name: "Futsal",
    emoji: "⚽",
    description: null,
    coverMediaId: null,
    coverUrl: null,
    sportProfile: "futsal",
    rules: resolveModalityRules("futsal", {}),
    weight: 1,
    pointsTable: null,
    status: "in_progress",
    sortOrder: 0,
    entries: IDS.teams.map((participantId, seed) => ({ participantId, seed })),
    stages: [
      {
        id: IDS.stage,
        index: 0,
        type: "round_robin",
        name: "Fase de grupos",
        config: {},
        status: "in_progress",
        groups: [{ id: IDS.group, name: "Grupo A", participantIds: [...IDS.teams] }],
        results: [],
      },
    ],
    frozenPlacements: [],
  };
  return {
    version: 7,
    loadedAt: 0,
    competition: { id: IDS.competition, slug: "jogos", name: "Jogos 2026", description: null, logoMediaId: null, logoUrl: null, overallEnabled: true, pointsTable: [100, 80, 65], overallIncludesPartial: true },
    participants: [participant(0), participant(1), participant(2)],
    athletes: [athlete(0, 0), athlete(1, 0), athlete(2, 1)],
    modalities: [modality],
    matches: [
      match(IDS.matches.finished, 0, 1, {
        status: "finished",
        homeScore: 2,
        awayScore: 1,
        mvpAthleteId: IDS.athletes[0],
        startedAt: "2026-10-05T13:00:00.000Z",
        finishedAt: "2026-10-05T13:30:00.000Z",
        scheduledDate: "2026-10-05",
      }),
      match(IDS.matches.live, 1, 2, { status: "live", startedAt: "2026-10-06T13:00:00.000Z", scheduledDate: "2026-10-06", sortOrder: 1 }),
      match(IDS.matches.scheduled, 2, 0, { sortOrder: 2 }),
    ],
    events: [
      goal(100, IDS.matches.finished, "home", IDS.athletes[0]),
      goal(101, IDS.matches.finished, "home", IDS.athletes[0]),
      goal(102, IDS.matches.finished, "away", IDS.athletes[2]),
    ],
    boosts: [],
    boostCatalog: [],
    adjustments: [],
    polls: [
      { id: IDS.polls.finished, kind: "match_athlete", matchId: IDS.matches.finished, title: "Turma 1 × Turma 2", openMode: "auto" },
      { id: IDS.polls.live, kind: "match_athlete", matchId: IDS.matches.live, title: "Turma 2 × Turma 3", openMode: "auto" },
      { id: IDS.polls.favorite, kind: "participant", matchId: null, title: "Equipe favorita", openMode: "open" },
    ],
    channels: [{ id: uuid(50), key: "principal", name: "Principal", currentMatchId: IDS.matches.live, teaser: null }],
  };
}
