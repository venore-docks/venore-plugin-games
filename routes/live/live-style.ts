import type { CSSProperties } from "react";

// Base visual das telas /ext/games/** (fora do tema do site: as variáveis shadcn não são garantidas
// ali). Cor de destaque e a tinta legível sobre ela entram como variáveis CSS inline, vindas da
// setting games.accentColor.
export const LIVE_FONT_FAMILY = `"GamesCondensed", "Barlow Condensed", "Roboto Condensed", "Arial Narrow", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
export const LIVE_UI_FONT_FAMILY = `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

export function accentVars(accentColor: string, accentInk: string, extra: Record<string, string> = {}): CSSProperties {
  return { "--gm-accent": accentColor, "--gm-accent-ink": accentInk, ...extra } as CSSProperties;
}

// Iniciais pra brasão/foto ausente ("Turma 9A" → "T9").
export function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
