"use server";

import { isPluginActive } from "@venore/plugin-sdk";
import { readCompetitionVersion, resolveActiveCompetitionId } from "../../../runtime/snapshot";

// Pergunta leve da TV a cada 30s: "a versão dos dados mudou?" (1 consulta minúscula). Pública e só
// leitura — a TV é uma tela sem login, como o overlay. Só quando muda a TV pede a página de novo
// (router.refresh), que remonta tudo do snapshot.
export async function getTvVersionAction(): Promise<string | null> {
  if (!(await isPluginActive("games"))) return null;
  const competitionId = await resolveActiveCompetitionId();
  if (!competitionId) return null;
  const version = await readCompetitionVersion(competitionId);
  // Competição ativa trocada também conta como mudança.
  return version === null ? null : `${competitionId}:${version}`;
}
