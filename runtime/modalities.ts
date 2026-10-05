import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  matches,
  modalities,
  modalityEntries,
  modalityPlacements,
  participants,
  stageGroupMembers,
  stageGroups,
  stageResults,
  stages,
  tournamentTemplates,
} from "../database/schema";
import { isSportProfileKey, getSportProfile, type SportProfileKey } from "../shared/sport-profiles";
import { resolveModalityRules } from "../shared/modality-rules";
import { distributeIntoGroups, generateRoundRobin, groupNameForIndex } from "../shared/round-robin";
import { planKnockout } from "../shared/bracket";
import { computeStandings, type StandingRow } from "../shared/standings";
import { matchWinner, resolveSlot, type SlotResolutionContext } from "../shared/slot-resolution";
import { isStageType, type SlotSource, type StageDefinition } from "../shared/tournament";
import { sanitizeStages } from "../shared/templates";
import { bumpDataVersion, db, isUniqueViolation, type Executor, type Tx } from "./db";
import { uniqueSlug } from "./competitions";
import { fail, ok, type OperationResult } from "./result";

export type ModalityInput = {
  name: string;
  emoji: string | null;
  description: string | null;
  coverMediaId: string | null;
  sportProfile: SportProfileKey;
  rules: Record<string, unknown>;
  weight: number;
  pointsTable: number[] | null;
  sortOrder: number;
};

