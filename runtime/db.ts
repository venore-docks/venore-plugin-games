import { db } from "@venore/plugin-sdk";
import { eq, sql } from "drizzle-orm";
import { competitions } from "../database/schema";

export { db };
export type Database = typeof db;
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type Executor = Database | Tx;

// Toda escrita do plugin chama isto na MESMA transação: o snapshot público (runtime/snapshot.ts)
// só recarrega quando a versão muda.
export async function bumpDataVersion(executor: Executor, competitionId: string): Promise<void> {
  await executor
    .update(competitions)
    .set({ dataVersion: sql`${competitions.dataVersion} + 1`, updatedAt: new Date() })
    .where(eq(competitions.id, competitionId));
}

// Código de erro de violação de unicidade do Postgres (slug repetido em corrida, nonce reusado).
export function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string; cause?: { code?: string } } | null)?.code ?? (error as { cause?: { code?: string } } | null)?.cause?.code;
  return code === "23505";
}
