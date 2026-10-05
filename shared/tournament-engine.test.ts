import { describe, expect, it } from "vitest";
import { generateRoundRobin, distributeIntoGroups, groupNameForIndex } from "./round-robin";
import { planKnockout, standardSeedOrder } from "./bracket";
import { computeStandings, rankAcrossGroups, DEFAULT_TIEBREAKERS } from "./standings";
import { resolveSlot, matchWinner } from "./slot-resolution";
import { computeOverall, placementsFromEventResults, placementsFromKnockout } from "./placement";
import { buildTemplateStages } from "./templates";
import { reserveVoteSlot, DEFAULT_VOTE_COST_POLICY } from "./vote-cost";
import type { SlotSource } from "./tournament";

const rules = { pointsWin: 3, pointsDraw: 1, pointsLoss: 0, tiebreakers: DEFAULT_TIEBREAKERS };

describe("round robin", () => {
  it("everyone plays everyone exactly once, one game per round", () => {
    const ids = ["a", "b", "c", "d", "e"];
    const pairings = generateRoundRobin(ids);
    expect(pairings).toHaveLength(10);
    const keys = new Set(pairings.map((p) => [p.home, p.away].sort().join("-")));
    expect(keys.size).toBe(10);
    for (const round of new Set(pairings.map((p) => p.round))) {
      const inRound = pairings.filter((p) => p.round === round).flatMap((p) => [p.home, p.away]);
      expect(new Set(inRound).size).toBe(inRound.length);
    }
  });

  it("double round mirrors home/away", () => {
    const pairings = generateRoundRobin(["a", "b"], true);
    expect(pairings).toEqual([
      { round: 1, home: "a", away: "b" },
      { round: 2, home: "b", away: "a" },
    ]);
  });

  it("snake distribution balances seeds", () => {
    expect(distributeIntoGroups([1, 2, 3, 4, 5, 6], 3)).toEqual([
      [1, 6],
      [2, 5],
      [3, 4],
    ]);
    expect(groupNameForIndex(0)).toBe("A");
    expect(groupNameForIndex(26)).toBe("AA");
  });
});

