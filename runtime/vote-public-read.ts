import { and, eq, inArray } from "drizzle-orm";
import { votes } from "../database/schema";
import { isUuid } from "../shared/ids";
import { db } from "./db";
import { readVoterKey } from "./votes";

// "Seu voto" nas páginas públicas da votação: lê o cookie de aparelho SEM criar (render não grava
// cookie) e devolve a escolha deste aparelho por votação. Sem cookie = nunca votou aqui, nenhuma
// consulta. Uma consulta indexada (votes_poll_voter_unique) pra todas as votações da página.
export async function readVoterChoices(pollIds: string[]): Promise<Map<string, string>> {
  const ids = pollIds.filter((id) => isUuid(id));
  if (ids.length === 0) return new Map();
  const voterKey = await readVoterKey();
  if (!voterKey) return new Map();
  const rows = await db
    .select({ pollId: votes.pollId, choiceId: votes.choiceId })
    .from(votes)
    .where(and(eq(votes.voterKey, voterKey), inArray(votes.pollId, ids)));
  return new Map(rows.map((row) => [row.pollId, row.choiceId]));
}
