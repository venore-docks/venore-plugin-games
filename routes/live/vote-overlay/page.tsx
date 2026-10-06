import { notFound } from "next/navigation";
import { isPluginActive } from "@venore/plugin-sdk";
import { LiveFontFace } from "../live-font";
import { readLiveSettings } from "../live-settings";
import { loadVoteCallout, voteHubQr } from "../vote-loader";
import { VoteQrOverlay, type VoteOverlayPosition } from "./vote-qr-overlay";

const POSITIONS: VoteOverlayPosition[] = ["top-left", "top-right", "bottom-left", "bottom-right"];

// /ext/games/votacao-overlay?pos=top-right — fonte de navegador SEPARADA do placar no OBS (quem
// opera o placar não precisa mexer no QR). Fundo transparente; com votação de jogo aberta chama o
// craque da torcida, senão a equipe favorita (se aberta), senão fica vazia — esquecer a fonte
// ligada não quebra nada. Padrão top-right: o placar ocupa o rodapé.
export default async function VoteOverlayPage({ searchParams }: { params: Promise<Record<string, string>>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!(await isPluginActive("games"))) notFound();
  const query = await searchParams;
  const position = POSITIONS.find((item) => item === query.pos) ?? "top-right";
  const [settings, callout, { qr, displayUrl }] = await Promise.all([readLiveSettings(), loadVoteCallout(), voteHubQr()]);
  return (
    <>
      <LiveFontFace />
      <VoteQrOverlay initialCallout={callout} qr={qr} displayUrl={displayUrl} accentColor={settings.accentColor} accentInk={settings.accentInk} position={position} />
    </>
  );
}
