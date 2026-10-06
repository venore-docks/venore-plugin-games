// "Palco" das telas de TV (/ext/games/tv e /ext/games/votacao-tv): compõe contra uma LARGURA DE
// REFERÊNCIA FIXA em px de CSS e escala uniformemente pro viewport real via transform: scale(...)
// — qualquer TV/projetor (1280×720, 1920×1080, 4K, item "página web" de playlist) mostra o MESMO
// layout, só em tamanhos diferentes. Técnica herdada do plugin erasto-league.
export const TV_STAGE_WIDTH_PX = 1920;
// 16:9 — usado enquanto o viewport ainda não foi medido (SSR e primeiro render).
export const TV_STAGE_FALLBACK_HEIGHT_PX = 1080;

export type TvStageTransform = { scale: number; stageWidthPx: number; stageHeightPx: number };

const FALLBACK: TvStageTransform = { scale: 1, stageWidthPx: TV_STAGE_WIDTH_PX, stageHeightPx: TV_STAGE_FALLBACK_HEIGHT_PX };

// Entradas degeneradas (0, negativo, NaN) caem no palco 16:9 sem escala: a tela aparece composta,
// nunca em branco. A altura acompanha o viewport (tela 4:3 ganha palco mais alto, não tarja).
export function resolveTvStageTransform(viewportWidth: number, viewportHeight: number): TvStageTransform {
  if (!(viewportWidth > 0) || !(viewportHeight > 0)) return FALLBACK;
  const scale = viewportWidth / TV_STAGE_WIDTH_PX;
  return { scale, stageWidthPx: TV_STAGE_WIDTH_PX, stageHeightPx: viewportHeight / scale };
}
