import { and, eq, inArray, sql } from "drizzle-orm";
import { liveChannels, matchBoosts, matchEvents, matches, modalities, participants, powerBoosts, stageGroups, stages } from "../database/schema";
import type { MatchSide } from "../contracts/types";
import { getSportProfile } from "../shared/sport-profiles";
import { isClockTime, isIsoDate } from "../shared/timezone";
import { matchWinner } from "../shared/slot-resolution";
import { isSlotSource, type SlotSource } from "../shared/tournament";
import { sanitizeYoutubeUrl } from "../shared/youtube";
import { bumpDataVersion, db } from "./db";
import { resolveModalitySlots } from "./modalities";
import { athleteBelongsToSide, bumpChannelsForMatch, ensureMatchPoll, loadMatchForUpdate, recalcMatchScore } from "./match-core";
import { fail, ok, type OperationResult } from "./result";

// Escrita de jogos fora do ao vivo: agenda, lados (manual/travado), súmula (resultado lançado
// depois), lances corrigidos, MVP, transmissão, foto de capa.

export type MatchScheduleInput = {
  modalityId: string;
  stageId: string | null;
  groupId: string | null;
  roundLabel: string | null;
  homeParticipantId: string | null;
  awayParticipantId: string | null;
  homeLabel: string | null;
  awayLabel: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  venue: string | null;
  // Trava os lados contra o preenchimento automático do mata-mata.
  slotsLocked: boolean;
};

async function participantsBelong(competitionId: string, ids: (string | null)[]): Promise<boolean> {
  const wanted = ids.filter((id): id is string => Boolean(id));
  if (wanted.length === 0) return true;
  const rows = await db.select({ id: participants.id }).from(participants).where(and(eq(participants.competitionId, competitionId), inArray(participants.id, wanted)));
  return rows.length === new Set(wanted).size;
}

function normalizeSchedule(input: MatchScheduleInput) {
  const scheduledDate = input.scheduledDate && isIsoDate(input.scheduledDate) ? input.scheduledDate : null;
  const scheduledTime = scheduledDate && input.scheduledTime && isClockTime(input.scheduledTime) ? input.scheduledTime.slice(0, 5) : null;
  return {
    scheduledDate,
    scheduledTime,
    roundLabel: input.roundLabel?.trim().slice(0, 40) || null,
    homeLabel: input.homeLabel?.trim().slice(0, 60) || null,
    awayLabel: input.awayLabel?.trim().slice(0, 60) || null,
    venue: input.venue?.trim().slice(0, 60) || null,
  };
}

