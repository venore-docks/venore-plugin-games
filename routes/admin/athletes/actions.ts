"use server";

import { deleteAthlete, saveAthlete } from "../../../runtime/competitions";
import { getSnapshotById } from "../../../runtime/snapshot";
import { isUuid } from "../../../shared/ids";
import { INVALID_INPUT, type ActionResult } from "../_shared/action-result";
import { bool, oneOf, optInt, optText, text } from "../_shared/input";
import { fromOperation, guard } from "../_shared/server";

const GENDERS = ["male", "female"] as const;

export async function saveAthleteAction(
  id: unknown,
  input: { participantId: unknown; name: unknown; number: unknown; gender: unknown; position: unknown; isCaptain: unknown; photoMediaId: unknown; bio: unknown },
): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  if (id !== null && !isUuid(id)) return INVALID_INPUT;
  if (!isUuid(input?.participantId)) return { ok: false, message: "Escolha a equipe do atleta." };
  const result = await saveAthlete(gate.competitionId, id, {
    participantId: input.participantId,
    name: text(input.name, 80),
    number: optInt(input.number, 0, 999),
    gender: oneOf(input.gender, GENDERS),
    position: optText(input.position, 30),
    isCaptain: bool(input.isCaptain),
    photoMediaId: optText(input.photoMediaId, 64),
    bio: optText(input.bio, 2000),
  });
  if (!result.success) return { ok: false, message: result.error.message };
  return { ok: true, id: result.data.id };
}

export async function deleteAthleteAction(id: unknown): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  if (!isUuid(id)) return INVALID_INPUT;
  // deleteAthlete não filtra por competição: a checagem de posse fica aqui.
  const snapshot = await getSnapshotById(gate.competitionId);
  if (!snapshot?.athletes.some((athlete) => athlete.id === id)) return { ok: false, message: "Atleta não encontrado." };
  return fromOperation(await deleteAthlete(gate.competitionId, id));
}
