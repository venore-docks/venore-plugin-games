import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { getMediaAsset, getMediaAssetUrls, uploadMediaAsset } from "@venore/plugin-sdk/media";
import { deleteMediaSafely } from "@venore/plugin-sdk/media";
import { getSetting } from "@venore/plugin-sdk/settings";
import { matches } from "../database/schema";
import { formatMatchDate } from "../shared/timezone";
import { formatScore } from "../shared/score";
import { indexes } from "../shared/derive";
import { GAMES_SETTINGS, sanitizeHexColor } from "../shared/settings";
import { bumpDataVersion, db } from "./db";
import { getCompetitionSnapshot } from "./snapshot";
import { renderShareImages, type ShareImageData } from "./images/share-image";
import { fail, ok, type OperationResult } from "./result";

// Capa (16:9) e story (9:16) de um jogo: geradas UMA vez a partir da foto da súmula + dados do
// jogo e salvas no sistema de mídia (Blob). Regeradas só quando o hash dos dados de entrada muda
// (foto, equipes, brasões, rodada, data, placar final). Precisa de sessão com permissão de mídia
// (uploadMediaAsset) — por isso roda em Server Action do admin/controle (via after()), nunca em
// rota pública.

export type ShareImagesOutcome = "generated" | "unchanged" | "skipped";

async function buildInput(competitionId: string, matchId: string, origin: string): Promise<{ data: ShareImageData; hash: string; current: typeof matches.$inferSelect } | null> {
  const snapshot = await getCompetitionSnapshot(competitionId);
  if (!snapshot) return null;
  const index = indexes(snapshot);
  const match = index.matches.get(matchId);
  const [row] = await db.select().from(matches).where(eq(matches.id, matchId));
  if (!match || !row || !match.homeId || !match.awayId) return null;
  const modality = index.modalities.get(match.modalityId);
  const home = index.participants.get(match.homeId);
  const away = index.participants.get(match.awayId);
  if (!home || !away) return null;

  // Brasões/logo em resolução de imagem gerada (não a miniatura de 96px do snapshot).
  const mediaIds = [home.crestMediaId, away.crestMediaId, snapshot.competition.logoMediaId, row.coverPhotoMediaId].filter((id): id is string => Boolean(id));
  const urls = mediaIds.length ? await getMediaAssetUrls({ ids: mediaIds, displayWidth: 640 }) : null;
  const url = (id: string | null) => (id && urls?.success ? (urls.data[id] ?? null) : null);
  const photoUrl = row.coverPhotoMediaId ? await originalUrl(row.coverPhotoMediaId) : null;

  const accentSetting = await getSetting({ key: GAMES_SETTINGS.accentColor.key });
  const accentColor = sanitizeHexColor(accentSetting.success && accentSetting.data ? accentSetting.data.value : null) ?? GAMES_SETTINGS.accentColor.defaultValue;

  const data: ShareImageData = {
    competitionName: snapshot.competition.name,
    modalityName: modality?.name ?? "",
    stageLabel: match.roundLabel,
    dateLabel: formatMatchDate(match.scheduledDate, match.scheduledTime),
    accentColor,
    logoUrl: url(snapshot.competition.logoMediaId),
    photoUrl,
    home: { name: home.name, crestUrl: url(home.crestMediaId), color: home.primaryColor },
    away: { name: away.name, crestUrl: url(away.crestMediaId), color: away.primaryColor },
    score: match.status === "finished" ? { home: formatScore(match.homeScore), away: formatScore(match.awayScore) } : null,
    domain: new URL(origin).host,
  };
  const hash = createHash("sha256")
    .update(JSON.stringify({ ...data, crestIds: [home.crestMediaId, away.crestMediaId, snapshot.competition.logoMediaId], photo: row.coverPhotoMediaId }))
    .digest("hex")
    .slice(0, 32);
  return { data, hash, current: row };
}

async function originalUrl(mediaId: string): Promise<string | null> {
  const asset = await getMediaAsset({ id: mediaId });
  return asset.success && asset.data ? asset.data.url : null;
}

export async function generateMatchShareImages(competitionId: string, matchId: string, origin: string, options: { force?: boolean } = {}): Promise<OperationResult<ShareImagesOutcome>> {
  const input = await buildInput(competitionId, matchId, origin);
  if (!input) return ok("skipped");
  if (!options.force && input.current.shareImagesHash === input.hash && input.current.coverImageMediaId && input.current.storyImageMediaId) return ok("unchanged");

  const { cover, story } = await renderShareImages(input.data, origin);
  const extension = cover.contentType === "image/jpeg" ? "jpg" : "png";
  const baseName = `${input.data.home.name}-x-${input.data.away.name}`.normalize("NFD").replace(/[^\w-]+/g, "-").toLowerCase().slice(0, 60);
  const [coverAsset, storyAsset] = await Promise.all([
    uploadMediaAsset({ filename: `capa-${baseName}.${extension}`, contentType: cover.contentType, size: cover.body.length, data: cover.body, visibility: "public" }),
    uploadMediaAsset({ filename: `story-${baseName}.${extension}`, contentType: story.contentType, size: story.body.length, data: story.body, visibility: "public" }),
  ]);
  if (!coverAsset.success || !storyAsset.success) {
    const error = !coverAsset.success ? coverAsset.error : !storyAsset.success ? storyAsset.error : null;
    return fail("games.share_images.upload_failed", error?.message ?? "Não foi possível salvar as imagens.");
  }

  const previous = [input.current.coverImageMediaId, input.current.storyImageMediaId].filter((id): id is string => Boolean(id));
  await db.transaction(async (tx) => {
    await tx
      .update(matches)
      .set({ coverImageMediaId: coverAsset.data.id, storyImageMediaId: storyAsset.data.id, shareImagesHash: input.hash, updatedAt: new Date() })
      .where(eq(matches.id, matchId));
    await bumpDataVersion(tx, competitionId);
  });
  // Versões antigas saem do Blob (não acumulam armazenamento a cada regeração).
  for (const id of previous) await deleteMediaSafely({ id, confirmed: true }).catch(() => undefined);
  return ok("generated");
}
