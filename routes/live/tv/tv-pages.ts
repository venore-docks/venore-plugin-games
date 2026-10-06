import type { CompetitionSnapshot, MatchSide, MatchStatus, MatchView, ModalityView, StageView } from "../../../contracts/types";
import { indexes, overallTable, stageStandings, topMvps, topScorers, upcomingMatches } from "../../../shared/derive";
import { knockoutRoundLabel } from "../../../shared/bracket";
import { placementsFromEventResults, sharedPositions } from "../../../shared/placement";
import { formatScore } from "../../../shared/score";
import { matchWinner } from "../../../shared/slot-resolution";
import { getSportProfile } from "../../../shared/sport-profiles";
import { formatMatchDate } from "../../../shared/timezone";

// Páginas da TV (/ext/games/tv), montadas no servidor a partir do snapshot — o cliente só gira e
// desenha. Tudo serializável e enxuto (a TV fica ligada o dia inteiro e recebe isto a cada
// mudança de versão). A página "ao vivo" não está aqui: vem do estado ao vivo, no cliente.

export type TvPageKind = "live" | "upcoming" | "standings" | "results" | "bracket" | "scorers" | "overall";

export type TvTeam = { name: string; shortName: string | null; crestUrl: string | null; color: string | null };

export type TvMatchCard = {
  id: string;
  modality: string;
  emoji: string | null;
  round: string | null;
  when: string;
  venue: string | null;
  home: TvTeam;
  away: TvTeam;
  status: MatchStatus;
  homeScore: string;
  awayScore: string;
  winner: MatchSide | null;
};

export type TvStandingRow = { position: number; team: TvTeam; played: number; won: number; drawn: number; lost: number; goalDiff: number; points: string };
export type TvResultRow = { position: number; team: TvTeam; value: string };
export type TvRankingRow = { position: number; name: string; photoUrl: string | null; team: TvTeam | null; value: string };
export type TvOverallRow = { position: number; team: TvTeam; total: string; golds: number; silvers: number; bronzes: number; byModality: string[] };

type PageBase = { key: string; title: string; subtitle: string | null };

export type TvPage =
  | (PageBase & { kind: "upcoming"; matches: TvMatchCard[] })
  | (PageBase & { kind: "standings"; rows: TvStandingRow[]; diffLabel: string })
  | (PageBase & { kind: "results"; rows: TvResultRow[] })
  | (PageBase & { kind: "bracket"; rounds: { label: string; matches: TvMatchCard[] }[] })
  | (PageBase & { kind: "scorers"; rows: TvRankingRow[]; valueLabel: string })
  | (PageBase & { kind: "overall"; columns: { label: string; emoji: string | null }[]; rows: TvOverallRow[] });

// ?pagina= → tipos de página (nomes em português na URL).
export const TV_PAGE_SLUGS: Record<string, TvPageKind[]> = {
  "ao-vivo": ["live"],
  proximos: ["upcoming"],
  classificacao: ["standings", "results"],
  "mata-mata": ["bracket"],
  artilharia: ["scorers"],
  "quadro-geral": ["overall"],
};

const UPCOMING_LIMIT = 6;
const TABLE_LIMIT = 12;
const RANKING_LIMIT = 8;
const OVERALL_COLUMNS_MAX = 8;

const UNKNOWN_TEAM: TvTeam = { name: "A definir", shortName: null, crestUrl: null, color: null };

function teamOf(snapshot: CompetitionSnapshot, id: string | null, fallback: string | null = null): TvTeam {
  const participant = id ? indexes(snapshot).participants.get(id) : undefined;
  if (!participant) return { ...UNKNOWN_TEAM, name: fallback || UNKNOWN_TEAM.name };
  return { name: participant.name, shortName: participant.shortName, crestUrl: participant.crestUrl, color: participant.primaryColor };
}

