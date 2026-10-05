// Pontos corridos: distribuição em grupos e geração das rodadas pelo método do círculo.

export type RoundRobinPairing = { round: number; home: string; away: string };

// Distribui participantes (já na ordem de cabeça de chave) em `groupCount` grupos em serpentina —
// 1º seed no A, 2º no B, 3º no C, 4º no C, 5º no B… — pra equilibrar a força entre grupos.
export function distributeIntoGroups<T>(seeded: T[], groupCount: number): T[][] {
  const count = Math.max(1, Math.floor(groupCount));
  const groups: T[][] = Array.from({ length: count }, () => []);
  seeded.forEach((item, index) => {
    const lap = Math.floor(index / count);
    const offset = index % count;
    const groupIndex = lap % 2 === 0 ? offset : count - 1 - offset;
    groups[groupIndex].push(item);
  });
  return groups;
}

export function groupNameForIndex(index: number): string {
  let name = "";
  let value = index;
  do {
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return name;
}

// Método do círculo: com n ímpar entra um "bye" (folga) fixo; cada participante joga uma vez por
// rodada. Mando alterna pra ninguém ficar sempre em casa. `doubleRound` repete invertendo o mando.
export function generateRoundRobin(participantIds: string[], doubleRound = false): RoundRobinPairing[] {
  const ids = [...participantIds];
  if (ids.length < 2) return [];
  const BYE = "\u0000bye";
  if (ids.length % 2 === 1) ids.push(BYE);

  const n = ids.length;
  const rounds = n - 1;
  const half = n / 2;
  const pairings: RoundRobinPairing[] = [];
  let rotation = ids.slice(1);

  for (let round = 0; round < rounds; round += 1) {
    const current = [ids[0], ...rotation];
    for (let i = 0; i < half; i += 1) {
      const a = current[i];
      const b = current[n - 1 - i];
      if (a === BYE || b === BYE) continue;
      // Alterna o mando: o fixo (índice 0) troca a cada rodada; os demais pela paridade da posição.
      const swap = i === 0 ? round % 2 === 1 : i % 2 === 1;
      pairings.push({ round: round + 1, home: swap ? b : a, away: swap ? a : b });
    }
    rotation = [rotation[rotation.length - 1], ...rotation.slice(0, -1)];
  }

  if (!doubleRound) return pairings;
  return [...pairings, ...pairings.map((pairing) => ({ round: pairing.round + rounds, home: pairing.away, away: pairing.home }))];
}
