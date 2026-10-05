// Estrutura de torneio — tipos puros (sem banco) usados pelo gerador de fases, pelos templates e
// pela resolução de slots do mata-mata. Ver docs/arquitetura.md §2.

export type StageType = "round_robin" | "knockout" | "single_event";

export const STAGE_TYPES: StageType[] = ["round_robin", "knockout", "single_event"];

export function isStageType(value: unknown): value is StageType {
  return typeof value === "string" && (STAGE_TYPES as string[]).includes(value);
}

// De onde vem o participante de um lado de um jogo.
export type SlotSource =
  | { type: "participant"; participantId: string }
  // n-ésimo colocado de um grupo de uma fase anterior.
  | { type: "group_rank"; stageIndex: number; groupName: string; rank: number }
  // n-ésimo colocado de uma fase inteira (todas as chaves juntas): primeiro por posição no grupo,
  // depois pelos critérios de desempate. `maxGroupRank` limita quem entra (ex.: só 1º e 2º de cada
  // grupo).
  | { type: "stage_rank"; stageIndex: number; rank: number; maxGroupRank?: number }
  | { type: "winner"; matchKey: string }
  | { type: "loser"; matchKey: string };

// Definição de fase como template (sem ids de banco). stageIndex nas origens é a posição da fase
// na lista do template/modalidade.
export type StageDefinition =
  | {
      type: "round_robin";
      name: string;
      groupCount: number;
      doubleRound: boolean;
    }
  | {
      type: "knockout";
      name: string;
      // Quantos participantes entram no mata-mata. Não precisa ser potência de 2: os melhores
      // cabeças de chave ganham bye.
      size: number;
      thirdPlace: boolean;
      // Origem de cada cabeça de chave (índice 0 = cabeça 1). Vazio = os inscritos na ordem de
      // seed manual da modalidade.
      seeds: SlotSource[];
    }
  | { type: "single_event"; name: string };

export type TournamentTemplate = {
  key: string;
  name: string;
  description: string;
  // Só faz sentido pra esse formato de modalidade.
  shape: "match" | "event";
  stages: StageDefinition[];
};

// Cabeças de chave vindas de uma fase de grupos: os `perGroup` primeiros de cada grupo, na ordem
// geral da fase (todos os 1º antes dos 2º; entre si, pelos critérios de desempate).
export function seedsFromGroups(stageIndex: number, size: number, perGroup: number): SlotSource[] {
  return Array.from({ length: size }, (_, index) => ({ type: "stage_rank" as const, stageIndex, rank: index + 1, maxGroupRank: perGroup }));
}

export function describeSlotSource(source: SlotSource | null, matchLabels: Record<string, string> = {}): string {
  if (!source) return "A definir";
  switch (source.type) {
    case "participant":
      return "Equipe definida";
    case "group_rank":
      return `${source.rank}º do Grupo ${source.groupName}`;
    case "stage_rank":
      return `${source.rank}º geral${source.maxGroupRank ? ` (até ${source.maxGroupRank}º do grupo)` : ""}`;
    case "winner":
      return `Vencedor ${matchLabels[source.matchKey] ?? source.matchKey}`;
    case "loser":
      return `Perdedor ${matchLabels[source.matchKey] ?? source.matchKey}`;
  }
}

export function isSlotSource(value: unknown): value is SlotSource {
  if (!value || typeof value !== "object") return false;
  const source = value as Record<string, unknown>;
  switch (source.type) {
    case "participant":
      return typeof source.participantId === "string";
    case "group_rank":
      return typeof source.stageIndex === "number" && typeof source.groupName === "string" && typeof source.rank === "number";
    case "stage_rank":
      return typeof source.stageIndex === "number" && typeof source.rank === "number";
    case "winner":
    case "loser":
      return typeof source.matchKey === "string";
    default:
      return false;
  }
}
