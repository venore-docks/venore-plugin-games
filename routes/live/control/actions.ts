"use server";

import { after } from "next/server";
import type { LiveMatchState, MatchSide } from "../../../contracts/types";
import { isClockCommand } from "../../../shared/clock";
import { isUuid } from "../../../shared/ids";
import { requireGames } from "../../../runtime/gate";
import {
  addBoost,
  addMarkerEvent,
  addScore,
  attributeEvent,
  cancelLiveMatch,
  commandClock,
  finishLiveMatch,
  releaseChannel,
  removeBoost,
  removeLiveEvent,
  setChannelTeaser,
  setLiveLabel,
  startMatchOnChannel,
  startQuickMatch,
  undoLastScore,
} from "../../../runtime/live";
import { buildLiveState, readChannel } from "../../../runtime/live-state";
import { getCompetitionSnapshot } from "../../../runtime/snapshot";
import { generateMatchShareImages } from "../../../runtime/share-images";
import { resolveRequestOrigin } from "../../../runtime/request-origin";
import type { OperationResult } from "../../../runtime/result";
import { indexes } from "../../../shared/derive";
import { isChannelKey } from "./control-model";
import { buildMatchDesk } from "./desk";
import type { ControlActionResult, MatchDesk } from "./types";

// Server Actions do controle ao vivo (/ext/games/controle). Toda função: permissão primeiro
// (games.operate), depois validação do input, depois o runtime (que revalida tudo de novo na
// transação). Devolvem o estado ao vivo fresco do canal — o cliente só aplica se for mais novo que
// o que já chegou pelo SSE (comparação por versão). Falha de banco vira mensagem, nunca exceção:
// o console no celular não pode cair no meio do jogo.

type Gate = { ok: true; competitionId: string } | { ok: false; message: string };

const INVALID: ControlActionResult = { ok: false, message: "Dados inválidos. Recarregue a página." };
const UNEXPECTED = "Não foi possível salvar agora. Tente de novo.";
const TEXT_MAX = 120;

async function gate(): Promise<Gate> {
  const access = await requireGames("operate");
  return access.ok ? { ok: true, competitionId: access.competitionId } : { ok: false, message: access.message };
}

function isSide(value: unknown): value is MatchSide {
  return value === "home" || value === "away";
}

function isShortText(value: unknown, max = TEXT_MAX): value is string {
  return typeof value === "string" && value.length <= max;
}

async function freshState(competitionId: string, channelKey: string): Promise<LiveMatchState | null> {
  try {
    const channel = await readChannel(competitionId, channelKey);
    return channel ? await buildLiveState(competitionId, channel) : null;
  } catch {
    // O SSE entrega o estado de qualquer jeito; a resposta da action é só atalho.
    return null;
  }
}

async function channelIdOf(competitionId: string, channelKey: string): Promise<string | null> {
  const channel = await readChannel(competitionId, channelKey);
  return channel?.id ?? null;
}

// Executa a escrita e monta a resposta padrão. `run` devolve o OperationResult do runtime.
async function perform<T>(
  channelKey: string,
  label: string,
  run: (competitionId: string) => Promise<OperationResult<T> | ControlActionResult>,
  pickEventId?: (data: T) => string | undefined,
): Promise<ControlActionResult> {
  const access = await gate();
  if (!access.ok) return { ok: false, message: access.message };
  if (!isChannelKey(channelKey)) return INVALID;
  try {
    const result = await run(access.competitionId);
    if ("ok" in result) {
      if (!result.ok) return result;
    } else if (!result.success) {
      return { ok: false, message: result.error.message, code: result.error.code };
    }
    const eventId = "success" in result && result.success && pickEventId ? pickEventId(result.data) : undefined;
    return { ok: true, state: await freshState(access.competitionId, channelKey), ...(eventId ? { eventId } : {}) };
  } catch (error) {
    console.error(`[games] controle: ${label} falhou`, error);
    return { ok: false, message: UNEXPECTED };
  }
}

// ---- Canal ----

