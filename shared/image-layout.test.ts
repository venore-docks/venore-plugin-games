import { describe, expect, it } from "vitest";
import { fitFontSize, readableTextOn, withAlpha } from "./image-layout";

describe("image layout", () => {
  it("shrinks long names down to the floor", () => {
    expect(fitFontSize("ABC", 460, 84, 36)).toBe(84);
    expect(fitFontSize("Um nome de equipe muito comprido mesmo", 460, 84, 36)).toBe(36);
  });

  it("picks readable text on accent colors", () => {
    expect(readableTextOn("#22c55e")).toBe("#0b0f14");
    expect(readableTextOn("#123a5c")).toBe("#ffffff");
    expect(readableTextOn("#fff")).toBe("#0b0f14");
    expect(withAlpha("#000000", 0.5)).toBe("rgba(0,0,0,0.5)");
  });
});
