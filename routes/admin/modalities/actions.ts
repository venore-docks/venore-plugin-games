"use server";

import type { CompetitionSnapshot, ModalityView } from "../../../contracts/types";
import {
  applyModalityStructure,
  deleteModality,
  deleteSavedTemplate,
  finalizeModality,
  listSavedTemplates,
  reopenModality,
  saveModality,
  saveStageResults,
  saveTemplateFromModality,
  setGroupMembers,
  setModalityEntries,
} from "../../../runtime/modalities";
import { getSnapshotById } from "../../../runtime/snapshot";
import { defaultModalityRules } from "../../../shared/modality-rules";
import { isSportProfileKey, SPORT_PROFILE_KEYS, type SportProfileKey } from "../../../shared/sport-profiles";
import { TIEBREAKER_KEYS } from "../../../shared/standings";
import { buildTemplateStages, DEFAULT_TEMPLATE_PARAMS, isBuiltinTemplateKey, sanitizeStages, type TemplateParams } from "../../../shared/templates";
import { isUuid } from "../../../shared/ids";
import { INVALID_INPUT, type ActionResult } from "../_shared/action-result";
import { bool, finite, intIn, oneOf, optText, pointsList, text, uuidList } from "../_shared/input";
import { fromOperation, guard } from "../_shared/server";

// Toda action confere que a modalidade/fase/grupo é da competição em edição ANTES de chamar o
// runtime (algumas funções de runtime filtram só pelo id).

async function findModality(competitionId: string, modalityId: unknown): Promise<{ snapshot: CompetitionSnapshot; modality: ModalityView } | null> {
  if (!isUuid(modalityId)) return null;
  const snapshot = await getSnapshotById(competitionId);
  const modality = snapshot?.modalities.find((candidate) => candidate.id === modalityId);
  return snapshot && modality ? { snapshot, modality } : null;
}

const NOT_FOUND: ActionResult = { ok: false, message: "Modalidade não encontrada." };

export async function createModalityAction(input: { name: unknown; sportProfile: unknown; emoji: unknown }): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  const profile = oneOf(input?.sportProfile, SPORT_PROFILE_KEYS);
  if (!profile) return { ok: false, message: "Escolha o tipo da modalidade." };
  const snapshot = await getSnapshotById(gate.competitionId);
  const result = await saveModality(gate.competitionId, null, {
    name: text(input.name, 60),
    emoji: optText(input.emoji, 8),
    description: null,
    coverMediaId: null,
    sportProfile: profile,
    rules: defaultModalityRules(profile),
    weight: 1,
    pointsTable: null,
    sortOrder: snapshot ? snapshot.modalities.length : 0,
  });
  if (!result.success) return { ok: false, message: result.error.message };
  return { ok: true, id: result.data.id };
}

// Regras chegam como objeto solto do formulário; só as chaves conhecidas passam (o runtime ainda
// limita cada número via resolveModalityRules).
function pickRules(raw: unknown, profile: SportProfileKey): Record<string, unknown> {
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const base = defaultModalityRules(profile);
  const numberKeys = ["pointsWin", "pointsDraw", "pointsLoss", "periodMinutes", "periodCount", "setsToWin", "pointsPerSet", "tieBreakPoints"] as const;
  const rules: Record<string, unknown> = {};
  for (const key of numberKeys) rules[key] = finite(input[key]) ?? base[key];
  for (const key of ["allowHalfPoints", "lowerIsBetter", "knockoutNeedsWinner"] as const) rules[key] = typeof input[key] === "boolean" ? input[key] : base[key];
  rules.measureUnit = text(input.measureUnit, 16);
  rules.tiebreakers = Array.isArray(input.tiebreakers) ? input.tiebreakers.filter((key) => typeof key === "string" && (TIEBREAKER_KEYS as string[]).includes(key)) : base.tiebreakers;
  return rules;
}

export async function saveModalityAction(
  modalityId: unknown,
  input: { name: unknown; emoji: unknown; description: unknown; coverMediaId: unknown; sportProfile: unknown; rules: unknown; weight: unknown; pointsTable: unknown; sortOrder: unknown },
): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  if (!(await findModality(gate.competitionId, modalityId))) return NOT_FOUND;
  const profile = isSportProfileKey(input?.sportProfile) ? input.sportProfile : null;
  if (!profile) return { ok: false, message: "Tipo de modalidade inválido." };
  const weight = finite(input.weight);
  if (weight === null || weight < 0 || weight > 100) return { ok: false, message: "Peso inválido (0 a 100)." };
  let pointsTable: number[] | null = null;
  if (input.pointsTable !== null && input.pointsTable !== undefined) {
    pointsTable = pointsList(input.pointsTable);
    if (!pointsTable) return { ok: false, message: "Tabela de pontos inválida." };
  }
  return fromOperation(
    await saveModality(gate.competitionId, modalityId as string, {
      name: text(input.name, 60),
      emoji: optText(input.emoji, 8),
      description: optText(input.description, 2000),
      coverMediaId: optText(input.coverMediaId, 64),
      sportProfile: profile,
      rules: pickRules(input.rules, profile),
      weight,
      pointsTable,
      sortOrder: intIn(input.sortOrder, 0, 999, 0),
    }),
  );
}

