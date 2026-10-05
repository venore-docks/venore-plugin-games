import { pgSchema } from "drizzle-orm/pg-core";

// Schema próprio do plugin — aplicado no install (run-plugin-migrations.ts do core) e, nas versões
// seguintes, no prebuild (db:migrate:plugins). Nome bate com a key "games".
export const gamesSchema = pgSchema("games");
