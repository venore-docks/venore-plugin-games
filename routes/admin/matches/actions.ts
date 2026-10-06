"use server";

import { after } from "next/server";
import {
  addMatchBoost,
  addMatchEvent,
  deleteMatch,
  deleteMatchBoost,
  deleteMatchEvent,
  saveMatchResult,
  saveMatchSchedule,
  setMatchMvp,
  setMatchYoutubeUrl,
  updateMatchEvent,
} from "../../../runtime/matches";
import { getMatchCoverPhotoId, setMatchCoverPhoto } from "../../../runtime/admin-match-photo";
import { generateMatchShareImages } from "../../../runtime/share-images";
import { resolveRequestOrigin } from "../../../runtime/request-origin";
import type { OperationResult } from "../../../runtime/result";
import { isIsoDate } from "../../../shared/timezone";
import { isUuid } from "../../../shared/ids";
import { INVALID_INPUT, type ActionResult } from "../_shared/action-result";
import { bool, finite, oneOf, optText, optUuid, text } from "../_shared/input";
import { fromOperation, guard } from "../_shared/server";

const SIDES = ["home", "away"] as const;

// Capa/story regeradas DEPOIS da resposta (after): o admin não espera o render da imagem. Só
// quando o jogo tem foto — sem foto não há o que compor; o hash de entrada evita regerar à toa.
async function refreshShareImagesLater(competitionId: string, matchId: string): Promise<void> {
  if (!(await getMatchCoverPhotoId(competitionId, matchId))) return;
  const origin = await resolveRequestOrigin();
  after(async () => {
    await generateMatchShareImages(competitionId, matchId, origin).catch(() => undefined);
  });
}

async function withImages(competitionId: string, matchId: string, result: OperationResult<unknown>): Promise<ActionResult> {
  if (result.success) await refreshShareImagesLater(competitionId, matchId);
  return fromOperation(result);
}

export async function saveMatchScheduleAction(
  matchId: unknown,
  input: {
    modalityId: unknown;
    stageId: unknown;
    groupId: unknown;
    roundLabel: unknown;
    homeParticipantId: unknown;
    awayParticipantId: unknown;
    homeLabel: unknown;
    awayLabel: unknown;
    scheduledDate: unknown;
    scheduledTime: unknown;
    venue: unknown;
    slotsLocked: unknown;
  },
): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  if (matchId !== null && !isUuid(matchId)) return INVALID_INPUT;
  if (!isUuid(input?.modalityId)) return { ok: false, message: "Escolha a modalidade." };
  const result = await saveMatchSchedule(gate.competitionId, matchId, {
    modalityId: input.modalityId,
    stageId: optUuid(input.stageId),
    groupId: optUuid(input.stageId) ? optUuid(input.groupId) : null,
    roundLabel: optText(input.roundLabel, 40),
    homeParticipantId: optUuid(input.homeParticipantId),
    awayParticipantId: optUuid(input.awayParticipantId),
    homeLabel: optText(input.homeLabel, 60),
    awayLabel: optText(input.awayLabel, 60),
    scheduledDate: optText(input.scheduledDate, 10),
    scheduledTime: optText(input.scheduledTime, 8),
    venue: optText(input.venue, 60),
    slotsLocked: bool(input.slotsLocked),
  });
  if (!result.success) return { ok: false, message: result.error.message };
  if (matchId) await refreshShareImagesLater(gate.competitionId, result.data.id);
  return { ok: true, id: result.data.id };
}

export async function saveMatchResultAction(input: {
  matchId: unknown;
  status: unknown;
  homeScore: unknown;
  awayScore: unknown;
  sets: unknown;
  decidedWinnerId: unknown;
  resultNote: unknown;
  finishedDate: unknown;
}): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  if (!isUuid(input?.matchId)) return INVALID_INPUT;
  const status = oneOf(input.status, ["finished", "scheduled"] as const);
  if (!status) return INVALID_INPUT;
  let sets: { home: number; away: number }[] | null = null;
  if (Array.isArray(input.sets) && input.sets.length > 0) {
    if (input.sets.length > 9) return { ok: false, message: "Sets demais." };
    sets = [];
    for (const raw of input.sets) {
      const set = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      const home = finite(set.home);
      const away = finite(set.away);
      if (home === null || away === null || home < 0 || away < 0 || home > 999 || away > 999) return { ok: false, message: "Placar de set inválido." };
      sets.push({ home, away });
    }
  }
  const homeScore = finite(input.homeScore);
  const awayScore = finite(input.awayScore);
  if ((homeScore !== null && (homeScore < 0 || homeScore > 9999)) || (awayScore !== null && (awayScore < 0 || awayScore > 9999))) return { ok: false, message: "Placar inválido." };
  const finishedDate = optText(input.finishedDate, 10);
  const result = await saveMatchResult(gate.competitionId, {
    matchId: input.matchId,
    status,
    homeScore,
    awayScore,
    sets,
    decidedWinnerId: optUuid(input.decidedWinnerId),
    resultNote: optText(input.resultNote, 200),
    finishedDate: finishedDate && isIsoDate(finishedDate) ? finishedDate : null,
  });
  return withImages(gate.competitionId, input.matchId, result);
}

