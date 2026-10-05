// Settings do plugin (contexts/settings do host) — única fonte de chaves/defaults, usada pelo
// manifest (registro do default) e pelas telas de admin.
export const GAMES_SETTINGS = {
  // Competição mostrada no site (uuid). Vazio = a mais recente.
  activeCompetitionId: { key: "games.activeCompetitionId", defaultValue: "", label: "Competição ativa" },
  // Cor de destaque das telas fora do tema (overlay OBS, controle, TV). Hex.
  accentColor: { key: "games.accentColor", defaultValue: "#22c55e", label: "Cor de destaque do placar/TV" },
  youtubeChannelId: { key: "games.youtubeChannelId", defaultValue: "", label: "Id do canal do YouTube" },
  goalFlashSeconds: { key: "games.goalFlashSeconds", defaultValue: 7, label: "Duração do destaque de ponto no overlay (s)" },
  // Votação do craque da torcida: aberta do início do jogo até N horas depois do fim.
  fanVoteWindowHours: { key: "games.fanVoteWindowHours", defaultValue: 48, label: "Votação do jogo fica aberta por quantas horas depois do fim" },
  voteWaitBaseSeconds: { key: "games.voteWaitBaseSeconds", defaultValue: 5, label: "Espera do primeiro voto de uma rede (s)" },
  voteWaitStepSeconds: { key: "games.voteWaitStepSeconds", defaultValue: 5, label: "Espera a mais por voto da mesma rede (s)" },
  voteWaitMaxSeconds: { key: "games.voteWaitMaxSeconds", defaultValue: 60, label: "Espera máxima por voto (s)" },
  voteMaxPerNetwork: { key: "games.voteMaxPerNetwork", defaultValue: 30, label: "Máximo de votos por rede em cada votação (0 = sem limite)" },
  // Limite de emissão de tickets por rede por minuto (anti-script).
  voteTicketsPerMinute: { key: "games.voteTicketsPerMinute", defaultValue: 6, label: "Tickets de voto por rede por minuto" },
} as const;

export type GamesSettingField = keyof typeof GAMES_SETTINGS;

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function sanitizeHexColor(raw: unknown, fallback: string | null = GAMES_SETTINGS.accentColor.defaultValue): string | null {
  if (typeof raw !== "string") return fallback;
  const value = raw.trim();
  return HEX_COLOR.test(value) ? value : fallback;
}

export function clampInt(raw: unknown, min: number, max: number, fallback: number): number {
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}
