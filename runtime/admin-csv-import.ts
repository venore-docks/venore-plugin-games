import { and, asc, eq, inArray } from "drizzle-orm";
import { matches, modalities, modalityEntries, participants, stageGroups, stages } from "../database/schema";
import { csvToRows, normalizeName, parseFlexibleDate, pickCell, type CsvRow } from "../shared/csv";
import { isUuid } from "../shared/ids";
import { getSportProfile } from "../shared/sport-profiles";
import type { SlotSource } from "../shared/tournament";
import { bumpDataVersion, db } from "./db";
import { uniqueSlug } from "./competitions";
import { resolveModalitySlots } from "./modalities";
import { fail, ok, type OperationResult } from "./result";

// Import CSV do admin (equipes e jogos de uma modalidade). Diferenças do Erasto League:
// - reimportar equipe NUNCA apaga brasão nem campo que veio vazio — só atualiza o que veio;
// - jogo casa equipe por id ou por nome (sem acento/caixa);
// - TODAS as linhas são validadas antes de gravar; com erro, nada é gravado;
// - "substituir" apaga só os jogos AGENDADOS da modalidade, na mesma transação dos novos.

export type ImportError = { line: number; message: string };
export type ImportSummary = { created: number; updated: number; errors: ImportError[] };

const MAX_ROWS = 2000;
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// ---- Equipes ----

type TeamPatch = {
  line: number;
  id: string | null;
  name: string;
  // undefined = coluna vazia/ausente → não mexe no valor atual.
  shortName?: string;
  primaryColor?: string;
  secondaryColor?: string;
  foundedDate?: string;
  description?: string;
  sortOrder?: number;
};

function parseTeamRow(row: CsvRow, errors: ImportError[]): TeamPatch | null {
  const name = pickCell(row, ["name", "nome", "equipe"]).slice(0, 60);
  const id = pickCell(row, ["id", "uuid"]);
  if (!name) {
    errors.push({ line: row.line, message: 'Coluna "nome" vazia.' });
    return null;
  }
  if (id && !isUuid(id)) {
    errors.push({ line: row.line, message: `"${id}" não é um id válido (uuid).` });
    return null;
  }
  const patch: TeamPatch = { line: row.line, id: id || null, name };
  const shortName = pickCell(row, ["shortName", "sigla"]);
  if (shortName) patch.shortName = shortName.slice(0, 8).toUpperCase();
  for (const [key, aliases] of [
    ["primaryColor", ["primaryColor", "corPrimaria", "cor"]],
    ["secondaryColor", ["secondaryColor", "corSecundaria"]],
  ] as const) {
    const value = pickCell(row, [...aliases]);
    if (!value) continue;
    const hex = value.startsWith("#") ? value : `#${value}`;
    if (!HEX.test(hex)) {
      errors.push({ line: row.line, message: `Cor inválida: "${value}" (use #RRGGBB).` });
      return null;
    }
    patch[key] = hex;
  }
  const founded = pickCell(row, ["foundedDate", "fundacao"]);
  if (founded) {
    const parsed = parseFlexibleDate(founded, "");
    if (!parsed.valid || !parsed.scheduledDate) {
      errors.push({ line: row.line, message: `Data de fundação inválida: "${founded}".` });
      return null;
    }
    patch.foundedDate = parsed.scheduledDate;
  }
  const description = pickCell(row, ["description", "descricao"]);
  if (description) patch.description = description.slice(0, 2000);
  const order = pickCell(row, ["sortOrder", "order", "ordem"]);
  if (order) {
    const value = Number(order);
    if (!Number.isInteger(value) || value < 0 || value > 9999) {
      errors.push({ line: row.line, message: `Ordem inválida: "${order}".` });
      return null;
    }
    patch.sortOrder = value;
  }
  return patch;
}