describe("knockout", () => {
  it("standard seed order keeps 1 and 2 apart", () => {
    expect(standardSeedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it("6 teams: top 2 get byes, quarters 3×6 and 4×5", () => {
    const seeds: SlotSource[] = ["s1", "s2", "s3", "s4", "s5", "s6"].map((id) => ({ type: "participant", participantId: id }));
    const plan = planKnockout(seeds, { thirdPlace: true });
    const first = plan.filter((m) => m.round === 1);
    expect(first.map((m) => m.roundLabel)).toEqual(["Quartas de final", "Quartas de final"]);
    const pairs = first.map((m) => [m.home, m.away].map((s) => (s.type === "participant" ? s.participantId : "?")).sort().join("×"));
    expect(pairs.sort()).toEqual(["s3×s6", "s4×s5"]);
    const semis = plan.filter((m) => m.roundLabel === "Semifinal");
    expect(semis).toHaveLength(2);
    expect(semis.some((m) => m.home.type === "participant" && m.home.participantId === "s1")).toBe(true);
    expect(plan.filter((m) => m.roundLabel === "Final")).toHaveLength(1);
    expect(plan.filter((m) => m.isThirdPlace)).toHaveLength(1);
  });
});

describe("standings", () => {
  const teams = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
    { id: "c", name: "C" },
  ];

  it("points then head-to-head", () => {
    const rows = computeStandings(teams, [
      { homeId: "a", awayId: "b", homeScore: 1, awayScore: 0 },
      { homeId: "b", awayId: "c", homeScore: 1, awayScore: 0 },
      { homeId: "c", awayId: "a", homeScore: 1, awayScore: 0 },
    ], { ...rules, tiebreakers: ["head_to_head", "name"] });
    expect(rows.map((r) => r.points)).toEqual([3, 3, 3]);
    expect(rows.map((r) => r.participantId)).toEqual(["a", "b", "c"]);
  });

  it("goal difference breaks ties", () => {
    const rows = computeStandings(teams, [
      { homeId: "a", awayId: "c", homeScore: 5, awayScore: 0 },
      { homeId: "b", awayId: "c", homeScore: 1, awayScore: 0 },
    ], rules);
    expect(rows[0].participantId).toBe("a");
    expect(rows[1].participantId).toBe("b");
  });

  it("ranks across groups by group position first", () => {
    const groupA = computeStandings([{ id: "a1", name: "a1" }, { id: "a2", name: "a2" }], [{ homeId: "a1", awayId: "a2", homeScore: 2, awayScore: 0 }], rules);
    const groupB = computeStandings([{ id: "b1", name: "b1" }, { id: "b2", name: "b2" }], [{ homeId: "b1", awayId: "b2", homeScore: 1, awayScore: 0 }], rules);
    expect(rankAcrossGroups([groupA, groupB], 2).map((r) => r.participantId)).toEqual(["a1", "b1", "b2", "a2"]);
    expect(rankAcrossGroups([groupA, groupB], 1)).toHaveLength(2);
  });
});

describe("slot resolution", () => {
  it("resolves winner and group rank", () => {
    const groupRows = computeStandings([{ id: "x", name: "x" }, { id: "y", name: "y" }], [{ homeId: "y", awayId: "x", homeScore: 2, awayScore: 1 }], rules);
    const context = {
      finishedStageGroups: new Map([[0, new Map([["A", groupRows]])]]),
      matchOutcomes: new Map([["M1", matchWinner({ homeId: "p", awayId: "q", homeScore: 1, awayScore: 1, decidedWinnerId: "q" })]]),
    };
    expect(resolveSlot({ type: "group_rank", stageIndex: 0, groupName: "A", rank: 1 }, context)).toBe("y");
    expect(resolveSlot({ type: "winner", matchKey: "M1" }, context)).toBe("q");
    expect(resolveSlot({ type: "loser", matchKey: "M1" }, context)).toBe("p");
    expect(resolveSlot({ type: "group_rank", stageIndex: 1, groupName: "A", rank: 1 }, context)).toBeNull();
  });
});

describe("placements and overall", () => {
  it("event results share ties", () => {
    expect(placementsFromEventResults([
      { participantId: "a", value: 9 },
      { participantId: "b", value: 9.5 },
      { participantId: "c", value: 9 },
    ], false)).toEqual([
      { participantId: "b", position: 1 },
      { participantId: "a", position: 2 },
      { participantId: "c", position: 2 },
    ]);
  });

  it("knockout placements", () => {
    const placements = placementsFromKnockout([
      { key: "M1", round: 1, isThirdPlace: false, homeId: "a", awayId: "d", winnerId: "a" },
      { key: "M2", round: 1, isThirdPlace: false, homeId: "b", awayId: "c", winnerId: "c" },
      { key: "M3", round: 2, isThirdPlace: false, homeId: "a", awayId: "c", winnerId: "c" },
    ]);
    expect(placements).toEqual([
      { participantId: "c", position: 1 },
      { participantId: "a", position: 2 },
      { participantId: "d", position: 3 },
      { participantId: "b", position: 3 },
    ]);
  });

  it("overall sums weighted placements plus adjustments", () => {
    const rows = computeOverall(
      [{ id: "a", name: "A" }, { id: "b", name: "B" }],
      [
        { modalityId: "futsal", weight: 1, pointsTable: null, placements: [{ participantId: "a", position: 1 }, { participantId: "b", position: 2 }] },
        { modalityId: "danca", weight: 2, pointsTable: [50, 40], placements: [{ participantId: "b", position: 1 }, { participantId: "a", position: 2 }] },
      ],
      [100, 80],
      [{ participantId: "a", points: -10, modalityId: null }],
    );
    expect(rows.map((r) => [r.participantId, r.total])).toEqual([
      ["b", 180],
      ["a", 170],
    ]);
  });
});

describe("templates", () => {
  it("groups + knockout with 6 qualifiers seeds from stage ranking", () => {
    const stages = buildTemplateStages("groups_knockout", { participantCount: 12, groupCount: 3, advancePerGroup: 2, knockoutSize: 6, doubleRound: false, thirdPlace: false });
    expect(stages[1]).toMatchObject({ type: "knockout", size: 6 });
    if (stages[1].type === "knockout") expect(stages[1].seeds[0]).toEqual({ type: "stage_rank", stageIndex: 0, rank: 1, maxGroupRank: 2 });
  });
});

describe("vote cost", () => {
  it("accumulates waits for tickets issued at the same instant", () => {
    let state = { issued: 0, nextSlotAtMs: null as number | null };
    const validAfter: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      const reservation = reserveVoteSlot(state, DEFAULT_VOTE_COST_POLICY, 0);
      if (!reservation.ok) throw new Error("cap");
      validAfter.push(reservation.validAfterMs);
      state = { issued: reservation.issued, nextSlotAtMs: reservation.nextSlotAtMs };
    }
    expect(validAfter).toEqual([5000, 15000, 30000, 50000]);
  });

  it("caps per network", () => {
    expect(reserveVoteSlot({ issued: 30, nextSlotAtMs: null }, DEFAULT_VOTE_COST_POLICY, 0)).toEqual({ ok: false, reason: "cap" });
  });
});
