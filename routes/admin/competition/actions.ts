"use server";

import {
  addScoreAdjustment,
  deletePowerBoost,
  deleteScoreAdjustment,
  saveLiveChannel,
  savePowerBoost,
  updateCompetition,
} from "../../../runtime/competitions";
import { getSnapshotById } from "../../../runtime/snapshot";
import { isUuid } from "../../../shared/ids";
import { INVALID_INPUT, type ActionResult } from "../_shared/action-result";
import { bool, finite, intIn, optText, optUuid, pointsList, text } from "../_shared/input";
import { fromOperation, guard } from "../_shared/server";

export async function updateCompetitionAction(input: {
  name: unknown;
  description: unknown;
  logoMediaId: unknown;
  overallEnabled: unknown;
  overallIncludesPartial: unknown;
  pointsTable: unknown;
}): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  const pointsTable = pointsList(input?.pointsTable);
  if (!pointsTable) return { ok: false, message: "Tabela de pontos inválida (use números maiores ou iguais a zero)." };
  return fromOperation(
    await updateCompetition(gate.competitionId, {
      name: text(input.name, 80),
      description: optText(input.description, 2000),
      logoMediaId: optText(input.logoMediaId, 64),
      overallEnabled: bool(input.overallEnabled),
      overallIncludesPartial: bool(input.overallIncludesPartial),
      pointsTable,
    }),
  );
}

export async function saveLiveChannelAction(id: unknown, name: unknown): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  if (id !== null && !isUuid(id)) return INVALID_INPUT;
  return fromOperation(await saveLiveChannel(gate.competitionId, id, text(name, 40)));
}

export async function savePowerBoostAction(id: unknown, input: { label: unknown; emoji: unknown; description: unknown; sortOrder: unknown }): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  if (id !== null && !isUuid(id)) return INVALID_INPUT;
  return fromOperation(
    await savePowerBoost(gate.competitionId, id, {
      label: text(input?.label, 40),
      emoji: text(input?.emoji, 8),
      description: optText(input?.description, 200),
      sortOrder: intIn(input?.sortOrder, 0, 999, 0),
    }),
  );
}

export async function deletePowerBoostAction(id: unknown): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  if (!isUuid(id)) return INVALID_INPUT;
  return fromOperation(await deletePowerBoost(gate.competitionId, id));
}

export async function addScoreAdjustmentAction(input: { participantId: unknown; modalityId: unknown; points: unknown; reason: unknown }): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  if (!isUuid(input?.participantId)) return { ok: false, message: "Escolha a equipe." };
  const modalityId = optUuid(input.modalityId);
  if (modalityId) {
    const snapshot = await getSnapshotById(gate.competitionId);
    if (!snapshot?.modalities.some((modality) => modality.id === modalityId)) return { ok: false, message: "Modalidade inválida." };
  }
  const points = finite(input.points);
  if (points === null || Math.abs(points) > 100_000) return { ok: false, message: "Informe os pontos (positivo = bônus, negativo = penalidade)." };
  return fromOperation(await addScoreAdjustment(gate.competitionId, { participantId: input.participantId, modalityId, points, reason: text(input.reason, 200) }));
}

export async function deleteScoreAdjustmentAction(id: unknown): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  if (!isUuid(id)) return INVALID_INPUT;
  return fromOperation(await deleteScoreAdjustment(gate.competitionId, id));
}
