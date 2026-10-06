import type { CompetitionSnapshot, MatchView, PollTallies, PollView } from "../../contracts/types";
import { indexes } from "../../shared/derive";
import { sharedPositions } from "../../shared/placement";
import { computeVoteShares, type PollWindow } from "../../shared/votes";

// Votação da torcida nas telas de transmissão (overlay com QR e TV da parcial). Puro: recebe o
// snapshot, a janela de cada votação (runtime/votes.ts pollWindowFromSnapshot) e as parciais.

export type WindowOf = (poll: PollView) => PollWindow;

export type VoteCallout = { kind: "match"; pollId: string; title: string; subtitle: string | null } | { kind: "favorite"; pollId: string; title: string } | null;

function sideName(snapshot: CompetitionSnapshot, id: string | null, fallback: string | null): string {
  const participant = id ? indexes(snapshot).participants.get(id) : undefined;
  return participant?.shortName || participant?.name || fallback || "A definir";
}

function matchOfPoll(snapshot: CompetitionSnapshot, poll: PollView): MatchView | undefined {
  return poll.matchId ? indexes(snapshot).matches.get(poll.matchId) : undefined;
}

// Ao vivo primeiro, depois o que começou por último.
function recency(match: MatchView | undefined): number {
  if (!match) return 0;
  const started = Date.parse(match.startedAt ?? match.finishedAt ?? "") || 0;
  return (match.status === "live" ? 1e15 : 0) + started;
}

export function pickOpenMatchPoll(snapshot: CompetitionSnapshot, windowOf: WindowOf): PollView | null {
  const open = snapshot.polls.filter((poll) => poll.kind === "match_athlete" && matchOfPoll(snapshot, poll) && windowOf(poll).isOpen);
  return open.sort((a, b) => recency(matchOfPoll(snapshot, b)) - recency(matchOfPoll(snapshot, a)))[0] ?? null;
}

// TV da parcial: sem votação aberta, mostra o resultado da mais recente que já fechou.
export function pickMatchPollForBoard(snapshot: CompetitionSnapshot, windowOf: WindowOf): PollView | null {
  const open = pickOpenMatchPoll(snapshot, windowOf);
  if (open) return open;
  const finished = snapshot.polls.filter((poll) => poll.kind === "match_athlete" && matchOfPoll(snapshot, poll)?.status === "finished");
  return finished.sort((a, b) => (matchOfPoll(snapshot, b)?.finishedAt ?? "").localeCompare(matchOfPoll(snapshot, a)?.finishedAt ?? ""))[0] ?? null;
}

export function pickFavoritePoll(snapshot: CompetitionSnapshot): PollView | null {
  return snapshot.polls.find((poll) => poll.kind === "participant") ?? null;
}

export function matchPollTitle(snapshot: CompetitionSnapshot, poll: PollView): string {
  const match = matchOfPoll(snapshot, poll);
  return match ? `${sideName(snapshot, match.homeId, match.homeLabel)} × ${sideName(snapshot, match.awayId, match.awayLabel)}` : poll.title;
}

export function resolveVoteCallout(snapshot: CompetitionSnapshot, windowOf: WindowOf): VoteCallout {
  const matchPoll = pickOpenMatchPoll(snapshot, windowOf);
  if (matchPoll) {
    const match = matchOfPoll(snapshot, matchPoll);
    const modality = match ? indexes(snapshot).modalities.get(match.modalityId) : undefined;
    return { kind: "match", pollId: matchPoll.id, title: matchPollTitle(snapshot, matchPoll), subtitle: modality?.name ?? null };
  }
  const favorite = pickFavoritePoll(snapshot);
  if (favorite && windowOf(favorite).isOpen) return { kind: "favorite", pollId: favorite.id, title: favorite.title };
  return null;
}

// ---- Parcial ----

export type VoteEntry = { id: string; position: number; name: string; subtitle: string | null; imageUrl: string | null; color: string | null; votes: number; percent: number };

export type VoteBoardSide = { name: string; crestUrl: string | null; color: string | null };

export type VoteBoardMatch = {
  pollId: string;
  modality: string | null;
  home: VoteBoardSide;
  away: VoteBoardSide;
  isOpen: boolean;
  total: number;
  entries: VoteEntry[];
};

export type VoteBoardFavorite = { pollId: string; title: string; isOpen: boolean; total: number; entries: VoteEntry[] };

export type VoteBoard = { match: VoteBoardMatch | null; favorite: VoteBoardFavorite | null };

const MATCH_TOP = 5;
const FAVORITE_TOP = 8;

function entriesFrom(tallies: PollTallies | undefined, limit: number, describe: (choiceId: string) => Omit<VoteEntry, "id" | "position" | "votes" | "percent"> | null): VoteEntry[] {
  const shares = computeVoteShares(tallies?.counts ?? {})
    .map((share) => ({ share, info: describe(share.choiceId) }))
    .filter((item): item is { share: (typeof item)["share"]; info: NonNullable<(typeof item)["info"]> } => item.info !== null)
    .slice(0, limit);
  // Empate divide a posição (e a medalha).
  const positions = sharedPositions(shares, (a, b) => a.share.votes === b.share.votes);
  return shares.map(({ share, info }, index) => ({ id: share.choiceId, position: positions[index], votes: share.votes, percent: share.percent, ...info }));
}

function boardSide(snapshot: CompetitionSnapshot, id: string | null, fallback: string | null): VoteBoardSide {
  const participant = id ? indexes(snapshot).participants.get(id) : undefined;
  return { name: participant?.shortName || participant?.name || fallback || "A definir", crestUrl: participant?.crestUrl ?? null, color: participant?.primaryColor ?? null };
}

export function buildVoteBoard(
  snapshot: CompetitionSnapshot,
  polls: { match: PollView | null; favorite: PollView | null },
  windowOf: WindowOf,
  tallies: Map<string, PollTallies>,
): VoteBoard {
  const index = indexes(snapshot);
  let match: VoteBoardMatch | null = null;
  const matchRow = polls.match ? matchOfPoll(snapshot, polls.match) : undefined;
  if (polls.match && matchRow) {
    const counts = tallies.get(polls.match.id);
    match = {
      pollId: polls.match.id,
      modality: index.modalities.get(matchRow.modalityId)?.name ?? null,
      home: boardSide(snapshot, matchRow.homeId, matchRow.homeLabel),
      away: boardSide(snapshot, matchRow.awayId, matchRow.awayLabel),
      isOpen: windowOf(polls.match).isOpen,
      total: counts?.total ?? 0,
      entries: entriesFrom(counts, MATCH_TOP, (athleteId) => {
        const athlete = index.athletes.get(athleteId);
        if (!athlete) return null;
        const team = index.participants.get(athlete.participantId);
        return { name: athlete.name, subtitle: team?.name ?? null, imageUrl: athlete.photoUrl, color: team?.primaryColor ?? null };
      }),
    };
  }

  let favorite: VoteBoardFavorite | null = null;
  if (polls.favorite) {
    const counts = tallies.get(polls.favorite.id);
    favorite = {
      pollId: polls.favorite.id,
      title: polls.favorite.title,
      isOpen: windowOf(polls.favorite).isOpen,
      total: counts?.total ?? 0,
      entries: entriesFrom(counts, FAVORITE_TOP, (participantId) => {
        const team = index.participants.get(participantId);
        return team ? { name: team.name, subtitle: null, imageUrl: team.crestUrl, color: team.primaryColor } : null;
      }),
    };
  }
  return { match, favorite };
}
