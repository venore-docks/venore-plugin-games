import { and, asc, eq, sql } from "drizzle-orm";
import { athletes, liveChannels, matchEvents, matchLive, matches, modalities, votePolls } from "../database/schema";
import { getSportProfile, isSportProfileKey, type SportProfile } from "../shared/sport-profiles";
import { resolveModalityRules, type ModalityRules } from "../shared/modality-rules";
import { computeScore } from "../shared/score";
import type { MatchSide } from "../contracts/types";
import type { Executor, Tx } from "./db";

// Peças compartilhadas pela escrita ao vivo (runtime/live.ts) e pela súmula (runtime/matches.ts).

export type MatchContext = {
  match: typeof matches.$inferSelect;
  modality: typeof modalities.$inferSelect;
  profile: SportProfile;
  rules: ModalityRules;
};

// FOR UPDATE: duas ações no mesmo jogo (dois operadores, aba antiga) serializam — o recálculo do
// placar nunca grava uma soma velha por último.
export async function loadMatchForUpdate(tx: Tx, matchId: string, competitionId: string): Promise<MatchContext | null> {
  const [match] = await tx
    .select()
    .from(matches)
    .where(and(eq(matches.id, matchId), eq(matches.competitionId, competitionId)))
    .for("update");
  if (!match) return null;
  const [modality] = await tx.select().from(modalities).where(eq(modalities.id, match.modalityId));
  if (!modality) return null;
  const profileKey = isSportProfileKey(modality.sportProfile) ? modality.sportProfile : "pontos";
  return { match, modality, profile: getSportProfile(profileKey), rules: resolveModalityRules(profileKey, modality.rules) };
}

export async function recalcMatchScore(tx: Tx, context: MatchContext): Promise<{ homeScore: number; awayScore: number }> {
  const events = await tx
    .select({ side: matchEvents.side, kind: matchEvents.kind, amount: matchEvents.amount })
    .from(matchEvents)
    .where(eq(matchEvents.matchId, context.match.id))
    .orderBy(asc(matchEvents.createdAt), asc(matchEvents.id));
  const score = computeScore(
    events.map((event) => ({ side: event.side as MatchSide, kind: event.kind, amount: event.amount })),
    context.profile,
    context.rules,
  );
  await tx
    .update(matches)
    .set({ homeScore: score.homeScore, awayScore: score.awayScore, sets: score.sets, updatedAt: new Date() })
    .where(eq(matches.id, context.match.id));
  context.match.homeScore = score.homeScore;
  context.match.awayScore = score.awayScore;
  return score;
}

// Canais que mostram este jogo recebem nova versão — o poller do SSE (runtime/live-feed.ts) só
// olha live_channels.version.
export async function bumpChannelsForMatch(executor: Executor, matchId: string): Promise<void> {
  await executor
    .update(liveChannels)
    .set({ version: sql`${liveChannels.version} + 1`, updatedAt: new Date() })
    .where(eq(liveChannels.currentMatchId, matchId));
}

export async function bumpMatchLive(executor: Executor, matchId: string): Promise<void> {
  await executor
    .update(matchLive)
    .set({ version: sql`${matchLive.version} + 1`, updatedAt: new Date() })
    .where(eq(matchLive.matchId, matchId));
  await bumpChannelsForMatch(executor, matchId);
}

// Atleta precisa ser da equipe daquele lado do jogo.
export async function athleteBelongsToSide(executor: Executor, match: MatchContext["match"], side: MatchSide, athleteId: string): Promise<boolean> {
  const participantId = side === "home" ? match.homeParticipantId : match.awayParticipantId;
  if (!participantId) return false;
  const [row] = await executor
    .select({ id: athletes.id })
    .from(athletes)
    .where(and(eq(athletes.id, athleteId), eq(athletes.participantId, participantId)));
  return Boolean(row);
}

// Votação de craque da torcida do jogo — criada no apito inicial (ou ao encerrar súmula manual).
export async function ensureMatchPoll(tx: Tx, match: MatchContext["match"], title: string): Promise<void> {
  await tx
    .insert(votePolls)
    .values({ competitionId: match.competitionId, kind: "match_athlete", matchId: match.id, title })
    .onConflictDoNothing({ target: votePolls.matchId });
}

export function isMatchSide(value: unknown): value is MatchSide {
  return value === "home" || value === "away";
}
