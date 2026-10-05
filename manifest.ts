import type { PluginManifest } from "@venore/plugin-sdk";
import { GAMES_SETTINGS } from "./shared/settings";

// Faixa de core escrita à mão (não importada do CORE_VERSION) — importar tornaria a checagem
// sempre trivialmente satisfeita.
export const gamesManifest: PluginManifest = {
  manifestVersion: "1.0.0",
  key: "games",
  name: "Games",
  version: "0.1.0",
  description:
    "Competições escolares: campeonatos e olimpíadas com várias modalidades (futsal, vôlei, dança, e-sports, arrecadação…), torneios configuráveis (grupos, mata-mata com qualquer número de equipes, prova única) com templates, quadro geral por colocação, jogo ao vivo (controle pelo celular, overlay OBS, TV), votação da torcida, imagens de compartilhamento pré-geradas e blocos/páginas prontas pro page-builder.",
  compatibility: { coreVersion: ">=2.0.0 <3.0.0" },
  migrationsPath: "./migrations",

  permissions: [
    { key: "games.manage", label: "Administrar competições, modalidades, equipes, jogos e votação" },
    { key: "games.operate", label: "Operar o jogo ao vivo (controle do placar)" },
  ],

  navigation: [
    {
      key: "games.admin",
      label: "Competições",
      href: "/admin/games",
      icon: "award",
      groupKey: "plugins",
      groupLabel: "Plugins",
      groupOrder: 30,
      order: 40,
      requiredPermission: ["games.manage", "games.operate"],
    },
  ],

  // Páginas prontas do site (CMS + page-builder) — rodadas pelo admin, nunca sozinhas.
  seeds: [
    {
      key: "site-pages",
      label: "Páginas do site",
      description: "Cria (se ainda não existirem) Início, Agenda, Classificação, Equipes, Jogos e Votação com os blocos do plugin, e adiciona ao menu principal.",
    },
  ],

  settings: Object.values(GAMES_SETTINGS).map(({ key, defaultValue }) => ({ key, defaultValue })),
};
