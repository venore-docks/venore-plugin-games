import { notFound } from "next/navigation";
import { isPluginActive } from "@venore/plugin-sdk";
import { getBrandConfig } from "@venore/plugin-sdk/brand";
import { getActiveSnapshot } from "../../../runtime/snapshot";
import { LiveFontFace } from "../live-font";
import { readLiveSettings } from "../live-settings";
import { loadVoteBoard, voteHubQr } from "../vote-loader";
import { VoteTvCanvas, type VoteTvPin } from "./vote-tv-canvas";

// /ext/games/votacao-tv — parcial da votação da torcida em tela cheia (TV/projetor): craque da
// torcida do jogo (top 5) e equipe favorita (top 8) em rodízio, QR fixo na lateral. Pública e só
// leitura. ?pagina=jogador|equipe fixa uma das duas.
export default async function VoteTvPage({ searchParams }: { params: Promise<Record<string, string>>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!(await isPluginActive("games"))) notFound();
  const query = await searchParams;
  const pin: VoteTvPin = query.pagina === "jogador" ? "match" : query.pagina === "equipe" || query.pagina === "time" ? "favorite" : null;
  const [settings, board, { qr, displayUrl }, snapshot, brand] = await Promise.all([readLiveSettings(), loadVoteBoard(), voteHubQr(), getActiveSnapshot(), getBrandConfig("png")]);
  return (
    <>
      <LiveFontFace />
      <VoteTvCanvas
        initialBoard={board}
        qr={qr}
        displayUrl={displayUrl}
        pin={pin}
        competitionName={snapshot?.competition.name ?? brand.siteName}
        logoUrl={snapshot?.competition.logoUrl || brand.logoUrl || null}
        accentColor={settings.accentColor}
        accentInk={settings.accentInk}
      />
    </>
  );
}
