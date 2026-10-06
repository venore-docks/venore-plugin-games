import type { ReactNode } from "react";
import type { BlockRenderMode } from "@venore/plugin-sdk";
import { EditPlaceholder } from "../components/section";

// Vazio no modo publicado = some (null); no modo de edição = placeholder que explica o porquê (o
// admin precisa ver que o bloco existe e o que ele mostraria).
export function emptyState(mode: BlockRenderMode, title: string, message: string): ReactNode {
  return mode === "edit" ? <EditPlaceholder title={title} message={message} /> : null;
}

export const NO_COMPETITION = "Nenhuma competição ativa (ou o plugin está desativado). Cadastre uma em /admin/games.";

export function missingModalityNote(mode: BlockRenderMode, slug: string | null): ReactNode {
  if (!slug || mode !== "edit") return null;
  return (
    <p className="mb-2 rounded-xl border border-dashed border-warning-border bg-warning-soft px-3 py-2 text-xs text-foreground">
      Modalidade &ldquo;{slug}&rdquo; não encontrada — mostrando todas. Confira o slug em Modalidades.
    </p>
  );
}