function matchCard(snapshot: CompetitionSnapshot, match: MatchView): TvMatchCard {
  const modality = indexes(snapshot).modalities.get(match.modalityId);
  const { winnerId } = match.status === "finished" ? matchWinner(match) : { winnerId: null };
  return {
    id: match.id,
    modality: modality?.name ?? "",
    emoji: modality?.emoji ?? null,
    round: match.roundLabel,
    when: formatMatchDate(match.scheduledDate, match.scheduledTime),
    venue: match.venue,
    home: teamOf(snapshot, match.homeId, match.homeLabel),
    away: teamOf(snapshot, match.awayId, match.awayLabel),
    status: match.status,
    homeScore: formatScore(match.homeScore),
    awayScore: formatScore(match.awayScore),
    winner: winnerId ? (winnerId === match.homeId ? "home" : "away") : null,
  };
}

// Fase "da vez" de uma modalidade: a em andamento; senão a última encerrada; senão a primeira.
export function currentStage(modality: ModalityView): StageView | null {
  const stages = [...modality.stages].sort((a, b) => a.index - b.index);
  return stages.find((stage) => stage.status === "in_progress") ?? [...stages].reverse().find((stage) => stage.status === "finished") ?? stages[0] ?? null;
}

function modalityLabel(modality: ModalityView, stage?: StageView | null): string {
  return [`${modality.emoji ? `${modality.emoji} ` : ""}${modality.name}`, stage?.name].filter(Boolean).join(" · ");
}

function stagePages(snapshot: CompetitionSnapshot, modality: ModalityView, stage: StageView): TvPage[] {
  const profile = getSportProfile(modality.sportProfile);
  const subtitle = modalityLabel(modality, stage);

  if (stage.type === "round_robin") {
    const groups = stageStandings(snapshot, modality, stage);
    return groups
      .filter((group) => group.rows.length > 0)
      .map((group) => ({
        key: `standings:${stage.id}:${group.groupId}`,
        kind: "standings" as const,
        title: groups.length > 1 ? `Classificação · ${group.groupName}` : "Classificação",
        subtitle,
        diffLabel: profile.usesSets ? "SS" : "SG",
        rows: group.rows.slice(0, TABLE_LIMIT).map((row) => ({
          position: row.rank,
          team: teamOf(snapshot, row.participantId),
          played: row.played,
          won: row.won,
          drawn: row.drawn,
          lost: row.lost,
          goalDiff: row.goalDiff,
          points: formatScore(row.points),
        })),
      }));
  }

  if (stage.type === "knockout") {
    const stageMatches = snapshot.matches.filter((match) => match.stageId === stage.id && match.status !== "cancelled");
    if (stageMatches.length === 0) return [];
    const byRound = new Map<number, MatchView[]>();
    for (const match of stageMatches.filter((item) => !item.isThirdPlace)) {
      const round = match.bracketRound ?? 1;
      byRound.set(round, [...(byRound.get(round) ?? []), match]);
    }
    const rounds = [...byRound.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, matches]) => {
        const sorted = [...matches].sort((a, b) => (a.bracketPosition ?? 0) - (b.bracketPosition ?? 0));
        return { label: sorted[0]?.roundLabel || knockoutRoundLabel(sorted.length), matches: sorted.map((match) => matchCard(snapshot, match)) };
      });
    const third = stageMatches.filter((match) => match.isThirdPlace);
    if (third.length > 0) rounds.push({ label: "3º lugar", matches: third.map((match) => matchCard(snapshot, match)) });
    return [{ key: `bracket:${stage.id}`, kind: "bracket", title: "Mata-mata", subtitle, rounds }];
  }

  // Prova única: média das notas dos jurados quando não há valor final lançado.
  const valueOf = (result: StageView["results"][number]) =>
    result.value ?? (result.judgeScores && result.judgeScores.length > 0 ? result.judgeScores.reduce((sum, value) => sum + value, 0) / result.judgeScores.length : null);
  const lowerIsBetter = modality.rules.lowerIsBetter || profile.eventResult?.kind === "placement";
  const values = new Map(stage.results.map((result) => [result.participantId, valueOf(result)]));
  const placements = placementsFromEventResults(
    stage.results.map((result) => ({ participantId: result.participantId, value: values.get(result.participantId) ?? null })),
    lowerIsBetter,
  );
  if (placements.length === 0) return [];
  const unit = profile.eventResult?.kind === "placement" ? "" : modality.rules.measureUnit || profile.eventResult?.unit || "";
  return [
    {
      key: `results:${stage.id}`,
      kind: "results",
      title: "Resultado",
      subtitle,
      rows: placements.slice(0, TABLE_LIMIT).map((placement) => {
        const value = values.get(placement.participantId) ?? 0;
        const text = profile.eventResult?.kind === "placement" ? `${placement.position}º` : `${formatScore(Math.round(value * 100) / 100)}${unit ? ` ${unit}` : ""}`;
        return { position: placement.position, team: teamOf(snapshot, placement.participantId), value: text };
      }),
    },
  ];
}