export async function importParticipantsCsv(competitionId: string, csvText: string, options: { enrollModalityId: string | null }): Promise<OperationResult<ImportSummary>> {
  const rows = csvToRows(csvText);
  if (rows.length === 0) return fail("games.import.empty", "O arquivo não tem linhas (além do cabeçalho).");
  if (rows.length > MAX_ROWS) return fail("games.import.too_big", `No máximo ${MAX_ROWS} linhas por arquivo.`);

  const errors: ImportError[] = [];
  const patches = rows.map((row) => parseTeamRow(row, errors)).filter((patch): patch is TeamPatch => patch !== null);

  const existing = await db.select().from(participants).where(eq(participants.competitionId, competitionId));
  const byId = new Map(existing.map((row) => [row.id, row]));
  const byName = new Map(existing.map((row) => [normalizeName(row.name), row]));

  if (options.enrollModalityId) {
    const [modality] = await db.select({ id: modalities.id }).from(modalities).where(and(eq(modalities.id, options.enrollModalityId), eq(modalities.competitionId, competitionId)));
    if (!modality) return fail("games.import.modality_invalid", "Modalidade inválida.");
  }

  // Id preenchido que não é desta competição, mas existe em outra: não dá pra criar com ele.
  const foreignIds = patches.filter((patch) => patch.id && !byId.has(patch.id)).map((patch) => patch.id!);
  if (foreignIds.length > 0) {
    const taken = await db.select({ id: participants.id }).from(participants).where(inArray(participants.id, foreignIds));
    const takenIds = new Set(taken.map((row) => row.id));
    for (const patch of patches) if (patch.id && takenIds.has(patch.id)) errors.push({ line: patch.line, message: "Esse id pertence a uma equipe de outra competição." });
  }
  const seenNames = new Map<string, number>();
  for (const patch of patches) {
    const key = patch.id ?? normalizeName(patch.name);
    if (seenNames.has(key)) errors.push({ line: patch.line, message: `Equipe repetida no arquivo (linha ${seenNames.get(key)}).` });
    else seenNames.set(key, patch.line);
  }
  if (errors.length > 0) return ok({ created: 0, updated: 0, errors: errors.sort((a, b) => a.line - b.line) });

  const summary = await db.transaction(async (tx) => {
    let created = 0;
    let updated = 0;
    const touchedIds: string[] = [];
    for (const patch of patches) {
      const current = (patch.id ? byId.get(patch.id) : undefined) ?? (!patch.id ? byName.get(normalizeName(patch.name)) : undefined);
      const fields = {
        ...(patch.shortName !== undefined && { shortName: patch.shortName }),
        ...(patch.primaryColor !== undefined && { primaryColor: patch.primaryColor }),
        ...(patch.secondaryColor !== undefined && { secondaryColor: patch.secondaryColor }),
        ...(patch.foundedDate !== undefined && { foundedDate: patch.foundedDate }),
        ...(patch.description !== undefined && { description: patch.description }),
        ...(patch.sortOrder !== undefined && { sortOrder: patch.sortOrder }),
      };
      if (current) {
        const slug = current.name === patch.name ? current.slug : await uniqueSlug(tx, participants, competitionId, patch.name, current.id);
        await tx
          .update(participants)
          .set({ ...fields, name: patch.name, slug, updatedAt: new Date() })
          .where(eq(participants.id, current.id));
        touchedIds.push(current.id);
        updated += 1;
      } else {
        const slug = await uniqueSlug(tx, participants, competitionId, patch.name);
        const [row] = await tx
          .insert(participants)
          .values({ ...fields, ...(patch.id && { id: patch.id }), competitionId, name: patch.name, slug })
          .returning({ id: participants.id });
        touchedIds.push(row.id);
        created += 1;
      }
    }
    if (options.enrollModalityId) {
      const entries = await tx.select().from(modalityEntries).where(eq(modalityEntries.modalityId, options.enrollModalityId)).orderBy(asc(modalityEntries.seed));
      const enrolled = new Set(entries.map((entry) => entry.participantId));
      const toAdd = [...new Set(touchedIds)].filter((id) => !enrolled.has(id));
      const lastSeed = entries.reduce((max, entry) => Math.max(max, entry.seed), 0);
      if (toAdd.length > 0) {
        await tx.insert(modalityEntries).values(toAdd.map((participantId, index) => ({ modalityId: options.enrollModalityId!, participantId, seed: lastSeed + index + 1 })));
      }
    }
    await bumpDataVersion(tx, competitionId);
    return { created, updated, errors: [] };
  });
  return ok(summary);
}

// ---- Jogos de uma modalidade ----

