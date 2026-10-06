"use server";

import { setSetting } from "@venore/plugin-sdk/settings";
import { createCompetition, getCompetitionRow, listCompetitions } from "../../../runtime/competitions";
import { checkGamesAccess } from "../../../runtime/gate";
import { GAMES_SETTINGS } from "../../../shared/settings";
import { DEFAULT_PLACEMENT_POINTS } from "../../../shared/placement";
import { isUuid } from "../../../shared/ids";
import type { ActionResult } from "../_shared/action-result";
import { bool, intIn, optHex, optText, text } from "../_shared/input";

// Criar/ativar competição não passa por requireGames: ele exige uma competição existente, e aqui
// é justamente onde a primeira nasce.
async function manageGate(): Promise<ActionResult> {
  const gate = await checkGamesAccess("manage");
  if (gate.ok) return { ok: true };
  return { ok: false, message: gate.reason === "unauthenticated" ? "Entre na sua conta para continuar." : "Você não tem permissão para esta ação." };
}

const SETTINGS_HINT = " (gravar configurações exige a permissão settings.manage ou games.settings.manage)";

async function writeSetting(key: string, value: unknown): Promise<ActionResult> {
  const result = await setSetting({ key, value });
  if (result.success) return { ok: true };
  return { ok: false, message: result.error.message + (result.error.code.includes("forbidden") || result.error.code.includes("unauthorized") ? SETTINGS_HINT : "") };
}

export async function createCompetitionAction(input: { name: unknown; description: unknown; overallEnabled: unknown }): Promise<ActionResult> {
  const allowed = await manageGate();
  if (!allowed.ok) return allowed;
  const name = text(input?.name, 80);
  if (!name) return { ok: false, message: "Dê um nome à competição." };
  const isFirst = (await listCompetitions()).length === 0;
  const created = await createCompetition({
    name,
    description: optText(input?.description, 2000),
    logoMediaId: null,
    overallEnabled: bool(input?.overallEnabled),
    overallIncludesPartial: true,
    pointsTable: DEFAULT_PLACEMENT_POINTS,
  });
  if (!created.success) return { ok: false, message: created.error.message };
  // A primeira competição já vira a do site; as seguintes o admin ativa quando quiser.
  if (isFirst) {
    const activated = await writeSetting(GAMES_SETTINGS.activeCompetitionId.key, created.data.id);
    if (!activated.ok) return { ok: true, id: created.data.id, message: "Competição criada. Ela já aparece no site por ser a mais recente." };
  }
  return { ok: true, id: created.data.id };
}

export async function setActiveCompetitionAction(competitionId: unknown): Promise<ActionResult> {
  const allowed = await manageGate();
  if (!allowed.ok) return allowed;
  if (!isUuid(competitionId)) return { ok: false, message: "Competição inválida." };
  const row = await getCompetitionRow(competitionId);
  if (!row) return { ok: false, message: "Competição não encontrada." };
  return writeSetting(GAMES_SETTINGS.activeCompetitionId.key, row.id);
}

export async function saveGeneralSettingsAction(input: { accentColor: unknown; youtubeChannelId: unknown; goalFlashSeconds: unknown }): Promise<ActionResult> {
  const allowed = await manageGate();
  if (!allowed.ok) return allowed;
  const accent = optHex(input?.accentColor);
  if (!accent) return { ok: false, message: "Cor de destaque inválida (use o seletor de cor)." };
  const channel = text(input?.youtubeChannelId, 64);
  if (channel && !/^[A-Za-z0-9_-]+$/.test(channel)) return { ok: false, message: "Id do canal do YouTube inválido (ex.: UCxxxxxxxx)." };
  const seconds = intIn(input?.goalFlashSeconds, 2, 30, GAMES_SETTINGS.goalFlashSeconds.defaultValue);

  for (const [key, value] of [
    [GAMES_SETTINGS.accentColor.key, accent],
    [GAMES_SETTINGS.youtubeChannelId.key, channel],
    [GAMES_SETTINGS.goalFlashSeconds.key, seconds],
  ] as const) {
    const saved = await writeSetting(key, value);
    if (!saved.ok) return saved;
  }
  return { ok: true };
}
