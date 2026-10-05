import { eq, or } from "drizzle-orm";
import type { MediaUsageReference } from "@venore/plugin-sdk";
import { athletes, competitions, matches, modalities, participants } from "../database/schema";
import { PATHS } from "../shared/paths";
import { db } from "./db";

// "Quem usa esta mídia" pro sistema de mídia do host: apagar um brasão/foto/capa avisa onde ele
// aparece em vez de quebrar a imagem em silêncio.
export async function resolveGamesMediaUsage(mediaId: string): Promise<MediaUsageReference[]> {
  const ref = (label: string, href: string): MediaUsageReference => ({ consumerKey: "games", consumerLabel: "Competições", label, href });
  const [competitionRows, participantRows, athleteRows, modalityRows, matchRows] = await Promise.all([
    db.select({ id: competitions.id, name: competitions.name }).from(competitions).where(eq(competitions.logoMediaId, mediaId)),
    db.select({ id: participants.id, name: participants.name }).from(participants).where(eq(participants.crestMediaId, mediaId)),
    db.select({ id: athletes.id, name: athletes.name }).from(athletes).where(eq(athletes.photoMediaId, mediaId)),
    db.select({ id: modalities.id, name: modalities.name }).from(modalities).where(eq(modalities.coverMediaId, mediaId)),
    db
      .select({ id: matches.id })
      .from(matches)
      .where(or(eq(matches.coverPhotoMediaId, mediaId), eq(matches.coverImageMediaId, mediaId), eq(matches.storyImageMediaId, mediaId))),
  ]);
  return [
    ...competitionRows.map((row) => ref(`Logo da competição: ${row.name}`, PATHS.admin.competition())),
    ...participantRows.map((row) => ref(`Brasão: ${row.name}`, PATHS.admin.participant(row.id))),
    ...athleteRows.map((row) => ref(`Foto do atleta: ${row.name}`, PATHS.admin.athlete(row.id))),
    ...modalityRows.map((row) => ref(`Capa da modalidade: ${row.name}`, PATHS.admin.modality(row.id))),
    ...matchRows.map((row) => ref("Foto/capa de um jogo", PATHS.admin.match(row.id))),
  ];
}
