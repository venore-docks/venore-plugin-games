import { describe, expect, it } from "vitest";
import type { PollTallies, PollView } from "../../contracts/types";
import type { PollWindow } from "../../shared/votes";
import { buildFixtureSnapshot, IDS } from "./__fixtures__/snapshot";
import { buildVoteBoard, pickMatchPollForBoard, resolveVoteCallout, type WindowOf } from "./vote-board";

const OPEN: PollWindow = { isOpen: true, opensAt: null, closesAt: null, closedForGood: false };
const CLOSED: PollWindow = { isOpen: false, opensAt: null, closesAt: null, closedForGood: true };

const windows = (open: string[]): WindowOf => (poll: PollView) => (open.includes(poll.id) ? OPEN : CLOSED);

describe("resolveVoteCallout", () => {
  it("prefere o jogo ao vivo entre as votações abertas", () => {
    const callout = resolveVoteCallout(buildFixtureSnapshot(), windows([IDS.polls.finished, IDS.polls.live, IDS.polls.favorite]));
    expect(callout).toEqual({ kind: "match", pollId: IDS.polls.live, title: "Turma 2 × Turma 3", subtitle: "Futsal" });
  });

  it("sem jogo aberto chama a equipe favorita; sem nada, vazio", () => {
    const snapshot = buildFixtureSnapshot();
    expect(resolveVoteCallout(snapshot, windows([IDS.polls.favorite]))).toMatchObject({ kind: "favorite", pollId: IDS.polls.favorite });
    expect(resolveVoteCallout(snapshot, windows([]))).toBeNull();
  });
});

describe("buildVoteBoard", () => {
  it("sem votação aberta, a TV mostra o resultado do último jogo encerrado", () => {
    expect(pickMatchPollForBoard(buildFixtureSnapshot(), windows([]))?.id).toBe(IDS.polls.finished);
  });

  it("parcial com percentuais, posições empatadas e equipe do atleta", () => {
    const snapshot = buildFixtureSnapshot();
    const tallies = new Map<string, PollTallies>([
      [IDS.polls.finished, { pollId: IDS.polls.finished, counts: { [IDS.athletes[0]]: 3, [IDS.athletes[2]]: 3, [IDS.athletes[1]]: 2 }, total: 8 }],
    ]);
    const board = buildVoteBoard(snapshot, { match: snapshot.polls[0], favorite: snapshot.polls[2] }, windows([IDS.polls.favorite]), tallies);
    expect(board.match?.isOpen).toBe(false);
    expect(board.match?.total).toBe(8);
    expect(board.match?.entries.map((entry) => [entry.position, entry.name, entry.subtitle, entry.percent])).toEqual([
      [1, "Atleta 1", "Turma 1", 38],
      [1, "Atleta 3", "Turma 2", 37],
      [3, "Atleta 2", "Turma 1", 25],
    ]);
    expect(board.favorite).toMatchObject({ isOpen: true, total: 0, entries: [] });
  });
});
