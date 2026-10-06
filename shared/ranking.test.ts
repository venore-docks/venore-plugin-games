import { describe, expect, it } from "vitest";
import { rankPositions } from "./ranking";

describe("rankPositions", () => {
  it("empate divide a posição e pula a seguinte", () => {
    expect(rankPositions([7, 5, 5, 2, 2, 2, 1])).toEqual([1, 2, 2, 4, 4, 4, 7]);
    expect(rankPositions([3, 3])).toEqual([1, 1]);
    expect(rankPositions([])).toEqual([]);
  });
});