type EventInput = { matchId: unknown; eventId?: unknown; side: unknown; kind: unknown; amount: unknown; athleteId: unknown };

function parseEvent(input: EventInput) {
  const side = oneOf(input?.side, SIDES);
  const kind = text(input?.kind, 32);
  const amount = finite(input?.amount) ?? 1;
  if (!isUuid(input?.matchId) || !side || !kind) return null;
  return { matchId: input.matchId as string, side, kind, amount, athleteId: optUuid(input.athleteId) };
}

export async function addMatchEventAction(input: EventInput): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  const event = parseEvent(input);
  if (!event) return INVALID_INPUT;
  return withImages(gate.competitionId, event.matchId, await addMatchEvent(gate.competitionId, event));
}

export async function updateMatchEventAction(input: EventInput): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  const event = parseEvent(input);
  if (!event || !isUuid(input.eventId)) return INVALID_INPUT;
  return withImages(gate.competitionId, event.matchId, await updateMatchEvent(gate.competitionId, { ...event, eventId: input.eventId }));
}

export async function deleteMatchEventAction(matchId: unknown, eventId: unknown): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  if (!isUuid(matchId) || !isUuid(eventId)) return INVALID_INPUT;
  return withImages(gate.competitionId, matchId, await deleteMatchEvent(gate.competitionId, { matchId, eventId }));
}

export async function addMatchBoostAction(matchId: unknown, side: unknown, boostId: unknown): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  const parsedSide = oneOf(side, SIDES);
  if (!isUuid(matchId) || !isUuid(boostId) || !parsedSide) return INVALID_INPUT;
  return fromOperation(await addMatchBoost(gate.competitionId, { matchId, side: parsedSide, boostId }));
}

export async function deleteMatchBoostAction(matchId: unknown, boostUseId: unknown): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  if (!isUuid(matchId) || !isUuid(boostUseId)) return INVALID_INPUT;
  return fromOperation(await deleteMatchBoost(gate.competitionId, { matchId, boostUseId }));
}

export async function setMatchMvpAction(matchId: unknown, athleteId: unknown, note: unknown): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  if (!isUuid(matchId) || (athleteId !== null && !isUuid(athleteId))) return INVALID_INPUT;
  return fromOperation(await setMatchMvp(gate.competitionId, { matchId, athleteId, note: optText(note, 140) }));
}

export async function setMatchYoutubeUrlAction(matchId: unknown, url: unknown): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  if (!isUuid(matchId)) return INVALID_INPUT;
  return fromOperation(await setMatchYoutubeUrl(gate.competitionId, { matchId, url: optText(url, 300) }));
}

export async function setMatchPhotoAction(matchId: unknown, mediaId: unknown): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  if (!isUuid(matchId) || (mediaId !== null && (typeof mediaId !== "string" || mediaId.length > 64))) return INVALID_INPUT;
  const result = await setMatchCoverPhoto(gate.competitionId, matchId, mediaId as string | null);
  if (!result.success) return { ok: false, message: result.error.message };
  if (mediaId) {
    await refreshShareImagesLater(gate.competitionId, matchId);
    return { ok: true, message: "Foto salva. A capa e o story ficam prontos em alguns segundos — atualize a página." };
  }
  return { ok: true, message: "Foto removida." };
}

// "Gerar de novo": síncrono (o admin pediu e espera ver o resultado), com force.
export async function regenerateShareImagesAction(matchId: unknown): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  if (!isUuid(matchId)) return INVALID_INPUT;
  const result = await generateMatchShareImages(gate.competitionId, matchId, await resolveRequestOrigin(), { force: true });
  if (!result.success) return { ok: false, message: result.error.message };
  if (result.data === "skipped") return { ok: false, message: "Defina as duas equipes do jogo antes de gerar as imagens." };
  return { ok: true, message: "Capa e story gerados." };
}

export async function deleteMatchAction(matchId: unknown): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  if (!isUuid(matchId)) return INVALID_INPUT;
  return fromOperation(await deleteMatch(gate.competitionId, matchId));
}
