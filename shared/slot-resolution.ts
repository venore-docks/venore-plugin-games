import type { SlotSource } from "./tournament";
import { rankAcrossGroups, type StandingRow } from "./standings";

// Resolve a origem de um lado de jogo do mata-mata para um participante, quando já dá. Puro: o
// runtime monta o contexto (classificações das fases anteriores + vencedores) e persiste o
// resultado. `null` = ainda não resolvível (grupo não terminou, jogo de origem não acabou).

export type SlotResolutionContext = {
  // Por índice de fase: grupos encerrados com sua classificação. Só entra fase cujos jogos todos
  // terminaram (ou que o admin fechou) — posição de grupo parcial nunca vira slot.
  finishedStageGroups: Map<number, Map<string, StandingRow[]>>;
  // Por matchKey (código do jogo dentro da modalidade).
  matchOutcomes: Map<string, { winnerId: string | null; loserId: string | null }>;
};

export function resolveSlot(source: SlotSource | null, context: SlotResolutionContext): string | null {
  if (!source) return null;
  switch (source.type) {
    case "participant":
      return source.participantId;
    case "group_rank": {
      const groups = context.finishedStageGroups.get(source.stageIndex);
      const rows = groups?.get(source.groupName);
      return rows?.find((row) => row.rank === source.rank)?.participantId ?? null;
    }
    case "stage_rank": {
      const groups = context.finishedStageGroups.get(source.stageIndex);
      if (!groups) return null;
      const ranked = rankAcrossGroups([...groups.values()], source.maxGroupRank);
      return ranked[source.rank - 1]?.participantId ?? null;
    }
    case "winner":
      return context.matchOutcomes.get(source.matchKey)?.winnerId ?? null;
    case "loser":
      return context.matchOutcomes.get(source.matchKey)?.loserId ?? null;
  }
}

// Vencedor de um jogo encerrado: placar; empate só tem vencedor se o admin marcou (pênaltis).
export function matchWinner(match: { homeId: string | null; awayId: string | null; homeScore: number; awayScore: number; decidedWinnerId: string | null }): {
  winnerId: string | null;
  loserId: string | null;
} {
  if (!match.homeId || !match.awayId) return { winnerId: null, loserId: null };
  let winnerId: string | null = null;
  if (match.homeScore > match.awayScore) winnerId = match.homeId;
  else if (match.awayScore > match.homeScore) winnerId = match.awayId;
  else if (match.decidedWinnerId === match.homeId || match.decidedWinnerId === match.awayId) winnerId = match.decidedWinnerId;
  if (!winnerId) return { winnerId: null, loserId: null };
  return { winnerId, loserId: winnerId === match.homeId ? match.awayId : match.homeId };
}
