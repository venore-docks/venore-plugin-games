import type { StandingRow } from "./standings";

// Colocação final de uma modalidade e pontos do quadro geral — puro.

export type Placement = { participantId: string; position: number };

// Posições com empate compartilhado ("1, 1, 3"), a partir de uma lista já ordenada e de uma
// função que diz se dois vizinhos estão empatados.
export function sharedPositions<T>(ordered: T[], tied: (a: T, b: T) => boolean): number[] {
  const positions: number[] = [];
  ordered.forEach((item, index) => {
    positions.push(index > 0 && tied(ordered[index - 1], item) ? positions[index - 1] : index + 1);
  });
  return positions;
}

// Prova única: maior valor vence (ou menor, em tempo). Empate exato divide a posição.
export function placementsFromEventResults(
  results: { participantId: string; value: number | null }[],
  lowerIsBetter: boolean,
): Placement[] {
  const valid = results.filter((result): result is { participantId: string; value: number } => result.value !== null && Number.isFinite(result.value));
  const ordered = [...valid].sort((a, b) => (lowerIsBetter ? a.value - b.value : b.value - a.value));
  const positions = sharedPositions(ordered, (a, b) => a.value === b.value);
  return ordered.map((result, index) => ({ participantId: result.participantId, position: positions[index] }));
}

export function placementsFromStandings(rows: StandingRow[]): Placement[] {
  return rows.map((row) => ({ participantId: row.participantId, position: row.rank }));
}

export type KnockoutResult = {
  key: string;
  round: number;
  isThirdPlace: boolean;
  homeId: string | null;
  awayId: string | null;
  winnerId: string | null;
};

// Mata-mata: campeão = vencedor da final, 2º = perdedor; 3º = vencedor da disputa de 3º (ou os
// dois perdedores da semi empatados em 3º, sem disputa). Eliminados antes dividem a posição
// seguinte por rodada (perdedores das quartas = 5º).
export function placementsFromKnockout(matches: KnockoutResult[]): Placement[] {
  const regular = matches.filter((match) => !match.isThirdPlace);
  if (regular.length === 0) return [];
  const finalRound = Math.max(...regular.map((match) => match.round));
  const final = regular.find((match) => match.round === finalRound);
  if (!final?.winnerId) return [];

  const loserOf = (match: KnockoutResult) =>
    match.winnerId ? (match.winnerId === match.homeId ? match.awayId : match.homeId) : null;

  const placements: Placement[] = [{ participantId: final.winnerId, position: 1 }];
  const finalLoser = loserOf(final);
  if (finalLoser) placements.push({ participantId: finalLoser, position: 2 });

  let nextPosition = 3;
  const thirdPlace = matches.find((match) => match.isThirdPlace);
  if (thirdPlace?.winnerId) {
    placements.push({ participantId: thirdPlace.winnerId, position: 3 });
    const fourth = loserOf(thirdPlace);
    if (fourth) placements.push({ participantId: fourth, position: 4 });
    nextPosition = 5;
  }

  const placed = new Set(placements.map((placement) => placement.participantId));
  for (let round = finalRound - 1; round >= 1; round -= 1) {
    const losers = regular
      .filter((match) => match.round === round)
      .map(loserOf)
      .filter((id): id is string => Boolean(id) && !placed.has(id as string));
    for (const id of losers) {
      placements.push({ participantId: id, position: nextPosition });
      placed.add(id);
    }
    if (losers.length > 0) nextPosition += losers.length;
  }
  return placements;
}

// ---- Quadro geral ----

export const DEFAULT_PLACEMENT_POINTS = [100, 80, 65, 55, 45, 40, 35, 30, 25, 20, 15, 10];

export type OverallModalityInput = {
  modalityId: string;
  weight: number;
  // Override da tabela da competição (vazio = usa a da competição).
  pointsTable: number[] | null;
  placements: Placement[];
};

export type OverallAdjustment = { participantId: string; points: number; modalityId: string | null };

export type OverallRow = {
  participantId: string;
  name: string;
  total: number;
  byModality: Record<string, number>;
  adjustments: number;
  golds: number;
  silvers: number;
  bronzes: number;
  position: number;
};

export function pointsForPosition(position: number, table: number[]): number {
  if (position < 1 || table.length === 0) return 0;
  return table[position - 1] ?? 0;
}

export function computeOverall(
  participants: { id: string; name: string }[],
  modalities: OverallModalityInput[],
  competitionTable: number[],
  adjustments: OverallAdjustment[],
): OverallRow[] {
  const rows = new Map<string, OverallRow>(
    participants.map((participant) => [
      participant.id,
      { participantId: participant.id, name: participant.name, total: 0, byModality: {}, adjustments: 0, golds: 0, silvers: 0, bronzes: 0, position: 0 },
    ]),
  );

  for (const modality of modalities) {
    const table = modality.pointsTable && modality.pointsTable.length > 0 ? modality.pointsTable : competitionTable;
    for (const placement of modality.placements) {
      const row = rows.get(placement.participantId);
      if (!row) continue;
      const points = round2(pointsForPosition(placement.position, table) * modality.weight);
      row.byModality[modality.modalityId] = (row.byModality[modality.modalityId] ?? 0) + points;
      row.total += points;
      if (placement.position === 1) row.golds += 1;
      if (placement.position === 2) row.silvers += 1;
      if (placement.position === 3) row.bronzes += 1;
    }
  }

  for (const adjustment of adjustments) {
    const row = rows.get(adjustment.participantId);
    if (!row) continue;
    row.adjustments += adjustment.points;
    row.total += adjustment.points;
  }

  // Desempate do quadro geral: mais ouros, depois pratas, depois bronzes (quadro de medalhas).
  const ordered = [...rows.values()]
    .map((row) => ({ ...row, total: round2(row.total) }))
    .sort((a, b) => b.total - a.total || b.golds - a.golds || b.silvers - a.silvers || b.bronzes - a.bronzes || a.name.localeCompare(b.name, "pt-BR"));
  const positions = sharedPositions(
    ordered,
    (a, b) => a.total === b.total && a.golds === b.golds && a.silvers === b.silvers && a.bronzes === b.bronzes,
  );
  return ordered.map((row, index) => ({ ...row, position: positions[index] }));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function parsePointsTable(raw: string): number[] {
  return raw
    .split(/[\s,;]+/)
    .map((part) => Number(part.replace(",", ".")))
    .filter((value) => Number.isFinite(value) && value >= 0);
}
