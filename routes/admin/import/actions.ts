"use server";

import { importMatchesCsv, importParticipantsCsv, type ImportSummary } from "../../../runtime/admin-csv-import";
import { checkGamesAccess } from "../../../runtime/gate";
import { migrateFromErastoLeague } from "../../../runtime/migrate-erasto";
import { isUuid } from "../../../shared/ids";
import type { ActionResult } from "../_shared/action-result";
import { bool } from "../_shared/input";
import { guard } from "../_shared/server";

export type CsvImportState = { error: string | null; result: ImportSummary | null };

const MAX_BYTES = 2 * 1024 * 1024;

async function readCsv(formData: FormData): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Escolha um arquivo .csv." };
  if (file.size > MAX_BYTES) return { ok: false, error: "Arquivo grande demais (máx. 2 MB)." };
  return { ok: true, text: await file.text() };
}

export async function importParticipantsAction(_previous: CsvImportState, formData: FormData): Promise<CsvImportState> {
  const gate = await guard();
  if (!gate.ok) return { error: gate.message, result: null };
  const csv = await readCsv(formData);
  if (!csv.ok) return { error: csv.error, result: null };
  const modality = formData.get("modalityId");
  const result = await importParticipantsCsv(gate.competitionId, csv.text, { enrollModalityId: isUuid(modality) ? modality : null });
  return result.success ? { error: null, result: result.data } : { error: result.error.message, result: null };
}

export async function importMatchesAction(_previous: CsvImportState, formData: FormData): Promise<CsvImportState> {
  const gate = await guard();
  if (!gate.ok) return { error: gate.message, result: null };
  const modalityId = formData.get("modalityId");
  if (!isUuid(modalityId)) return { error: "Escolha a modalidade.", result: null };
  const csv = await readCsv(formData);
  if (!csv.ok) return { error: csv.error, result: null };
  const result = await importMatchesCsv(gate.competitionId, modalityId, csv.text, { replaceScheduled: bool(formData.get("replaceScheduled")) });
  return result.success ? { error: null, result: result.data } : { error: result.error.message, result: null };
}

// Migração não passa por requireGames: pode ser a primeira competição da instância.
export async function migrateErastoAction(): Promise<ActionResult> {
  const gate = await checkGamesAccess("manage");
  if (!gate.ok) return { ok: false, message: gate.reason === "unauthenticated" ? "Entre na sua conta para continuar." : "Você não tem permissão para esta ação." };
  const result = await migrateFromErastoLeague();
  if (!result.success) return { ok: false, message: result.error.message };
  const total = Object.values(result.data.counts).reduce((sum, value) => sum + value, 0);
  return { ok: true, id: result.data.competitionId, message: `Migração concluída (${total} registros). Torne a competição “Erasto League” ativa na visão geral, se ainda não for.` };
}
