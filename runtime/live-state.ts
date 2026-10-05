import { and, eq } from "drizzle-orm";
import { liveChannels, matchLive } from "../database/schema";
import type { CompetitionSnapshot, LiveMatchState, LiveSideState, MatchView } from "../contracts/types";
import { getSportProfile } from "../shared/sport-profiles";
import { indexes } from "../shared/derive";
import { db } from "./db";
import { getCompetitionSnapshot } from "./snapshot";

// Estado de um canal ao vivo = snapshot (nomes, placar, lances — sobem a versão do snapshot) +
// match_live (relógio/etiqueta — só sobem a versão do canal). Montado uma vez por versão de canal
// por processo (runtime/live-feed.ts), nunca por conexão.

type ChannelRow = typeof liveChannels.$inferSelect;

export async function readChannel(competitionId: string, key: string | null): Promise<ChannelRow | null> {
  const rows = await db.select().from(liveChannels).where(eq(liveChannels.competitionId, competitionId));
  if (rows.length === 0) return null;
  if (key) return rows.find((row) => row.key === key) ?? null;
  return rows.find((row) => row.key === "principal") ?? rows.sort((a, b) => a.key.localeCompare(b.key))[0];
}

function side(snapshot: CompetitionSnapshot, match: MatchView, which: "home" | "away"): LiveSideState {
  const id = which === "home" ? match.homeId : match.awayId;
  const participant = id ? indexes(snapshot).participants.get(id) : undefined;
  const sets = match.sets ?? [];
  return {
    participantId: id,
    name: participant?.name ?? (which === "home" ? match.homeLabel : match.awayLabel) ?? "A definir",
    shortName: participant?.shortName ?? null,
    crestUrl: participant?.crestUrl ?? null,
    color: participant?.primaryColor ?? null,
    score: which === "home" ? match.homeScore : match.awayScore,
    sets: sets.length > 0 ? (which === "home" ? match.homeScore : match.awayScore) : 0,
  };
}

export async function buildLiveState(competitionId: string, channel: ChannelRow): Promise<LiveMatchState> {
  const snapshot = await getCompetitionSnapshot(competitionId);
  const now = Date.now();
  const idle: LiveMatchState = {
    channelKey: channel.key,
    channelName: channel.name,
    teaser: channel.teaser,
    matchId: null,
    modalityName: null,
    sportProfile: null,
    stageLabel: null,
    status: null,
    home: null,
    away: null,
    currentSet: null,
    clock: { running: false, anchorMs: null, accumulatedMs: 0 },
    period: 1,
    periodMs: 0,
    periodCount: 0,
    label: "",
    markers: [],
    lastScore: null,
    version: channel.version,
    serverNow: now,
  };
  if (!snapshot || !channel.currentMatchId) return idle;
  const index = indexes(snapshot);
  const match = index.matches.get(channel.currentMatchId);
  if (!match) return idle;
  const modality = index.modalities.get(match.modalityId);
  const profile = getSportProfile(modality?.sportProfile ?? "pontos");
  const [live] = await db.select().from(matchLive).where(and(eq(matchLive.matchId, match.id)));

  const events = index.eventsByMatch.get(match.id) ?? [];
  const athleteName = (id: string | null) => (id ? (index.athletes.get(id)?.name ?? null) : null);
  const markerKinds = new Map(profile.eventKinds.filter((kind) => kind.showOnOverlay).map((kind) => [kind.key, kind]));
  const markers = [
    ...events
      .filter((event) => markerKinds.has(event.kind))
      .map((event) => ({
        id: event.id,
        side: event.side,
        kind: event.kind,
        label: markerKinds.get(event.kind)!.label,
        emoji: markerKinds.get(event.kind)!.emoji,
        athleteName: athleteName(event.athleteId),
      })),
    ...(index.boostsByMatch.get(match.id) ?? []).map((boost) => ({ id: boost.id, side: boost.side, kind: "boost", label: boost.label, emoji: boost.emoji, athleteName: null })),
  ];
  const scoringKinds = new Set(profile.eventKinds.filter((kind) => kind.scores).map((kind) => kind.key));
  const lastScoring = [...events].reverse().find((event) => scoringKinds.has(event.kind) && event.amount > 0);
  const sets = match.sets ?? [];

  return {
    ...idle,
    matchId: match.id,
    modalityName: modality?.name ?? null,
    sportProfile: profile.key,
    stageLabel: match.roundLabel,
    status: match.status,
    home: side(snapshot, match, "home"),
    away: side(snapshot, match, "away"),
    currentSet: profile.usesSets && sets.length > 0 ? sets[sets.length - 1] : null,
    clock: { running: live?.clockRunning ?? false, anchorMs: live?.clockAnchorMs ?? null, accumulatedMs: live?.clockAccumulatedMs ?? 0 },
    period: live?.period ?? 1,
    periodMs: (modality?.rules.periodMinutes ?? 0) * 60_000,
    periodCount: modality?.rules.periodCount ?? 0,
    label: live?.label ?? "",
    markers,
    lastScore: lastScoring
      ? { side: lastScoring.side, athleteName: athleteName(lastScoring.athleteId), occurredAt: Date.parse(lastScoring.createdAt), label: profile.eventKinds.find((k) => k.key === lastScoring.kind)?.label ?? "Ponto" }
      : null,
  };
}
