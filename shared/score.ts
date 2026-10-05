import type { MatchSide } from "../contracts/types";
import type { ModalityRules } from "./modality-rules";
import { clampScore } from "./modality-rules";
import type { SportProfile } from "./sport-profiles";

// Placar SEMPRE derivado dos lances (nunca contador solto): somar/desfazer um ponto é inserir ou
// apagar o lance, e o placar é recalculado do zero. Corrige os bugs do plugin antigo em que o "−1"
// gravava um lance negativo (placar 0,5 − 1 virava −0,5 → 0 e o +1 seguinte mostrava 0,5; o gol
// continuava na artilharia).

export type ScoringEvent = { side: MatchSide; kind: string; amount: number };

export type ComputedScore = { homeScore: number; awayScore: number; sets: { home: number; away: number }[] | null };

function isScoring(profile: SportProfile, event: ScoringEvent): boolean {
  return event.amount > 0 && profile.eventKinds.some((kind) => kind.key === event.kind && kind.scores);
}

// Vôlei: replay dos pontos em ordem. Set fecha com `pointsPerSet` (ou `tieBreakPoints` no set
// decisivo) e 2 de vantagem; jogo fecha com `setsToWin`. Pontos depois do fim são ignorados.
export function replaySets(events: ScoringEvent[], rules: Pick<ModalityRules, "setsToWin" | "pointsPerSet" | "tieBreakPoints">): ComputedScore {
  const setsToWin = Math.max(1, rules.setsToWin);
  const sets: { home: number; away: number }[] = [{ home: 0, away: 0 }];
  let homeSets = 0;
  let awaySets = 0;
  for (const event of events) {
    if (homeSets >= setsToWin || awaySets >= setsToWin) break;
    const current = sets[sets.length - 1];
    current[event.side] += event.amount;
    const deciding = homeSets === setsToWin - 1 && awaySets === setsToWin - 1;
    const target = deciding && rules.tieBreakPoints > 0 ? rules.tieBreakPoints : Math.max(1, rules.pointsPerSet);
    const lead = Math.abs(current.home - current.away);
    if ((current.home >= target || current.away >= target) && lead >= 2) {
      if (current.home > current.away) homeSets += 1;
      else awaySets += 1;
      if (homeSets < setsToWin && awaySets < setsToWin) sets.push({ home: 0, away: 0 });
    }
  }
  return { homeScore: homeSets, awayScore: awaySets, sets };
}

export function computeScore(events: ScoringEvent[], profile: SportProfile, rules: ModalityRules): ComputedScore {
  const scoring = events.filter((event) => isScoring(profile, event));
  if (profile.usesSets) return replaySets(scoring, rules);
  let home = 0;
  let away = 0;
  for (const event of scoring) {
    if (event.side === "home") home += event.amount;
    else away += event.amount;
  }
  return { homeScore: clampScore(home, rules.allowHalfPoints), awayScore: clampScore(away, rules.allowHalfPoints), sets: null };
}

// Valores que o controle aceita num lance que pontua: os botões do perfil (+1, +2, +3) e +0,5
// quando a modalidade permite meio ponto.
export function allowedScoreAmounts(profile: SportProfile, rules: ModalityRules): number[] {
  const amounts = new Set(profile.scoreButtons.map((button) => button.amount));
  if (rules.allowHalfPoints) amounts.add(0.5);
  return [...amounts];
}

export function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
}
