"use server";

import { setSetting } from "@venore/plugin-sdk/settings";
import { applyAuditAction, ensureParticipantPoll, resetPollVotes, setPollOpenMode, type AuditAction } from "../../../runtime/votes";
import { getSnapshotById } from "../../../runtime/snapshot";
import { GAMES_SETTINGS } from "../../../shared/settings";
import { isUuid } from "../../../shared/ids";
import type { PollOpenMode } from "../../../contracts/types";
import { INVALID_INPUT, type ActionResult } from "../_shared/action-result";
import { intIn, oneOf, text } from "../_shared/input";
import { fromOperation, guard } from "../_shared/server";
import { VOTE_SETTING_LIMITS, type VoteSettingsValues } from "../_shared/settings-read";

const OPEN_MODES: readonly PollOpenMode[] = ["auto", "open", "closed"];
const AUDIT_ACTIONS: readonly AuditAction[] = ["keep_one_per_browser", "void_all", "restore"];
// Hash de rede: hex do HMAC, "unknown" ou o formato herdado da migração — nunca texto livre.
const IP_HASH = /^[A-Za-z0-9:_./+=-]{1,128}$/;

async function pollBelongs(competitionId: string, pollId: string): Promise<boolean> {
  const snapshot = await getSnapshotById(competitionId);
  return Boolean(snapshot?.polls.some((poll) => poll.id === pollId));
}

export async function setPollOpenModeAction(pollId: unknown, mode: unknown): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  const openMode = oneOf(mode, OPEN_MODES);
  if (!isUuid(pollId) || !openMode) return INVALID_INPUT;
  return fromOperation(await setPollOpenMode(gate.competitionId, pollId, openMode));
}

export async function ensureParticipantPollAction(title: unknown): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  const result = await ensureParticipantPoll(gate.competitionId, text(title, 80) || "Equipe favorita");
  if (!result.success) return { ok: false, message: result.error.message };
  return { ok: true, id: result.data.id };
}

export async function resetPollVotesAction(pollId: unknown): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  if (!isUuid(pollId) || !(await pollBelongs(gate.competitionId, pollId))) return { ok: false, message: "Votação não encontrada." };
  return fromOperation(await resetPollVotes(gate.competitionId, pollId));
}

export async function applyAuditActionAction(pollId: unknown, ipHash: unknown, action: unknown): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  const parsed = oneOf(action, AUDIT_ACTIONS);
  if (!isUuid(pollId) || typeof ipHash !== "string" || !IP_HASH.test(ipHash) || !parsed) return INVALID_INPUT;
  const result = await applyAuditAction(gate.competitionId, pollId, ipHash, parsed);
  if (!result.success) return { ok: false, message: result.error.message };
  const affected = result.data.affected;
  return { ok: true, message: affected === 0 ? "Nada a mudar nessa rede." : `${affected} voto(s) ${parsed === "restore" ? "restaurado(s)" : "anulado(s)"}.` };
}

export async function saveVoteSettingsAction(values: Record<string, unknown>): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  if (!values || typeof values !== "object") return INVALID_INPUT;
  const fields = Object.keys(VOTE_SETTING_LIMITS) as (keyof VoteSettingsValues)[];
  for (const field of fields) {
    const { min, max } = VOTE_SETTING_LIMITS[field];
    const value = intIn(values[field], min, max, GAMES_SETTINGS[field].defaultValue);
    const saved = await setSetting({ key: GAMES_SETTINGS[field].key, value });
    if (!saved.success) return { ok: false, message: `${saved.error.message} (gravar configurações exige settings.manage ou games.settings.manage)` };
  }
  return { ok: true };
}
