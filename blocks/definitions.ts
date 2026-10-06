import type { BlockDefinition, EditorField } from "@venore/plugin-sdk/cms";

// Blocos do page-builder (category "games"). Dado puro e serializável — atravessa o boundary RSC.
// Renderers em blocks/renderers.ts (carregados sob demanda pelo contributions.ts). Todos leem o
// snapshot da competição ativa na hora de renderizar; nenhum guarda id de banco no data (modalidade e
// equipe por SLUG, que o admin enxerga na URL pública).

const MODALITY_FIELD: EditorField = { name: "modality", type: "text", label: "Modalidade (slug, vazio = todas)" };
const TITLE_FIELD: EditorField = { name: "title", type: "text", label: "Título (vazio = padrão)" };

function games(definition: Omit<BlockDefinition, "category" | "structure" | "allowedInRoot">): BlockDefinition {
  return { category: "games", structure: "leaf", allowedInRoot: true, ...definition };
}

export const blockDefinitions: BlockDefinition[] = [
  games({
    key: "games.home",
    label: "Página inicial completa",
    defaultData: { title: "", subtitle: "", ctaLabel: "Ver agenda", ctaHref: "/agenda", scheduleHref: "/agenda", showLogo: true },
    editorFields: [
      { name: "title", type: "text", label: "Título (vazio = nome da competição)" },
      { name: "subtitle", type: "textarea", label: "Subtítulo" },
      { name: "ctaLabel", type: "text", label: "Texto do botão" },
      { name: "ctaHref", type: "url", label: "Link do botão" },
      { name: "scheduleHref", type: "url", label: "Link da agenda completa" },
      { name: "showLogo", type: "boolean", label: "Mostrar logo da competição" },
    ],
  }),
  games({
    key: "games.hero",
    label: "Capa da competição",
    defaultData: { title: "", subtitle: "", ctaLabel: "", ctaHref: "", showLogo: true },
    editorFields: [
      { name: "title", type: "text", label: "Título (vazio = nome da competição)" },
      { name: "subtitle", type: "textarea", label: "Subtítulo" },
      { name: "ctaLabel", type: "text", label: "Texto do botão" },
      { name: "ctaHref", type: "url", label: "Link do botão" },
      { name: "showLogo", type: "boolean", label: "Mostrar logo da competição" },
    ],
  }),
  games({
    key: "games.live-now",
    label: "Jogos ao vivo",
    defaultData: { title: "" },
    editorFields: [TITLE_FIELD],
  }),
  games({
    key: "games.next-match-card",
    label: "Card do próximo jogo (16:9)",
    defaultData: { title: "", modality: "" },
    editorFields: [TITLE_FIELD, MODALITY_FIELD],
  }),
  games({
    key: "games.upcoming",
    label: "Próximos jogos",
    defaultData: { title: "", limit: 6, modality: "", scheduleHref: "/agenda" },
    editorFields: [
      TITLE_FIELD,
      { name: "limit", type: "number", label: "Quantos jogos" },
      MODALITY_FIELD,
      { name: "scheduleHref", type: "url", label: "Link da agenda completa" },
    ],
  }),
  games({
    key: "games.schedule",
    label: "Agenda completa",
    defaultData: { title: "", modality: "", groupBy: "day" },
    editorFields: [
      TITLE_FIELD,
      MODALITY_FIELD,
      {
        name: "groupBy",
        type: "select",
        label: "Abas por",
        options: [
          { value: "day", label: "Dia" },
          { value: "round", label: "Rodada/fase" },
        ],
      },
    ],
  }),
  games({
    key: "games.results",
    label: "Últimos resultados",
    defaultData: { title: "", limit: 6, modality: "", moreHref: "" },
    editorFields: [
      TITLE_FIELD,
      { name: "limit", type: "number", label: "Quantos jogos" },
      MODALITY_FIELD,
      { name: "moreHref", type: "url", label: "Link \"Todos os jogos\" (opcional)" },
    ],
  }),
  games({
    key: "games.matches-gallery",
    label: "Jogos e transmissões",
    defaultData: { title: "", limit: 12, modality: "", onlyWithVideo: false },
    editorFields: [
      TITLE_FIELD,
      { name: "limit", type: "number", label: "Quantos jogos" },
      MODALITY_FIELD,
      { name: "onlyWithVideo", type: "boolean", label: "Só jogos com transmissão" },
    ],
  }),
  games({
    key: "games.standings",
    label: "Classificação de uma modalidade",
    defaultData: { title: "", modality: "" },
    editorFields: [TITLE_FIELD, { name: "modality", type: "text", label: "Modalidade (slug)" }],
    requiredDataFields: ["modality"],
    missingConfigMessage: "Informe o slug da modalidade (aparece na URL /modalidades/<slug>).",
  }),
  games({
    key: "games.bracket",
    label: "Chaveamento (mata-mata)",
    defaultData: { title: "", modality: "" },
    editorFields: [TITLE_FIELD, { name: "modality", type: "text", label: "Modalidade (slug)" }],
    requiredDataFields: ["modality"],
    missingConfigMessage: "Informe o slug da modalidade (aparece na URL /modalidades/<slug>).",
  }),
  games({
    key: "games.overall",
    label: "Quadro geral",
    defaultData: { title: "", limit: 0 },
    editorFields: [TITLE_FIELD, { name: "limit", type: "number", label: "Quantas equipes (0 = todas)" }],
  }),
  games({
    key: "games.modalities",
    label: "Modalidades",
    defaultData: { title: "" },
    editorFields: [TITLE_FIELD],
  }),
  games({
    key: "games.participants",
    label: "Equipes",
    defaultData: { title: "", showRecord: true },
    editorFields: [TITLE_FIELD, { name: "showRecord", type: "boolean", label: "Mostrar campanha (V/E/D)" }],
  }),
  games({
    key: "games.team-spotlight",
    label: "Destaque de uma equipe",
    defaultData: { title: "", participant: "" },
    editorFields: [TITLE_FIELD, { name: "participant", type: "text", label: "Equipe (slug)" }],
    requiredDataFields: ["participant"],
    missingConfigMessage: "Informe o slug da equipe (aparece na URL /equipes/<slug>).",
  }),
  games({
    key: "games.athletes-ranking",
    label: "Ranking de atletas",
    defaultData: { title: "", kind: "scorers", modality: "", limit: 10 },
    editorFields: [
      TITLE_FIELD,
      {
        name: "kind",
        type: "select",
        label: "Ranking",
        options: [
          { value: "scorers", label: "Artilharia / pontuadores" },
          { value: "mvps", label: "Craque do jogo (MVP)" },
          { value: "fan", label: "Craque da torcida" },
        ],
      },
      MODALITY_FIELD,
      { name: "limit", type: "number", label: "Quantos atletas" },
    ],
  }),
  games({
    key: "games.vote-cta",
    label: "Chamada da votação",
    defaultData: { title: "", subtitle: "" },
    editorFields: [TITLE_FIELD, { name: "subtitle", type: "text", label: "Subtítulo" }],
  }),
];
