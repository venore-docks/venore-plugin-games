import { getSportProfile, type SportProfileKey } from "./sport-profiles";
import { DEFAULT_TIEBREAKERS, TIEBREAKER_KEYS, type TiebreakerKey } from "./standings";

// Regras de uma modalidade = defaults do perfil esportivo + overrides gravados em modalities.rules
// (jsonb). Sempre passam por resolveModalityRules — o jsonb nunca é lido cru pelas telas.
export type ModalityRules = {
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  tiebreakers: TiebreakerKey[];
  // Relógio do jogo (perfis com relógio).
  periodMinutes: number;
  periodCount: number;
  // Botão +0,5 no controle (pedido do Erasto League).
  allowHalfPoints: boolean;
  // Vôlei: sets pra vencer (melhor de 3 = 2) e pontos por set / tie-break.
  setsToWin: number;
  pointsPerSet: number;
  tieBreakPoints: number;
  // Prova única por medida: unidade e direção.
  measureUnit: string;
  lowerIsBetter: boolean;
  // Mata-mata: empate no tempo normal precisa de desempate (pênaltis) marcado no resultado.
  knockoutNeedsWinner: boolean;
};

export function defaultModalityRules(profileKey: SportProfileKey): ModalityRules {
  const profile = getSportProfile(profileKey);
  return {
    pointsWin: 3,
    pointsDraw: profile.defaultAllowsDraw ? 1 : 0,
    pointsLoss: 0,
    tiebreakers: DEFAULT_TIEBREAKERS,
    periodMinutes: profile.clock.defaultPeriodMinutes,
    periodCount: profile.clock.defaultPeriodCount,
    allowHalfPoints: false,
    setsToWin: profile.usesSets ? 2 : 0,
    pointsPerSet: profile.usesSets ? 25 : 0,
    tieBreakPoints: profile.usesSets ? 15 : 0,
    measureUnit: profile.eventResult?.unit ?? "",
    lowerIsBetter: profile.eventResult?.lowerIsBetter ?? false,
    knockoutNeedsWinner: true,
  };
}

function num(raw: unknown, min: number, max: number, fallback: number): number {
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function resolveModalityRules(profileKey: SportProfileKey, raw: unknown): ModalityRules {
  const base = defaultModalityRules(profileKey);
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const tiebreakers = Array.isArray(input.tiebreakers)
    ? input.tiebreakers.filter((key): key is TiebreakerKey => typeof key === "string" && (TIEBREAKER_KEYS as string[]).includes(key))
    : base.tiebreakers;
  return {
    pointsWin: num(input.pointsWin, 0, 100, base.pointsWin),
    pointsDraw: num(input.pointsDraw, 0, 100, base.pointsDraw),
    pointsLoss: num(input.pointsLoss, -100, 100, base.pointsLoss),
    tiebreakers: tiebreakers.length > 0 ? tiebreakers : base.tiebreakers,
    periodMinutes: Math.round(num(input.periodMinutes, 0, 120, base.periodMinutes)),
    periodCount: Math.round(num(input.periodCount, 0, 8, base.periodCount)),
    allowHalfPoints: typeof input.allowHalfPoints === "boolean" ? input.allowHalfPoints : base.allowHalfPoints,
    setsToWin: Math.round(num(input.setsToWin, 0, 5, base.setsToWin)),
    pointsPerSet: Math.round(num(input.pointsPerSet, 0, 100, base.pointsPerSet)),
    tieBreakPoints: Math.round(num(input.tieBreakPoints, 0, 100, base.tieBreakPoints)),
    measureUnit: typeof input.measureUnit === "string" ? input.measureUnit.trim().slice(0, 16) : base.measureUnit,
    lowerIsBetter: typeof input.lowerIsBetter === "boolean" ? input.lowerIsBetter : base.lowerIsBetter,
    knockoutNeedsWinner: typeof input.knockoutNeedsWinner === "boolean" ? input.knockoutNeedsWinner : base.knockoutNeedsWinner,
  };
}

// Placar sempre em múltiplos do menor passo permitido; nunca negativo.
export function clampScore(value: number, allowHalf: boolean): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return allowHalf ? Math.round(value * 2) / 2 : Math.round(value);
}
