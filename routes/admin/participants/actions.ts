"use server";

import { deleteParticipant, getParticipantDeleteImpact, saveParticipant, type ParticipantDeleteImpact } from "../../../runtime/competitions";
import { getSnapshotById } from "../../../runtime/snapshot";
import { isIsoDate } from "../../../shared/timezone";
import { isUuid } from "../../../shared/ids";
import { INVALID_INPUT, type ActionResult } from "../_shared/action-result";
import { intIn, optHex, optText, text } from "../_shared/input";
import { fromOperation, guard } from "../_shared/server";

export async function saveParticipantAction(
  id: unknown,
  input: { name: unknown; shortName: unknown; crestMediaId: unknown; primaryColor: unknown; secondaryColor: unknown; description: unknown; foundedDate: unknown; sortOrder: unknown },
): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  if (id !== null && !isUuid(id)) return INVALID_INPUT;
  const foundedDate = optText(input?.foundedDate, 10);
  if (foundedDate && !isIsoDate(foundedDate)) return { ok: false, message: "Data de fundação inválida." };
  const result = await saveParticipant(gate.competitionId, id, {
    name: text(input.name, 60),
    shortName: optText(input.shortName, 8)?.toUpperCase() ?? null,
    crestMediaId: optText(input.crestMediaId, 64),
    primaryColor: optHex(input.primaryColor),
    secondaryColor: optHex(input.secondaryColor),
    description: optText(input.description, 2000),
    foundedDate,
    sortOrder: intIn(input.sortOrder, 0, 9999, 0),
  });
  if (!result.success) return { ok: false, message: result.error.message };
  return { ok: true, id: result.data.id };
}

async function belongs(competitionId: string, participantId: string): Promise<boolean> {
  const snapshot = await getSnapshotById(competitionId);
  return Boolean(snapshot?.participants.some((participant) => participant.id === participantId));
}

export async function getParticipantDeleteImpactAction(id: unknown): Promise<{ ok: true; impact: ParticipantDeleteImpact } | { ok: false; message: string }> {
  const gate = await guard();
  if (!gate.ok) return gate;
  if (!isUuid(id) || !(await belongs(gate.competitionId, id))) return { ok: false, message: "Equipe não encontrada." };
  const impact = await getParticipantDeleteImpact(id);
  return { ok: true, impact };
}

export async function deleteParticipantAction(id: unknown): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  if (!isUuid(id) || !(await belongs(gate.competitionId, id))) return { ok: false, message: "Equipe não encontrada." };
  return fromOperation(await deleteParticipant(gate.competitionId, id));
}
