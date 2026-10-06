import { describe, expect, it } from "vitest";
import { SPORT_PROFILES } from "../../../shared/sport-profiles";
import { buildLabelChips, clockMinute, isChannelKey, periodEndShortcuts } from "./control-model";

describe("buildLabelChips", () => {
  it("futsal: dois tempos com intervalo no meio e fim de jogo", () => {
    expect(buildLabelChips(SPORT_PROFILES.futsal, 2)).toEqual([
      { label: "1º TEMPO", period: 1 },
      { label: "INTERVALO", period: null },
      { label: "2º TEMPO", period: 2 },
      { label: "FIM DE JOGO", period: null },
    ]);
  });

  it("basquete: quatro quartos, intervalo depois do 2º", () => {
    expect(buildLabelChips(SPORT_PROFILES.basquete, 4).map((chip) => chip.label)).toEqual([
      "1º QUARTO",
      "2º QUARTO",
      "INTERVALO",
      "3º QUARTO",
      "4º QUARTO",
      "FIM DE JOGO",
    ]);
  });

  it("número ímpar de períodos: intervalo uma vez só, sem período fantasma", () => {
    const labels = buildLabelChips(SPORT_PROFILES.futsal, 3).map((chip) => chip.label);
    expect(labels.filter((label) => label === "INTERVALO")).toHaveLength(1);
    expect(labels).toContain("3º TEMPO");
  });

  it("perfil sem relógio (vôlei): só intervalo e fim", () => {
    expect(buildLabelChips(SPORT_PROFILES.volei, 0).map((chip) => chip.label)).toEqual(["INTERVALO", "FIM DE JOGO"]);
  });
});

describe("periodEndShortcuts", () => {
  it("acumula a duração dos tempos", () => {
    expect(periodEndShortcuts(SPORT_PROFILES.futsal, 10, 2)).toEqual([
      { label: "Fim do 1º tempo", elapsedMs: 600_000 },
      { label: "Fim do 2º tempo", elapsedMs: 1_200_000 },
    ]);
  });

  it("sem relógio ou sem duração: nenhum atalho", () => {
    expect(periodEndShortcuts(SPORT_PROFILES.volei, 10, 2)).toEqual([]);
    expect(periodEndShortcuts(SPORT_PROFILES.futsal, 0, 2)).toEqual([]);
  });
});

describe("isChannelKey", () => {
  it("aceita slugs e recusa o resto", () => {
    expect(isChannelKey("principal")).toBe(true);
    expect(isChannelKey("quadra-2")).toBe(true);
    expect(isChannelKey("")).toBe(false);
    expect(isChannelKey("Quadra 1")).toBe(false);
    expect(isChannelKey("a".repeat(65))).toBe(false);
    expect(isChannelKey(42)).toBe(false);
  });
});

describe("clockMinute", () => {
  it("minuto corrente do lance", () => {
    expect(clockMinute(0)).toBe("1'");
    expect(clockMinute(61_000)).toBe("2'");
    expect(clockMinute(null)).toBeNull();
  });
});
