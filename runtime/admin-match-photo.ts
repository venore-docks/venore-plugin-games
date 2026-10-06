import { and, eq } from "drizzle-orm";
import { matches } from "../database/schema";
import { bumpDataVersion, db } from "./db";
import { fail, ok, type OperationResult } from "./result";

// Foto da súmula (base da capa/story geradas). Trocar a foto muda o hash de entrada de
// generateMatchShareImages (runtime/share-images.ts), que regera as imagens na próxima chamada.
export async function setMatchCoverPhoto(competitionId: string, matchId: string, mediaId: string | null): Promise<OperationResult<void>> {
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(matches)
      .set({ coverPhotoMediaId: mediaId, updatedAt: new Date() })
      .where(and(eq(matches.id, matchId), eq(matches.competitionId, competitionId)))
      .returning({ id: matches.id });
    if (updated.length === 0) return fail<void>("games.match.not_found", "Jogo não encontrado.");
    await bumpDataVersion(tx, competitionId);
    return ok(undefined);
  });
}

// Leitura direta (não pelo snapshot): a Server Action decide gerar as imagens logo depois de uma
// escrita, quando o snapshot do request ainda pode ser o de antes.
export async function getMatchCoverPhotoId(competitionId: string, matchId: string): Promise<string | null> {
  const [row] = await db
    .select({ photo: matches.coverPhotoMediaId })
    .from(matches)
    .where(and(eq(matches.id, matchId), eq(matches.competitionId, competitionId)));
  return row?.photo ?? null;
}