export async function startMatchAction(channelKey: string, matchId: string, force: boolean): Promise<ControlActionResult> {
  return perform(channelKey, "iniciar jogo", async (competitionId) => {
    if (!isUuid(matchId) || typeof force !== "boolean") return INVALID;
    const channelId = await channelIdOf(competitionId, channelKey);
    if (!channelId) return { ok: false, message: "Canal não encontrado." };
    return startMatchOnChannel(competitionId, { channelId, matchId, force });
  });
}

export async function startQuickMatchAction(channelKey: string, modalityId: string, homeId: string, awayId: string, force: boolean): Promise<ControlActionResult> {
  return perform(channelKey, "jogo rápido", async (competitionId) => {
    if (!isUuid(modalityId) || !isUuid(homeId) || !isUuid(awayId) || typeof force !== "boolean") return INVALID;
    const channelId = await channelIdOf(competitionId, channelKey);
    if (!channelId) return { ok: false, message: "Canal não encontrado." };
    return startQuickMatch(competitionId, { channelId, modalityId, homeParticipantId: homeId, awayParticipantId: awayId, force });
  });
}

export async function setTeaserAction(channelKey: string, teaser: string): Promise<ControlActionResult> {
  return perform(channelKey, "prévia", async (competitionId) => {
    if (!isShortText(teaser, 200)) return INVALID;
    const channelId = await channelIdOf(competitionId, channelKey);
    if (!channelId) return { ok: false, message: "Canal não encontrado." };
    return setChannelTeaser(competitionId, channelId, teaser);
  });
}

export async function releaseChannelAction(channelKey: string): Promise<ControlActionResult> {
  return perform(channelKey, "liberar canal", async (competitionId) => {
    const channelId = await channelIdOf(competitionId, channelKey);
    if (!channelId) return { ok: false, message: "Canal não encontrado." };
    return releaseChannel(competitionId, channelId);
  });
}

// ---- Placar e lances ----

export async function addScoreAction(channelKey: string, matchId: string, side: MatchSide, amount: number, kind: string): Promise<ControlActionResult> {
  return perform(
    channelKey,
    "ponto",
    async (competitionId) => {
      if (!isUuid(matchId) || !isSide(side) || typeof amount !== "number" || !Number.isFinite(amount) || !isShortText(kind, 32)) return INVALID;
      return addScore(competitionId, { matchId, side, amount, kind, athleteId: null });
    },
    (data) => data.eventId,
  );
}

export async function undoLastScoreAction(channelKey: string, matchId: string, side: MatchSide): Promise<ControlActionResult> {
  return perform(channelKey, "desfazer ponto", async (competitionId) => {
    if (!isUuid(matchId) || !isSide(side)) return INVALID;
    return undoLastScore(competitionId, { matchId, side });
  });
}

export async function addMarkerAction(channelKey: string, matchId: string, side: MatchSide, kind: string): Promise<ControlActionResult> {
  return perform(
    channelKey,
    "lance",
    async (competitionId) => {
      if (!isUuid(matchId) || !isSide(side) || !isShortText(kind, 32)) return INVALID;
      return addMarkerEvent(competitionId, { matchId, side, kind, athleteId: null });
    },
    (data) => data.eventId,
  );
}

export async function attributeEventAction(channelKey: string, matchId: string, eventId: string, athleteId: string | null): Promise<ControlActionResult> {
  return perform(channelKey, "atribuir lance", async (competitionId) => {
    if (!isUuid(matchId) || !isUuid(eventId) || (athleteId !== null && !isUuid(athleteId))) return INVALID;
    return attributeEvent(competitionId, { matchId, eventId, athleteId });
  });
}

export async function removeEventAction(channelKey: string, matchId: string, eventId: string): Promise<ControlActionResult> {
  return perform(channelKey, "remover lance", async (competitionId) => {
    if (!isUuid(matchId) || !isUuid(eventId)) return INVALID;
    return removeLiveEvent(competitionId, { matchId, eventId });
  });
}

export async function addBoostAction(channelKey: string, matchId: string, side: MatchSide, boostId: string): Promise<ControlActionResult> {
  return perform(channelKey, "power play", async (competitionId) => {
    if (!isUuid(matchId) || !isSide(side) || !isUuid(boostId)) return INVALID;
    return addBoost(competitionId, { matchId, side, boostId });
  });
}

