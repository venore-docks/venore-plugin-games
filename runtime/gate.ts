import { isPluginActive } from "@venore/plugin-sdk";
import { getPluginAdminPageData } from "@venore/plugin-sdk/admin";
import { resolveActiveCompetitionId } from "./snapshot";

// Gate de TODA Server Action/página do plugin que escreve ou mostra dado administrativo.
//  - "manage": cadastro, súmula, votação, configurações (permissão games.manage);
//  - "operate": controle ao vivo (games.operate OU games.manage).
// Devolve também a competição em edição (a ativa do site) — toda escrita é escopada nela.

export type GameActor = { id: string; name: string | null; isSuperadmin: boolean; canManage: boolean; canOperate: boolean };

export type GateResult =
  | { ok: true; actor: GameActor; competitionId: string | null }
  | { ok: false; reason: "unauthenticated" | "forbidden" | "inactive" };

export async function checkGamesAccess(level: "manage" | "operate"): Promise<GateResult> {
  if (!(await isPluginActive("games"))) return { ok: false, reason: "inactive" };
  const gate = await getPluginAdminPageData("games");
  if (!gate.granted) return { ok: false, reason: gate.reason };
  const { actor } = gate;
  const canManage = actor.isSuperadmin || actor.permissions.includes("games.manage");
  const canOperate = canManage || actor.permissions.includes("games.operate");
  if (level === "manage" ? !canManage : !canOperate) return { ok: false, reason: "forbidden" };
  return {
    ok: true,
    actor: { id: actor.id, name: actor.name, isSuperadmin: actor.isSuperadmin, canManage, canOperate },
    competitionId: await resolveActiveCompetitionId(),
  };
}

// Para Server Actions: competição obrigatória.
export async function requireGames(level: "manage" | "operate"): Promise<{ ok: true; actor: GameActor; competitionId: string } | { ok: false; message: string }> {
  const gate = await checkGamesAccess(level);
  if (!gate.ok) {
    return { ok: false, message: gate.reason === "unauthenticated" ? "Entre na sua conta para continuar." : "Você não tem permissão para esta ação." };
  }
  if (!gate.competitionId) return { ok: false, message: "Crie uma competição antes (Admin → Competições)." };
  return { ok: true, actor: gate.actor, competitionId: gate.competitionId };
}

export const DENIED_MESSAGE = "Você não tem permissão para ver esta área.";
