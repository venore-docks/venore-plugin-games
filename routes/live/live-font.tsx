import { BARLOW_CONDENSED_600_WOFF_BASE64, BARLOW_CONDENSED_800_WOFF_BASE64 } from "../../shared/fonts/barlow-condensed";

// Barlow Condensed embutida (mesmos bytes da capa gerada) só nas telas de transmissão — overlay e
// TVs. Server component: os ~70 KB de base64 vão uma vez no HTML, nunca no bundle de cliente.
// font-display: block — a fonte do OBS/TV não deve "pular" de largura no primeiro segundo.
const FONT_CSS = `
@font-face { font-family: "GamesCondensed"; font-weight: 400 600; font-style: normal; font-display: block;
  src: url(data:font/woff;base64,${BARLOW_CONDENSED_600_WOFF_BASE64}) format("woff"); }
@font-face { font-family: "GamesCondensed"; font-weight: 700 900; font-style: normal; font-display: block;
  src: url(data:font/woff;base64,${BARLOW_CONDENSED_800_WOFF_BASE64}) format("woff"); }
`;

export function LiveFontFace() {
  return <style>{FONT_CSS}</style>;
}
