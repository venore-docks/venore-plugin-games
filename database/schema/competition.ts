import { bigint, boolean, index, integer, jsonb, primaryKey, real, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { gamesSchema } from "./schema";

// Edição de uma competição ("Erasto League 2026", "Erasto Games 2026"). dataVersion sobe em TODA
// escrita do plugin (runtime/version.ts, mesma transação) — é a chave do snapshot em memória das
// leituras públicas (runtime/snapshot.ts): 1 consulta barata por visita em vez de dezenas.
export const competitions = gamesSchema.table("competitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  logoMediaId: text("logo_media_id"),
  // Quadro geral (Erasto Games). Desligado = campeonato simples.
  overallEnabled: boolean("overall_enabled").notNull().default(false),
  // Pontos por colocação (índice 0 = 1º lugar).
  pointsTable: jsonb("points_table").$type<number[]>().notNull().default([100, 80, 65, 55, 45, 40, 35, 30, 25, 20, 15, 10]),
  // Quadro geral com modalidades ainda em andamento (parcial) ou só finalizadas.
  overallIncludesPartial: boolean("overall_includes_partial").notNull().default(true),
  dataVersion: bigint("data_version", { mode: "number" }).notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Equipe/turma. Mesma equipe disputa várias modalidades no Erasto Games.
export const participants = gamesSchema.table(
  "participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    shortName: text("short_name"),
    crestMediaId: text("crest_media_id"),
    primaryColor: text("primary_color"),
    secondaryColor: text("secondary_color"),
    description: text("description"),
    foundedDate: text("founded_date"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("participants_competition_slug_unique").on(table.competitionId, table.slug)],
);

export const athletes = gamesSchema.table(
  "athletes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    number: integer("number"),
    gender: text("gender"),
    position: text("position"),
    isCaptain: boolean("is_captain").notNull().default(false),
    photoMediaId: text("photo_media_id"),
    bio: text("bio"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("athletes_competition_slug_unique").on(table.competitionId, table.slug),
    index("athletes_participant_idx").on(table.participantId),
  ],
);

// Modalidade: futsal, vôlei, dança, arrecadação… sportProfile = chave de shared/sport-profiles.ts;
// rules = overrides validados por shared/modality-rules.ts.
export const modalities = gamesSchema.table(
  "modalities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    emoji: text("emoji"),
    description: text("description"),
    coverMediaId: text("cover_media_id"),
    sportProfile: text("sport_profile").notNull(),
    rules: jsonb("rules").$type<Record<string, unknown>>().notNull().default({}),
    // Peso no quadro geral e tabela própria (null = a da competição).
    weight: real("weight").notNull().default(1),
    pointsTable: jsonb("points_table").$type<number[] | null>(),
    // setup → in_progress → finished. Finalizar congela a colocação (modality_placements).
    status: text("status").notNull().default("setup"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("modalities_competition_slug_unique").on(table.competitionId, table.slug)],
);

// Inscrição de uma equipe numa modalidade; seed = ordem de cabeça de chave (menor = melhor).
export const modalityEntries = gamesSchema.table(
  "modality_entries",
  {
    modalityId: uuid("modality_id")
      .notNull()
      .references(() => modalities.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id),
    seed: integer("seed").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.modalityId, table.participantId] })],
);

// Colocação final congelada da modalidade (calculada ou ajustada à mão pelo admin).
export const modalityPlacements = gamesSchema.table(
  "modality_placements",
  {
    modalityId: uuid("modality_id")
      .notNull()
      .references(() => modalities.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id),
    position: integer("position").notNull(),
  },
  (table) => [primaryKey({ columns: [table.modalityId, table.participantId] })],
);

// Bônus/penalidade no quadro geral, sempre com motivo.
export const scoreAdjustments = gamesSchema.table("score_adjustments", {
  id: uuid("id").primaryKey().defaultRandom(),
  competitionId: uuid("competition_id")
    .notNull()
    .references(() => competitions.id),
  participantId: uuid("participant_id")
    .notNull()
    .references(() => participants.id),
  modalityId: uuid("modality_id").references(() => modalities.id, { onDelete: "set null" }),
  points: real("points").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Templates de torneio salvos pelo admin (os prontos moram em shared/templates.ts).
export const tournamentTemplates = gamesSchema.table("tournament_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  shape: text("shape").notNull().default("match"),
  stages: jsonb("stages").$type<unknown[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
