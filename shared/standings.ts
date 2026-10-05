// Classificação de pontos corridos — pura. Entrada: jogos ENCERRADOS de um grupo (ou da fase
// inteira, numa liga de grupo único) + participantes do grupo + regras. A tabela de um grupo usa
// só os jogos daquele grupo (o plugin antigo filtrava a classificação geral pelos times do grupo e
// contava jogo de mata-mata/outro grupo).

export type TiebreakerKey = "wins" | "goal_diff" | "goals_for" | "head_to_head" | "fewer_red" | "fewer_yellow" | "name";

export const TIEBREAKER_LABELS: Record<TiebreakerKey, string> = {
  wins: "Vitórias",
  goal_diff: "Saldo",
  goals_for: "Pró",
  head_to_head: "Confronto direto",
  fewer_red: "Menos vermelhos",
  fewer_yellow: "Menos amarelos",
  name: "Nome (ordem alfabética)",
};

export const TIEBREAKER_KEYS = Object.keys(TIEBREAKER_LABELS) as TiebreakerKey[];

export const DEFAULT_TIEBREAKERS: TiebreakerKey[] = ["wins", "goal_diff", "goals_for", "head_to_head", "fewer_red", "fewer_yellow", "name"];

export type StandingsRules = {
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  tiebreakers: TiebreakerKey[];
};

export type StandingsMatch = {
  homeId: string;
  awayId: string;
  homeScore: number;
  awayScore: number;
  // Desempate por pênaltis/sorteio num jogo que precisa de vencedor — não muda pontos de liga.
  winnerId?: string | null;
};

export type StandingsCards = { participantId: string; yellow: number; red: number };

export type StandingRow = {
  participantId: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  yellow: number;
  red: number;
  rank: number;
};

type Participant = { id: string; name: string };

function emptyRow(participant: Participant): StandingRow {
  return {
    participantId: participant.id,
    name: participant.name,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
    points: 0,
    yellow: 0,
    red: 0,
    rank: 0,
  };
}

function accumulate(rows: Map<string, StandingRow>, matches: StandingsMatch[], rules: StandingsRules): void {
  for (const match of matches) {
    const home = rows.get(match.homeId);
    const away = rows.get(match.awayId);
    if (!home || !away) continue;
    home.played += 1;
    away.played += 1;
    home.goalsFor += match.homeScore;
    home.goalsAgainst += match.awayScore;
    away.goalsFor += match.awayScore;
    away.goalsAgainst += match.homeScore;
    if (match.homeScore > match.awayScore) {
      home.won += 1;
      away.lost += 1;
      home.points += rules.pointsWin;
      away.points += rules.pointsLoss;
    } else if (match.homeScore < match.awayScore) {
      away.won += 1;
      home.lost += 1;
      away.points += rules.pointsWin;
      home.points += rules.pointsLoss;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += rules.pointsDraw;
      away.points += rules.pointsDraw;
    }
  }
  for (const row of rows.values()) row.goalDiff = row.goalsFor - row.goalsAgainst;
}

function compareBy(key: TiebreakerKey, a: StandingRow, b: StandingRow): number {
  switch (key) {
    case "wins":
      return b.won - a.won;
    case "goal_diff":
      return b.goalDiff - a.goalDiff;
    case "goals_for":
      return b.goalsFor - a.goalsFor;
    case "fewer_red":
      return a.red - b.red;
    case "fewer_yellow":
      return a.yellow - b.yellow;
    case "name":
      return a.name.localeCompare(b.name, "pt-BR");
    case "head_to_head":
      return 0; // tratado em blocos (precisa do grupo de empatados inteiro)
  }
}

// Ordena um bloco de empatados em pontos aplicando os critérios em sequência. Confronto direto
// recalcula uma mini-tabela só com os jogos entre os empatados (pontos → saldo → pró).
function sortTied(block: StandingRow[], matches: StandingsMatch[], rules: StandingsRules, criteria: TiebreakerKey[]): StandingRow[] {
  if (block.length <= 1 || criteria.length === 0) return block;
  const [criterion, ...rest] = criteria;

  let keyOf: (row: StandingRow) => number[];
  if (criterion === "head_to_head") {
    const ids = new Set(block.map((row) => row.participantId));
    const mini = new Map(block.map((row) => [row.participantId, emptyRow({ id: row.participantId, name: row.name })]));
    accumulate(
      mini,
      matches.filter((match) => ids.has(match.homeId) && ids.has(match.awayId)),
      rules,
    );
    keyOf = (row) => {
      const m = mini.get(row.participantId)!;
      return [-m.points, -m.goalDiff, -m.goalsFor];
    };
  } else {
    keyOf = () => [0];
  }

  const sorted = [...block].sort((a, b) => {
    if (criterion === "head_to_head") {
      const ka = keyOf(a);
      const kb = keyOf(b);
      for (let i = 0; i < ka.length; i += 1) if (ka[i] !== kb[i]) return ka[i] - kb[i];
      return 0;
    }
    return compareBy(criterion, a, b);
  });

  // Reparte em sub-blocos ainda empatados por este critério e aplica o próximo.
  const result: StandingRow[] = [];
  let start = 0;
  for (let i = 1; i <= sorted.length; i += 1) {
    const sameAsPrevious =
      i < sorted.length &&
      (criterion === "head_to_head"
        ? keyOf(sorted[i]).every((value, index) => value === keyOf(sorted[start])[index])
        : compareBy(criterion, sorted[start], sorted[i]) === 0);
    if (!sameAsPrevious) {
      result.push(...sortTied(sorted.slice(start, i), matches, rules, rest));
      start = i;
    }
  }
  return result;
}

export function computeStandings(
  participants: Participant[],
  matches: StandingsMatch[],
  rules: StandingsRules,
  cards: StandingsCards[] = [],
): StandingRow[] {
  const rows = new Map(participants.map((participant) => [participant.id, emptyRow(participant)]));
  accumulate(rows, matches, rules);
  for (const card of cards) {
    const row = rows.get(card.participantId);
    if (row) {
      row.yellow += card.yellow;
      row.red += card.red;
    }
  }

  const criteria = rules.tiebreakers.length > 0 ? rules.tiebreakers : DEFAULT_TIEBREAKERS;
  const byPoints = [...rows.values()].sort((a, b) => b.points - a.points);
  const ordered: StandingRow[] = [];
  let start = 0;
  for (let i = 1; i <= byPoints.length; i += 1) {
    if (i === byPoints.length || byPoints[i].points !== byPoints[start].points) {
      ordered.push(...sortTied(byPoints.slice(start, i), matches, rules, criteria));
      start = i;
    }
  }
  ordered.forEach((row, index) => {
    row.rank = index + 1;
  });
  return ordered;
}

// Ranking de uma fase inteira (todas as chaves): primeiro pela posição no próprio grupo, depois
// pelos critérios gerais (pontos, vitórias, saldo, pró). `maxGroupRank` corta quem não passou.
export function rankAcrossGroups(groups: StandingRow[][], maxGroupRank?: number): StandingRow[] {
  const all = groups.flatMap((rows) => rows.filter((row) => (maxGroupRank ? row.rank <= maxGroupRank : true)));
  return all.sort(
    (a, b) =>
      a.rank - b.rank ||
      b.points - a.points ||
      b.won - a.won ||
      b.goalDiff - a.goalDiff ||
      b.goalsFor - a.goalsFor ||
      a.name.localeCompare(b.name, "pt-BR"),
  );
}
