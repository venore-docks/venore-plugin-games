import type { PluginContributions } from "@venore/plugin-sdk";
import { blockDefinitions } from "./blocks/definitions";
import { gamesBreadcrumbSegments } from "./breadcrumbs";

// O que o plugin contribui pro core. Só importa do entry raiz do SDK (evita ciclo de runtime com
// o registro de contribuições); renderers e seed são carregados sob demanda.
export const gamesContributions: PluginContributions = {
  blockDefinitions,
  blockRenderers: async () => (await import("./blocks/renderers")).blockRenderers,
  breadcrumbSegments: gamesBreadcrumbSegments,
  seeds: {
    "site-pages": async () => (await import("./runtime/seed-site-pages")).seedSitePages(),
  },
  mediaUsageResolver: async (mediaId) => (await import("./runtime/media-usage")).resolveGamesMediaUsage(mediaId),
};
