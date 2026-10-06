"use server";

import { loadVoteBoard } from "../vote-loader";
import type { VoteBoard } from "../vote-board";

// Parcial pra TV a cada 10s. Pública e só leitura; as contagens vêm agregadas (vote_tallies) com
// cache curto no runtime, então várias TVs não multiplicam consulta.
export async function getVoteBoardAction(): Promise<VoteBoard | null> {
  try {
    return await loadVoteBoard();
  } catch {
    return null;
  }
}
