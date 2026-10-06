"use server";

import { isPluginActive } from "@venore/plugin-sdk";
import { castVote, requestVoteTicket } from "../../../runtime/votes";
import { getActiveSnapshot } from "../../../runtime/snapshot";
import { isUuid } from "../../../shared/ids";

// AÇÕES PÚBLICAS DE PROPÓSITO (sem login nem requireGames): a votação da torcida é aberta a qualquer
// visitante — decisão de produto (docs/arquitetura.md §6). As barreiras são do runtime/votes.ts:
// ticket assinado preso a votação/aparelho/rede, espera acumulada por rede, teto por rede, Turnstile
// opcional e auditoria do admin. Aqui só validamos o input, checamos o plugin ativo e que a votação é
// da competição mostrada no site. requestTicketAction GRAVA (reserva vaga na fila da rede) — é o
// propósito; ver o relatório sobre o teste de server actions do host.

export type TicketActionResult =
  | { ok: true; ticket: string; waitSeconds: number }
  | { ok: false; status: "already_voted"; choiceId: string; message: string }
  | { ok: false; status: "closed" | "network_cap" | "unavailable" | "not_found"; message: string };

export type CastActionResult =
  | { status: "voted"; choiceId: string; changed: boolean; message: string }
  | { status: "already_voted"; choiceId: string; message: string }
  | { status: "wait"; retryAfterSeconds: number; message: string }
  | { status: "invalid_ticket" | "closed" | "invalid_choice" | "bot_check" | "unavailable"; message: string };

const MESSAGES = {
  closed: "A votação já foi encerrada.",
  network_cap: "Esta rede já atingiu o limite de votos nesta votação. Tente de outra conexão (dados móveis, por exemplo).",
  unavailable: "Votação indisponível no momento.",
  not_found: "Votação não encontrada.",
  already_voted: "Este aparelho já votou neste jogo.",
  invalid_ticket: "Sua vez na fila expirou — vamos pedir outra.",
  invalid_choice: "Opção inválida. Atualize a página e escolha de novo.",
  bot_check: "A verificação anti-robô não passou. Tente de novo.",
  wait: "Quase lá — falta um pouco da espera.",
} as const;

async function pollIsActive(pollId: string): Promise<boolean> {
  if (!(await isPluginActive("games"))) return false;
  const snapshot = await getActiveSnapshot();
  return Boolean(snapshot?.polls.some((poll) => poll.id === pollId));
}

export async function requestTicketAction(pollId: unknown): Promise<TicketActionResult> {
  if (!isUuid(pollId)) return { ok: false, status: "not_found", message: MESSAGES.not_found };
  if (!(await pollIsActive(pollId))) return { ok: false, status: "not_found", message: MESSAGES.not_found };
  const result = await requestVoteTicket(pollId);
  switch (result.status) {
    case "ticket":
      return { ok: true, ticket: result.ticket, waitSeconds: result.waitSeconds };
    case "already_voted":
      return { ok: false, status: "already_voted", choiceId: result.choiceId, message: MESSAGES.already_voted };
    default:
      return { ok: false, status: result.status, message: MESSAGES[result.status] };
  }
}

export async function castVoteAction(input: unknown): Promise<CastActionResult> {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const pollId = raw.pollId;
  const choiceId = raw.choiceId;
  const ticket = typeof raw.ticket === "string" && raw.ticket.length <= 400 ? raw.ticket : null;
  const turnstileToken = typeof raw.turnstileToken === "string" && raw.turnstileToken.length > 0 && raw.turnstileToken.length <= 4096 ? raw.turnstileToken : null;
  if (!isUuid(pollId) || !isUuid(choiceId)) return { status: "invalid_choice", message: MESSAGES.invalid_choice };
  if (!ticket) return { status: "invalid_ticket", message: MESSAGES.invalid_ticket };
  if (!(await pollIsActive(pollId))) return { status: "closed", message: MESSAGES.closed };

  const result = await castVote({ pollId, choiceId, ticket, turnstileToken });
  switch (result.status) {
    case "voted":
      return { ...result, message: result.changed ? "Voto trocado!" : "Voto registrado!" };
    case "already_voted":
      return { ...result, message: MESSAGES.already_voted };
    case "wait":
      return { ...result, message: MESSAGES.wait };
    default:
      return { status: result.status, message: MESSAGES[result.status] };
  }
}
