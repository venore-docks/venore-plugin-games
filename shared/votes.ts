import type { MatchStatus, PollOpenMode } from "../contracts/types";

// Regras puras da votação da torcida (janela, rede, ticket, auditoria, vencedor).

// ---- Janela ----

export type PollWindow = { isOpen: boolean; opensAt: number | null; closesAt: number | null; closedForGood: boolean };

export function resolveMatchPollWindow(
  match: { status: MatchStatus; startedAt: string | null; finishedAt: string | null },
  openMode: PollOpenMode,
  windowHours: number,
  now: number,
): PollWindow {
  if (openMode === "closed") return { isOpen: false, opensAt: null, closesAt: null, closedForGood: true };
  if (openMode === "open") return { isOpen: true, opensAt: null, closesAt: null, closedForGood: false };
  if (match.status === "live") return { isOpen: true, opensAt: match.startedAt ? Date.parse(match.startedAt) : null, closesAt: null, closedForGood: false };
  if (match.status !== "finished") return { isOpen: false, opensAt: null, closesAt: null, closedForGood: false };
  const end = Date.parse(match.finishedAt ?? match.startedAt ?? "");
  // Jogo encerrado sem data (legado) = encerrado de vez, nunca "aberto pra sempre".
  if (!Number.isFinite(end)) return { isOpen: false, opensAt: null, closesAt: null, closedForGood: true };
  const closesAt = end + windowHours * 60 * 60 * 1000;
  return { isOpen: now < closesAt, opensAt: match.startedAt ? Date.parse(match.startedAt) : null, closesAt, closedForGood: now >= closesAt };
}

export function resolveParticipantPollOpen(openMode: PollOpenMode): boolean {
  return openMode !== "closed";
}

// ---- Rede (IP) ----

// IPv4 inteiro; IPv6 pelo /64 (uma casa recebe um /64 inteiro e gira o sufixo à vontade).
export function normalizeIpForGrouping(rawIp: string | null | undefined): string | null {
  let ip = (rawIp ?? "").trim().toLowerCase();
  if (!ip) return null;
  const bracketed = ip.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketed) ip = bracketed[1];
  const v4WithPort = ip.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (v4WithPort) ip = v4WithPort[1];
  const mapped = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return mapped[1];
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip)) return ip;
  if (!ip.includes(":")) return null;
  const withoutZone = ip.split("%")[0];
  const [head, tail] = withoutZone.split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail !== undefined && tail !== "" ? tail.split(":") : [];
  if (withoutZone.includes("::")) {
    const missing = 8 - headParts.length - tailParts.length;
    if (missing < 0) return null;
    const full = [...headParts, ...Array<string>(missing).fill("0"), ...tailParts];
    return full.slice(0, 4).map((part) => part.replace(/^0+(?=.)/, "")).join(":") + "::/64";
  }
  if (headParts.length !== 8) return null;
  return headParts.slice(0, 4).map((part) => part.replace(/^0+(?=.)/, "")).join(":") + "::/64";
}

// IP do cliente SÓ de cabeçalho de confiança. Na Vercel, x-vercel-forwarded-for / x-real-ip são
// escritos pela borda (o cliente não consegue forjar). Fora dela, só o cabeçalho configurado em
// GAMES_TRUSTED_IP_HEADER (o do proxy reverso da instância). Sem isso → null, e o voto cai na rede
// compartilhada "desconhecida" (custo acumula pra todos os sem-IP juntos).
export function pickTrustedClientIp(get: (name: string) => string | null, env: { onVercel: boolean; trustedHeader: string | null }): string | null {
  const first = (value: string | null) => value?.split(",")[0]?.trim() || null;
  if (env.onVercel) return first(get("x-vercel-forwarded-for")) ?? first(get("x-real-ip")) ?? first(get("x-forwarded-for"));
  if (env.trustedHeader) return first(get(env.trustedHeader));
  return null;
}

export const UNKNOWN_NETWORK = "unknown";

// ---- Ticket ----
// v2.<pollId>.<voterKey prefix>.<ipHash>.<issuedAt>.<validAfter>.<nonce>.<sig>
// Preso à votação, ao aparelho e à rede que o pediram. validAfter = horário reservado na fila da
// rede (shared/vote-cost.ts reserveVoteSlot) no momento da emissão.

export type TicketPayload = { pollId: string; voterTag: string; ipHash: string; issuedAt: number; validAfter: number; nonce: string };

export const TICKET_TTL_MS = 20 * 60 * 1000;
const TICKET_VERSION = "v2";
const NONCE_RE = /^[A-Za-z0-9_-]{16,32}$/;
const SAFE_SEGMENT = /^[A-Za-z0-9_:/.-]{1,80}$/;

export function voterTagOf(voterKey: string): string {
  return voterKey.slice(0, 16);
}

export function encodeTicketBody(payload: TicketPayload): string {
  return [TICKET_VERSION, payload.pollId, payload.voterTag, payload.ipHash, payload.issuedAt, payload.validAfter, payload.nonce].join(".");
}