export async function removeBoostAction(channelKey: string, matchId: string, boostUseId: string): Promise<ControlActionResult> {
  return perform(channelKey, "remover power play", async (competitionId) => {
    if (!isUuid(matchId) || !isUuid(boostUseId)) return INVALID;
    return removeBoost(competitionId, { matchId, boostUseId });
  });
}

// ---- Relógio e etiqueta ----

export async function clockAction(channelKey: string, matchId: string, command: unknown): Promise<ControlActionResult> {
  return perform(channelKey, "relógio", async (competitionId) => {
    if (!isUuid(matchId) || !isClockCommand(command)) return INVALID;
    // Teto de sanidade: nenhum jogo escolar passa de 10 h de relógio.
    if (command.kind === "set" && (command.elapsedMs < 0 || command.elapsedMs > 36_000_000)) return INVALID;
    if (command.kind === "adjust" && Math.abs(command.deltaMs) > 36_000_000) return INVALID;
    return commandClock(competitionId, { matchId, command });
  });
}

export async function setLabelAction(channelKey: string, matchId: string, label: string, period: number | null): Promise<ControlActionResult> {
  return perform(channelKey, "etiqueta", async (competitionId) => {
    if (!isUuid(matchId) || !isShortText(label, 64)) return INVALID;
    if (period !== null && !(typeof period === "number" && Number.isInteger(period) && period >= 1 && period <= 8)) return INVALID;
    return setLiveLabel(competitionId, { matchId, label, period });
  });
}

// ---- Encerrar / cancelar ----

export async function finishMatchAction(channelKey: string, matchId: string, decidedWinnerId: string | null, mvpAthleteId: string | null): Promise<ControlActionResult> {
  return perform(channelKey, "encerrar jogo", async (competitionId) => {
    if (!isUuid(matchId) || (decidedWinnerId !== null && !isUuid(decidedWinnerId)) || (mvpAthleteId !== null && !isUuid(mvpAthleteId))) return INVALID;
    const finished = await finishLiveMatch(competitionId, { matchId, decidedWinnerId, mvpAthleteId });
    if (finished.success) scheduleShareImages(competitionId, matchId);
    return finished;
  });
}

// Capa/story do jogo com o placar final — só se a súmula tem foto. Roda depois da resposta (o
// operador não espera o render da imagem); falta de permissão de mídia (operador sem
// media.manage) só deixa a geração pra quando o admin salvar a foto.
function scheduleShareImages(competitionId: string, matchId: string) {
  after(async () => {
    try {
      const snapshot = await getCompetitionSnapshot(competitionId);
      const match = snapshot ? indexes(snapshot).matches.get(matchId) : undefined;
      if (!match?.coverPhotoMediaId) return;
      const origin = await resolveRequestOrigin();
      const generated = await generateMatchShareImages(competitionId, matchId, origin);
      if (!generated.success) console.warn(`[games] capa/story do jogo ${matchId} não gerada: ${generated.error.message}`);
    } catch (error) {
      console.warn(`[games] capa/story do jogo ${matchId} não gerada`, error);
    }
  });
}

export async function cancelMatchAction(channelKey: string, matchId: string): Promise<ControlActionResult> {
  return perform(channelKey, "cancelar jogo", async (competitionId) => {
    if (!isUuid(matchId)) return INVALID;
    return cancelLiveMatch(competitionId, matchId);
  });
}

// ---- Leitura (elenco, lances com id) ----

export async function getMatchDeskAction(matchId: string): Promise<{ ok: true; desk: MatchDesk | null } | { ok: false; message: string }> {
  const access = await gate();
  if (!access.ok) return { ok: false, message: access.message };
  if (!isUuid(matchId)) return { ok: false, message: "Jogo inválido." };
  try {
    const snapshot = await getCompetitionSnapshot(access.competitionId);
    return { ok: true, desk: snapshot ? buildMatchDesk(snapshot, matchId) : null };
  } catch (error) {
    console.error("[games] controle: leitura do jogo falhou", error);
    return { ok: false, message: "Não foi possível carregar o elenco agora." };
  }
}
