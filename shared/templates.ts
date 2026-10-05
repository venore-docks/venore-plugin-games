import { isSlotSource, seedsFromGroups, type StageDefinition } from "./tournament";

// Formatos prontos. O admin escolhe um, ajusta (grupos, quantos passam, tamanho do mata-mata) e
// pode salvar o resultado como template próprio (tabela tournament_templates).

export type TemplateParams = {
  participantCount: number;
  groupCount: number;
  // Quantos passam de cada grupo pro mata-mata.
  advancePerGroup: number;
  // Quantos entram no mata-mata (não precisa ser potência de 2: melhores ganham bye).
  knockoutSize: number;
  doubleRound: boolean;
  thirdPlace: boolean;
};

export const DEFAULT_TEMPLATE_PARAMS: TemplateParams = {
  participantCount: 8,
  groupCount: 2,
  advancePerGroup: 2,
  knockoutSize: 4,
  doubleRound: false,
  thirdPlace: false,
};

export type BuiltinTemplateKey = "league" | "groups_knockout" | "knockout" | "single_event";

export const BUILTIN_TEMPLATES: { key: BuiltinTemplateKey; name: string; description: string; shape: "match" | "event" }[] = [
  { key: "league", name: "Pontos corridos", description: "Todos contra todos; campeão é o primeiro da tabela.", shape: "match" },
  {
    key: "groups_knockout",
    name: "Grupos + mata-mata",
    description: "Fase de grupos com pontos; os melhores de cada grupo vão pro mata-mata (aceita número ímpar, ex.: 6 na quartas — os 2 melhores folgam).",
    shape: "match",
  },
  { key: "knockout", name: "Mata-mata", description: "Eliminação direta desde o início, com byes quando o número não fecha.", shape: "match" },
  { key: "single_event", name: "Prova única", description: "Todas as equipes de uma vez (dança, arrecadação); vale nota, medida ou colocação.", shape: "event" },
];

export function buildTemplateStages(key: BuiltinTemplateKey, params: TemplateParams): StageDefinition[] {
  switch (key) {
    case "league":
      return [{ type: "round_robin", name: "Pontos corridos", groupCount: 1, doubleRound: params.doubleRound }];
    case "groups_knockout": {
      const groupCount = Math.max(1, params.groupCount);
      const qualifiers = groupCount * Math.max(1, params.advancePerGroup);
      const size = Math.min(Math.max(2, params.knockoutSize), qualifiers);
      return [
        { type: "round_robin", name: "Fase de grupos", groupCount, doubleRound: params.doubleRound },
        { type: "knockout", name: "Mata-mata", size, thirdPlace: params.thirdPlace, seeds: seedsFromGroups(0, size, params.advancePerGroup) },
      ];
    }
    case "knockout":
      return [{ type: "knockout", name: "Mata-mata", size: Math.max(2, params.participantCount), thirdPlace: params.thirdPlace, seeds: [] }];
    case "single_event":
      return [{ type: "single_event", name: "Prova" }];
  }
}

export function isBuiltinTemplateKey(value: unknown): value is BuiltinTemplateKey {
  return typeof value === "string" && BUILTIN_TEMPLATES.some((template) => template.key === value);
}

// Validação leve de um template salvo (jsonb vindo do banco/form).
export function sanitizeStages(raw: unknown): StageDefinition[] {
  if (!Array.isArray(raw)) return [];
  const stages: StageDefinition[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const stage = item as Record<string, unknown>;
    const name = typeof stage.name === "string" && stage.name.trim() ? stage.name.trim().slice(0, 60) : "Fase";
    if (stage.type === "round_robin") {
      stages.push({ type: "round_robin", name, groupCount: clampInt(stage.groupCount, 1, 26, 1), doubleRound: stage.doubleRound === true });
    } else if (stage.type === "knockout") {
      stages.push({
        type: "knockout",
        name,
        size: clampInt(stage.size, 2, 64, 4),
        thirdPlace: stage.thirdPlace === true,
        seeds: Array.isArray(stage.seeds) ? stage.seeds.filter(isSlotSource) : [],
      });
    } else if (stage.type === "single_event") {
      stages.push({ type: "single_event", name });
    }
  }
  return stages;
}

function clampInt(raw: unknown, min: number, max: number, fallback: number): number {
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}