export async function importMatchesCsv(competitionId: string, modalityId: string, csvText: string, options: { replaceScheduled: boolean }): Promise<OperationResult<ImportSummary>> {
  const [modality] = await db.select().from(modalities).where(and(eq(modalities.id, modalityId), eq(modalities.competitionId, competitionId)));
  if (!modality) return fail("games.import.modality_invalid", "Modalidade inválida.");
  if (getSportProfile(modality.sportProfile).shape !== "match") return fail("games.import.modality_shape", "Essa modalidade é de prova única — não tem jogos.");
  const rows = csvToRows(csvText);
  if (rows.length === 0) return fail("games.import.empty", "O arquivo não tem linhas (além do cabeçalho).");
  if (rows.length > MAX_ROWS) return fail("games.import.too_big", `No máximo ${MAX_ROWS} linhas por arquivo.`);

  const [teamRows, stageRows] = await Promise.all([
    db.select({ id: participants.id, name: participants.name, shortName: participants.shortName }).from(participants).where(eq(participants.competitionId, competitionId)),
    db.select().from(stages).where(eq(stages.modalityId, modalityId)),
  ]);
  const groupRows = stageRows.length ? await db.select().from(stageGroups).where(inArray(stageGroups.stageId, stageRows.map((stage) => stage.id))) : [];
  const teamIds = new Set(teamRows.map((team) => team.id));
  const teamByName = new Map<string, string>();
  for (const team of teamRows) {
    teamByName.set(normalizeName(team.name), team.id);
    if (team.shortName && !teamByName.has(normalizeName(team.shortName))) teamByName.set(normalizeName(team.shortName), team.id);
  }
  const stageByName = new Map(stageRows.map((stage) => [normalizeName(stage.name), stage]));

  const errors: ImportError[] = [];
  const values: (typeof matches.$inferInsert)[] = [];

  const resolveTeam = (row: CsvRow, idAliases: string[], nameAliases: string[], label: string): string | null | undefined => {
    const id = pickCell(row, idAliases);
    if (id) {
      if (!isUuid(id) || !teamIds.has(id)) {
        errors.push({ line: row.line, message: `${label}: id "${id}" não é de uma equipe desta competição.` });
        return undefined;
      }
      return id;
    }
    const name = pickCell(row, nameAliases);
    if (!name) return null;
    const found = teamByName.get(normalizeName(name));
    if (!found) errors.push({ line: row.line, message: `${label}: equipe "${name}" não encontrada. Importe as equipes antes.` });
    return found ?? undefined;
  };

  for (const row of rows) {
    const before = errors.length;
    const home = resolveTeam(row, ["homeTeamId", "homeId", "mandanteId"], ["homeTeam", "home", "mandante"], "Mandante");
    const away = resolveTeam(row, ["awayTeamId", "awayId", "visitanteId"], ["awayTeam", "away", "visitante"], "Visitante");
    if (home && away && home === away) errors.push({ line: row.line, message: "Mandante e visitante são a mesma equipe." });

    const stageName = pickCell(row, ["phase", "fase", "stage"]);
    const stage = stageName ? stageByName.get(normalizeName(stageName)) : undefined;
    if (stageName && !stage) errors.push({ line: row.line, message: `Fase "${stageName}" não existe nesta modalidade (${stageRows.map((s) => s.name).join(", ") || "sem fases"}).` });
    if (stage?.type === "single_event") errors.push({ line: row.line, message: `A fase "${stage.name}" é de prova única (sem jogos).` });

    const groupName = pickCell(row, ["group", "grupo"]);
    let groupId: string | null = null;
    if (groupName) {
      const candidates = groupRows.filter((group) => (stage ? group.stageId === stage.id : true) && normalizeName(group.name) === normalizeName(groupName.replace(/^grupo\s+/i, "")));
      if (candidates.length !== 1) errors.push({ line: row.line, message: candidates.length === 0 ? `Grupo "${groupName}" não encontrado.` : `Grupo "${groupName}" é ambíguo — informe a fase.` });
      else groupId = candidates[0].id;
    }
    const groupStageId = groupId ? (groupRows.find((group) => group.id === groupId)?.stageId ?? null) : null;

    const date = parseFlexibleDate(pickCell(row, ["date", "data"]), pickCell(row, ["time", "hora", "horario"]));
    if (!date.valid) errors.push({ line: row.line, message: "Data/hora inválida (use dd/mm/aaaa e HH:mm)." });
    const orderRaw = pickCell(row, ["order", "ordem", "sortOrder"]);
    const order = orderRaw ? Number(orderRaw) : 0;
    if (!Number.isInteger(order)) errors.push({ line: row.line, message: `Ordem inválida: "${orderRaw}".` });

    if (errors.length > before) continue;
    const homeId = home ?? null;
    const awayId = away ?? null;
    values.push({
      competitionId,
      modalityId,
      stageId: stage?.id ?? groupStageId,
      groupId,
      roundLabel: pickCell(row, ["round", "rodada"]).slice(0, 40) || null,
      homeParticipantId: homeId,
      awayParticipantId: awayId,
      homeSource: homeId ? ({ type: "participant", participantId: homeId } satisfies SlotSource) : null,
      awaySource: awayId ? ({ type: "participant", participantId: awayId } satisfies SlotSource) : null,
      homeLabel: homeId ? null : pickCell(row, ["homeLabel", "rotuloMandante"]).slice(0, 60) || null,
      awayLabel: awayId ? null : pickCell(row, ["awayLabel", "rotuloVisitante"]).slice(0, 60) || null,
      scheduledDate: date.scheduledDate && ISO_DATE.test(date.scheduledDate) ? date.scheduledDate : null,
      scheduledTime: date.scheduledDate ? date.scheduledTime : null,
      venue: pickCell(row, ["venue", "local"]).slice(0, 60) || null,
      // Lados importados com equipe são escolha do admin — o mata-mata não sobrescreve.
      slotsLocked: Boolean(homeId || awayId) && Boolean(stage && stage.type === "knockout"),
      sortOrder: order,
    });
  }
  if (errors.length > 0) return ok({ created: 0, updated: 0, errors: errors.sort((a, b) => a.line - b.line) });

  const summary = await db.transaction(async (tx) => {
    if (options.replaceScheduled) {
      await tx.delete(matches).where(and(eq(matches.modalityId, modalityId), eq(matches.status, "scheduled")));
    }
    if (values.length > 0) await tx.insert(matches).values(values);
    await resolveModalitySlots(tx, modalityId);
    await bumpDataVersion(tx, competitionId);
    return { created: values.length, updated: 0, errors: [] };
  });
  return ok(summary);
}
