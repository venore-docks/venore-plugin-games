import type { SportProfile } from "../../../shared/sport-profiles";

// Regras puras do console de controle (chips de etiqueta, atalhos do relógio, validação de canal).

const CHANNEL_KEY_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

// Chave de canal vem de slugify (runtime/competitions.ts saveLiveChannel).
export function isChannelKey(value: unknown): value is string {
  return typeof value === "string" && CHANNEL_KEY_RE.test(value);
}

export type LabelChip = { label: string; period: number | null };

// Chips rápidos de etiqueta a partir do perfil: "1º TEMPO", "INTERVALO", "2º TEMPO", "FIM DE JOGO"
// (futsal); "1º QUARTO"…"4º QUARTO" com intervalo no meio (basquete). Sem relógio: só intervalo e
// fim. O chip de período também grava o número do período (overlay/TV mostram).
export function buildLabelChips(profile: Pick<SportProfile, "clock">, periodCount: number): LabelChip[] {
  const count = Math.max(0, Math.min(8, Math.round(periodCount)));
  if (!profile.clock.enabled || count === 0) return [{ label: "INTERVALO", period: null }, { label: "FIM DE JOGO", period: null }];
  const noun = (profile.clock.periodLabel || "tempo").toUpperCase();
  const chips: LabelChip[] = [];
  const half = count >= 2 && count % 2 === 0 ? count / 2 : null;
  for (let period = 1; period <= count; period += 1) {
    chips.push({ label: `${period}º ${noun}`, period });
    if (period === half) chips.push({ label: "INTERVALO", period: null });
  }
  if (count === 1 || half === null) chips.push({ label: "INTERVALO", period: null });
  chips.push({ label: "FIM DE JOGO", period: null });
  return dedupe(chips);
}

function dedupe(chips: LabelChip[]): LabelChip[] {
  const seen = new Set<string>();
  return chips.filter((chip) => (seen.has(chip.label) ? false : (seen.add(chip.label), true)));
}

export type ClockShortcut = { label: string; elapsedMs: number };

// Relógio crescente acumulado: "Fim do 1º tempo" = 1 × duração, "Fim do 2º tempo" = 2 × duração.
export function periodEndShortcuts(profile: Pick<SportProfile, "clock">, periodMinutes: number, periodCount: number): ClockShortcut[] {
  if (!profile.clock.enabled || !(periodMinutes > 0)) return [];
  const count = Math.max(0, Math.min(8, Math.round(periodCount)));
  const noun = profile.clock.periodLabel || "tempo";
  return Array.from({ length: count }, (_, index) => ({ label: `Fim do ${index + 1}º ${noun}`, elapsedMs: (index + 1) * periodMinutes * 60_000 }));
}

// Texto do lance com o minuto do relógio ("12'").
export function clockMinute(clockMs: number | null): string | null {
  if (clockMs === null || !Number.isFinite(clockMs) || clockMs < 0) return null;
  return `${Math.floor(clockMs / 60_000) + 1}'`;
}
