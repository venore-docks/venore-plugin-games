import { notFound } from "next/navigation";
import { isPluginActive } from "@venore/plugin-sdk";
import { buildLiveState, readChannel } from "../../../runtime/live-state";
import { getCompetitionSnapshot, resolveActiveCompetitionId } from "../../../runtime/snapshot";
import { isChannelKey } from "../control/control-model";
import { LiveFontFace } from "../live-font";
import { readLiveSettings } from "../live-settings";
import { Scoreboard, type OverlayPosition } from "./scoreboard";

// /ext/games/overlay?canal=<chave>&pos=bottom|top — placar pro OBS (fonte de navegador 1920×1080,
// fundo transparente). Público e só leitura: o estado vem do SSE do canal.
export default async function OverlayPage({ searchParams }: { params: Promise<Record<string, string>>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!(await isPluginActive("games"))) notFound();
  const query = await searchParams;
  const channelKey = isChannelKey(query.canal) ? query.canal : null;
  const position: OverlayPosition = query.pos === "top" ? "top" : "bottom";

  const competitionId = await resolveActiveCompetitionId();
  const [settings, channel, snapshot] = await Promise.all([
    readLiveSettings(),
    competitionId ? readChannel(competitionId, channelKey) : null,
    competitionId ? getCompetitionSnapshot(competitionId) : null,
  ]);
  // Canal inexistente: overlay vazio e transparente (nunca uma mensagem de erro na transmissão).
  if (!competitionId || !channel) return <style>{"html, body { background: transparent !important; }"}</style>;

  const initialState = await buildLiveState(competitionId, channel);
  return (
    <>
      <LiveFontFace />
      <Scoreboard
        initialState={initialState}
        accentColor={settings.accentColor}
        accentInk={settings.accentInk}
        goalFlashMs={settings.goalFlashMs}
        logoUrl={snapshot?.competition.logoUrl ?? null}
        competitionName={snapshot?.competition.name ?? ""}
        position={position}
      />
    </>
  );
}
