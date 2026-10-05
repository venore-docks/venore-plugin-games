// Perfis esportivos — o que muda de uma modalidade pra outra sem virar coluna de banco: unidade do
// placar, botões do controle ao vivo, tipos de lance, relógio e como o resultado é decidido. A
// modalidade guarda só a chave do perfil + overrides (ModalityRules, shared/modality-rules.ts).

export type SportProfileKey =
  | "futsal"
  | "futebol"
  | "volei"
  | "basquete"
  | "handebol"
  | "pontos"
  | "esports"
  | "nota"
  | "medida"
  | "colocacao";

// "match": jogo entre dois lados com placar. "event": prova única, todas as equipes de uma vez.
export type CompetitionShape = "match" | "event";

export type EventKindDefinition = {
  key: string;
  label: string;
  emoji: string;
  // Lance que mexe no placar (gol, cesta, ponto). `amount` vem do botão, não do tipo.
  scores: boolean;
  // Aparece no overlay enquanto o lance existir (cartões).
  showOnOverlay: boolean;
};

export type ScoreButton = { amount: number; label: string; eventKind: string };

export type ClockProfile = { enabled: boolean; defaultPeriodMinutes: number; defaultPeriodCount: number; periodLabel: string };

export type SportProfile = {
  key: SportProfileKey;
  label: string;
  shape: CompetitionShape;
  scoreUnit: { singular: string; plural: string };
  scoreButtons: ScoreButton[];
  eventKinds: EventKindDefinition[];
  clock: ClockProfile;
  // Vôlei: placar do jogo é em sets; cada set tem o próprio placar de pontos.
  usesSets: boolean;
  // Prova única: o que o admin lança por equipe.
  eventResult?: { kind: "score" | "measure" | "placement"; unit: string; lowerIsBetter: boolean };
  defaultAllowsDraw: boolean;
};

const GOAL: EventKindDefinition = { key: "goal", label: "Gol", emoji: "⚽", scores: true, showOnOverlay: false };
const YELLOW: EventKindDefinition = { key: "yellow_card", label: "Amarelo", emoji: "🟨", scores: false, showOnOverlay: true };
const RED: EventKindDefinition = { key: "red_card", label: "Vermelho", emoji: "🟥", scores: false, showOnOverlay: true };
const FOUL: EventKindDefinition = { key: "foul", label: "Falta", emoji: "✋", scores: false, showOnOverlay: false };
const POINT: EventKindDefinition = { key: "point", label: "Ponto", emoji: "•", scores: true, showOnOverlay: false };

const NO_CLOCK: ClockProfile = { enabled: false, defaultPeriodMinutes: 0, defaultPeriodCount: 0, periodLabel: "" };