export async function saveMatchSchedule(competitionId: string, id: string | null, input: MatchScheduleInput): Promise<OperationResult<{ id: string }>> {
  if (input.homeParticipantId && input.homeParticipantId === input.awayParticipantId) return fail("games.match.same_team", "Escolha duas equipes diferentes.");
  if (!(await participantsBelong(competitionId, [input.homeParticipantId, input.awayParticipantId]))) return fail("games.match.sides_invalid", "Equipe inválida.");
  const [modality] = await db.select().from(modalities).where(and(eq(modalities.id, input.modalityId), eq(modalities.competitionId, competitionId)));
  if (!modality) return fail("games.modality.not_found", "Modalidade não encontrada.");
  if (input.stageId) {
    const [stage] = await db.select().from(stages).where(and(eq(stages.id, input.stageId), eq(stages.modalityId, modality.id)));
    if (!stage) return fail("games.match.stage_invalid", "Fase inválida.");
  }
  if (input.groupId) {
    const [group] = input.stageId ? await db.select().from(stageGroups).where(and(eq(stageGroups.id, input.groupId), eq(stageGroups.stageId, input.stageId))) : [];
    if (!group) return fail("games.match.group_invalid", "Grupo inválido.");
  }
  const schedule = normalizeSchedule(input);

  return db.transaction(async (tx) => {
    let savedId: string;
    if (id) {
      const context = await loadMatchForUpdate(tx, id, competitionId);
      if (!context) return fail<{ id: string }>("games.match.not_found", "Jogo não encontrado.");
      // Lado de jogo já disputado não muda (o resultado é daquelas equipes).
      const sidesChanged = context.match.homeParticipantId !== input.homeParticipantId || context.match.awayParticipantId !== input.awayParticipantId;
      if (sidesChanged && context.match.status !== "scheduled") return fail<{ id: string }>("games.match.sides_locked", "Não dá pra trocar as equipes de um jogo já iniciado.");
      const homeSource: SlotSource | null = input.slotsLocked && input.homeParticipantId ? { type: "participant", participantId: input.homeParticipantId } : context.match.homeSource;
      const awaySource: SlotSource | null = input.slotsLocked && input.awayParticipantId ? { type: "participant", participantId: input.awayParticipantId } : context.match.awaySource;
      await tx
        .update(matches)
        .set({
          ...schedule,
          stageId: input.stageId,
          groupId: input.groupId,
          homeParticipantId: input.homeParticipantId,
          awayParticipantId: input.awayParticipantId,
          homeSource: isSlotSource(homeSource) ? homeSource : null,
          awaySource: isSlotSource(awaySource) ? awaySource : null,
          slotsLocked: input.slotsLocked,
          updatedAt: new Date(),
        })
        .where(eq(matches.id, id));
      savedId = id;
    } else {
      const [row] = await tx
        .insert(matches)
        .values({
          ...schedule,
          competitionId,
          modalityId: modality.id,
          stageId: input.stageId,
          groupId: input.groupId,
          homeParticipantId: input.homeParticipantId,
          awayParticipantId: input.awayParticipantId,
          homeSource: input.homeParticipantId ? { type: "participant", participantId: input.homeParticipantId } : null,
          awaySource: input.awayParticipantId ? { type: "participant", participantId: input.awayParticipantId } : null,
          slotsLocked: input.slotsLocked,
        })
        .returning({ id: matches.id });
      savedId = row.id;
    }
    await resolveModalitySlots(tx, modality.id);
    await bumpChannelsForMatch(tx, savedId);
    await bumpDataVersion(tx, competitionId);
    return ok({ id: savedId });
  });
}

