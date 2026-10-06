import type { Metadata } from "next";
import { asPluginApiHandler, asPluginPage, type PluginRouteTable } from "@venore/plugin-sdk";
import AdminHomePage from "./admin/home/page";
import AdminCompetitionPage from "./admin/competition/page";
import AdminParticipantsPage from "./admin/participants/list-page";
import AdminParticipantPage from "./admin/participants/detail-page";
import AdminAthletesPage from "./admin/athletes/list-page";
import AdminAthletePage from "./admin/athletes/detail-page";
import AdminModalitiesPage from "./admin/modalities/list-page";
import AdminModalityPage from "./admin/modalities/detail-page";
import AdminMatchesPage from "./admin/matches/list-page";
import AdminMatchPage from "./admin/matches/detail-page";
import AdminVotesPage from "./admin/votes/page";
import AdminImportPage from "./admin/import/page";
import PublicMatchPage from "./public/match/page";
import PublicParticipantPage from "./public/participant/page";
import PublicAthletePage from "./public/athlete/page";
import PublicModalityPage from "./public/modality/page";
import VoteHubPage from "./public/vote/hub-page";
import VoteMatchPage from "./public/vote/match-page";
import VoteFavoritePage from "./public/vote/favorite-page";
import { LegacyMatchRedirect, LegacyParticipantRedirect, LegacyAthleteRedirect, LegacyVoteRedirect, LegacyVoteMatchRedirect } from "./public/legacy-redirects";
import ControlPage from "./live/control/page";
import OverlayPage from "./live/overlay/page";
import TvPage from "./live/tv/page";
import VoteOverlayPage from "./live/vote-overlay/page";
import VoteTvPage from "./live/vote-tv/page";
import { GET as liveStateGET } from "./api/live-state";
import { GET as liveEventsGET } from "./api/live-events";
import { GET as calendarFeedGET } from "./api/calendar-feed";
import { GET as matchCalendarGET } from "./api/match-calendar";
import { buildAthleteMetadata, buildMatchMetadata, buildModalityMetadata, buildParticipantMetadata, buildVoteHubMetadata, buildVoteMatchMetadata } from "./public/metadata";

// generateMetadata declarado fora do literal (com tipo próprio, não asPluginMetadata): num core que
// ainda não lê o campo, a entrada só carrega uma propriedade a mais e o plugin compila igual.
type RouteMetadata = (props: {
  params: Promise<Record<string, string>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => Promise<Metadata>;

const withMetadata = (pattern: string, Component: Parameters<typeof asPluginPage>[0], generateMetadata: RouteMetadata) => ({
  pattern,
  Component: asPluginPage(Component),
  generateMetadata,
});

// Áreas (docs/venore-docks — §1.1 do AGENTS.md do host):
// - admin      → /admin/games/...                (cadastro, súmula, votação; gate por permissão)
// - public     → caminho completo, dentro do tema (jogo, equipe, atleta, modalidade, votação).
//                As LISTAS (início, agenda, classificação, equipes, jogos) são páginas do CMS
//                montadas com os blocos do plugin (seed "site-pages"), editáveis no page-builder.
// - standalone → /ext/games/... sem shell (controle no celular, overlay OBS, TVs).
// - api        → /api/games/... (ao vivo JSON/SSE, agenda .ics).
// Links antigos do Erasto League (/erasto-league/...) redirecionam pras rotas novas — a migração
// preserva os ids e slugs.
export const gamesRouteTable: PluginRouteTable = {
  admin: [
    { pattern: "", Component: asPluginPage(AdminHomePage) },
    { pattern: "competicao", Component: asPluginPage(AdminCompetitionPage) },
    { pattern: "equipes", Component: asPluginPage(AdminParticipantsPage) },
    { pattern: "equipes/:id", Component: asPluginPage(AdminParticipantPage) },
    { pattern: "atletas", Component: asPluginPage(AdminAthletesPage) },
    { pattern: "atletas/:id", Component: asPluginPage(AdminAthletePage) },
    { pattern: "modalidades", Component: asPluginPage(AdminModalitiesPage) },
    { pattern: "modalidades/:id", Component: asPluginPage(AdminModalityPage) },
    { pattern: "jogos", Component: asPluginPage(AdminMatchesPage) },
    { pattern: "jogos/:id", Component: asPluginPage(AdminMatchPage) },
    { pattern: "votacao", Component: asPluginPage(AdminVotesPage) },
    { pattern: "importar", Component: asPluginPage(AdminImportPage) },
  ],
  public: [
    withMetadata("jogos/:id", PublicMatchPage, async ({ params }) => buildMatchMetadata((await params).id)),
    withMetadata("equipes/:slug", PublicParticipantPage, async ({ params }) => buildParticipantMetadata((await params).slug)),
    withMetadata("atletas/:slug", PublicAthletePage, async ({ params }) => buildAthleteMetadata((await params).slug)),
    withMetadata("modalidades/:slug", PublicModalityPage, async ({ params }) => buildModalityMetadata((await params).slug)),
    withMetadata("votar", VoteHubPage, async () => buildVoteHubMetadata()),
    { pattern: "votar/favorito", Component: asPluginPage(VoteFavoritePage) },
    withMetadata("votar/jogo/:id", VoteMatchPage, async ({ params }) => buildVoteMatchMetadata((await params).id)),
    { pattern: "erasto-league/jogos/:id", Component: asPluginPage(LegacyMatchRedirect) },
    { pattern: "erasto-league/teams/:slug", Component: asPluginPage(LegacyParticipantRedirect) },
    { pattern: "erasto-league/players/:slug", Component: asPluginPage(LegacyAthleteRedirect) },
    { pattern: "erasto-league/votar", Component: asPluginPage(LegacyVoteRedirect) },
    { pattern: "erasto-league/votar/jogo/:id", Component: asPluginPage(LegacyVoteMatchRedirect) },
  ],
  standalone: [
    { pattern: "games/controle", Component: asPluginPage(ControlPage) },
    { pattern: "games/overlay", Component: asPluginPage(OverlayPage) },
    { pattern: "games/tv", Component: asPluginPage(TvPage) },
    { pattern: "games/votacao-overlay", Component: asPluginPage(VoteOverlayPage) },
    { pattern: "games/votacao-tv", Component: asPluginPage(VoteTvPage) },
  ],
  api: [
    { pattern: "live", handlers: { GET: asPluginApiHandler(liveStateGET) } },
    { pattern: "live/stream", handlers: { GET: asPluginApiHandler(liveEventsGET) } },
    { pattern: "agenda", handlers: { GET: asPluginApiHandler(calendarFeedGET) } },
    { pattern: "jogos/:id/agenda", handlers: { GET: asPluginApiHandler(matchCalendarGET) } },
  ],
};