export const SPORT_PROFILES: Record<SportProfileKey, SportProfile> = {
  futsal: {
    key: "futsal",
    label: "Futsal",
    shape: "match",
    scoreUnit: { singular: "gol", plural: "gols" },
    scoreButtons: [{ amount: 1, label: "+1 GOL", eventKind: "goal" }],
    eventKinds: [GOAL, YELLOW, RED, FOUL],
    clock: { enabled: true, defaultPeriodMinutes: 10, defaultPeriodCount: 2, periodLabel: "tempo" },
    usesSets: false,
    defaultAllowsDraw: true,
  },
  futebol: {
    key: "futebol",
    label: "Futebol",
    shape: "match",
    scoreUnit: { singular: "gol", plural: "gols" },
    scoreButtons: [{ amount: 1, label: "+1 GOL", eventKind: "goal" }],
    eventKinds: [GOAL, YELLOW, RED, FOUL],
    clock: { enabled: true, defaultPeriodMinutes: 20, defaultPeriodCount: 2, periodLabel: "tempo" },
    usesSets: false,
    defaultAllowsDraw: true,
  },
  volei: {
    key: "volei",
    label: "Vôlei",
    shape: "match",
    scoreUnit: { singular: "set", plural: "sets" },
    scoreButtons: [{ amount: 1, label: "+1 PONTO", eventKind: "point" }],
    eventKinds: [POINT],
    clock: NO_CLOCK,
    usesSets: true,
    defaultAllowsDraw: false,
  },
  basquete: {
    key: "basquete",
    label: "Basquete",
    shape: "match",
    scoreUnit: { singular: "ponto", plural: "pontos" },
    scoreButtons: [
      { amount: 1, label: "+1", eventKind: "basket" },
      { amount: 2, label: "+2", eventKind: "basket" },
      { amount: 3, label: "+3", eventKind: "basket" },
    ],
    eventKinds: [{ key: "basket", label: "Cesta", emoji: "🏀", scores: true, showOnOverlay: false }, FOUL],
    clock: { enabled: true, defaultPeriodMinutes: 10, defaultPeriodCount: 4, periodLabel: "quarto" },
    usesSets: false,
    defaultAllowsDraw: false,
  },
  handebol: {
    key: "handebol",
    label: "Handebol",
    shape: "match",
    scoreUnit: { singular: "gol", plural: "gols" },
    scoreButtons: [{ amount: 1, label: "+1 GOL", eventKind: "goal" }],
    eventKinds: [
      { ...GOAL, emoji: "🤾" },
      YELLOW,
      { key: "suspension", label: "2 min", emoji: "⏱", scores: false, showOnOverlay: true },
      RED,
    ],
    clock: { enabled: true, defaultPeriodMinutes: 15, defaultPeriodCount: 2, periodLabel: "tempo" },
    usesSets: false,
    defaultAllowsDraw: true,
  },
  pontos: {
    key: "pontos",
    label: "Pontos (genérico)",
    shape: "match",
    scoreUnit: { singular: "ponto", plural: "pontos" },
    scoreButtons: [{ amount: 1, label: "+1", eventKind: "point" }],
    eventKinds: [POINT],
    clock: NO_CLOCK,
    usesSets: false,
    defaultAllowsDraw: true,
  },
  esports: {
    key: "esports",
    label: "E-sports",
    shape: "match",
    scoreUnit: { singular: "round", plural: "rounds" },
    scoreButtons: [{ amount: 1, label: "+1 ROUND", eventKind: "round" }],
    eventKinds: [{ key: "round", label: "Round", emoji: "🎮", scores: true, showOnOverlay: false }],
    clock: NO_CLOCK,
    usesSets: false,
    defaultAllowsDraw: false,
  },
  nota: {
    key: "nota",
    label: "Nota dos jurados (dança, apresentação)",
    shape: "event",
    scoreUnit: { singular: "ponto", plural: "pontos" },
    scoreButtons: [],
    eventKinds: [],
    clock: NO_CLOCK,
    usesSets: false,
    eventResult: { kind: "score", unit: "pts", lowerIsBetter: false },
    defaultAllowsDraw: true,
  },
  medida: {
    key: "medida",
    label: "Medida (arrecadação, tempo, distância)",
    shape: "event",
    scoreUnit: { singular: "unidade", plural: "unidades" },
    scoreButtons: [],
    eventKinds: [],
    clock: NO_CLOCK,
    usesSets: false,
    eventResult: { kind: "measure", unit: "", lowerIsBetter: false },
    defaultAllowsDraw: true,
  },
  colocacao: {
    key: "colocacao",
    label: "Colocação direta",
    shape: "event",
    scoreUnit: { singular: "posição", plural: "posições" },
    scoreButtons: [],
    eventKinds: [],
    clock: NO_CLOCK,
    usesSets: false,
    eventResult: { kind: "placement", unit: "", lowerIsBetter: true },
    defaultAllowsDraw: false,
  },
};

export const SPORT_PROFILE_KEYS = Object.keys(SPORT_PROFILES) as SportProfileKey[];

export function isSportProfileKey(value: unknown): value is SportProfileKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(SPORT_PROFILES, value);
}

export function getSportProfile(key: string): SportProfile {
  return isSportProfileKey(key) ? SPORT_PROFILES[key] : SPORT_PROFILES.pontos;
}