export function decodeTicket(ticket: string): { payload: TicketPayload; body: string; signature: string } | null {
  if (typeof ticket !== "string" || ticket.length > 400) return null;
  const parts = ticket.split(".");
  // ipHash pode conter ":" mas nunca "." (hex ou "unknown").
  if (parts.length !== 8 || parts[0] !== TICKET_VERSION) return null;
  const [, pollId, voterTag, ipHash, issuedAtRaw, validAfterRaw, nonce, signature] = parts;
  const issuedAt = Number(issuedAtRaw);
  const validAfter = Number(validAfterRaw);
  if (!SAFE_SEGMENT.test(pollId) || !SAFE_SEGMENT.test(voterTag) || !SAFE_SEGMENT.test(ipHash)) return null;
  if (!Number.isSafeInteger(issuedAt) || !Number.isSafeInteger(validAfter) || !NONCE_RE.test(nonce) || !signature) return null;
  const payload = { pollId, voterTag, ipHash, issuedAt, validAfter, nonce };
  return { payload, body: encodeTicketBody(payload), signature };
}

export type TicketCheck =
  | { ok: true; payload: TicketPayload }
  | { ok: false; reason: "invalid" | "expired" | "wrong_poll" | "wrong_voter" | "wrong_network" }
  | { ok: false; reason: "wait"; retryAfterSeconds: number };

export function checkTicketClaims(
  payload: TicketPayload,
  expected: { pollId: string; voterKey: string; ipHash: string },
  now: number,
): TicketCheck {
  if (payload.pollId !== expected.pollId) return { ok: false, reason: "wrong_poll" };
  if (payload.voterTag !== voterTagOf(expected.voterKey)) return { ok: false, reason: "wrong_voter" };
  if (payload.ipHash !== expected.ipHash) return { ok: false, reason: "wrong_network" };
  if (payload.issuedAt > now + 5_000) return { ok: false, reason: "invalid" };
  if (now - payload.issuedAt > TICKET_TTL_MS) return { ok: false, reason: "expired" };
  if (now < payload.validAfter) return { ok: false, reason: "wait", retryAfterSeconds: Math.ceil((payload.validAfter - now) / 1000) };
  return { ok: true, payload };
}

// ---- Parcial / vencedor ----

export type VoteShare = { choiceId: string; votes: number; percent: number };

// Percentuais inteiros que somam 100 (maior resto). Ordem: votos, depois a ordem de entrada.
export function computeVoteShares(counts: Record<string, number>, order: string[] = []): VoteShare[] {
  const entries = Object.entries(counts).filter(([, votes]) => votes > 0);
  const total = entries.reduce((sum, [, votes]) => sum + votes, 0);
  if (total === 0) return [];
  const position = new Map(order.map((id, index) => [id, index]));
  const sorted = entries.sort((a, b) => b[1] - a[1] || (position.get(a[0]) ?? 1e9) - (position.get(b[0]) ?? 1e9) || a[0].localeCompare(b[0]));
  const raw = sorted.map(([choiceId, votes]) => ({ choiceId, votes, exact: (votes / total) * 100 }));
  const floors = raw.map((item) => Math.floor(item.exact));
  let remaining = 100 - floors.reduce((sum, value) => sum + value, 0);
  const byRemainder = raw.map((item, index) => ({ index, rest: item.exact - floors[index] })).sort((a, b) => b.rest - a.rest);
  for (const item of byRemainder) {
    if (remaining <= 0) break;
    floors[item.index] += 1;
    remaining -= 1;
  }
  return raw.map((item, index) => ({ choiceId: item.choiceId, votes: item.votes, percent: floors[index] }));
}

// Empate no topo: todos levam.
export function resolveTopChoiceIds(counts: Record<string, number>): string[] {
  const max = Math.max(0, ...Object.values(counts));
  if (max <= 0) return [];
  return Object.entries(counts)
    .filter(([, votes]) => votes === max)
    .map(([choiceId]) => choiceId);
}

// ---- Auditoria ----

export type AuditVote = { id: string; ipHash: string | null; uaHash: string | null; voided: boolean; createdAt: string };
export type AuditLevel = "suspect" | "watch" | "none";
export type AuditGroup = { ipHash: string; total: number; active: number; browsers: number; level: AuditLevel; votes: AuditVote[] };

// Agrupa por rede; só redes com 3+ votos. "suspeito" = muitos votos por navegador (mesmo aparelho
// limpando cookie/aba anônima).
export function buildAuditGroups(votes: AuditVote[]): AuditGroup[] {
  const groups = new Map<string, AuditVote[]>();
  for (const vote of votes) {
    const key = vote.ipHash ?? UNKNOWN_NETWORK;
    const list = groups.get(key) ?? [];
    list.push(vote);
    groups.set(key, list);
  }
  const order: Record<AuditLevel, number> = { suspect: 0, watch: 1, none: 2 };
  return [...groups.entries()]
    .filter(([, list]) => list.length >= 3)
    .map(([ipHash, list]) => {
      const browsers = new Set(list.map((vote) => vote.uaHash ?? "")).size;
      const level: AuditLevel = list.length < 5 ? "none" : list.length / Math.max(1, browsers) >= 3 ? "suspect" : "watch";
      return { ipHash, total: list.length, active: list.filter((vote) => !vote.voided).length, browsers, level, votes: list };
    })
    .sort((a, b) => order[a.level] - order[b.level] || b.total - a.total);
}

// "Manter 1 por navegador": o voto ativo mais antigo de cada navegador fica; o resto é anulado.
export function votesToVoidKeepingOnePerBrowser(votes: AuditVote[]): string[] {
  const kept = new Set<string>();
  const toVoid: string[] = [];
  for (const vote of [...votes].filter((v) => !v.voided).sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const browser = vote.uaHash ?? "";
    if (kept.has(browser)) toVoid.push(vote.id);
    else kept.add(browser);
  }
  return toVoid;
}
