import { and, asc, eq, ne, sql } from "drizzle-orm";
import { athletes, competitions, liveChannels, matches, modalities, participants, powerBoosts, scoreAdjustments } from "../database/schema";
import { slugify } from "../shared/slug";
import { isUuid } from "../shared/ids";
import { DEFAULT_PLACEMENT_POINTS } from "../shared/placement";
import { bumpDataVersion, db, isUniqueViolation, type Executor } from "./db";
import { fail, ok, type OperationResult } from "./result";

// Escrita do cadastro-base: competição, equipes, atletas, power plays, ajustes do quadro geral.
// Todas as funções aqui assumem que o chamador (Server Action) já checou permissão; validam o
// input de domínio e sobem a versão do snapshot na mesma transação.

type SlugTable = typeof participants | typeof athletes | typeof modalities;

export async function uniqueSlug(executor: Executor, table: SlugTable, competitionId: string, name: string, excludeId?: string): Promise<string> {
  const base = slugify(name);
  for (let attempt = 1; attempt < 200; attempt += 1) {
    const candidate = attempt === 1 ? base : `${base}-${attempt}`;
    const conditions = [eq(table.competitionId, competitionId), eq(table.slug, candidate)];
    if (excludeId) conditions.push(ne(table.id, excludeId));
    const [taken] = await executor.select({ id: table.id }).from(table).where(and(...conditions)).limit(1);
    if (!taken) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

// ---- Competição ----

export type CompetitionInput = {
  name: string;
  description: string | null;
  logoMediaId: string | null;
  overallEnabled: boolean;
  overallIncludesPartial: boolean;
  pointsTable: number[];
};

export async function listCompetitions() {
  return db.select().from(competitions).orderBy(asc(competitions.createdAt));
}

export async function getCompetitionRow(id: string) {
  if (!isUuid(id)) return null;
  const [row] = await db.select().from(competitions).where(eq(competitions.id, id));
  return row ?? null;
}

export async function createCompetition(input: CompetitionInput): Promise<OperationResult<{ id: string }>> {
  const name = input.name.trim();
  if (!name) return fail("games.competition.name_required", "Dê um nome à competição.");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const base = slugify(name);
      const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
      const [row] = await db
        .insert(competitions)
        .values({
          slug,
          name,
          description: input.description,
          logoMediaId: input.logoMediaId,
          overallEnabled: input.overallEnabled,
          overallIncludesPartial: input.overallIncludesPartial,
          pointsTable: input.pointsTable.length > 0 ? input.pointsTable : DEFAULT_PLACEMENT_POINTS,
        })
        .returning({ id: competitions.id });
      // Canal padrão do overlay/TV.
      await db.insert(liveChannels).values({ competitionId: row.id, key: "principal", name: "Principal" });
      return ok({ id: row.id });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  return fail("games.competition.slug_taken", "Já existe uma competição com esse nome.");
}

export async function updateCompetition(id: string, input: CompetitionInput): Promise<OperationResult<void>> {
  const name = input.name.trim();
  if (!name) return fail("games.competition.name_required", "Dê um nome à competição.");
  await db.transaction(async (tx) => {
    await tx
      .update(competitions)
      .set({
        name,
        description: input.description,
        logoMediaId: input.logoMediaId,
        overallEnabled: input.overallEnabled,
        overallIncludesPartial: input.overallIncludesPartial,
        pointsTable: input.pointsTable.length > 0 ? input.pointsTable : DEFAULT_PLACEMENT_POINTS,
        updatedAt: new Date(),
      })
      .where(eq(competitions.id, id));
    await bumpDataVersion(tx, id);
  });
  return ok(undefined);
}

// ---- Equipes ----

export type ParticipantInput = {
  name: string;
  shortName: string | null;
  crestMediaId: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  description: string | null;
  foundedDate: string | null;
  sortOrder: number;
};

export async function saveParticipant(competitionId: string, id: string | null, input: ParticipantInput): Promise<OperationResult<{ id: string; slug: string }>> {
  const name = input.name.trim();
  if (!name) return fail("games.participant.name_required", "Dê um nome à equipe.");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await db.transaction(async (tx) => {
        let saved: { id: string; slug: string };
        if (id) {
          const [existing] = await tx.select().from(participants).where(and(eq(participants.id, id), eq(participants.competitionId, competitionId)));
          if (!existing) return fail<{ id: string; slug: string }>("games.participant.not_found", "Equipe não encontrada.");
          const slug = existing.name === name ? existing.slug : await uniqueSlug(tx, participants, competitionId, name, id);
          [saved] = await tx
            .update(participants)
            .set({ ...input, name, slug, updatedAt: new Date() })
            .where(eq(participants.id, id))
            .returning({ id: participants.id, slug: participants.slug });
        } else {
          const slug = await uniqueSlug(tx, participants, competitionId, name);
          [saved] = await tx.insert(participants).values({ ...input, name, slug, competitionId }).returning({ id: participants.id, slug: participants.slug });
        }
        await bumpDataVersion(tx, competitionId);
        return ok(saved);
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  return fail("games.participant.slug_conflict", "Não foi possível gerar um endereço único pra equipe. Tente de novo.");
}

export type ParticipantDeleteImpact = { matches: number; athletes: number };

export async function getParticipantDeleteImpact(participantId: string): Promise<ParticipantDeleteImpact> {
  const [[matchCount], [athleteCount]] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(matches)
      .where(sql`${matches.homeParticipantId} = ${participantId} or ${matches.awayParticipantId} = ${participantId}`),
    db.select({ count: sql<number>`count(*)::int` }).from(athletes).where(eq(athletes.participantId, participantId)),
  ]);
  return { matches: matchCount?.count ?? 0, athletes: athleteCount?.count ?? 0 };
}

// Equipe com jogo (agendado ou disputado) não sai — o histórico/chaveamento quebraria. Sem jogo:
// sai com atletas, inscrições, grupos e ajustes, numa transação só.
export async function deleteParticipant(competitionId: string, participantId: string): Promise<OperationResult<void>> {
  return db.transaction(async (tx) => {
    const [used] = await tx
      .select({ id: matches.id })
      .from(matches)
      .where(sql`${matches.homeParticipantId} = ${participantId} or ${matches.awayParticipantId} = ${participantId} or ${matches.decidedWinnerId} = ${participantId}`)
      .limit(1);
    if (used) return fail<void>("games.participant.has_matches", "A equipe tem jogos cadastrados. Remova ou troque a equipe nesses jogos antes.");

    const athleteRows = await tx.select({ id: athletes.id }).from(athletes).where(eq(athletes.participantId, participantId));
    for (const athlete of athleteRows) await deleteAthleteInTx(tx, athlete.id);
    await tx.execute(sql`delete from games.modality_entries where participant_id = ${participantId}`);
    await tx.execute(sql`delete from games.modality_placements where participant_id = ${participantId}`);
    await tx.execute(sql`delete from games.stage_group_members where participant_id = ${participantId}`);
    await tx.execute(sql`delete from games.stage_results where participant_id = ${participantId}`);
    await tx.delete(scoreAdjustments).where(eq(scoreAdjustments.participantId, participantId));
    await deleteVotesForChoice(tx, participantId);
    await tx.delete(participants).where(and(eq(participants.id, participantId), eq(participants.competitionId, competitionId)));
    await bumpDataVersion(tx, competitionId);
    return ok(undefined);
  });
}

// ---- Atletas ----

export type AthleteInput = {
  participantId: string;
  name: string;
  number: number | null;
  gender: string | null;
  position: string | null;
  isCaptain: boolean;
  photoMediaId: string | null;
  bio: string | null;
};

export async function saveAthlete(competitionId: string, id: string | null, input: AthleteInput): Promise<OperationResult<{ id: string; slug: string }>> {
  const name = input.name.trim();
  if (!name) return fail("games.athlete.name_required", "Dê um nome ao atleta.");
  const [participant] = await db
    .select({ id: participants.id })
    .from(participants)
    .where(and(eq(participants.id, input.participantId), eq(participants.competitionId, competitionId)));
  if (!participant) return fail("games.athlete.participant_invalid", "Escolha uma equipe desta competição.");

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await db.transaction(async (tx) => {
        let saved: { id: string; slug: string };
        if (id) {
          const [existing] = await tx.select().from(athletes).where(and(eq(athletes.id, id), eq(athletes.competitionId, competitionId)));
          if (!existing) return fail<{ id: string; slug: string }>("games.athlete.not_found", "Atleta não encontrado.");
          const slug = existing.name === name ? existing.slug : await uniqueSlug(tx, athletes, competitionId, name, id);
          [saved] = await tx
            .update(athletes)
            .set({ ...input, name, slug, updatedAt: new Date() })
            .where(eq(athletes.id, id))
            .returning({ id: athletes.id, slug: athletes.slug });
        } else {
          const slug = await uniqueSlug(tx, athletes, competitionId, name);
          [saved] = await tx.insert(athletes).values({ ...input, name, slug, competitionId }).returning({ id: athletes.id, slug: athletes.slug });
        }
        await bumpDataVersion(tx, competitionId);
        return ok(saved);
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  return fail("games.athlete.slug_conflict", "Não foi possível gerar um endereço único pro atleta. Tente de novo.");
}

async function deleteVotesForChoice(tx: Executor, choiceId: string): Promise<void> {
  await tx.execute(sql`delete from games.votes where choice_id = ${choiceId}`);
  await tx.execute(sql`delete from games.vote_tallies where choice_id = ${choiceId}`);
}

// Atleta sempre pode sair: lances ficam sem atribuição e o MVP vira vazio (FK on delete set null);
// votos de torcida nele são apagados.
async function deleteAthleteInTx(tx: Executor, athleteId: string): Promise<void> {
  await deleteVotesForChoice(tx, athleteId);
  await tx.delete(athletes).where(eq(athletes.id, athleteId));
}

export async function deleteAthlete(competitionId: string, athleteId: string): Promise<OperationResult<void>> {
  await db.transaction(async (tx) => {
    await deleteAthleteInTx(tx, athleteId);
    await bumpDataVersion(tx, competitionId);
  });
  return ok(undefined);
}

// ---- Power plays ----

export async function savePowerBoost(
  competitionId: string,
  id: string | null,
  input: { label: string; emoji: string; description: string | null; sortOrder: number },
): Promise<OperationResult<void>> {
  const label = input.label.trim().slice(0, 40);
  if (!label) return fail("games.boost.label_required", "Dê um nome ao power play.");
  const emoji = input.emoji.trim().slice(0, 8) || "⚡";
  await db.transaction(async (tx) => {
    if (id) {
      await tx
        .update(powerBoosts)
        .set({ label, emoji, description: input.description, sortOrder: input.sortOrder })
        .where(and(eq(powerBoosts.id, id), eq(powerBoosts.competitionId, competitionId)));
    } else {
      await tx.insert(powerBoosts).values({ competitionId, label, emoji, description: input.description, sortOrder: input.sortOrder });
    }
    await bumpDataVersion(tx, competitionId);
  });
  return ok(undefined);
}

export async function deletePowerBoost(competitionId: string, id: string): Promise<OperationResult<void>> {
  await db.transaction(async (tx) => {
    await tx.delete(powerBoosts).where(and(eq(powerBoosts.id, id), eq(powerBoosts.competitionId, competitionId)));
    await bumpDataVersion(tx, competitionId);
  });
  return ok(undefined);
}

// ---- Ajustes do quadro geral ----

export async function addScoreAdjustment(
  competitionId: string,
  input: { participantId: string; modalityId: string | null; points: number; reason: string },
): Promise<OperationResult<void>> {
  const reason = input.reason.trim().slice(0, 200);
  if (!reason) return fail("games.adjustment.reason_required", "Explique o motivo do ajuste.");
  if (!Number.isFinite(input.points) || input.points === 0) return fail("games.adjustment.points_invalid", "Informe os pontos (positivo = bônus, negativo = penalidade).");
  const [participant] = await db
    .select({ id: participants.id })
    .from(participants)
    .where(and(eq(participants.id, input.participantId), eq(participants.competitionId, competitionId)));
  if (!participant) return fail("games.adjustment.participant_invalid", "Equipe inválida.");
  await db.transaction(async (tx) => {
    await tx.insert(scoreAdjustments).values({ competitionId, participantId: input.participantId, modalityId: input.modalityId, points: input.points, reason });
    await bumpDataVersion(tx, competitionId);
  });
  return ok(undefined);
}

export async function deleteScoreAdjustment(competitionId: string, id: string): Promise<OperationResult<void>> {
  await db.transaction(async (tx) => {
    await tx.delete(scoreAdjustments).where(and(eq(scoreAdjustments.id, id), eq(scoreAdjustments.competitionId, competitionId)));
    await bumpDataVersion(tx, competitionId);
  });
  return ok(undefined);
}

// ---- Canais ao vivo ----

export async function saveLiveChannel(competitionId: string, id: string | null, name: string): Promise<OperationResult<void>> {
  const label = name.trim().slice(0, 40);
  if (!label) return fail("games.channel.name_required", "Dê um nome ao canal (ex.: Quadra 1).");
  await db.transaction(async (tx) => {
    if (id) {
      await tx.update(liveChannels).set({ name: label, updatedAt: new Date() }).where(and(eq(liveChannels.id, id), eq(liveChannels.competitionId, competitionId)));
    } else {
      let key = slugify(label);
      const existing = await tx.select({ key: liveChannels.key }).from(liveChannels).where(eq(liveChannels.competitionId, competitionId));
      const keys = new Set(existing.map((row) => row.key));
      for (let n = 2; keys.has(key); n += 1) key = `${slugify(label)}-${n}`;
      await tx.insert(liveChannels).values({ competitionId, key, name: label });
    }
    await bumpDataVersion(tx, competitionId);
  });
  return ok(undefined);
}