// Súmula: lança/corrige o resultado sem passar pelo ao vivo. Placar de modalidade de pontos vem
// dos lances quando existem; sem lances, o admin digita o placar final (jogo antigo, recreio).
export async function saveMatchResult(
  competitionId: string,
  input: {
    matchId: string;
    status: "finished" | "scheduled";
    homeScore: number | null;
    awayScore: number | null;
    sets: { home: number; away: number }[] | null;
    decidedWinnerId: string | null;
    resultNote: string | null;
    finishedDate: string | null;
  },
): Promise<OperationResult<void>> {
  return db.transaction(async (tx) => {
    const context = await loadMatchForUpdate(tx, input.matchId, competitionId);
    if (!context) return fail<void>("games.match.not_found", "Jogo não encontrado.");
    const { match, profile } = context;
    if (match.status === "live") return fail<void>("games.match.is_live", "O jogo está em andamento — encerre pelo controle ao vivo.");
    if (input.status === "finished" && (!match.homeParticipantId || !match.awayParticipantId)) {
      return fail<void>("games.match.sides_missing", "Defina as duas equipes antes de lançar o resultado.");
    }
    if (input.status === "scheduled") {
      await tx.delete(matchEvents).where(eq(matchEvents.matchId, match.id));
      await tx.delete(matchBoosts).where(eq(matchBoosts.matchId, match.id));
      await tx
        .update(matches)
        .set({ status: "scheduled", homeScore: 0, awayScore: 0, sets: null, decidedWinnerId: null, finishedAt: null, startedAt: null, resultNote: null, updatedAt: new Date() })
        .where(eq(matches.id, match.id));
    } else {
      const [eventCount] = await tx.select({ count: sql<number>`count(*)::int` }).from(matchEvents).where(eq(matchEvents.matchId, match.id));
      const scoringKinds = profile.eventKinds.filter((kind) => kind.scores).map((kind) => kind.key);
      const [scoringCount] = scoringKinds.length
        ? await tx.select({ count: sql<number>`count(*)::int` }).from(matchEvents).where(and(eq(matchEvents.matchId, match.id), inArray(matchEvents.kind, scoringKinds)))
        : [{ count: 0 }];
      const decided = input.decidedWinnerId === match.homeParticipantId || input.decidedWinnerId === match.awayParticipantId ? input.decidedWinnerId : null;
      const finishedAt = input.finishedDate && isIsoDate(input.finishedDate) ? new Date(`${input.finishedDate}T15:00:00Z`) : (match.finishedAt ?? new Date());
      let homeScore = match.homeScore;
      let awayScore = match.awayScore;
      let sets = match.sets ?? null;
      if ((scoringCount?.count ?? 0) === 0) {
        if (profile.usesSets && input.sets && input.sets.length > 0) {
          sets = input.sets.map((set) => ({ home: Math.max(0, Math.round(set.home)), away: Math.max(0, Math.round(set.away)) }));
          homeScore = sets.filter((set) => set.home > set.away).length;
          awayScore = sets.filter((set) => set.away > set.home).length;
        } else {
          homeScore = Math.max(0, Number(input.homeScore) || 0);
          awayScore = Math.max(0, Number(input.awayScore) || 0);
        }
      }
      await tx
        .update(matches)
        .set({
          status: "finished",
          homeScore,
          awayScore,
          sets,
          decidedWinnerId: decided,
          resultNote: input.resultNote?.trim().slice(0, 200) || null,
          startedAt: match.startedAt ?? finishedAt,
          finishedAt,
          updatedAt: new Date(),
        })
        .where(eq(matches.id, match.id));
      if ((eventCount?.count ?? 0) > 0 && (scoringCount?.count ?? 0) > 0) await recalcMatchScore(tx, context);
      const needsWinner = match.stageId ? (await tx.select({ type: stages.type }).from(stages).where(eq(stages.id, match.stageId)))[0]?.type === "knockout" : false;
      if (needsWinner && context.rules.knockoutNeedsWinner && !matchWinner({ homeId: match.homeParticipantId, awayId: match.awayParticipantId, homeScore, awayScore, decidedWinnerId: decided }).winnerId) {
        return fail<void>("games.match.needs_winner", "Jogo de mata-mata empatado: escolha o vencedor (pênaltis/desempate).");
      }
      await ensureMatchPoll(tx, { ...match }, "Craque da torcida");
    }
    await resolveModalitySlots(tx, context.modality.id);
    await bumpChannelsForMatch(tx, match.id);
    await bumpDataVersion(tx, competitionId);
    return ok(undefined);
  });
}

// ---- Lances (súmula) ----

export async function addMatchEvent(
  competitionId: string,
  input: { matchId: string; side: MatchSide; kind: string; amount: number; athleteId: string | null },
): Promise<OperationResult<void>> {
  return db.transaction(async (tx) => {
    const context = await loadMatchForUpdate(tx, input.matchId, competitionId);
    if (!context) return fail<void>("games.match.not_found", "Jogo não encontrado.");
    const kindDef = context.profile.eventKinds.find((kind) => kind.key === input.kind);
    if (!kindDef) return fail<void>("games.event.kind_invalid", "Tipo de lance inválido.");
    const amount = kindDef.scores ? input.amount : 1;
    if (kindDef.scores && !(amount > 0 && amount <= 10)) return fail<void>("games.event.amount_invalid", "Valor inválido.");
    if (input.athleteId && !(await athleteBelongsToSide(tx, context.match, input.side, input.athleteId))) return fail<void>("games.event.athlete_invalid", "O atleta não é dessa equipe.");
    await tx.insert(matchEvents).values({ matchId: input.matchId, side: input.side, kind: input.kind, amount, athleteId: input.athleteId });
    if (kindDef.scores) await recalcMatchScore(tx, context);
    await resolveModalitySlots(tx, context.modality.id);
    await bumpChannelsForMatch(tx, input.matchId);
    await bumpDataVersion(tx, competitionId);
    return ok(undefined);
  });
}

