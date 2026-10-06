import { dynamicBreadcrumbSegment, staticBreadcrumbSegment, type BreadcrumbSegmentDefinition } from "@venore/plugin-sdk";
import type { CompetitionSnapshot } from "./contracts/types";
import { isUuid } from "./shared/ids";

// Trilha das páginas públicas do plugin. Os níveis de lista ("jogos", "equipes", "modalidades") são
// páginas do CMS (seed "site-pages") e o CMS resolve o próprio rótulo; aqui só os níveis do plugin.
// Nomes vêm do snapshot (o mesmo cache() da página — nenhuma consulta própria). Import dinâmico:
// este arquivo entra no contributions.ts, que só pode puxar o entry raiz do SDK no carregamento.

async function snapshot(): Promise<CompetitionSnapshot | null> {
  const { loadSiteSnapshot } = await import("./components/site-data");
  return loadSiteSnapshot();
}

async function matchLabel(id: string): Promise<string | null> {
  if (!isUuid(id)) return null;
  const data = await snapshot();
  if (!data) return null;
  const { indexes } = await import("./shared/derive");
  const match = indexes(data).matches.get(id);
  if (!match) return null;
  const { matchTitle } = await import("./components/lib/match-info");
  return matchTitle(data, match);
}

export const gamesBreadcrumbSegments: BreadcrumbSegmentDefinition[] = [
  dynamicBreadcrumbSegment({
    key: "games.public.match",
    segments: ["jogos", ":id"],
    paramName: "id",
    resolveLabel: matchLabel,
  }),
  dynamicBreadcrumbSegment({
    key: "games.public.participant",
    segments: ["equipes", ":slug"],
    paramName: "slug",
    resolveLabel: async (slug) => {
      const data = await snapshot();
      return data?.participants.find((participant) => participant.slug === slug)?.name ?? null;
    },
  }),
  dynamicBreadcrumbSegment({
    key: "games.public.athlete",
    segments: ["atletas", ":slug"],
    paramName: "slug",
    resolveLabel: async (slug) => {
      const data = await snapshot();
      return data?.athletes.find((athlete) => athlete.slug === slug)?.name ?? null;
    },
  }),
  dynamicBreadcrumbSegment({
    key: "games.public.modality",
    segments: ["modalidades", ":slug"],
    paramName: "slug",
    resolveLabel: async (slug) => {
      const data = await snapshot();
      return data?.modalities.find((modality) => modality.slug === slug)?.name ?? null;
    },
  }),
  staticBreadcrumbSegment({ key: "games.public.vote", segments: ["votar"], label: "Votação" }),
  staticBreadcrumbSegment({ key: "games.public.vote.favorite", segments: ["votar", "favorito"], label: "Equipe favorita" }),
  // "votar/jogo" não tem página própria: rótulo omitido (o nível do jogo aponta direto pra votação dele).
  dynamicBreadcrumbSegment({
    key: "games.public.vote.match",
    segments: ["votar", "jogo", ":id"],
    paramName: "id",
    resolveLabel: async (id) => {
      const label = await matchLabel(id);
      return label ? `Craque da torcida: ${label}` : null;
    },
  }),
];
