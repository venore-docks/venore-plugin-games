import { defineConfig } from "drizzle-kit";

// Gera as migrations do schema "games" (npx drizzle-kit generate --config drizzle.config.ts).
// Aplicadas no install pelo core e, nas versões seguintes, no prebuild (db:migrate:plugins).
export default defineConfig({
  dialect: "postgresql",
  schema: "./database/schema/index.ts",
  out: "./migrations",
  schemaFilter: ["games"],
  migrations: { schema: "games_migrations", table: "__drizzle_migrations" },
});
