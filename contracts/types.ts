import type { SportProfileKey } from "../shared/sport-profiles";
import type { SlotSource, StageType } from "../shared/tournament";
import type { ModalityRules } from "../shared/modality-rules";

// Tipos de leitura (views) — o formato que blocos, páginas, TV e overlay consomem. Montados pelo
// snapshot (runtime/snapshot.ts), nunca direto do banco nas telas.

export type MatchSide = "home" | "away";
export type MatchStatus = "scheduled" | "live" | "finished" | "cancelled";
export type ModalityStatus = "setup" | "in_progress" | "finished";
export type StageStatus = "pending" | "in_progress" | "finished";

export const MATCH_STATUSES: MatchStatus[] = ["scheduled", "live", "finished", "cancelled"];

export type CompetitionView = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoMediaId: string | null;
  logoUrl: string | null;
  overallEnabled: boolean;
  pointsTable: number[];
  overallIncludesPartial: boolean;
};

export type ParticipantView = {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  crestMediaId: string | null;
  crestUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  description: string | null;
  foundedDate: string | null;
  sortOrder: number;
};

export type AthleteView = {
  id: string;
  slug: string;
  participantId: string;
  name: string;
  number: number | null;
  gender: string | null;
  position: string | null;
  isCaptain: boolean;
  photoMediaId: string | null;
  photoUrl: string | null;
  bio: string | null;
};

export type StageGroupView = { id: string; name: string; participantIds: string[] };

export type StageResultView = { participantId: string; value: number | null; judgeScores: number[] | null; note: string | null };

export type StageView = {
  id: string;
  index: number;
  type: StageType;
  name: string;
  config: Record<string, unknown>;
  status: StageStatus;
  groups: StageGroupView[];
  results: StageResultView[];
};

export type ModalityView = {
  id: string;
  slug: string;
  name: string;
  emoji: string | null;
  description: string | null;
  coverMediaId: string | null;
  coverUrl: string | null;
  sportProfile: SportProfileKey;
  rules: ModalityRules;
  weight: number;
  pointsTable: number[] | null;
  status: ModalityStatus;
  sortOrder: number;
  entries: { participantId: string; seed: number }[];
  stages: StageView[];
  // Colocação congelada pelo admin ao finalizar (vazio = calcular).
  frozenPlacements: { participantId: string; position: number }[];
};

export type MatchView = {
  id: string;
  modalityId: string;
  stageId: string | null;
  groupId: string | null;
  matchKey: string | null;
  roundNumber: number | null;
  roundLabel: string | null;
  bracketRound: number | null;
  bracketPosition: number | null;
  isThirdPlace: boolean;
  homeId: string | null;
  awayId: string | null;
  homeLabel: string | null;
  awayLabel: string | null;
  homeSource: SlotSource | null;
  awaySource: SlotSource | null;
  slotsLocked: boolean;
  scheduledDate: string | null;
  scheduledTime: string | null;
  venue: string | null;
  status: MatchStatus;
  homeScore: number;
  awayScore: number;
  sets: { home: number; away: number }[] | null;
  decidedWinnerId: string | null;
  resultNote: string | null;
  mvpAthleteId: string | null;
  mvpNote: string | null;
  youtubeUrl: string | null;
  coverPhotoMediaId: string | null;
  coverImageUrl: string | null;
  storyImageUrl: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  sortOrder: number;
};

export type MatchEventView = {
  id: string;
  matchId: string;
  kind: string;
  side: MatchSide;
  athleteId: string | null;
  amount: number;
  clockMs: number | null;
  period: number | null;
  createdAt: string;
};

export type MatchBoostView = { id: string; matchId: string; side: MatchSide; label: string; emoji: string; clockMs: number | null };

export type PowerBoostView = { id: string; label: string; emoji: string; description: string | null; sortOrder: number };

export type ScoreAdjustmentView = { id: string; participantId: string; modalityId: string | null; points: number; reason: string; createdAt: string };

export type PollKind = "match_athlete" | "participant";
export type PollOpenMode = "auto" | "open" | "closed";

export type PollView = {
  id: string;
  kind: PollKind;
  matchId: string | null;
  title: string;
  openMode: PollOpenMode;
};

export type PollTallies = { pollId: string; counts: Record<string, number>; total: number };

export type LiveChannelView = { id: string; key: string; name: string; currentMatchId: string | null; teaser: string | null };

export type CompetitionSnapshot = {
  version: number;
  loadedAt: number;
  competition: CompetitionView;
  participants: ParticipantView[];
  athletes: AthleteView[];
  modalities: ModalityView[];
  matches: MatchView[];
  events: MatchEventView[];
  boosts: MatchBoostView[];
  boostCatalog: PowerBoostView[];
  adjustments: ScoreAdjustmentView[];
  polls: PollView[];
  channels: LiveChannelView[];
};

// ---- Ao vivo (fora do snapshot: muda a cada segundo) ----

export type LiveClock = { running: boolean; anchorMs: number | null; accumulatedMs: number };

export type LiveSideState = {
  participantId: string | null;
  name: string;
  shortName: string | null;
  crestUrl: string | null;
  color: string | null;
  score: number;
  sets: number;
};

export type LiveMarker = { id: string; side: MatchSide; label: string; emoji: string; athleteName: string | null; kind: string };

export type LiveMatchState = {
  channelKey: string;
  channelName: string;
  teaser: string | null;
  // null = canal ocioso.
  matchId: string | null;
  modalityName: string | null;
  sportProfile: SportProfileKey | null;
  stageLabel: string | null;
  status: MatchStatus | null;
  home: LiveSideState | null;
  away: LiveSideState | null;
  currentSet: { home: number; away: number } | null;
  clock: LiveClock;
  period: number;
  periodMs: number;
  periodCount: number;
  label: string;
  markers: LiveMarker[];
  // Último lance que pontuou (overlay mostra o destaque por alguns segundos).
  lastScore: { side: MatchSide; athleteName: string | null; occurredAt: number; label: string } | null;
  version: number;
  serverNow: number;
};
