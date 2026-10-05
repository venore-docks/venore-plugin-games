import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getCache, setCache } from "@venore/plugin-sdk";
import { getSetting } from "@venore/plugin-sdk/settings";
import { athletes, matches, participants, voteNetworkSlots, votePolls, voteTallies, votes } from "../database/schema";
import type { CompetitionSnapshot, MatchStatus, PollOpenMode, PollTallies, PollView } from "../contracts/types";
import { GAMES_SETTINGS, clampInt } from "../shared/settings";
import { clampPolicyValue, DEFAULT_VOTE_COST_POLICY, reserveVoteSlot, type VoteCostPolicy } from "../shared/vote-cost";
import {
  checkTicketClaims,
  decodeTicket,
  encodeTicketBody,
  normalizeIpForGrouping,
  pickTrustedClientIp,
  resolveMatchPollWindow,
  resolveParticipantPollOpen,
  resolveTopChoiceIds,
  UNKNOWN_NETWORK,
  voterTagOf,
  votesToVoidKeepingOnePerBrowser,
  type AuditVote,
  type PollWindow,
} from "../shared/votes";
import { indexes } from "../shared/derive";
import { isUuid } from "../shared/ids";
import { bumpDataVersion, db, isUniqueViolation, type Tx } from "./db";
import { verifyTurnstileToken } from "./turnstile";
import { fail, ok, type OperationResult } from "./result";

// Votação da torcida, SEM login (decisão do produto), endurecida contra as brechas usadas no
// Erasto League (docs/arquitetura.md §6):
// - espera ACUMULADA por rede (fila em vote_network_slots, sob lock na emissão do ticket);
// - ticket assinado preso à votação, ao aparelho (cookie) e à rede;
// - IP só de cabeçalho de confiança; sem segredo de servidor a votação fica fechada;
// - contagem agregada mantida na transação do voto (nunca COUNT(*) por visita) e voto NÃO sobe a
//   versão do snapshot (senão o pico de votos recarregaria o site inteiro a cada voto).

const VOTER_COOKIE = "games_voter";
const VOTER_COOKIE_MAX_AGE_S = 400 * 24 * 60 * 60;

function serverSecret(): string | null {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  return secret && secret.length >= 16 ? secret : null;
}

function keyedHash(secret: string, namespace: string, value: string, length: number): string {
  return createHmac("sha256", `games:${namespace}:${secret}`).update(value).digest("hex").slice(0, length);
}

function voterKeyFromToken(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 40);
}

function isValidToken(token: string | undefined): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{32,64}$/.test(token);
}

export async function readVoterKey(): Promise<string | null> {
  const token = (await cookies()).get(VOTER_COOKIE)?.value;
  return isValidToken(token) ? voterKeyFromToken(token) : null;
}

type Identity = { voterKey: string; ipHash: string; uaHash: string | null };

// Só em Server Action (cookies() gravável).
async function ensureIdentity(secret: string): Promise<Identity> {
  const cookieStore = await cookies();
  let token = cookieStore.get(VOTER_COOKIE)?.value;
  if (!isValidToken(token)) token = randomBytes(24).toString("base64url");
  cookieStore.set(VOTER_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: VOTER_COOKIE_MAX_AGE_S });
  const headerList = await headers();
  const ip = normalizeIpForGrouping(
    pickTrustedClientIp((name) => headerList.get(name), { onVercel: Boolean(process.env.VERCEL), trustedHeader: process.env.GAMES_TRUSTED_IP_HEADER?.trim() || null }),
  );
  const userAgent = headerList.get("user-agent")?.trim() ?? "";
  return {
    voterKey: voterKeyFromToken(token),
    ipHash: ip ? keyedHash(secret, "ip", ip, 16) : UNKNOWN_NETWORK,
    uaHash: userAgent ? keyedHash(secret, "ua", userAgent, 12) : null,
  };
}

function signTicket(secret: string, body: string): string {
  return createHmac("sha256", `games:vote-ticket:${secret}`).update(body).digest("base64url").slice(0, 32);
}