export async function deleteModalityAction(modalityId: unknown): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  if (!(await findModality(gate.competitionId, modalityId))) return NOT_FOUND;
  return fromOperation(await deleteModality(gate.competitionId, modalityId as string));
}

export async function setEntriesAction(modalityId: unknown, participantIds: unknown): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  if (!(await findModality(gate.competitionId, modalityId))) return NOT_FOUND;
  const ids = uuidList(participantIds);
  if (!ids) return INVALID_INPUT;
  return fromOperation(await setModalityEntries(gate.competitionId, modalityId as string, ids));
}

function sanitizeParams(raw: unknown): TemplateParams {
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    participantCount: intIn(input.participantCount, 2, 64, DEFAULT_TEMPLATE_PARAMS.participantCount),
    groupCount: intIn(input.groupCount, 1, 26, DEFAULT_TEMPLATE_PARAMS.groupCount),
    advancePerGroup: intIn(input.advancePerGroup, 1, 16, DEFAULT_TEMPLATE_PARAMS.advancePerGroup),
    knockoutSize: intIn(input.knockoutSize, 2, 64, DEFAULT_TEMPLATE_PARAMS.knockoutSize),
    doubleRound: bool(input.doubleRound),
    thirdPlace: bool(input.thirdPlace),
  };
}

export async function applyBuiltinTemplateAction(modalityId: unknown, key: unknown, params: unknown): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  if (!(await findModality(gate.competitionId, modalityId))) return NOT_FOUND;
  if (!isBuiltinTemplateKey(key)) return { ok: false, message: "Formato inválido." };
  const result = await applyModalityStructure(gate.competitionId, modalityId as string, buildTemplateStages(key, sanitizeParams(params)));
  if (!result.success) return { ok: false, message: result.error.message };
  return { ok: true, message: `Formato aplicado: ${result.data.matches} jogo(s) gerado(s).` };
}

export async function applySavedTemplateAction(modalityId: unknown, templateId: unknown): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  if (!(await findModality(gate.competitionId, modalityId))) return NOT_FOUND;
  if (!isUuid(templateId)) return INVALID_INPUT;
  const template = (await listSavedTemplates()).find((row) => row.id === templateId);
  if (!template) return { ok: false, message: "Template não encontrado." };
  const result = await applyModalityStructure(gate.competitionId, modalityId as string, sanitizeStages(template.stages));
  if (!result.success) return { ok: false, message: result.error.message };
  return { ok: true, message: `Template aplicado: ${result.data.matches} jogo(s) gerado(s).` };
}

export async function saveTemplateAction(modalityId: unknown, name: unknown, description: unknown): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  if (!(await findModality(gate.competitionId, modalityId))) return NOT_FOUND;
  return fromOperation(await saveTemplateFromModality(modalityId as string, text(name, 60), optText(description, 300)), { message: "Template salvo." });
}

export async function deleteSavedTemplateAction(templateId: unknown): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  if (!isUuid(templateId)) return INVALID_INPUT;
  return fromOperation(await deleteSavedTemplate(templateId));
}

export async function setGroupMembersAction(groupId: unknown, participantIds: unknown): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  if (!isUuid(groupId)) return INVALID_INPUT;
  const ids = uuidList(participantIds, 64);
  if (!ids) return INVALID_INPUT;
  const snapshot = await getSnapshotById(gate.competitionId);
  const stage = snapshot?.modalities.flatMap((modality) => modality.stages).find((candidate) => candidate.groups.some((group) => group.id === groupId));
  if (!stage) return { ok: false, message: "Grupo não encontrado." };
  return fromOperation(await setGroupMembers(gate.competitionId, groupId, ids, stage.config.doubleRound === true));
}

export async function saveStageResultsAction(
  stageId: unknown,
  results: unknown,
  close: unknown,
): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  if (!isUuid(stageId) || !Array.isArray(results) || results.length > 200) return INVALID_INPUT;
  const rows: { participantId: string; value: number | null; judgeScores: number[] | null; note: string | null }[] = [];
  for (const raw of results) {
    const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
    if (!row || !isUuid(row.participantId)) return INVALID_INPUT;
    const judgeScores = Array.isArray(row.judgeScores) ? row.judgeScores.slice(0, 20).map(finite).filter((score): score is number => score !== null) : null;
    rows.push({ participantId: row.participantId, value: finite(row.value), judgeScores: judgeScores && judgeScores.length > 0 ? judgeScores : null, note: optText(row.note, 200) });
  }
  return fromOperation(await saveStageResults(gate.competitionId, stageId, rows, bool(close)));
}

export async function finalizeModalityAction(modalityId: unknown, placements: unknown): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  if (!(await findModality(gate.competitionId, modalityId))) return NOT_FOUND;
  if (!Array.isArray(placements) || placements.length > 200) return INVALID_INPUT;
  const rows: { participantId: string; position: number }[] = [];
  for (const raw of placements) {
    const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
    if (!row || !isUuid(row.participantId)) return INVALID_INPUT;
    const position = intIn(row.position, 0, 999, 0);
    if (position >= 1) rows.push({ participantId: row.participantId, position });
  }
  return fromOperation(await finalizeModality(gate.competitionId, modalityId as string, rows));
}

export async function reopenModalityAction(modalityId: unknown): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  if (!(await findModality(gate.competitionId, modalityId))) return NOT_FOUND;
  return fromOperation(await reopenModality(gate.competitionId, modalityId as string));
}
