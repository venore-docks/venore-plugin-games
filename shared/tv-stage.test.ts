import { describe, expect, it } from "vitest";
import { resolveTvStageTransform, TV_STAGE_FALLBACK_HEIGHT_PX, TV_STAGE_WIDTH_PX } from "./tv-stage";

describe("resolveTvStageTransform", () => {
  it("escala o palco de 1920px pra largura do viewport", () => {
    expect(resolveTvStageTransform(1280, 720)).toEqual({ scale: 1280 / 1920, stageWidthPx: TV_STAGE_WIDTH_PX, stageHeightPx: 1080 });
    expect(resolveTvStageTransform(3840, 2160).scale).toBe(2);
  });

  it("acompanha a proporção do viewport na altura (4:3 ganha palco mais alto)", () => {
    expect(resolveTvStageTransform(1024, 768).stageHeightPx).toBeCloseTo(1440);
  });

  it("viewport não medido cai no palco 16:9 sem escala", () => {
    for (const [w, h] of [[0, 0], [-1, 500], [Number.NaN, 720]]) {
      expect(resolveTvStageTransform(w, h)).toEqual({ scale: 1, stageWidthPx: TV_STAGE_WIDTH_PX, stageHeightPx: TV_STAGE_FALLBACK_HEIGHT_PX });
    }
  });
});