function verifySignature(secret: string, body: string, signature: string): boolean {
  const expected = Buffer.from(signTicket(secret, body));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// ---- Configuração ----

async function readNumberSetting(key: string, fallback: number): Promise<number> {
  const result = await getSetting({ key, skipCache: true });
  const value = result.success && result.data ? Number(result.data.value) : NaN;
  return Number.isFinite(value) ? value : fallback;
}

export async function readVotePolicy(): Promise<VoteCostPolicy> {
  const [base, step, max, cap] = await Promise.all([
    readNumberSetting(GAMES_SETTINGS.voteWaitBaseSeconds.key, DEFAULT_VOTE_COST_POLICY.baseSeconds),
    readNumberSetting(GAMES_SETTINGS.voteWaitStepSeconds.key, DEFAULT_VOTE_COST_POLICY.stepSeconds),
    readNumberSetting(GAMES_SETTINGS.voteWaitMaxSeconds.key, DEFAULT_VOTE_COST_POLICY.maxSeconds),
    readNumberSetting(GAMES_SETTINGS.voteMaxPerNetwork.key, DEFAULT_VOTE_COST_POLICY.maxPerNetwork),
  ]);
  return {
    baseSeconds: clampPolicyValue(base, DEFAULT_VOTE_COST_POLICY.baseSeconds),
    stepSeconds: clampPolicyValue(step, DEFAULT_VOTE_COST_POLICY.stepSeconds),
    maxSeconds: clampPolicyValue(max, DEFAULT_VOTE_COST_POLICY.maxSeconds),
    maxPerNetwork: clampPolicyValue(cap, DEFAULT_VOTE_COST_POLICY.maxPerNetwork, 10_000),
  };
}

export async function readVoteWindowHours(): Promise<number> {
  const result = await getSetting({ key: GAMES_SETTINGS.fanVoteWindowHours.key });
  return clampInt(result.success && result.data ? result.data.value : undefined, 1, 24 * 30, GAMES_SETTINGS.fanVoteWindowHours.defaultValue);
}

// ---- Estado da votação ----

type PollRow = typeof votePolls.$inferSelect;

async function pollState(tx: Tx | typeof db, poll: PollRow, windowHours: number, now: number): Promise<{ window: PollWindow; match: typeof matches.$inferSelect | null }> {
  if (poll.kind === "participant") {
    const open = resolveParticipantPollOpen(poll.openMode as PollOpenMode);
    return { window: { isOpen: open, opensAt: null, closesAt: null, closedForGood: !open }, match: null };
  }
  const [match] = poll.matchId ? await tx.select().from(matches).where(eq(matches.id, poll.matchId)) : [];
  if (!match) return { window: { isOpen: false, opensAt: null, closesAt: null, closedForGood: true }, match: null };
  return {
    window: resolveMatchPollWindow(
      { status: match.status as MatchStatus, startedAt: match.startedAt?.toISOString() ?? null, finishedAt: match.finishedAt?.toISOString() ?? null },
      poll.openMode as PollOpenMode,
      windowHours,
      now,
    ),
    match,
  };
}

export function pollWindowFromSnapshot(snapshot: CompetitionSnapshot, poll: PollView, windowHours: number, now: number): PollWindow {
  if (poll.kind === "participant") {
    const open = resolveParticipantPollOpen(poll.openMode);
    return { isOpen: open, opensAt: null, closesAt: null, closedForGood: !open };
  }
  const match = poll.matchId ? indexes(snapshot).matches.get(poll.matchId) : undefined;
  if (!match) return { isOpen: false, opensAt: null, closesAt: null, closedForGood: true };
  return resolveMatchPollWindow(match, poll.openMode, windowHours, now);
}

// ---- Ticket ----

export type TicketResult =
  | { status: "ticket"; ticket: string; waitSeconds: number }
  | { status: "already_voted"; choiceId: string }
  | { status: "closed" | "network_cap" | "unavailable" | "not_found" };

export async function requestVoteTicket(pollId: string): Promise<TicketResult> {
  const secret = serverSecret();
  if (!secret) return { status: "unavailable" };
  if (!isUuid(pollId)) return { status: "not_found" };
  const identity = await ensureIdentity(secret);
  const [policy, windowHours] = await Promise.all([readVotePolicy(), readVoteWindowHours()]);
  const now = Date.now();

  return db.transaction(async (tx) => {
    const [poll] = await tx.select().from(votePolls).where(eq(votePolls.id, pollId));
    if (!poll) return { status: "not_found" as const };
    const { window } = await pollState(tx, poll, windowHours, now);
    if (!window.isOpen) return { status: "closed" as const };

    const [existing] = await tx.select().from(votes).where(and(eq(votes.pollId, pollId), eq(votes.voterKey, identity.voterKey)));
    if (existing && poll.kind === "match_athlete") return { status: "already_voted" as const, choiceId: existing.choiceId };

    // Fila da rede: lock por (votação, rede) — tickets pedidos ao mesmo tempo entram em sequência.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`games:vote:${pollId}:${identity.ipHash}`}, 0))`);
    const [slot] = await tx.select().from(voteNetworkSlots).where(and(eq(voteNetworkSlots.pollId, pollId), eq(voteNetworkSlots.ipHash, identity.ipHash)));
    const state = { issued: slot?.issued ?? 0, nextSlotAtMs: slot?.nextSlotAt?.getTime() ?? null };

    let validAfter: number;
    if (existing) {
      // Troca do Time favorito pelo mesmo aparelho: espera base, não conta como voto novo da rede
      // (nem trava a troca quando a rede bateu o teto).
      validAfter = now + policy.baseSeconds * 1000;
    } else {
      const reservation = reserveVoteSlot(state, policy, now);
      if (!reservation.ok) return { status: "network_cap" as const };
      validAfter = reservation.validAfterMs;
      await tx
        .insert(voteNetworkSlots)
        .values({ pollId, ipHash: identity.ipHash, issued: reservation.issued, nextSlotAt: new Date(reservation.nextSlotAtMs) })
        .onConflictDoUpdate({
          target: [voteNetworkSlots.pollId, voteNetworkSlots.ipHash],
          set: { issued: reservation.issued, nextSlotAt: new Date(reservation.nextSlotAtMs), updatedAt: new Date() },
        });
    }

    const body = encodeTicketBody({
      pollId,
      voterTag: voterTagOf(identity.voterKey),
      ipHash: identity.ipHash,
      issuedAt: now,
      validAfter,
      nonce: randomBytes(12).toString("base64url"),
    });
    return { status: "ticket" as const, ticket: `${body}.${signTicket(secret, body)}`, waitSeconds: Math.max(0, Math.ceil((validAfter - now) / 1000)) };
  });
}

// ---- Voto ----

export type CastResult =
  | { status: "voted"; choiceId: string; changed: boolean }
  | { status: "already_voted"; choiceId: string }
  | { status: "wait"; retryAfterSeconds: number }
  | { status: "invalid_ticket" | "closed" | "invalid_choice" | "bot_check" | "unavailable" };

export async function castVote(input: { pollId: string; choiceId: string; ticket: string; turnstileToken: string | null }): Promise<CastResult> {
  const secret = serverSecret();
  if (!secret) return { status: "unavailable" };
  if (!isUuid(input.pollId) || !isUuid(input.choiceId)) return { status: "invalid_choice" };
  const decoded = decodeTicket(input.ticket);
  if (!decoded || !verifySignature(secret, decoded.body, decoded.signature)) return { status: "invalid_ticket" };

  const identity = await ensureIdentity(secret);
  const now = Date.now();
  const claims = checkTicketClaims(decoded.payload, { pollId: input.pollId, voterKey: identity.voterKey, ipHash: identity.ipHash }, now);
  if (!claims.ok) return claims.reason === "wait" ? { status: "wait", retryAfterSeconds: claims.retryAfterSeconds } : { status: "invalid_ticket" };

  // Turnstile depois da espera: uma resposta "espere mais" não gasta o token.
  if (!(await verifyTurnstileToken(input.turnstileToken))) return { status: "bot_check" };

  const windowHours = await readVoteWindowHours();
  try {
    return await db.transaction(async (tx) => {
      const [poll] = await tx.select().from(votePolls).where(eq(votePolls.id, input.pollId));
      if (!poll) return { status: "closed" as const };
      const { window, match } = await pollState(tx, poll, windowHours, now);
      if (!window.isOpen) return { status: "closed" as const };

      if (!(await isValidChoice(tx, poll, match, input.choiceId))) return { status: "invalid_choice" as const };

      const [existing] = await tx.select().from(votes).where(and(eq(votes.pollId, poll.id), eq(votes.voterKey, identity.voterKey))).for("update");
      if (existing && poll.kind === "match_athlete") return { status: "already_voted" as const, choiceId: existing.choiceId };

      if (existing) {
        if (existing.choiceId === input.choiceId) return { status: "voted" as const, choiceId: input.choiceId, changed: false };
        await tx
          .update(votes)
          .set({ choiceId: input.choiceId, ticketNonce: decoded.payload.nonce, uaHash: identity.uaHash, updatedAt: new Date() })
          .where(eq(votes.id, existing.id));
        if (!existing.voidedAt) {
          await adjustTally(tx, poll.id, existing.choiceId, -1);
          await adjustTally(tx, poll.id, input.choiceId, 1);
        }
        return { status: "voted" as const, choiceId: input.choiceId, changed: true };
      }

      await tx.insert(votes).values({
        pollId: poll.id,
        choiceId: input.choiceId,
        voterKey: identity.voterKey,
        ipHash: identity.ipHash,
        uaHash: identity.uaHash,
        ticketNonce: decoded.payload.nonce,
      });
      await adjustTally(tx, poll.id, input.choiceId, 1);
      return { status: "voted" as const, choiceId: input.choiceId, changed: false };
    });
  } catch (error) {
    // Nonce repetido (ticket reusado) ou voto concorrente do mesmo aparelho.
    if (isUniqueViolation(error)) return { status: "invalid_ticket" };
    throw error;
  } finally {
    invalidateTallies(input.pollId);
  }
}

async function isValidChoice(tx: Tx, poll: PollRow, match: typeof matches.$inferSelect | null, choiceId: string): Promise<boolean> {
  if (poll.kind === "participant") {
    const [row] = await tx.select({ id: participants.id }).from(participants).where(and(eq(participants.id, choiceId), eq(participants.competitionId, poll.competitionId)));
    return Boolean(row);
  }
  if (!match?.homeParticipantId || !match.awayParticipantId) return false;
  const [row] = await tx
    .select({ id: athletes.id })
    .from(athletes)
    .where(and(eq(athletes.id, choiceId), inArray(athletes.participantId, [match.homeParticipantId, match.awayParticipantId])));
  return Boolean(row);
}

async function adjustTally(tx: Tx, pollId: string, choiceId: string, delta: number): Promise<void> {
  await tx
    .insert(voteTallies)
    .values({ pollId, choiceId, count: Math.max(0, delta) })
    .onConflictDoUpdate({ target: [voteTallies.pollId, voteTallies.choiceId], set: { count: sql`greatest(0, ${voteTallies.count} + ${delta})` } });
}

// Recontagem a partir dos votos (depois de anular/restaurar em lote).
async function recountTallies(tx: Tx, pollId: string): Promise<void> {
  await tx.delete(voteTallies).where(eq(voteTallies.pollId, pollId));
  await tx.execute(sql`
    insert into games.vote_tallies (poll_id, choice_id, count)
    select poll_id, choice_id, count(*)::int from games.votes
    where poll_id = ${pollId} and voided_at is null
    group by poll_id, choice_id
  `);
}

// ---- Parcial (cache curto por processo) ----

const TALLY_TTL_OPEN_S = 10;
const TALLY_TTL_CLOSED_S = 60 * 30;

function tallyKey(pollId: string) {
  return `games:tallies:${pollId}`;
}

function invalidateTallies(pollId: string) {
  setCache(tallyKey(pollId), null, 0);
}

export async function getPollTallies(pollIds: string[], closedPollIds: Set<string> = new Set()): Promise<Map<string, PollTallies>> {
  const result = new Map<string, PollTallies>();
  const missing: string[] = [];
  for (const id of pollIds) {
    const cached = getCache<PollTallies>(tallyKey(id));
    if (cached) result.set(id, cached);
    else missing.push(id);
  }
  if (missing.length > 0) {
    const rows = await db.select().from(voteTallies).where(inArray(voteTallies.pollId, missing));
    for (const id of missing) {
      const counts: Record<string, number> = {};
      let total = 0;
      for (const row of rows) {
        if (row.pollId !== id || row.count <= 0) continue;
        counts[row.choiceId] = row.count;
        total += row.count;
      }
      const tallies = { pollId: id, counts, total };
      result.set(id, tallies);
      setCache(tallyKey(id), tallies, closedPollIds.has(id) ? TALLY_TTL_CLOSED_S : TALLY_TTL_OPEN_S);
    }
  }
  return result;
}

// Craque(s) da torcida de cada jogo com votação encerrada de vez (empate: todos levam).
export async function resolveFanAwards(snapshot: CompetitionSnapshot, windowHours: number, now: number): Promise<Map<string, string[]>> {
  const closed = snapshot.polls.filter((poll) => poll.kind === "match_athlete" && pollWindowFromSnapshot(snapshot, poll, windowHours, now).closedForGood);
  const tallies = await getPollTallies(
    closed.map((poll) => poll.id),
    new Set(closed.map((poll) => poll.id)),
  );
  const awards = new Map<string, string[]>();
  for (const poll of closed) {
    if (!poll.matchId) continue;
    const winners = resolveTopChoiceIds(tallies.get(poll.id)?.counts ?? {});
    if (winners.length > 0) awards.set(poll.matchId, winners);
  }
  return awards;
}

// ---- Admin ----

export async function setPollOpenMode(competitionId: string, pollId: string, openMode: PollOpenMode): Promise<OperationResult<void>> {
  if (!["auto", "open", "closed"].includes(openMode)) return fail("games.poll.mode_invalid", "Modo inválido.");
  await db.transaction(async (tx) => {
    await tx.update(votePolls).set({ openMode }).where(and(eq(votePolls.id, pollId), eq(votePolls.competitionId, competitionId)));
    await bumpDataVersion(tx, competitionId);
  });
  invalidateTallies(pollId);
  return ok(undefined);
}

export async function ensureParticipantPoll(competitionId: string, title: string): Promise<OperationResult<{ id: string }>> {
  const [existing] = await db.select().from(votePolls).where(and(eq(votePolls.competitionId, competitionId), eq(votePolls.kind, "participant"), isNull(votePolls.matchId)));
  if (existing) return ok({ id: existing.id });
  const id = await db.transaction(async (tx) => {
    const [row] = await tx.insert(votePolls).values({ competitionId, kind: "participant", title: title.trim() || "Equipe favorita" }).returning({ id: votePolls.id });
    await bumpDataVersion(tx, competitionId);
    return row.id;
  });
  return ok({ id });
}

// Nova temporada: zera os votos de uma votação (sem volta).
export async function resetPollVotes(competitionId: string, pollId: string): Promise<OperationResult<void>> {
  await db.transaction(async (tx) => {
    const [poll] = await tx.select().from(votePolls).where(and(eq(votePolls.id, pollId), eq(votePolls.competitionId, competitionId)));
    if (!poll) return;
    await tx.delete(votes).where(eq(votes.pollId, pollId));
    await tx.delete(voteTallies).where(eq(voteTallies.pollId, pollId));
    await tx.delete(voteNetworkSlots).where(eq(voteNetworkSlots.pollId, pollId));
  });
  invalidateTallies(pollId);
  return ok(undefined);
}

export async function listAuditVotes(pollId: string): Promise<AuditVote[]> {
  const rows = await db
    .select({ id: votes.id, ipHash: votes.ipHash, uaHash: votes.uaHash, voidedAt: votes.voidedAt, createdAt: votes.createdAt })
    .from(votes)
    .where(eq(votes.pollId, pollId));
  return rows.map((row) => ({ id: row.id, ipHash: row.ipHash, uaHash: row.uaHash, voided: row.voidedAt !== null, createdAt: row.createdAt.toISOString() }));
}

export type AuditAction = "keep_one_per_browser" | "void_all" | "restore";

export async function applyAuditAction(competitionId: string, pollId: string, ipHash: string, action: AuditAction): Promise<OperationResult<{ affected: number }>> {
  const affected = await db.transaction(async (tx) => {
    const [poll] = await tx.select().from(votePolls).where(and(eq(votePolls.id, pollId), eq(votePolls.competitionId, competitionId)));
    if (!poll) return 0;
    // Lock da rede: um voto novo entrando no meio não é anulado por engano.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`games:vote:${pollId}:${ipHash}`}, 0))`);
    const rows = await tx
      .select({ id: votes.id, ipHash: votes.ipHash, uaHash: votes.uaHash, voidedAt: votes.voidedAt, createdAt: votes.createdAt })
      .from(votes)
      .where(and(eq(votes.pollId, pollId), eq(votes.ipHash, ipHash)))
      .for("update");
    let ids: string[] = [];
    if (action === "restore") {
      ids = rows.filter((row) => row.voidedAt).map((row) => row.id);
      if (ids.length) await tx.update(votes).set({ voidedAt: null }).where(inArray(votes.id, ids));
    } else {
      const audit = rows.map((row) => ({ id: row.id, ipHash: row.ipHash, uaHash: row.uaHash, voided: row.voidedAt !== null, createdAt: row.createdAt.toISOString() }));
      ids = action === "void_all" ? audit.filter((vote) => !vote.voided).map((vote) => vote.id) : votesToVoidKeepingOnePerBrowser(audit);
      if (ids.length) await tx.update(votes).set({ voidedAt: new Date() }).where(inArray(votes.id, ids));
    }
    await recountTallies(tx, pollId);
    return ids.length;
  });
  invalidateTallies(pollId);
  return ok({ affected });
}

export async function countVotesByPoll(competitionId: string): Promise<Map<string, { total: number; voided: number }>> {
  const rows = await db
    .select({
      pollId: votes.pollId,
      total: sql<number>`count(*)::int`,
      voided: sql<number>`count(${votes.voidedAt})::int`,
    })
    .from(votes)
    .innerJoin(votePolls, eq(votePolls.id, votes.pollId))
    .where(eq(votePolls.competitionId, competitionId))
    .groupBy(votes.pollId);
  return new Map(rows.map((row) => [row.pollId, { total: row.total, voided: row.voided }]));
}

