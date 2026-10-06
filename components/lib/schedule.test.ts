import { describe, expect, it } from "vitest";
import type { MatchView } from "../../contracts/types";
import { defaultGroupKey, groupByDay, groupByRound, relativeMatchLabel } from "./schedule";

function match(partial: Partial<MatchView>): MatchView {
  return {
    id: Math.random().toString(36).slice(2),
    modalityId: "mod",
    stageId: "s1",
    groupId: null,
    matchKey: null,
    roundNumber: null,
    roundLabel: null,
    bracketRound: null,
    bracketPosition: null,
    isThirdPlace: false,
    homeId: null,
    awayId: null,
    homeLabel: null,
    awayLabel: null,
    homeSource: null,
    awaySource: null,
    slotsLocked: false,
    scheduledDate: null,
    scheduledTime: null,
    venue: null,
    status: "scheduled",
    homeScore: 0,
    awayScore: 0,
    sets: null,
    decidedWinnerId: null,
    resultNote: null,
    mvpAthleteId: null,
    mvpNote: null,
    youtubeUrl: null,
    coverPhotoMediaId: null,
    coverImageUrl: null,
    storyImageUrl: null,
    startedAt: null,
    finishedAt: null,
    sortOrder: 0,
    ...partial,
  };
}

describe("groupByDay", () => {
  it("ordena por data e deixa 'A definir' no fim", () => {
    const groups = groupByDay([match({ scheduledDate: "2026-10-12" }), match({}), match({ scheduledDate: "2026-10-10" }), match({ scheduledDate: "2026-10-12" })]);
    expect(groups.map((group) => group.key)).toEqual(["2026-10-10", "2026-10-12", "sem-data"]);
    expect(groups[1].matches).toHaveLength(2);
    expect(groups[2].label).toBe("A definir");
  });

  it("aba padrão: hoje ou a próxima com jogo; tudo passado → última com data", () => {
    const groups = groupByDay([match({ scheduledDate: "2026-10-10" }), match({ scheduledDate: "2026-10-12" }), match({})]);
    expect(defaultGroupKey(groups, Date.UTC(2026, 9, 11, 15), "day")).toBe("2026-10-12");
    expect(defaultGroupKey(groups, Date.UTC(2026, 9, 10, 15), "day")).toBe("2026-10-10");
    expect(defaultGroupKey(groups, Date.UTC(2026, 9, 20, 15), "day")).toBe("2026-10-12");
    expect(defaultGroupKey([], 0, "day")).toBeNull();
  });
});

describe("groupByRound", () => {
  it("separa rodadas e a disputa de 3º, na ordem de chegada", () => {
    const groups = groupByRound([
      match({ roundNumber: 1, roundLabel: "1ª rodada", status: "finished" }),
      match({ roundNumber: 2, roundLabel: "2ª rodada" }),
      match({ stageId: "s2", bracketRound: 2, roundLabel: "Final" }),
      match({ stageId: "s2", bracketRound: 2, roundLabel: "Final", isThirdPlace: true }),
    ]);
    expect(groups.map((group) => group.label)).toEqual(["1ª rodada", "2ª rodada", "Final", "3º lugar"]);
    expect(defaultGroupKey(groups, 0, "round")).toBe(groups[1].key);
  });
});

describe("relativeMatchLabel", () => {
  const now = Date.UTC(2026, 9, 10, 15); // sáb 10/10 12:00 em Brasília
  it("hoje, amanhã, em N dias e data cheia", () => {
    expect(relativeMatchLabel("2026-10-10", "15:00", now)).toBe("Hoje · 15:00");
    expect(relativeMatchLabel("2026-10-11", null, now)).toBe("Amanhã");
    expect(relativeMatchLabel("2026-10-13", "09:00", now)).toBe("Em 3 dias · ter, 13/10 · 09:00");
    expect(relativeMatchLabel("2026-11-01", null, now)).toBe("dom, 01/11");
    expect(relativeMatchLabel(null, null, now)).toBe("Data a definir");
  });
});
