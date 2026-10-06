// Migração do Erasto League: lá a correção de placar gravava um lance NEGATIVO (−1/−0,5, sem
// jogador). Aqui o placar é a soma dos lances positivos, então cada correção vira "desfazer": tira
// dos lances positivos mais recentes daquele lado o valor corrigido (um gol de 1 corrigido em −0,5
// vira 0,5). O resultado preserva o placar e tira o gol "corrigido" da artilharia.

export type LegacyGoal = { id: string; side: "home" | "away"; amount: number; createdAt: number };

export function normalizeLegacyGoals(goals: LegacyGoal[]): LegacyGoal[] {
  const kept: LegacyGoal[] = [];
  const ordered = [...goals].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  for (const goal of ordered) {
    if (goal.amount > 0) {
      kept.push({ ...goal });
      continue;
    }
    let remaining = -goal.amount;
    for (let index = kept.length - 1; index >= 0 && remaining > 0; index -= 1) {
      const candidate = kept[index];
      if (candidate.side !== goal.side) continue;
      const taken = Math.min(candidate.amount, remaining);
      candidate.amount = Math.round((candidate.amount - taken) * 2) / 2;
      remaining = Math.round((remaining - taken) * 2) / 2;
      if (candidate.amount <= 0) kept.splice(index, 1);
    }
  }
  return kept;
}