export async function updateMatchEvent(
  competitionId: string,
  input: { matchId: string; eventId: string; side: MatchSide; kind: string; amount: number; athleteId: string | null },
): Promise<OperationResult<void>> {
  return db.transaction(async (tx) => {
    const context = await loadMatchForUpdate(tx, input.matchId, competitionId);
    if (!context) return fail<void>("games.match.not_found", "Jogo não encontrado.");
    const kindDef = context.profile.eventKinds.find((kind) => kind.key === input.kind);
    if (!kindDef) return fail<void>("games.event.kind_invalid", "Tipo de lance inválido.");
    if (input.athleteId && !(await athleteBelongsToSide(tx, context.match, input.side, input.athleteId))) return fail<void>("games.event.athlete_invalid", "O atleta não é dessa equipe.");
    const amount = kindDef.scores ? input.amount : 1;
    if (kindDef.scores && !(amount > 0 && amount <= 10)) return fail<void>("games.event.amount_invalid", "Valor inválido.");
    const updated = await tx
      .update(matchEvents)
      .set({ side: input.side, kind: input.kind, amount, athleteId: input.athleteId })
      .where(and(eq(matchEvents.id, input.eventId), eq(matchEvents.matchId, input.matchId)))
      .returning({ id: matchEvents.id });
    if (updated.length === 0) return fail<void>("games.event.not_found", "Lance não encontrado.");
    await recalcMatchScore(tx, context);
    await resolveModalitySlots(tx, context.modality.id);
    await bumpChannelsForMatch(tx, input.matchId);
    await bumpDataVersion(tx, competitionId);
    return ok(undefined);
  });
}

export async function deleteMatchEvent(competitionId: string, input: { matchId: string; eventId: string }): Promise<OperationResult<void>> {
  return db.transaction(async (tx) => {
    const context = await loadMatchForUpdate(tx, input.matchId, competitionId);
    if (!context) return fail<void>("games.match.not_found", "Jogo não encontrado.");
    await tx.delete(matchEvents).where(and(eq(matchEvents.id, input.eventId), eq(matchEvents.matchId, input.matchId)));
    await recalcMatchScore(tx, context);
    await resolveModalitySlots(tx, context.modality.id);
    await bumpChannelsForMatch(tx, input.matchId);
    await bumpDataVersion(tx, competitionId);
    return ok(undefined);
  });
}

export async function addMatchBoost(competitionId: string, input: { matchId: string; side: MatchSide; boostId: string }): Promise<OperationResult<void>> {
  const [boost] = await db.select().from(powerBoosts).where(and(eq(powerBoosts.id, input.boostId), eq(powerBoosts.competitionId, competitionId)));
  if (!boost) return fail("games.boost.not_found", "Power play não encontrado.");
  return db.transaction(async (tx) => {
    const context = await loadMatchForUpdate(tx, input.matchId, competitionId);
    if (!context) return fail<void>("games.match.not_found", "Jogo não encontrado.");
    await tx.insert(matchBoosts).values({ matchId: input.matchId, side: input.side, boostId: boost.id, label: boost.label, emoji: boost.emoji });
    await bumpChannelsForMatch(tx, input.matchId);
    await bumpDataVersion(tx, competitionId);
    return ok(undefined);
  });
}

export async function deleteMatchBoost(competitionId: string, input: { matchId: string; boostUseId: string }): Promise<OperationResult<void>> {
  return db.transaction(async (tx) => {
    const context = await loadMatchForUpdate(tx, input.matchId, competitionId);
    if (!context) return fail<void>("games.match.not_found", "Jogo não encontrado.");
    await tx.delete(matchBoosts).where(and(eq(matchBoosts.id, input.boostUseId), eq(matchBoosts.matchId, input.matchId)));
    await bumpChannelsForMatch(tx, input.matchId);
    await bumpDataVersion(tx, competitionId);
    return ok(undefined);
  });
}