export async function saveModality(competitionId: string, id: string | null, input: ModalityInput): Promise<OperationResult<{ id: string }>> {
  const name = input.name.trim().slice(0, 60);
  if (!name) return fail("games.modality.name_required", "Dê um nome à modalidade.");
  if (!isSportProfileKey(input.sportProfile)) return fail("games.modality.profile_invalid", "Tipo de modalidade inválido.");
  const rules = resolveModalityRules(input.sportProfile, input.rules);
  const weight = Number.isFinite(input.weight) ? Math.min(100, Math.max(0, input.weight)) : 1;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await db.transaction(async (tx) => {
        const values = {
          name,
          emoji: input.emoji?.trim().slice(0, 8) || null,
          description: input.description,
          coverMediaId: input.coverMediaId,
          sportProfile: input.sportProfile,
          rules,
          weight,
          pointsTable: input.pointsTable && input.pointsTable.length > 0 ? input.pointsTable : null,
          sortOrder: input.sortOrder,
          updatedAt: new Date(),
        };
        let savedId: string;
        if (id) {
          const [existing] = await tx.select().from(modalities).where(and(eq(modalities.id, id), eq(modalities.competitionId, competitionId)));
          if (!existing) return fail<{ id: string }>("games.modality.not_found", "Modalidade não encontrada.");
          if (existing.sportProfile !== input.sportProfile) {
            const [played] = await tx.select({ id: matches.id }).from(matches).where(and(eq(matches.modalityId, id), inArray(matches.status, ["live", "finished"]))).limit(1);
            if (played) return fail<{ id: string }>("games.modality.profile_locked", "Não dá pra trocar o tipo de uma modalidade que já tem jogos disputados.");
          }
          const slug = existing.name === name ? existing.slug : await uniqueSlug(tx, modalities, competitionId, name, id);
          await tx.update(modalities).set({ ...values, slug }).where(eq(modalities.id, id));
          savedId = id;
        } else {
          const slug = await uniqueSlug(tx, modalities, competitionId, name);
          const [row] = await tx.insert(modalities).values({ ...values, slug, competitionId }).returning({ id: modalities.id });
          savedId = row.id;
        }
        await bumpDataVersion(tx, competitionId);
        return ok({ id: savedId });
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  return fail("games.modality.slug_conflict", "Não foi possível gerar um endereço único. Tente de novo.");
}

export async function deleteModality(competitionId: string, modalityId: string): Promise<OperationResult<void>> {
  return db.transaction(async (tx) => {
    const [played] = await tx.select({ id: matches.id }).from(matches).where(and(eq(matches.modalityId, modalityId), inArray(matches.status, ["live", "finished"]))).limit(1);
    if (played) return fail<void>("games.modality.has_results", "A modalidade tem jogos disputados. Apague os resultados antes, ou só esconda a modalidade.");
    await tx.delete(matches).where(eq(matches.modalityId, modalityId));
    await tx.delete(modalities).where(and(eq(modalities.id, modalityId), eq(modalities.competitionId, competitionId)));
    await bumpDataVersion(tx, competitionId);
    return ok(undefined);
  });
}

// Inscrições na ordem dada (índice = seed).
export async function setModalityEntries(competitionId: string, modalityId: string, participantIds: string[]): Promise<OperationResult<void>> {
  const unique = [...new Set(participantIds)];
  const valid = unique.length
    ? await db.select({ id: participants.id }).from(participants).where(and(eq(participants.competitionId, competitionId), inArray(participants.id, unique)))
    : [];
  const validIds = new Set(valid.map((row) => row.id));
  await db.transaction(async (tx) => {
    await tx.delete(modalityEntries).where(eq(modalityEntries.modalityId, modalityId));
    const rows = unique.filter((id) => validIds.has(id)).map((participantId, index) => ({ modalityId, participantId, seed: index + 1 }));
    if (rows.length > 0) await tx.insert(modalityEntries).values(rows);
    await bumpDataVersion(tx, competitionId);
  });
  return ok(undefined);
}

// ---- Estrutura do torneio ----

// Aplica fases (de template pronto ou salvo) na modalidade: cria fases, grupos (serpentina pela
// ordem de inscrição) e jogos — pontos corridos completos e o chaveamento do mata-mata com origens.
// Só com a modalidade sem jogo disputado: recriar estrutura com resultado apagaria história.
export async function applyModalityStructure(competitionId: string, modalityId: string, definitions: StageDefinition[]): Promise<OperationResult<{ matches: number }>> {
  const stagesToCreate = sanitizeStages(definitions);
  if (stagesToCreate.length === 0) return fail("games.structure.empty", "Escolha ao menos uma fase.");

  return db.transaction(async (tx) => {
    const [modality] = await tx.select().from(modalities).where(and(eq(modalities.id, modalityId), eq(modalities.competitionId, competitionId)));
    if (!modality) return fail<{ matches: number }>("games.modality.not_found", "Modalidade não encontrada.");
    const [played] = await tx.select({ id: matches.id }).from(matches).where(and(eq(matches.modalityId, modalityId), inArray(matches.status, ["live", "finished"]))).limit(1);
    if (played) return fail<{ matches: number }>("games.structure.has_results", "A modalidade já tem jogos disputados — a estrutura não pode ser recriada. Edite fases e jogos individualmente.");

    const shape = getSportProfile(modality.sportProfile).shape;
    if (shape === "event" && stagesToCreate.some((stage) => stage.type !== "single_event")) {
      return fail<{ matches: number }>("games.structure.shape", "Essa modalidade é de prova única (nota/medida/colocação).");
    }

    const entries = await tx.select().from(modalityEntries).where(eq(modalityEntries.modalityId, modalityId)).orderBy(asc(modalityEntries.seed));
    const seededIds = entries.map((entry) => entry.participantId);

    await tx.delete(matches).where(eq(matches.modalityId, modalityId));
    await tx.delete(stages).where(eq(stages.modalityId, modalityId));
    await tx.delete(modalityPlacements).where(eq(modalityPlacements.modalityId, modalityId));

    let created = 0;
    let knockoutCounter = 0;
    for (const [index, definition] of stagesToCreate.entries()) {
      const { type, name, ...config } = definition;
      const [stage] = await tx.insert(stages).values({ modalityId, stageIndex: index, type, name, config }).returning();

      if (definition.type === "round_robin") {
        // Só a primeira fase de pontos corridos recebe os inscritos; uma fase posterior de pontos
        // corridos (raro) começa vazia e o admin monta os grupos.
        const ids = index === 0 ? seededIds : [];
        const grouped = distributeIntoGroups(ids, definition.groupCount);
        for (const [groupIndex, members] of grouped.entries()) {
          const [group] = await tx.insert(stageGroups).values({ stageId: stage.id, name: groupNameForIndex(groupIndex), sortOrder: groupIndex }).returning();
          if (members.length > 0) await tx.insert(stageGroupMembers).values(members.map((participantId) => ({ groupId: group.id, participantId })));
          const pairings = generateRoundRobin(members, definition.doubleRound);
          if (pairings.length > 0) {
            await tx.insert(matches).values(
              pairings.map((pairing, order) => ({
                competitionId,
                modalityId,
                stageId: stage.id,
                groupId: group.id,
                roundNumber: pairing.round,
                roundLabel: `${pairing.round}ª rodada`,
                homeParticipantId: pairing.home,
                awayParticipantId: pairing.away,
                homeSource: { type: "participant", participantId: pairing.home } satisfies SlotSource,
                awaySource: { type: "participant", participantId: pairing.away } satisfies SlotSource,
                sortOrder: order,
              })),
            );
            created += pairings.length;
          }
        }
      } else if (definition.type === "knockout") {
        const seeds: SlotSource[] =
          definition.seeds.length > 0
            ? definition.seeds.slice(0, definition.size)
            : seededIds.slice(0, definition.size).map((participantId) => ({ type: "participant", participantId }));
        const plans = planKnockout(seeds, { thirdPlace: definition.thirdPlace, keyPrefix: "J" });
        // Renumera J1..Jn contínuo na modalidade (mais de uma fase de mata-mata não colide).
        const keyMap = new Map(plans.map((plan) => [plan.key, `J${++knockoutCounter}`]));
        const remap = (source: SlotSource): SlotSource =>
          source.type === "winner" || source.type === "loser" ? { ...source, matchKey: keyMap.get(source.matchKey) ?? source.matchKey } : source;
        if (plans.length > 0) {
          await tx.insert(matches).values(
            plans.map((plan, order) => {
              const home = remap(plan.home);
              const away = remap(plan.away);
              return {
                competitionId,
                modalityId,
                stageId: stage.id,
                matchKey: keyMap.get(plan.key)!,
                roundLabel: plan.roundLabel,
                bracketRound: plan.round,
                bracketPosition: plan.position,
                isThirdPlace: plan.isThirdPlace,
                homeParticipantId: home.type === "participant" ? home.participantId : null,
                awayParticipantId: away.type === "participant" ? away.participantId : null,
                homeSource: home,
                awaySource: away,
                sortOrder: order,
              };
            }),
          );
          created += plans.length;
        }
      }
      // single_event: sem jogos; resultados por equipe em stage_results.
    }

    await tx.update(modalities).set({ status: "setup", updatedAt: new Date() }).where(eq(modalities.id, modalityId));
    await resolveModalitySlots(tx, modalityId);
    await bumpDataVersion(tx, competitionId);
    return ok({ matches: created });
  });
}

// Recalcula status das fases e preenche os lados do mata-mata cuja origem já resolveu. Chamado na
// mesma transação de toda mudança de resultado da modalidade.
export async function resolveModalitySlots(tx: Tx, modalityId: string): Promise<void> {
  const [modality] = await tx.select().from(modalities).where(eq(modalities.id, modalityId));
  if (!modality) return;
  const rules = resolveModalityRules(isSportProfileKey(modality.sportProfile) ? modality.sportProfile : "pontos", modality.rules);
  const stageRows = await tx.select().from(stages).where(eq(stages.modalityId, modalityId)).orderBy(asc(stages.stageIndex));
  if (stageRows.length === 0) return;
  const matchRows = await tx.select().from(matches).where(eq(matches.modalityId, modalityId));
  const stageIds = stageRows.map((stage) => stage.id);
  const groupRows = await tx.select().from(stageGroups).where(inArray(stageGroups.stageId, stageIds));
  const memberRows = groupRows.length ? await tx.select().from(stageGroupMembers).where(inArray(stageGroupMembers.groupId, groupRows.map((g) => g.id))) : [];
  const participantRows = await tx.select({ id: participants.id, name: participants.name }).from(participants).where(eq(participants.competitionId, modality.competitionId));
  const names = new Map(participantRows.map((row) => [row.id, row.name]));
  const resultRows = await tx.select().from(stageResults).where(inArray(stageResults.stageId, stageIds));

  const context: SlotResolutionContext = { finishedStageGroups: new Map(), matchOutcomes: new Map() };

  // Status de cada fase a partir dos jogos (prova única: finished quando toda equipe tem resultado).
  for (const stage of stageRows) {
    const stageMatches = matchRows.filter((match) => match.stageId === stage.id && match.status !== "cancelled");
    let status: string;
    if (stage.type === "single_event") {
      const results = resultRows.filter((result) => result.stageId === stage.id && result.value !== null);
      status = results.length === 0 ? "pending" : stage.status === "finished" ? "finished" : "in_progress";
    } else if (stageMatches.length === 0) status = "pending";
    else if (stageMatches.every((match) => match.status === "finished")) status = "finished";
    else if (stageMatches.some((match) => match.status === "finished" || match.status === "live")) status = "in_progress";
    else status = "pending";
    if (status !== stage.status) {
      await tx.update(stages).set({ status }).where(eq(stages.id, stage.id));
      stage.status = status;
    }

    if (stage.type === "round_robin" && stage.status === "finished") {
      const byGroup = new Map<string, StandingRow[]>();
      for (const group of groupRows.filter((g) => g.stageId === stage.id)) {
        const members = memberRows.filter((m) => m.groupId === group.id).map((m) => ({ id: m.participantId, name: names.get(m.participantId) ?? "" }));
        const finished = stageMatches.filter((match) => match.groupId === group.id && match.status === "finished" && match.homeParticipantId && match.awayParticipantId);
        byGroup.set(
          group.name,
          computeStandings(
            members,
            finished.map((match) => ({ homeId: match.homeParticipantId!, awayId: match.awayParticipantId!, homeScore: match.homeScore, awayScore: match.awayScore })),
            rules,
          ),
        );
      }
      context.finishedStageGroups.set(stage.stageIndex, byGroup);
    }
  }

  for (const match of matchRows) {
    if (match.matchKey && match.status === "finished") {
      context.matchOutcomes.set(
        match.matchKey,
        matchWinner({ homeId: match.homeParticipantId, awayId: match.awayParticipantId, homeScore: match.homeScore, awayScore: match.awayScore, decidedWinnerId: match.decidedWinnerId }),
      );
    }
  }

  for (const match of matchRows) {
    if (match.slotsLocked || match.status !== "scheduled") continue;
    const home = match.homeSource ? resolveSlot(match.homeSource, context) : match.homeParticipantId;
    const away = match.awaySource ? resolveSlot(match.awaySource, context) : match.awayParticipantId;
    if (home !== match.homeParticipantId || away !== match.awayParticipantId) {
      await tx.update(matches).set({ homeParticipantId: home, awayParticipantId: away, updatedAt: new Date() }).where(eq(matches.id, match.id));
    }
  }

  const anyStarted = stageRows.some((stage) => stage.status !== "pending");
  const nextStatus = modality.status === "finished" ? "finished" : anyStarted ? "in_progress" : "setup";
  if (nextStatus !== modality.status) await tx.update(modalities).set({ status: nextStatus, updatedAt: new Date() }).where(eq(modalities.id, modalityId));
}

// ---- Prova única ----

export async function saveStageResults(
  competitionId: string,
  stageId: string,
  results: { participantId: string; value: number | null; judgeScores: number[] | null; note: string | null }[],
  closeStage: boolean,
): Promise<OperationResult<void>> {
  return db.transaction(async (tx) => {
    const [stage] = await tx.select().from(stages).where(eq(stages.id, stageId));
    if (!stage || stage.type !== "single_event") return fail<void>("games.stage.not_event", "Fase inválida.");
    const [modality] = await tx.select().from(modalities).where(and(eq(modalities.id, stage.modalityId), eq(modalities.competitionId, competitionId)));
    if (!modality) return fail<void>("games.stage.not_found", "Fase não encontrada.");
    const entryIds = new Set((await tx.select().from(modalityEntries).where(eq(modalityEntries.modalityId, modality.id))).map((entry) => entry.participantId));

    for (const result of results) {
      if (!entryIds.has(result.participantId)) continue;
      const judgeScores = result.judgeScores?.filter((score) => Number.isFinite(score)) ?? null;
      const value =
        result.value !== null && Number.isFinite(result.value)
          ? result.value
          : judgeScores && judgeScores.length > 0
            ? Math.round((judgeScores.reduce((sum, score) => sum + score, 0) / judgeScores.length) * 100) / 100
            : null;
      await tx
        .insert(stageResults)
        .values({ stageId, participantId: result.participantId, value, judgeScores: judgeScores && judgeScores.length > 0 ? judgeScores : null, note: result.note })
        .onConflictDoUpdate({
          target: [stageResults.stageId, stageResults.participantId],
          set: { value, judgeScores: judgeScores && judgeScores.length > 0 ? judgeScores : null, note: result.note, updatedAt: new Date() },
        });
    }
    await tx.update(stages).set({ status: closeStage ? "finished" : "in_progress" }).where(eq(stages.id, stageId));
    await resolveModalitySlots(tx, modality.id);
    await bumpDataVersion(tx, competitionId);
    return ok(undefined);
  });
}

// ---- Colocação final ----

export async function finalizeModality(competitionId: string, modalityId: string, placements: { participantId: string; position: number }[]): Promise<OperationResult<void>> {
  return db.transaction(async (tx) => {
    const [modality] = await tx.select().from(modalities).where(and(eq(modalities.id, modalityId), eq(modalities.competitionId, competitionId)));
    if (!modality) return fail<void>("games.modality.not_found", "Modalidade não encontrada.");
    const entryIds = new Set((await tx.select().from(modalityEntries).where(eq(modalityEntries.modalityId, modalityId))).map((entry) => entry.participantId));
    const rows = placements.filter((placement) => entryIds.has(placement.participantId) && Number.isInteger(placement.position) && placement.position >= 1);
    if (rows.length === 0) return fail<void>("games.modality.placements_empty", "Informe a colocação de ao menos uma equipe.");
    await tx.delete(modalityPlacements).where(eq(modalityPlacements.modalityId, modalityId));
    await tx.insert(modalityPlacements).values(rows.map((row) => ({ modalityId, participantId: row.participantId, position: row.position })));
    await tx.update(modalities).set({ status: "finished", updatedAt: new Date() }).where(eq(modalities.id, modalityId));
    await bumpDataVersion(tx, competitionId);
    return ok(undefined);
  });
}

export async function reopenModality(competitionId: string, modalityId: string): Promise<OperationResult<void>> {
  await db.transaction(async (tx) => {
    await tx.delete(modalityPlacements).where(eq(modalityPlacements.modalityId, modalityId));
    await tx.update(modalities).set({ status: "in_progress", updatedAt: new Date() }).where(and(eq(modalities.id, modalityId), eq(modalities.competitionId, competitionId)));
    await resolveModalitySlots(tx, modalityId);
    await bumpDataVersion(tx, competitionId);
  });
  return ok(undefined);
}

// ---- Grupos editados à mão ----

// Troca os membros de um grupo e regera SÓ os jogos ainda não disputados daquele grupo.
export async function setGroupMembers(competitionId: string, groupId: string, participantIds: string[], doubleRound: boolean): Promise<OperationResult<void>> {
  return db.transaction(async (tx) => {
    const [group] = await tx.select().from(stageGroups).where(eq(stageGroups.id, groupId));
    if (!group) return fail<void>("games.group.not_found", "Grupo não encontrado.");
    const [stage] = await tx.select().from(stages).where(eq(stages.id, group.stageId));
    const [modality] = stage ? await tx.select().from(modalities).where(and(eq(modalities.id, stage.modalityId), eq(modalities.competitionId, competitionId))) : [];
    if (!stage || !modality) return fail<void>("games.group.not_found", "Grupo não encontrado.");
    const [played] = await tx.select({ id: matches.id }).from(matches).where(and(eq(matches.groupId, groupId), inArray(matches.status, ["live", "finished"]))).limit(1);
    if (played) return fail<void>("games.group.has_results", "O grupo já tem jogos disputados; edite os jogos individualmente.");

    const unique = [...new Set(participantIds)];
    await tx.delete(stageGroupMembers).where(eq(stageGroupMembers.groupId, groupId));
    if (unique.length > 0) {
      // Uma equipe só pode estar em um grupo da fase.
      const siblingGroups = (await tx.select({ id: stageGroups.id }).from(stageGroups).where(eq(stageGroups.stageId, stage.id))).map((g) => g.id).filter((id) => id !== groupId);
      if (siblingGroups.length > 0) {
        await tx.delete(stageGroupMembers).where(and(inArray(stageGroupMembers.groupId, siblingGroups), inArray(stageGroupMembers.participantId, unique)));
      }
      await tx.insert(stageGroupMembers).values(unique.map((participantId) => ({ groupId, participantId })));
    }
    await tx.delete(matches).where(eq(matches.groupId, groupId));
    const pairings = generateRoundRobin(unique, doubleRound);
    if (pairings.length > 0) {
      await tx.insert(matches).values(
        pairings.map((pairing, order) => ({
          competitionId,
          modalityId: modality.id,
          stageId: stage.id,
          groupId,
          roundNumber: pairing.round,
          roundLabel: `${pairing.round}ª rodada`,
          homeParticipantId: pairing.home,
          awayParticipantId: pairing.away,
          homeSource: { type: "participant", participantId: pairing.home } satisfies SlotSource,
          awaySource: { type: "participant", participantId: pairing.away } satisfies SlotSource,
          sortOrder: order,
        })),
      );
    }
    await resolveModalitySlots(tx, modality.id);
    await bumpDataVersion(tx, competitionId);
    return ok(undefined);
  });
}

// ---- Templates salvos ----

export async function listSavedTemplates() {
  return db.select().from(tournamentTemplates).orderBy(asc(tournamentTemplates.name));
}

export async function saveTemplateFromModality(modalityId: string, name: string, description: string | null): Promise<OperationResult<void>> {
  const label = name.trim().slice(0, 60);
  if (!label) return fail("games.template.name_required", "Dê um nome ao template.");
  const [modality] = await db.select().from(modalities).where(eq(modalities.id, modalityId));
  if (!modality) return fail("games.modality.not_found", "Modalidade não encontrada.");
  const stageRows = await db.select().from(stages).where(eq(stages.modalityId, modalityId)).orderBy(asc(stages.stageIndex));
  if (stageRows.length === 0) return fail("games.template.empty", "A modalidade ainda não tem fases.");
  // Origens de equipe fixa não fazem sentido num template (outra modalidade, outras equipes).
  const definitions = stageRows
    .filter((stage) => isStageType(stage.type))
    .map((stage) => {
      const config = { ...(stage.config ?? {}) } as Record<string, unknown>;
      if (Array.isArray(config.seeds)) config.seeds = (config.seeds as SlotSource[]).filter((seed) => seed.type !== "participant");
      return { type: stage.type, name: stage.name, ...config };
    });
  await db.insert(tournamentTemplates).values({
    name: label,
    description,
    shape: getSportProfile(modality.sportProfile).shape,
    stages: sanitizeStages(definitions),
  });
  return ok(undefined);
}

export async function deleteSavedTemplate(id: string): Promise<OperationResult<void>> {
  await db.delete(tournamentTemplates).where(eq(tournamentTemplates.id, id));
  return ok(undefined);
}

export async function stageCountsByModality(executor: Executor, modalityIds: string[]) {
  if (modalityIds.length === 0) return new Map<string, number>();
  const rows = await executor
    .select({ modalityId: stages.modalityId, count: sql<number>`count(*)::int` })
    .from(stages)
    .where(inArray(stages.modalityId, modalityIds))
    .groupBy(stages.modalityId);
  return new Map(rows.map((row) => [row.modalityId, row.count]));
}

