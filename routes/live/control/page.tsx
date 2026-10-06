import { notFound } from "next/navigation";
import { checkGamesAccess } from "../../../runtime/gate";
import { buildLiveState, readChannel } from "../../../runtime/live-state";
import { getCompetitionSnapshot } from "../../../runtime/snapshot";
import { PATHS } from "../../../shared/paths";
import { readLiveSettings } from "../live-settings";
import { isChannelKey } from "./control-model";
import { buildMatchDesk, buildPickerGroups, buildQuickModalities } from "./desk";
import { ControlNotice } from "./notice";
import { Console } from "./console";

// /ext/games/controle?canal=<chave> — controle do jogo ao vivo no celular. Fora da shell do site
// (cabe inteiro na tela), mas gateado por login: games.operate (ou games.manage). Estado inicial
// montado no servidor; depois o console vive do SSE do canal e das Server Actions.
export default async function ControlPage({ searchParams }: { params: Promise<Record<string, string>>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await checkGamesAccess("operate");
  if (!access.ok && access.reason === "inactive") notFound();
  const settings = await readLiveSettings();
  const notice = (title: string, message: string, links: { href: string; label: string; ghost?: boolean }[]) => (
    <ControlNotice title={title} message={message} links={links} accentColor={settings.accentColor} accentInk={settings.accentInk} />
  );

  if (!access.ok) {
    return access.reason === "unauthenticated"
      ? notice("Entre para controlar o jogo", "O controle ao vivo é só para a equipe de operação. Faça login com uma conta autorizada.", [{ href: "/login", label: "Fazer login" }])
      : notice("Sem permissão", "Sua conta não tem acesso ao controle ao vivo. Peça a um administrador a permissão de operar os jogos.", [{ href: "/login", label: "Entrar com outra conta", ghost: true }]);
  }
  if (!access.competitionId) {
    return notice("Nenhuma competição", "Crie uma competição no painel antes de usar o controle.", [{ href: PATHS.admin.competition(), label: "Abrir o painel" }]);
  }

  const query = await searchParams;
  const requestedKey = typeof query.canal === "string" && isChannelKey(query.canal) ? query.canal : null;
  const [snapshot, channel] = await Promise.all([getCompetitionSnapshot(access.competitionId), readChannel(access.competitionId, requestedKey)]);
  if (!snapshot || !channel) {
    return requestedKey
      ? notice("Canal não encontrado", `Não existe o canal "${requestedKey}" nesta competição.`, [{ href: PATHS.control(), label: "Abrir o canal principal" }])
      : notice("Nenhum canal ao vivo", "Cadastre um canal (ex.: Quadra 1) na página da competição antes de usar o controle.", [{ href: PATHS.admin.competition(), label: "Abrir o painel" }]);
  }

  const initialState = await buildLiveState(access.competitionId, channel);
  const channels = [...snapshot.channels].sort((a, b) => (a.key === "principal" ? -1 : b.key === "principal" ? 1 : a.name.localeCompare(b.name, "pt-BR")));

  return (
    <Console
      initialState={initialState}
      initialDesk={initialState.matchId ? buildMatchDesk(snapshot, initialState.matchId) : null}
      channels={channels.map((item) => ({ key: item.key, name: item.name }))}
      pickerGroups={buildPickerGroups(snapshot, initialState.serverNow)}
      quickModalities={buildQuickModalities(snapshot)}
      boosts={[...snapshot.boostCatalog].sort((a, b) => a.sortOrder - b.sortOrder).map((boost) => ({ id: boost.id, label: boost.label, emoji: boost.emoji, description: boost.description }))}
      competitionName={snapshot.competition.name}
      accentColor={settings.accentColor}
      accentInk={settings.accentInk}
      overlayPath={PATHS.overlay(channel.key)}
      canManage={access.actor.canManage}
    />
  );
}
