import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { liveChannels, matchBoosts, matchEvents, matchLive, matches, modalities, participants, powerBoosts, stages } from "../database/schema";
import type { MatchSide } from "../contracts/types";
import { applyClockCommand, type ClockCommand } from "../shared/clock";
import { allowedScoreAmounts } from "../shared/score";
import { getSportProfile } from "../shared/sport-profiles";
import { matchWinner } from "../shared/slot-resolution";
import { bumpDataVersion, db } from "./db";
import { resolveModalitySlots } from "./modalities";
import {
  athleteBelongsToSide,
  bumpChannelsForMatch,
  bumpMatchLive,
  ensureMatchPoll,
  loadMatchForUpdate,
  recalcMatchScore,
  type MatchContext,
} from "./match-core";
import { fail, ok, type OperationResult } from "./result";

// Escrita do jogo AO VIVO (controle pelo celular). Toda ação: transação + lock do jogo, valida
// tudo no servidor (lado, tipo de lance, valor do ponto, atleta do lado certo) e sobe a versão do
// canal; ações que mudam placar/lances sobem também a versão do snapshot.

const LABEL_MAX = 24;
const TEASER_MAX = 80;

async function liveContext(competitionId: string, matchId: string, fn: (context: MatchContext, tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<OperationResult<void>>) {
  return db.transaction(async (tx) => {
    const context = await loadMatchForUpdate(tx, matchId, competitionId);
    if (!context) return fail<void>("games.match.not_found", "Jogo não encontrado.");
    if (context.match.status !== "live") return fail<void>("games.match.not_live", "Este jogo não está em andamento.");
    return fn(context, tx);
  });
}

// ---- Início / fim ----

export type StartMatchInput = { channelId: string; matchId: string; force: boolean };

export async function startMatchOnChannel(competitionId: string, input: StartMatchInput): Promise<OperationResult<void>> {
  return db.transaction(async (tx) => {
    const [channel] = await tx
      .select()
      .from(liveChannels)
      .where(and(eq(liveChannels.id, input.channelId), eq(liveChannels.competitionId, competitionId)))
      .for("update");
    if (!channel) return fail<void>("games.channel.not_found", "Canal não encontrado.");

    const context = await loadMatchForUpdate(tx, input.matchId, competitionId);
    if (!context) return fail<void>("games.match.not_found", "Jogo não encontrado.");
    if (getSportProfile(context.modality.sportProfile).shape !== "match") return fail<void>("games.match.not_playable", "Prova única não tem jogo ao vivo.");
    if (!context.match.homeParticipantId || !context.match.awayParticipantId) {
      return fail<void>("games.match.sides_missing", "O jogo ainda não tem as duas equipes definidas.");
    }
    if (context.match.status === "finished" || context.match.status === "cancelled") {
      return fail<void>("games.match.already_played", "Este jogo já foi encerrado.");
    }

    // Canal ocupado por outro jogo em andamento: só com confirmação explícita (no plugin antigo,
    // uma aba velha iniciava outra partida e a anterior ficava órfã "em andamento").
    if (channel.currentMatchId && channel.currentMatchId !== input.matchId) {
      const [current] = await tx.select({ status: matches.status }).from(matches).where(eq(matches.id, channel.currentMatchId));
      if (current?.status === "live" && !input.force) {
        return fail<void>("games.channel.busy", "Já existe um jogo em andamento neste canal. Encerre-o ou confirme a troca.");
      }
    }

    if (context.match.status === "scheduled") {
      await tx.update(matches).set({ status: "live", startedAt: new Date(), updatedAt: new Date() }).where(eq(matches.id, input.matchId));
      await tx.insert(matchLive).values({ matchId: input.matchId }).onConflictDoNothing();
      const [home, away] = await Promise.all([
        tx.select({ name: participants.name }).from(participants).where(eq(participants.id, context.match.homeParticipantId)),
        tx.select({ name: participants.name }).from(participants).where(eq(participants.id, context.match.awayParticipantId)),
      ]);
      await ensureMatchPoll(tx, context.match, `${home[0]?.name ?? "Casa"} × ${away[0]?.name ?? "Visitante"}`);
      await resolveModalitySlots(tx, context.modality.id);
    }
    await tx.update(liveChannels).set({ currentMatchId: input.matchId, teaser: null, updatedAt: new Date() }).where(eq(liveChannels.id, channel.id));
    await bumpChannelsForMatch(tx, input.matchId);
    await bumpDataVersion(tx, competitionId);
    return ok(undefined);
  });
}

// Jogo rápido (recreio): cria um jogo avulso na modalidade e já inicia.
export async function startQuickMatch(
  competitionId: string,
  input: { channelId: string; modalityId: string; homeParticipantId: string; awayParticipantId: string; force: boolean },
): Promise<OperationResult<{ matchId: string }>> {
  if (input.homeParticipantId === input.awayParticipantId) return fail("games.match.same_team", "Escolha duas equipes diferentes.");
  const [modality] = await db.select().from(modalities).where(and(eq(modalities.id, input.modalityId), eq(modalities.competitionId, competitionId)));
  if (!modality) return fail("games.modality.not_found", "Modalidade não encontrada.");
  const sides = await db
    .select({ id: participants.id })
    .from(participants)
    .where(and(eq(participants.competitionId, competitionId), inArray(participants.id, [input.homeParticipantId, input.awayParticipantId])));
  if (sides.length !== 2) return fail("games.match.sides_invalid", "Equipe inválida.");
  const [created] = await db
    .insert(matches)
    .values({ competitionId, modalityId: modality.id, homeParticipantId: input.homeParticipantId, awayParticipantId: input.awayParticipantId, roundLabel: "Amistoso" })
    .returning({ id: matches.id });
  const started = await startMatchOnChannel(competitionId, { channelId: input.channelId, matchId: created.id, force: input.force });
  if (!started.success) {
    await db.delete(matches).where(eq(matches.id, created.id));
    return started;
  }
  return ok({ matchId: created.id });
}

export async function finishLiveMatch(
  competitionId: string,
  input: { matchId: string; decidedWinnerId: string | null; mvpAthleteId: string | null },
): Promise<OperationResult<void>> {
  return liveContext(competitionId, input.matchId, async (context, tx) => {
    const { match, rules } = context;
    const [stage] = match.stageId ? await tx.select().from(stages).where(eq(stages.id, match.stageId)) : [];
    const needsWinner = stage?.type === "knockout" && rules.knockoutNeedsWinner;
    const decided = input.decidedWinnerId === match.homeParticipantId || input.decidedWinnerId === match.awayParticipantId ? input.decidedWinnerId : null;
    if (needsWinner && !matchWinner({ homeId: match.homeParticipantId, awayId: match.awayParticipantId, homeScore: match.homeScore, awayScore: match.awayScore, decidedWinnerId: decided }).winnerId) {
      return fail<void>("games.match.needs_winner", "Mata-mata empatado: escolha quem venceu nos pênaltis/desempate.");
    }
    if (input.mvpAthleteId) {
      const fromHome = await athleteBelongsToSide(tx, match, "home", input.mvpAthleteId);
      const fromAway = fromHome || (await athleteBelongsToSide(tx, match, "away", input.mvpAthleteId));
      if (!fromAway) return fail<void>("games.match.mvp_invalid", "O craque precisa ser de uma das duas equipes.");
    }
    const [live] = await tx.select().from(matchLive).where(eq(matchLive.matchId, match.id));
    if (live?.clockRunning) {
      const stopped = applyClockCommand({ running: true, anchorMs: live.clockAnchorMs, accumulatedMs: live.clockAccumulatedMs }, { kind: "pause" }, Date.now());
      await tx.update(matchLive).set({ clockRunning: false, clockAnchorMs: null, clockAccumulatedMs: stopped.accumulatedMs }).where(eq(matchLive.matchId, match.id));
    }
    await tx
      .update(matches)
      .set({ status: "finished", finishedAt: new Date(), decidedWinnerId: decided, mvpAthleteId: input.mvpAthleteId ?? match.mvpAthleteId, updatedAt: new Date() })
      .where(eq(matches.id, match.id));
    await resolveModalitySlots(tx, context.modality.id);
    await bumpMatchLive(tx, match.id);
    await bumpDataVersion(tx, competitionId);
    return ok(undefined);
  });
}

// "Comecei errado": volta o jogo a agendado, sem lances, placar zerado. Jogo avulso (sem fase) é
// apagado. Nunca conta na classificação.
export async function cancelLiveMatch(competitionId: string, matchId: string): Promise<OperationResult<void>> {
  return liveContext(competitionId, matchId, async (context, tx) => {
    await tx.delete(matchEvents).where(eq(matchEvents.matchId, matchId));
    await tx.delete(matchBoosts).where(eq(matchBoosts.matchId, matchId));
    await tx.delete(matchLive).where(eq(matchLive.matchId, matchId));
    await tx
      .update(liveChannels)
      .set({ currentMatchId: null, version: sql`${liveChannels.version} + 1`, updatedAt: new Date() })
      .where(eq(liveChannels.currentMatchId, matchId));
    if (!context.match.stageId) {
      await tx.delete(matches).where(eq(matches.id, matchId));
    } else {
      await tx
        .update(matches)
        .set({ status: "scheduled", homeScore: 0, awayScore: 0, sets: null, startedAt: null, decidedWinnerId: null, mvpAthleteId: null, updatedAt: new Date() })
        .where(eq(matches.id, matchId));
    }
    await resolveModalitySlots(tx, context.modality.id);
    await bumpDataVersion(tx, competitionId);
    return ok(undefined);
  });
}

export async function releaseChannel(competitionId: string, channelId: string): Promise<OperationResult<void>> {
  await db.transaction(async (tx) => {
    const [channel] = await tx.select().from(liveChannels).where(and(eq(liveChannels.id, channelId), eq(liveChannels.competitionId, competitionId))).for("update");
    if (!channel?.currentMatchId) return;
    const [current] = await tx.select({ status: matches.status }).from(matches).where(eq(matches.id, channel.currentMatchId));
    if (current?.status === "live") return;
    await tx.update(liveChannels).set({ currentMatchId: null, version: channel.version + 1, updatedAt: new Date() }).where(eq(liveChannels.id, channelId));
  });
  return ok(undefined);
}

export async function setChannelTeaser(competitionId: string, channelId: string, teaser: string | null): Promise<OperationResult<void>> {
  const text = teaser?.trim().slice(0, TEASER_MAX) || null;
  const [channel] = await db.select().from(liveChannels).where(and(eq(liveChannels.id, channelId), eq(liveChannels.competitionId, competitionId)));
  if (!channel) return fail("games.channel.not_found", "Canal não encontrado.");
  await db.update(liveChannels).set({ teaser: text, version: channel.version + 1, updatedAt: new Date() }).where(eq(liveChannels.id, channelId));
  return ok(undefined);
}

// ---- Placar ----

export async function addScore(
  competitionId: string,
  input: { matchId: string; side: MatchSide; amount: number; kind: string; athleteId: string | null },
): Promise<OperationResult<{ eventId: string }>> {
  let eventId = "";
  const result = await liveContext(competitionId, input.matchId, async (context, tx) => {
    const kindDef = context.profile.eventKinds.find((kind) => kind.key === input.kind && kind.scores);
    if (!kindDef) return fail<void>("games.event.kind_invalid", "Tipo de ponto inválido para esta modalidade.");
    if (!allowedScoreAmounts(context.profile, context.rules).includes(input.amount)) return fail<void>("games.event.amount_invalid", "Valor de ponto inválido.");
    if (input.athleteId && !(await athleteBelongsToSide(tx, context.match, input.side, input.athleteId))) {
      return fail<void>("games.event.athlete_invalid", "O atleta não é dessa equipe.");
    }
    const clockMs = await currentClockMs(tx, input.matchId);
    const [event] = await tx
      .insert(matchEvents)
      .values({ matchId: input.matchId, kind: input.kind, side: input.side, amount: input.amount, athleteId: input.athleteId, clockMs })
      .returning({ id: matchEvents.id });
    eventId = event.id;
    await recalcMatchScore(tx, context);
    await bumpMatchLive(tx, input.matchId);
    await bumpDataVersion(tx, competitionId);
    return ok(undefined);
  });
  return result.success ? ok({ eventId }) : result;
}

// Desfaz o último ponto daquele lado (apaga o lance), em vez de gravar um lance negativo.
export async function undoLastScore(competitionId: string, input: { matchId: string; side: MatchSide }): Promise<OperationResult<void>> {
  return liveContext(competitionId, input.matchId, async (context, tx) => {
    const scoringKinds = context.profile.eventKinds.filter((kind) => kind.scores).map((kind) => kind.key);
    if (scoringKinds.length === 0) return fail<void>("games.event.none", "Nada pra desfazer.");
    const [last] = await tx
      .select({ id: matchEvents.id })
      .from(matchEvents)
      .where(and(eq(matchEvents.matchId, input.matchId), eq(matchEvents.side, input.side), inArray(matchEvents.kind, scoringKinds)))
      .orderBy(desc(matchEvents.createdAt), desc(matchEvents.id))
      .limit(1);
    if (!last) return fail<void>("games.event.none", "Esse lado ainda não pontuou.");
    await tx.delete(matchEvents).where(eq(matchEvents.id, last.id));
    await recalcMatchScore(tx, context);
    await bumpMatchLive(tx, input.matchId);
    await bumpDataVersion(tx, competitionId);
    return ok(undefined);
  });
}

// Cartão, falta, 2 min… (lances que não pontuam).
export async function addMarkerEvent(
  competitionId: string,
  input: { matchId: string; side: MatchSide; kind: string; athleteId: string | null },
): Promise<OperationResult<{ eventId: string }>> {
  let eventId = "";
  const result = await liveContext(competitionId, input.matchId, async (context, tx) => {
    const kindDef = context.profile.eventKinds.find((kind) => kind.key === input.kind && !kind.scores);
    if (!kindDef) return fail<void>("games.event.kind_invalid", "Tipo de lance inválido para esta modalidade.");
    if (input.athleteId && !(await athleteBelongsToSide(tx, context.match, input.side, input.athleteId))) {
      return fail<void>("games.event.athlete_invalid", "O atleta não é dessa equipe.");
    }
    const clockMs = await currentClockMs(tx, input.matchId);
    const [event] = await tx
      .insert(matchEvents)
      .values({ matchId: input.matchId, kind: input.kind, side: input.side, amount: 1, athleteId: input.athleteId, clockMs })
      .returning({ id: matchEvents.id });
    eventId = event.id;
    await bumpMatchLive(tx, input.matchId);
    await bumpDataVersion(tx, competitionId);
    return ok(undefined);
  });
  return result.success ? ok({ eventId }) : result;
}

export async function attributeEvent(competitionId: string, input: { matchId: string; eventId: string; athleteId: string | null }): Promise<OperationResult<void>> {
  return liveContext(competitionId, input.matchId, async (context, tx) => {
    const [event] = await tx.select().from(matchEvents).where(and(eq(matchEvents.id, input.eventId), eq(matchEvents.matchId, input.matchId)));
    if (!event) return fail<void>("games.event.not_found", "Lance não encontrado.");
    if (input.athleteId && !(await athleteBelongsToSide(tx, context.match, event.side as MatchSide, input.athleteId))) {
      return fail<void>("games.event.athlete_invalid", "O atleta não é dessa equipe.");
    }
    await tx.update(matchEvents).set({ athleteId: input.athleteId }).where(eq(matchEvents.id, input.eventId));
    await bumpMatchLive(tx, input.matchId);
    await bumpDataVersion(tx, competitionId);
    return ok(undefined);
  });
}

export async function removeLiveEvent(competitionId: string, input: { matchId: string; eventId: string }): Promise<OperationResult<void>> {
  return liveContext(competitionId, input.matchId, async (context, tx) => {
    const deleted = await tx.delete(matchEvents).where(and(eq(matchEvents.id, input.eventId), eq(matchEvents.matchId, input.matchId))).returning({ id: matchEvents.id });
    if (deleted.length === 0) return fail<void>("games.event.not_found", "Lance não encontrado.");
    await recalcMatchScore(tx, context);
    await bumpMatchLive(tx, input.matchId);
    await bumpDataVersion(tx, competitionId);
    return ok(undefined);
  });
}

// ---- Power plays ----

export async function addBoost(competitionId: string, input: { matchId: string; side: MatchSide; boostId: string }): Promise<OperationResult<void>> {
  return liveContext(competitionId, input.matchId, async (_context, tx) => {
    const [boost] = await tx.select().from(powerBoosts).where(and(eq(powerBoosts.id, input.boostId), eq(powerBoosts.competitionId, competitionId)));
    if (!boost) return fail<void>("games.boost.not_found", "Power play não encontrado.");
    const clockMs = await currentClockMs(tx, input.matchId);
    await tx.insert(matchBoosts).values({ matchId: input.matchId, side: input.side, boostId: boost.id, label: boost.label, emoji: boost.emoji, clockMs });
    await bumpMatchLive(tx, input.matchId);
    await bumpDataVersion(tx, competitionId);
    return ok(undefined);
  });
}

export async function removeBoost(competitionId: string, input: { matchId: string; boostUseId: string }): Promise<OperationResult<void>> {
  return liveContext(competitionId, input.matchId, async (_context, tx) => {
    await tx.delete(matchBoosts).where(and(eq(matchBoosts.id, input.boostUseId), eq(matchBoosts.matchId, input.matchId)));
    await bumpMatchLive(tx, input.matchId);
    await bumpDataVersion(tx, competitionId);
    return ok(undefined);
  });
}

// ---- Relógio / etiqueta (só ao vivo — não sobem a versão do snapshot) ----

async function currentClockMs(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], matchId: string): Promise<number | null> {
  const [live] = await tx.select().from(matchLive).where(eq(matchLive.matchId, matchId));
  if (!live) return null;
  const now = Date.now();
  return live.clockRunning && live.clockAnchorMs !== null ? live.clockAccumulatedMs + (now - live.clockAnchorMs) : live.clockAccumulatedMs;
}

