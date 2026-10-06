import { describe, expect, it } from "vitest";
import { buildTemplateStages, DEFAULT_TEMPLATE_PARAMS } from "../../../shared/templates";
import { previewStructure } from "./format-preview";

const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
const names = Object.fromEntries(ids.map((id) => [id, id.toUpperCase()]));

describe("previewStructure", () => {
  it("liga de 6 equipes: 15 jogos em 5 rodadas", () => {
    const preview = previewStructure(buildTemplateStages("league", { ...DEFAULT_TEMPLATE_PARAMS }), ids.slice(0, 6), names);
    expect(preview.totalMatches).toBe(15);
    const stage = preview.stages[0];
    expect(stage.type).toBe("round_robin");
    if (stage.type === "round_robin") expect(stage.groups[0].rounds).toBe(5);
  });

  it("grupos + mata-mata com 6 classificados: byes pros 2 melhores e chaves contínuas", () => {
    const stages = buildTemplateStages("groups_knockout", { ...DEFAULT_TEMPLATE_PARAMS, groupCount: 2, advancePerGroup: 3, knockoutSize: 6 });
    const preview = previewStructure(stages, ids, names);
    const [groups, knockout] = preview.stages;
    expect(groups.type === "round_robin" && groups.groups.map((g) => g.members.length)).toEqual([4, 4]);
    expect(knockout.type).toBe("knockout");
    if (knockout.type === "knockout") {
      expect(knockout.byes).toBe(2);
      // 2 jogos de quartas + 2 semis + final.
      expect(knockout.matches).toBe(5);
      expect(knockout.rounds[0].matches[0].key).toBe("J1");
      expect(knockout.rounds.at(-1)?.label).toBe("Final");
    }
    expect(preview.totalMatches).toBe(12 + 5);
  });

  it("mata-mata com mais vagas que inscritos avisa e usa só os inscritos", () => {
    const preview = previewStructure(buildTemplateStages("knockout", { ...DEFAULT_TEMPLATE_PARAMS, participantCount: 8, thirdPlace: true }), ids.slice(0, 4), names);
    const stage = preview.stages[0];
    expect(stage.type === "knockout" && stage.size).toBe(4);
    // semis + final + 3º lugar
    expect(preview.totalMatches).toBe(4);
    expect(preview.warnings.some((warning) => warning.includes("8 vagas"))).toBe(true);
    if (stage.type === "knockout") expect(stage.rounds.flatMap((round) => round.matches).some((match) => match.isThirdPlace && match.home.startsWith("Perdedor"))).toBe(true);
  });

  it("prova única não gera jogos", () => {
    const preview = previewStructure(buildTemplateStages("single_event", DEFAULT_TEMPLATE_PARAMS), ids.slice(0, 3), names);
    expect(preview.totalMatches).toBe(0);
    expect(preview.stages[0]).toMatchObject({ type: "single_event", participants: 3 });
  });
});
