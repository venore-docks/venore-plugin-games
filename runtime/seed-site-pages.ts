import { randomUUID } from "node:crypto";
import type { OperationResult } from "@venore/plugin-sdk";
import { createEntry, createMenu, createMenuItem, getOrCreateReservedContentType, getPublishedEntryBySlug, listMenus, publishEntry } from "@venore/plugin-sdk/cms";
import type { BlockDefinition } from "@venore/plugin-sdk/cms";
import { blockDefinitions } from "../blocks/definitions";
import { getActiveSnapshot } from "./snapshot";
import { PATHS } from "../shared/paths";

// Seed "Páginas do site" (manifest.seeds): cria, se ainda não existirem, as páginas do CMS
// montadas com os blocos do plugin — editáveis no page-builder como qualquer página — e os itens
// do menu principal. Roda com a sessão do admin (/admin/plugins → "Popular dados de exemplo" ou
// a caixa no install). Idempotente: página com o slug já existente é pulada (nunca sobrescreve o
// que o admin editou).

type BlockSpec = { key: string; data?: Record<string, unknown> };
type PageSpec = { slug: string; title: string; menuLabel: string | null; blocks: BlockSpec[] };

const definitionByKey = new Map(blockDefinitions.map((definition) => [definition.key, definition]));
const resolveDefinition = (key: string): BlockDefinition | null => definitionByKey.get(key) ?? null;

function block(spec: BlockSpec) {
  const definition = definitionByKey.get(spec.key);
  if (!definition) return null;
  return {
    id: randomUUID(),
    key: spec.key,
    slot: "",
    htmlId: null,
    data: { ...definition.defaultData, ...(spec.data ?? {}) },
    areas: [],
  };
}

async function buildPages(): Promise<PageSpec[]> {
  const snapshot = await getActiveSnapshot();
  const modalities = snapshot?.modalities ?? [];
  const multi = snapshot?.competition.overallEnabled || modalities.length > 1;
  const competitionName = snapshot?.competition.name ?? "Competição";

  const standingsBlocks: BlockSpec[] = modalities
    .filter((modality) => modality.stages.length > 0)
    .flatMap((modality) => [
      { key: "games.standings", data: { title: `${modality.emoji ? `${modality.emoji} ` : ""}${modality.name}`, modality: modality.slug } },
      ...(modality.stages.some((stage) => stage.type === "knockout") ? [{ key: "games.bracket", data: { title: "Mata-mata", modality: modality.slug } }] : []),
    ]);

  return [
    {
      slug: "home",
      title: competitionName,
      menuLabel: null,
      blocks: [
        { key: "games.hero", data: { title: competitionName } },
        { key: "games.live-now" },
        { key: "games.upcoming", data: { limit: 6, scheduleHref: "/agenda" } },
        ...(multi ? [{ key: "games.overall" }] : standingsBlocks.slice(0, 1)),
        { key: "games.vote-cta" },
        { key: "games.results", data: { limit: 4 } },
        { key: "games.athletes-ranking", data: { kind: "scorers", limit: 5 } },
        { key: "games.participants" },
      ],
    },
    { slug: "agenda", title: "Agenda", menuLabel: "Agenda", blocks: [{ key: "games.schedule" }] },
    {
      slug: "classificacao",
      title: multi ? "Quadro geral e classificação" : "Classificação",
      menuLabel: "Classificação",
      blocks: [...(multi ? [{ key: "games.overall" }] : []), ...standingsBlocks],
    },
    ...(modalities.length > 1 ? [{ slug: "modalidades", title: "Modalidades", menuLabel: "Modalidades", blocks: [{ key: "games.modalities" }] }] : []),
    { slug: "equipes", title: "Equipes", menuLabel: "Equipes", blocks: [{ key: "games.participants" }] },
    {
      slug: "jogos",
      title: "Jogos e transmissões",
      menuLabel: "Jogos",
      blocks: [{ key: "games.live-now" }, { key: "games.matches-gallery" }],
    },
    {
      slug: "destaques",
      title: "Destaques",
      menuLabel: "Destaques",
      blocks: [
        { key: "games.athletes-ranking", data: { kind: "scorers", limit: 20 } },
        { key: "games.athletes-ranking", data: { kind: "mvps", limit: 20 } },
        { key: "games.athletes-ranking", data: { kind: "fan", limit: 20 } },
      ],
    },
  ];
}

export async function seedSitePages(): Promise<OperationResult<void>> {
  const pages = await buildPages();
  const contentType = await getOrCreateReservedContentType("games-pagina", "Página da competição");
  const menuTargets: { label: string; contentId: string }[] = [];

  for (const page of pages) {
    const existing = await getPublishedEntryBySlug({ categoryId: null, slug: page.slug });
    if (existing.success && existing.data) continue;

    const blocks = page.blocks.map(block).filter((item): item is NonNullable<ReturnType<typeof block>> => item !== null);
    const created = await createEntry({ contentTypeIds: [contentType.id], title: page.title, slug: page.slug, visibility: "public", data: { blocks } });
    if (!created.success) {
      // Slug já usado por um rascunho/outra entrada: respeita o que existe.
      if (created.error.code === "cms.entries.slug_taken") continue;
      return { success: false, error: created.error };
    }
    const published = await publishEntry({ id: created.data.id, resolveDefinition });
    if (!published.success) return { success: false, error: published.error };
    if (page.menuLabel) menuTargets.push({ label: page.menuLabel, contentId: created.data.id });
  }

  // Menu principal: cria se não houver; acrescenta os itens das páginas novas + "Votar".
  const menus = await listMenus();
  if (!menus.success) return { success: false, error: menus.error };
  let mainMenuId = menus.data.find((menu) => menu.location === "main")?.id ?? null;
  if (!mainMenuId) {
    const createdMenu = await createMenu({ key: "principal", name: "Principal", location: "main" });
    if (!createdMenu.success) return { success: false, error: createdMenu.error };
    mainMenuId = createdMenu.data.id;
  }
  for (const target of menuTargets) {
    await createMenuItem({ menuId: mainMenuId, label: target.label, target: { targetType: "content", contentId: target.contentId, anchor: null } });
  }
  if (menuTargets.length > 0) {
    await createMenuItem({ menuId: mainMenuId, label: "Votar", target: { targetType: "route", routePath: PATHS.vote(), requiredPermissionKey: null } });
  }
  return { success: true, data: undefined };
}