function rankingRows(snapshot: CompetitionSnapshot, rows: ReturnType<typeof topScorers>): TvRankingRow[] {
  const list = rows.slice(0, RANKING_LIMIT);
  const positions = sharedPositions(list, (a, b) => a.value === b.value);
  return list.map((row, index) => ({
    position: positions[index],
    name: row.athlete.name,
    photoUrl: row.athlete.photoUrl,
    team: row.participant ? teamOf(snapshot, row.participant.id) : null,
    value: formatScore(row.value),
  }));
}

export function buildTvPages(snapshot: CompetitionSnapshot, now: number, options: { modalityId?: string | null } = {}): TvPage[] {
  const modalityId = options.modalityId ?? undefined;
  const pages: TvPage[] = [];

  const upcoming = upcomingMatches(snapshot, now, modalityId).slice(0, UPCOMING_LIMIT);
  if (upcoming.length > 0) {
    pages.push({ key: "upcoming", kind: "upcoming", title: "Próximos jogos", subtitle: null, matches: upcoming.map((match) => matchCard(snapshot, match)) });
  }

  const ordered = [...snapshot.modalities].sort((a, b) => a.sortOrder - b.sortOrder);
  let shown = modalityId ? ordered.filter((modality) => modality.id === modalityId) : ordered.filter((modality) => modality.status === "in_progress");
  // Sem nada em andamento (antes de começar ou tudo encerrado): mostra o que já tem resultado.
  if (!modalityId && shown.length === 0) shown = ordered.filter((modality) => modality.status !== "setup");

  for (const modality of shown) {
    const stage = currentStage(modality);
    if (stage) pages.push(...stagePages(snapshot, modality, stage));
  }

  for (const modality of shown) {
    const profile = getSportProfile(modality.sportProfile);
    if (profile.shape !== "match") continue;
    const scorers = topScorers(snapshot, modality.id);
    if (scorers.length > 0) {
      pages.push({
        key: `scorers:${modality.id}`,
        kind: "scorers",
        title: profile.scoreUnit.plural === "gols" ? "Artilharia" : "Destaques",
        subtitle: modalityLabel(modality),
        valueLabel: profile.scoreUnit.plural === "sets" ? "Pontos" : profile.scoreUnit.plural.charAt(0).toUpperCase() + profile.scoreUnit.plural.slice(1),
        rows: rankingRows(snapshot, scorers),
      });
    }
  }

  const mvps = topMvps(snapshot, modalityId);
  if (mvps.length > 0) {
    const modality = modalityId ? indexes(snapshot).modalities.get(modalityId) : undefined;
    pages.push({ key: "mvps", kind: "scorers", title: "Craques dos jogos", subtitle: modality ? modalityLabel(modality) : null, valueLabel: "Vezes", rows: rankingRows(snapshot, mvps) });
  }

  if (snapshot.competition.overallEnabled && !modalityId) {
    const table = overallTable(snapshot);
    if (table.some((row) => row.total !== 0)) {
      const columns = ordered.length <= OVERALL_COLUMNS_MAX ? ordered : [];
      pages.push({
        key: "overall",
        kind: "overall",
        title: "Quadro geral",
        subtitle: snapshot.competition.overallIncludesPartial ? "Parcial — inclui modalidades em andamento" : null,
        columns: columns.map((modality) => ({ label: modality.name, emoji: modality.emoji })),
        rows: table.slice(0, TABLE_LIMIT).map((row) => ({
          position: row.position,
          team: teamOf(snapshot, row.participantId),
          total: formatScore(row.total),
          golds: row.golds,
          silvers: row.silvers,
          bronzes: row.bronzes,
          byModality: columns.map((modality) => (row.byModality[modality.id] ? formatScore(row.byModality[modality.id]) : "–")),
        })),
      });
    }
  }

  return pages;
}
