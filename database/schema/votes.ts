import { integer, index, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { gamesSchema } from "./schema";
import { competitions } from "./competition";
import { matches } from "./matches";

// Votação da torcida, sem login. kind:
//  - "match_athlete": craque da torcida de um jogo (matchId preenchido, um voto por aparelho, sem troca);
//  - "participant": equipe favorita da edição (troca permitida enquanto aberta).
// openMode: "auto" segue a janela do jogo; "open"/"closed" forçados pelo admin.
export const votePolls = gamesSchema.table(
  "vote_polls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id),
    kind: text("kind").notNull(),
    matchId: uuid("match_id").references(() => matches.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    openMode: text("open_mode").notNull().default("auto"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("vote_polls_match_unique").on(table.matchId)],
);

// voterKey = hash do cookie de aparelho; ipHash/uaHash = HMAC truncado (nunca o valor cru).
export const votes = gamesSchema.table(
  "votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pollId: uuid("poll_id")
      .notNull()
      .references(() => votePolls.id, { onDelete: "cascade" }),
    choiceId: uuid("choice_id").notNull(),
    voterKey: text("voter_key").notNull(),
    ipHash: text("ip_hash"),
    uaHash: text("ua_hash"),
    ticketNonce: text("ticket_nonce").notNull(),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("votes_poll_voter_unique").on(table.pollId, table.voterKey),
    uniqueIndex("votes_ticket_nonce_unique").on(table.ticketNonce),
    index("votes_poll_ip_idx").on(table.pollId, table.ipHash),
  ],
);

// Contagem agregada (só votos válidos), mantida na mesma transação de cada voto/anulação —
// parcial nunca faz COUNT(*) por visita.
export const voteTallies = gamesSchema.table(
  "vote_tallies",
  {
    pollId: uuid("poll_id")
      .notNull()
      .references(() => votePolls.id, { onDelete: "cascade" }),
    choiceId: uuid("choice_id").notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.pollId, table.choiceId] })],
);

// Fila de espera por rede em cada votação (shared/vote-cost.ts): quantos tickets já saíram e a
// partir de quando o próximo pode valer. Atualizada sob lock na emissão do ticket.
export const voteNetworkSlots = gamesSchema.table(
  "vote_network_slots",
  {
    pollId: uuid("poll_id")
      .notNull()
      .references(() => votePolls.id, { onDelete: "cascade" }),
    ipHash: text("ip_hash").notNull(),
    issued: integer("issued").notNull().default(0),
    nextSlotAt: timestamp("next_slot_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.pollId, table.ipHash] })],
);
