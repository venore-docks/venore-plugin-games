import { describe, expect, it } from "vitest";
import { normalizeLegacyGoals } from "./legacy-events";

describe("legacy goal corrections", () => {
  it("removes the latest goal of the same side", () => {
    const result = normalizeLegacyGoals([
      { id: "a", side: "home", amount: 1, createdAt: 1 },
      { id: "b", side: "away", amount: 1, createdAt: 2 },
      { id: "c", side: "home", amount: 1, createdAt: 3 },
      { id: "d", side: "home", amount: -1, createdAt: 4 },
    ]);
    expect(result.map((g) => g.id)).toEqual(["a", "b"]);
  });

  it("half corrections shrink a whole goal", () => {
    const result = normalizeLegacyGoals([
      { id: "a", side: "home", amount: 1, createdAt: 1 },
      { id: "b", side: "home", amount: -0.5, createdAt: 2 },
    ]);
    expect(result).toEqual([{ id: "a", side: "home", amount: 0.5, createdAt: 1 }]);
  });

  it("corrections below zero are ignored", () => {
    expect(normalizeLegacyGoals([{ id: "x", side: "away", amount: -1, createdAt: 1 }])).toEqual([]);
  });
});
