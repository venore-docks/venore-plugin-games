import type { SlotSource } from "./tournament";

// Mata-mata para QUALQUER número de participantes. Completa até a próxima potência de 2 com byes,
// que vão para os melhores cabeças de chave (6 equipes → cabeças 1 e 2 folgam a primeira rodada).
// Ex.: 6 → quartas 3×6 e 4×5; semis 1×V(4×5) e 2×V(3×6); final.

export type BracketMatchPlan = {
  key: string;
  round: number;
  // 1 = primeira rodada com jogos.
  position: number;
  roundLabel: string;
  home: SlotSource;
  away: SlotSource;
  isThirdPlace: boolean;
};

// Ordem padrão de cabeças de chave para uma chave de tamanho `size` (potência de 2), de modo que
// 1 e 2 só se encontrem na final: [1, 8, 4, 5, 2, 7, 3, 6] para 8.
export function standardSeedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const next = order.length * 2 + 1;
    order = order.flatMap((seed) => [seed, next - seed]);
  }
  return order;
}

export function nextPowerOfTwo(n: number): number {
  let size = 1;
  while (size < n) size *= 2;
  return size;
}

// Nome da rodada contando a partir do fim: 1 jogo = Final, 2 = Semifinal, 4 = Quartas…
export function knockoutRoundLabel(matchesInRound: number): string {
  if (matchesInRound <= 1) return "Final";
  if (matchesInRound === 2) return "Semifinal";
  if (matchesInRound === 4) return "Quartas de final";
  if (matchesInRound === 8) return "Oitavas de final";
  return `Rodada de ${matchesInRound * 2}`;
}

// `seeds[i]` = origem do cabeça i+1. Retorna os jogos de cada rodada; um lado que é bye não gera
// jogo — o cabeça entra direto na rodada seguinte.
export function planKnockout(seeds: SlotSource[], options: { thirdPlace: boolean; keyPrefix?: string }): BracketMatchPlan[] {
  const count = seeds.length;
  if (count < 2) return [];
  const prefix = options.keyPrefix ?? "M";
  const size = nextPowerOfTwo(count);
  const order = standardSeedOrder(size);

  // Entradas da rodada atual: origem de cada "vaga" (null = bye).
  let entrants: (SlotSource | null)[] = order.map((seed) => (seed <= count ? seeds[seed - 1] : null));
  const plans: BracketMatchPlan[] = [];
  let round = 0;
  let matchNumber = 0;
  const semifinalKeys: string[] = [];

  while (entrants.length > 1) {
    const next: (SlotSource | null)[] = [];
    const roundMatches: BracketMatchPlan[] = [];
    const slotsInRound = entrants.length / 2;
    for (let i = 0; i < entrants.length; i += 2) {
      const home = entrants[i];
      const away = entrants[i + 1];
      if (home && away) {
        matchNumber += 1;
        const plan: BracketMatchPlan = {
          key: `${prefix}${matchNumber}`,
          round: round + 1,
          position: roundMatches.length + 1,
          roundLabel: knockoutRoundLabel(slotsInRound),
          home,
          away,
          isThirdPlace: false,
        };
        roundMatches.push(plan);
        next.push({ type: "winner", matchKey: plan.key });
      } else {
        next.push(home ?? away);
      }
    }
    if (roundMatches.length > 0) {
      round += 1;
      for (const plan of roundMatches) plan.round = round;
      plans.push(...roundMatches);
      if (slotsInRound === 2) semifinalKeys.push(...roundMatches.map((plan) => plan.key));
    }
    entrants = next;
  }

  if (options.thirdPlace && semifinalKeys.length === 2) {
    const finalRound = plans[plans.length - 1].round;
    matchNumber += 1;
    plans.push({
      key: `${prefix}${matchNumber}`,
      round: finalRound,
      position: 2,
      roundLabel: "Disputa de 3º lugar",
      home: { type: "loser", matchKey: semifinalKeys[0] },
      away: { type: "loser", matchKey: semifinalKeys[1] },
      isThirdPlace: true,
    });
  }

  return plans;
}
