import { describe, expect, it } from "vitest";
import { buildFixtureSnapshot, IDS } from "../__fixtures__/snapshot";
import { buildTvPages, TV_PAGE_SLUGS } from "./tv-pages";

const NOW = Date.parse("2026-10-06T12:00:00.000Z");

describe("buildTvPages", () => {
  it("monta próximos jogos, classificação do grupo, artilharia, craques e quadro geral", () => {
    const pages = buildTvPages(buildFixtureSnapshot(), NOW);
    expect(pages.map((page) => page.kind)).toEqual(["upcoming", "standings", "scorers", "scorers", "overall"]);

    const upcoming = pages.find((page) => page.kind === "upcoming");
    expect(upcoming?.kind === "upcoming" && upcoming.matches.map((match) => match.id)).toEqual([IDS.matches.scheduled]);

    const standings = pages.find((page) => page.kind === "standings");
    expect(standings?.kind === "standings" && standings.rows.map((row) => [row.team.name, row.points])).toEqual([
      ["Turma 1", "3"],
      ["Turma 3", "0"],
      ["Turma 2", "0"],
    ]);

    const scorers = pages.find((page) => page.key.startsWith("scorers:"));
    expect(scorers?.kind === "scorers" && scorers.title).toBe("Artilharia");
    expect(scorers?.kind === "scorers" && scorers.rows.map((row) => [row.position, row.name, row.value])).toEqual([
      [1, "Atleta 1", "2"],
      [2, "Atleta 3", "1"],
    ]);
  });

  it("?modalidade= tira o quadro geral (é da competição inteira)", () => {
    const pages = buildTvPages(buildFixtureSnapshot(), NOW, { modalityId: IDS.modality });
    expect(pages.some((page) => page.kind === "overall")).toBe(false);
    expect(pages.some((page) => page.kind === "standings")).toBe(true);
  });

  it("quadro geral desligado na competição não gera página", () => {
    const snapshot = buildFixtureSnapshot();
    snapshot.competition = { ...snapshot.competition, overallEnabled: false };
    expect(buildTvPages(snapshot, NOW).some((page) => page.kind === "overall")).toBe(false);
  });

  it("nomes de ?pagina= cobrem todos os tipos", () => {
    expect(new Set(Object.values(TV_PAGE_SLUGS).flat())).toEqual(new Set(["live", "upcoming", "standings", "results", "bracket", "scorers", "overall"]));
  });
});