// ---- Detalhes ----

export async function setMatchMvp(competitionId: string, input: { matchId: string; athleteId: string | null; note: string | null }): Promise<OperationResult<void>> {
  return db.transaction(async (tx) => {
    const context = await loadMatchForUpdate(tx, input.matchId, competitionId);
    if (!context) return fail<void>("games.match.not_found", "Jogo não encontrado.");
    if (input.athleteId) {
      const valid = (await athleteBelongsToSide(tx, context.match, "home", input.athleteId)) || (await athleteBelongsToSide(tx, context.match, "away", input.athleteId));
      if (!valid) return fail<void>("games.match.mvp_invalid", "O craque precisa ser de uma das duas equipes.");
    }
    await tx
      .update(matches)
      .set({ mvpAthleteId: input.athleteId, mvpNote: input.athleteId ? input.note?.trim().slice(0, 140) || null : null, updatedAt: new Date() })
      .where(eq(matches.id, input.matchId));
    await bumpChannelsForMatch(tx, input.matchId);
    await bumpDataVersion(tx, competitionId);
    return ok(undefined);
  });
}

export async function setMatchYoutubeUrl(competitionId: string, input: { matchId: string; url: string | null }): Promise<OperationResult<void>> {
  const url = input.url?.trim() ? sanitizeYoutubeUrl(input.url) : null;
  if (input.url?.trim() && !url) return fail("games.match.youtube_invalid", "Cole um link http(s) válido do vídeo.");
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(matches)
      .set({ youtubeUrl: url, updatedAt: new Date() })
      .where(and(eq(matches.id, input.matchId), eq(matches.competitionId, competitionId)))
      .returning({ id: matches.id });
    if (updated.length === 0) return fail<void>("games.match.not_found", "Jogo não encontrado.");
    await bumpDataVersion(tx, competitionId);
    return ok(undefined);
  });
}

// Só jogo não iniciado ou já encerrado; ao vivo, cancela pelo controle. Lances, boosts, votação
// e estado ao vivo saem junto (FK cascade); canal que mostrava o jogo fica ocioso.
export async function deleteMatch(competitionId: string, matchId: string): Promise<OperationResult<void>> {
  return db.transaction(async (tx) => {
    const context = await loadMatchForUpdate(tx, matchId, competitionId);
    if (!context) return fail<void>("games.match.not_found", "Jogo não encontrado.");
    if (context.match.status === "live") return fail<void>("games.match.is_live", "O jogo está em andamento — cancele pelo controle ao vivo.");
    // Outro jogo que dependia deste (vencedor/perdedor) perde a origem e volta a "a definir".
    if (context.match.matchKey) {
      const dependents = await tx.select().from(matches).where(eq(matches.modalityId, context.modality.id));
      for (const dependent of dependents) {
        const clear = (source: SlotSource | null) =>
          source && (source.type === "winner" || source.type === "loser") && source.matchKey === context.match.matchKey ? null : source;
        const homeSource = clear(dependent.homeSource ?? null);
        const awaySource = clear(dependent.awaySource ?? null);
        if (homeSource !== (dependent.homeSource ?? null) || awaySource !== (dependent.awaySource ?? null)) {
          await tx.update(matches).set({ homeSource, awaySource }).where(eq(matches.id, dependent.id));
        }
      }
    }
    await tx
      .update(liveChannels)
      .set({ currentMatchId: null, version: sql`${liveChannels.version} + 1`, updatedAt: new Date() })
      .where(eq(liveChannels.currentMatchId, matchId));
    await tx.delete(matches).where(eq(matches.id, matchId));
    await resolveModalitySlots(tx, context.modality.id);
    await bumpDataVersion(tx, competitionId);
    return ok(undefined);
  });
}

export function isEventModality(sportProfile: string): boolean {
  return getSportProfile(sportProfile).shape === "event";
}