export async function commandClock(competitionId: string, input: { matchId: string; command: ClockCommand }): Promise<OperationResult<void>> {
  return liveContext(competitionId, input.matchId, async (_context, tx) => {
    const [live] = await tx.select().from(matchLive).where(eq(matchLive.matchId, input.matchId));
    const current = { running: live?.clockRunning ?? false, anchorMs: live?.clockAnchorMs ?? null, accumulatedMs: live?.clockAccumulatedMs ?? 0 };
    const next = applyClockCommand(current, input.command, Date.now());
    await tx
      .insert(matchLive)
      .values({ matchId: input.matchId, clockRunning: next.running, clockAnchorMs: next.anchorMs, clockAccumulatedMs: next.accumulatedMs })
      .onConflictDoUpdate({ target: matchLive.matchId, set: { clockRunning: next.running, clockAnchorMs: next.anchorMs, clockAccumulatedMs: next.accumulatedMs } });
    await bumpMatchLive(tx, input.matchId);
    return ok(undefined);
  });
}

export async function setLiveLabel(competitionId: string, input: { matchId: string; label: string; period: number | null }): Promise<OperationResult<void>> {
  return liveContext(competitionId, input.matchId, async (context, tx) => {
    const label = input.label.trim().slice(0, LABEL_MAX).toUpperCase();
    const maxPeriod = Math.max(1, context.rules.periodCount || 1);
    const period = input.period && Number.isInteger(input.period) ? Math.min(maxPeriod, Math.max(1, input.period)) : null;
    await tx.update(matchLive).set(period ? { label, period } : { label }).where(eq(matchLive.matchId, input.matchId));
    await bumpMatchLive(tx, input.matchId);
    return ok(undefined);
  });
}

export async function listLiveChannels(competitionId: string) {
  return db.select().from(liveChannels).where(eq(liveChannels.competitionId, competitionId));
}

export async function findIdleChannel(competitionId: string) {
  const [channel] = await db.select().from(liveChannels).where(and(eq(liveChannels.competitionId, competitionId), isNull(liveChannels.currentMatchId))).limit(1);
  return channel ?? null;
}

