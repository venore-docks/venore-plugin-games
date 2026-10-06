import { notFound } from "next/navigation";
import { isPluginActive } from "@venore/plugin-sdk";
import { getBrandConfig } from "@venore/plugin-sdk/brand";
import { buildLiveState, readChannel } from "../../../runtime/live-state";
import { getCompetitionSnapshot, resolveActiveCompetitionId } from "../../../runtime/snapshot";
import { indexes } from "../../../shared/derive";
import { LiveFontFace } from "../live-font";
import { readLiveSettings } from "../live-settings";
import { buildTvPages, TV_PAGE_SLUGS } from "./tv-pages";
import { TvScreen } from "./tv-canvas";

// Fora do corpo do componente: a regra de pureza do React não aceita Date.now() no render, mas a
// TV é dinâmica de propósito (cada request monta a hora certa pros "próximos jogos").
const currentTime = () => Date.now();

// /ext/games/tv — TV/projetor do evento: rodízio de páginas (jogo ao vivo, próximos jogos,
// classificação, mata-mata, artilharia, quadro geral) num palco de 1920px escalado. Pública e só
// leitura. ?pagina=<proximos|classificacao|mata-mata|artilharia|quadro-geral|ao-vivo> fixa um tipo
// de página; ?modalidade=<slug> mostra só uma modalidade.
export default async function TvPage({ searchParams }: { params: Promise<Record<string, string>>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!(await isPluginActive("games"))) notFound();
  const query = await searchParams;
  const competitionId = await resolveActiveCompetitionId();
  const [settings, snapshot, brand] = await Promise.all([readLiveSettings(), competitionId ? getCompetitionSnapshot(competitionId) : null, getBrandConfig("png")]);

  const pin = typeof query.pagina === "string" ? (TV_PAGE_SLUGS[query.pagina] ?? null) : null;
  const modality = snapshot && typeof query.modalidade === "string" ? (indexes(snapshot).modalitiesBySlug.get(query.modalidade) ?? null) : null;
  if (snapshot && typeof query.modalidade === "string" && !modality) notFound();

  // Canal com jogo AO VIVO (o principal primeiro); sem nenhum, o principal — a TV acompanha por
  // polling e a página "ao vivo" aparece quando um jogo começar.
  let live = null;
  if (competitionId && snapshot) {
    const liveChannel =
      [...snapshot.channels]
        .sort((a, b) => (a.key === "principal" ? -1 : b.key === "principal" ? 1 : a.key.localeCompare(b.key)))
        .find((channel) => channel.currentMatchId && indexes(snapshot).matches.get(channel.currentMatchId)?.status === "live" && (!modality || indexes(snapshot).matches.get(channel.currentMatchId)?.modalityId === modality.id)) ?? null;
    const row = await readChannel(competitionId, liveChannel?.key ?? null);
    if (row) live = await buildLiveState(competitionId, row);
  }

  const now = live?.serverNow ?? currentTime();
  return (
    <>
      <LiveFontFace />
      <TvScreen
        pages={snapshot ? buildTvPages(snapshot, now, { modalityId: modality?.id ?? null }) : []}
        version={snapshot && competitionId ? `${competitionId}:${snapshot.version}` : null}
        pin={pin}
        initialLive={live}
        competitionName={modality ? `${snapshot?.competition.name ?? ""} · ${modality.name}` : (snapshot?.competition.name ?? brand.siteName)}
        logoUrl={snapshot?.competition.logoUrl || brand.logoUrl || null}
        accentColor={settings.accentColor}
        accentInk={settings.accentInk}
        goalFlashMs={settings.goalFlashMs}
      />
    </>
  );
}
