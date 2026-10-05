// URLs do plugin — fonte única pra links entre telas (blocos, páginas, admin, compartilhar).
// Públicas: dentro do tema do site, casadas pelo catch-all do CMS (route-table "public").
// Standalone: /ext/games/... (sem shell — overlay OBS, TV, controle).

export const PATHS = {
  match: (id: string) => `/jogos/${id}`,
  participant: (slug: string) => `/equipes/${slug}`,
  athlete: (slug: string) => `/atletas/${slug}`,
  modality: (slug: string) => `/modalidades/${slug}`,
  vote: () => "/votar",
  voteMatch: (matchId: string) => `/votar/jogo/${matchId}`,
  voteFavorite: () => "/votar/favorito",

  control: (channelKey?: string) => `/ext/games/controle${channelKey ? `?canal=${encodeURIComponent(channelKey)}` : ""}`,
  overlay: (channelKey?: string) => `/ext/games/overlay${channelKey ? `?canal=${encodeURIComponent(channelKey)}` : ""}`,
  tv: () => "/ext/games/tv",
  voteOverlay: () => "/ext/games/votacao-overlay",
  voteTv: () => "/ext/games/votacao-tv",

  calendarFeed: () => "/api/games/agenda",
  matchCalendar: (matchId: string) => `/api/games/jogos/${matchId}/agenda`,
  liveJson: (channelKey: string) => `/api/games/live?canal=${encodeURIComponent(channelKey)}`,

  admin: {
    home: () => "/admin/games",
    competition: () => "/admin/games/competicao",
    participants: () => "/admin/games/equipes",
    participant: (id: string) => `/admin/games/equipes/${id}`,
    athletes: () => "/admin/games/atletas",
    athlete: (id: string) => `/admin/games/atletas/${id}`,
    modalities: () => "/admin/games/modalidades",
    modality: (id: string) => `/admin/games/modalidades/${id}`,
    matches: () => "/admin/games/jogos",
    match: (id: string) => `/admin/games/jogos/${id}`,
    votes: () => "/admin/games/votacao",
    import: () => "/admin/games/importar",
  },
} as const;
