import { bigint, boolean, date, index, integer, jsonb, primaryKey, real, text, time, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { gamesSchema } from "./schema";
import { athletes, competitions, modalities, participants } from "./competition";
import type { SlotSource } from "../../shared/tournament";

export const stages = gamesSchema.table(
  "stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    modalityId: uuid("modality_id")
      .notNull()
      .references(() => modalities.id, { onDelete: "cascade" }),
    stageIndex: integer("stage_index").notNull(),
    type: text("type").notNull(),
    name: text("name").notNull(),
    // StageDefinition sem type/name (groupCount, doubleRound, size, thirdPlace, seeds).
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    // pending → in_progress → finished. "finished" libera as posições de grupo pros slots.
    status: text("status").notNull().default("pending"),
  },
  (table) => [uniqueIndex("stages_modality_index_unique").on(table.modalityId, table.stageIndex)],
);

export const stageGroups = gamesSchema.table("stage_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  stageId: uuid("stage_id")
    .notNull()
    .references(() => stages.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const stageGroupMembers = gamesSchema.table(
  "stage_group_members",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => stageGroups.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id),
  },
  (table) => [primaryKey({ columns: [table.groupId, table.participantId] })],
);

// Resultado por equipe numa prova única (nota, medida, colocação).
export const stageResults = gamesSchema.table(
  "stage_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stageId: uuid("stage_id")
      .notNull()
      .references(() => stages.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id),
    value: real("value"),
    judgeScores: jsonb("judge_scores").$type<number[]>(),
    note: text("note"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("stage_results_stage_participant_unique").on(table.stageId, table.participantId)],
);

// Jogo — do agendamento ao resultado, uma entidade só (no plugin antigo eram "fixture" + "match"
// ligados à mão). Lados podem nascer vazios com uma origem (homeSource/awaySource: "1º do Grupo A",
// "vencedor M3") e são preenchidos sozinhos quando a origem resolve (runtime/brackets.ts), a menos
// que o admin tenha travado o slot (slotsLocked).
export const matches = gamesSchema.table(
  "matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id),
    modalityId: uuid("modality_id")
      .notNull()
      .references(() => modalities.id),
    stageId: uuid("stage_id").references(() => stages.id, { onDelete: "set null" }),
    groupId: uuid("group_id").references(() => stageGroups.id, { onDelete: "set null" }),
    // Código do jogo dentro da modalidade (M1, M2…) — usado pelas origens winner/loser.
    matchKey: text("match_key"),
    roundNumber: integer("round_number"),
    roundLabel: text("round_label"),
    bracketRound: integer("bracket_round"),
    bracketPosition: integer("bracket_position"),
    isThirdPlace: boolean("is_third_place").notNull().default(false),

    homeParticipantId: uuid("home_participant_id").references(() => participants.id),
    awayParticipantId: uuid("away_participant_id").references(() => participants.id),
    homeSource: jsonb("home_source").$type<SlotSource | null>(),
    awaySource: jsonb("away_source").$type<SlotSource | null>(),
    homeLabel: text("home_label"),
    awayLabel: text("away_label"),
    slotsLocked: boolean("slots_locked").notNull().default(false),

    // Texto puro (sem fuso) — mesma decisão do plugin antigo: "dia marcado, hora a definir".
    scheduledDate: date("scheduled_date"),
    scheduledTime: time("scheduled_time"),
    venue: text("venue"),

    // scheduled → live → finished | cancelled
    status: text("status").notNull().default("scheduled"),
    homeScore: real("home_score").notNull().default(0),
    awayScore: real("away_score").notNull().default(0),
    // Vôlei: placar de cada set.
    sets: jsonb("sets").$type<{ home: number; away: number }[]>(),
    // Desempate fora do placar (pênaltis, sorteio) em jogo que precisa de vencedor.
    decidedWinnerId: uuid("decided_winner_id").references(() => participants.id),
    resultNote: text("result_note"),

    mvpAthleteId: uuid("mvp_athlete_id").references(() => athletes.id, { onDelete: "set null" }),
    mvpNote: text("mvp_note"),
    youtubeUrl: text("youtube_url"),

    // Foto enviada pelo admin + imagens geradas UMA VEZ a partir dela (runtime/share-images.ts).
    coverPhotoMediaId: text("cover_photo_media_id"),
    coverImageMediaId: text("cover_image_media_id"),
    storyImageMediaId: text("story_image_media_id"),
    // Hash dos dados de entrada da última geração: igual = não gera de novo.
    shareImagesHash: text("share_images_hash"),

    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("matches_competition_status_idx").on(table.competitionId, table.status),
    index("matches_modality_idx").on(table.modalityId),
    index("matches_stage_idx").on(table.stageId),
  ],
);

export const matchEvents = gamesSchema.table(
  "match_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    side: text("side").notNull(),
    athleteId: uuid("athlete_id").references(() => athletes.id, { onDelete: "set null" }),
    amount: real("amount").notNull().default(1),
    clockMs: bigint("clock_ms", { mode: "number" }),
    period: integer("period"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("match_events_match_idx").on(table.matchId)],
);

// Catálogo de power plays por competição. O uso guarda rótulo/emoji copiados (snapshot) — editar
// ou excluir o catálogo não estraga usos antigos (bug da "key que muda com o rótulo").
export const powerBoosts = gamesSchema.table("power_boosts", {
  id: uuid("id").primaryKey().defaultRandom(),
  competitionId: uuid("competition_id")
    .notNull()
    .references(() => competitions.id),
  label: text("label").notNull(),
  emoji: text("emoji").notNull().default("⚡"),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const matchBoosts = gamesSchema.table(
  "match_boosts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    side: text("side").notNull(),
    boostId: uuid("boost_id").references(() => powerBoosts.id, { onDelete: "set null" }),
    label: text("label").notNull(),
    emoji: text("emoji").notNull(),
    clockMs: bigint("clock_ms", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("match_boosts_match_idx").on(table.matchId)],
);

// Estado ao vivo de um jogo (relógio, etiqueta). version sobe a cada mudança do jogo (lance,
// placar, relógio) — o poller do SSE só olha esta coluna.
export const matchLive = gamesSchema.table("match_live", {
  matchId: uuid("match_id")
    .primaryKey()
    .references(() => matches.id, { onDelete: "cascade" }),
  clockRunning: boolean("clock_running").notNull().default(false),
  clockAnchorMs: bigint("clock_anchor_ms", { mode: "number" }),
  clockAccumulatedMs: bigint("clock_accumulated_ms", { mode: "number" }).notNull().default(0),
  period: integer("period").notNull().default(1),
  label: text("label").notNull().default(""),
  version: bigint("version", { mode: "number" }).notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Canal de transmissão ("Quadra 1"): qual jogo o overlay/TV daquele canal mostra. Vários jogos
// simultâneos = vários canais.
export const liveChannels = gamesSchema.table(
  "live_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id),
    key: text("key").notNull(),
    name: text("name").notNull(),
    currentMatchId: uuid("current_match_id").references(() => matches.id, { onDelete: "set null" }),
    teaser: text("teaser"),
    version: bigint("version", { mode: "number" }).notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("live_channels_competition_key_unique").on(table.competitionId, table.key)],
);
