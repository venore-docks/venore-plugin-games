import { cache } from "react";
import { isPluginActive } from "@venore/plugin-sdk";
import type { CompetitionSnapshot, LiveMatchState, MatchView, PollView } from "../contracts/types";
import { getActiveSnapshot } from "../runtime/snapshot";
import { getPollTallies, pollWindowFromSnapshot, readVoteWindowHours, resolveFanAwards } from "../runtime/votes";
import { getTurnstileSiteKey } from "../runtime/turnstile";
import { resolveRequestOrigin } from "../runtime/request-origin";
import { indexes } from "../shared/derive";
import { getSportProfile } from "../shared/sport-profiles";
import type { PollWindow } from "../shared/votes";
import { liveChannelKeyFor, matchContext, sideInfo } from "./lib/match-info";

// Leitura das páginas públicas e blocos: SEMPRE o snapshot da competição ativa (runtime/snapshot.ts)
// + derivações puras. cache() do React: página, metadata, breadcrumb e todos os blocos de um mesmo
// request dividem as mesmas chamadas (inclusive a checagem do plugin ativo).

export const loadSiteSnapshot = cache(async (): Promise<CompetitionSnapshot | null> => {
  if (!(await isPluginActive("games"))) return null;
  return getActiveSnapshot();
});

// "Agora" único por request: todos os blocos decidem "próximo jogo"/"votação aberta" com o mesmo
// relógio (sem um bloco dizer aberta e outro encerrada no mesmo render).
export const requestNow = cache((): number => Date.now());

export const loadOrigin = cache(() => resolveRequestOrigin());

export const loadVoteWindowHours = cache(() => readVoteWindowHours());

export const loadTurnstileSiteKey = cache((): string | null => getTurnstileSiteKey());

// Craque(s) da torcida por jogo (votações encerradas de vez). Parciais vêm do cache curto de
// runtime/votes.ts, nunca COUNT(*) por visita.
export const loadFanAwards = cache(async (): Promise<Map<string, string[]>> => {
  const snapshot = await loadSiteSnapshot();
  if (!snapshot) return new Map();
  return resolveFanAwards(snapshot, await loadVoteWindowHours(), requestNow());
});

export type PollState = { poll: PollView; window: PollWindow };

export async function pollStates(snapshot: CompetitionSnapshot): Promise<PollState[]> {
  const windowHours = await loadVoteWindowHours();
  const now = requestNow();
  return snapshot.polls.map((poll) => ({ poll, window: pollWindowFromSnapshot(snapshot, poll, windowHours, now) }));
}

export function matchPoll(snapshot: CompetitionSnapshot, matchId: string): PollView | null {
  return snapshot.polls.find((poll) => poll.kind === "match_athlete" && poll.matchId === matchId) ?? null;
}

export function favoritePoll(snapshot: CompetitionSnapshot): PollView | null {
  return snapshot.polls.find((poll) => poll.kind === "participant") ?? null;
}

export async function loadTallies(pollIds: string[], closedIds: string[] = []) {
  if (pollIds.length === 0) return new Map<string, { pollId: string; counts: Record<string, number>; total: number }>();
  return getPollTallies(pollIds, new Set(closedIds));
}

// Estado inicial do placar ao vivo montado do snapshot (sem consulta): o island do cliente busca o
// estado real (relógio, etiqueta) no primeiro poll, logo ao montar.
export function initialLiveState(snapshot: CompetitionSnapshot, match: MatchView, channelKey: string): LiveMatchState {
  const { modality, stageLabel } = matchContext(snapshot, match);
  const channel = snapshot.channels.find((item) => item.key === channelKey);
  const profile = getSportProfile(modality?.sportProfile ?? "pontos");
  const side = (which: "home" | "away") => {
    const info = sideInfo(snapshot, match, which);
    const score = which === "home" ? match.homeScore : match.awayScore;
    return {
      participantId: info.participant?.id ?? null,
      name: info.name,
      shortName: info.participant?.shortName ?? null,
      crestUrl: info.crestUrl,
      color: info.color,
      score,
      sets: profile.usesSets ? score : 0,
    };
  };
  const sets = match.sets ?? [];
  return {
    channelKey,
    channelName: channel?.name ?? channelKey,
    teaser: channel?.teaser ?? null,
    matchId: match.id,
    modalityName: modality?.name ?? null,
    sportProfile: profile.key,
    stageLabel,
    status: match.status,
    home: side("home"),
    away: side("away"),
    currentSet: profile.usesSets && sets.length > 0 ? sets[sets.length - 1] : null,
    clock: { running: false, anchorMs: null, accumulatedMs: 0 },
    period: 1,
    periodMs: (modality?.rules.periodMinutes ?? 0) * 60_000,
    periodCount: modality?.rules.periodCount ?? 0,
    label: "",
    markers: [],
    lastScore: null,
    version: 0,
    serverNow: requestNow(),
  };
}

export function liveIslandFor(snapshot: CompetitionSnapshot, match: MatchView): { channelKey: string; initial: LiveMatchState } | null {
  if (match.status !== "live") return null;
  const channelKey = liveChannelKeyFor(snapshot, match.id);
  return channelKey ? { channelKey, initial: initialLiveState(snapshot, match, channelKey) } : null;
}

export function athleteName(snapshot: CompetitionSnapshot, athleteId: string | null): string | null {
  return athleteId ? (indexes(snapshot).athletes.get(athleteId)?.name ?? null) : null;
}

// Slug vem da URL: só serve pra procurar no índice do snapshot (nunca vai pro banco), então basta
// limitar o tamanho.
export function isSlugParam(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 200;
}
