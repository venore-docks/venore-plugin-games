"use server";

import { loadVoteCallout } from "../vote-loader";
import type { VoteCallout } from "../vote-board";

// Overlay do QR (OBS) pergunta a cada 30s o que chamar agora — a votação abre e fecha sozinha
// (apito inicial até N horas depois do fim). Pública e só leitura, como o overlay do placar.
export async function getVoteCalloutAction(): Promise<VoteCallout> {
  try {
    return await loadVoteCallout();
  } catch {
    return null;
  }
}
