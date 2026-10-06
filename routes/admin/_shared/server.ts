import { getMediaAsset } from "@venore/plugin-sdk/media";
import type { PickableMedia } from "@venore/plugin-sdk/ui";
import type { CompetitionSnapshot } from "../../../contracts/types";
import { checkGamesAccess, DENIED_MESSAGE, requireGames, type GameActor } from "../../../runtime/gate";
import { getSnapshotById } from "../../../runtime/snapshot";
import type { OperationResult } from "../../../runtime/result";
import type { ActionResult } from "./action-result";

// Peças de servidor compartilhadas pelas páginas e Server Actions do admin.

export type AdminPageAccess =
  | { ok: true; actor: GameActor; competitionId: string | null; snapshot: CompetitionSnapshot | null }
  | { ok: false; message: string };

export async function loadAdminPage(level: "manage" | "operate" = "manage"): Promise<AdminPageAccess> {
  const gate = await checkGamesAccess(level);
  if (!gate.ok) {
    const message =
      gate.reason === "unauthenticated"
        ? "Entre na sua conta para continuar."
        : gate.reason === "inactive"
          ? "O plugin Games está desativado. Ative-o em Admin → Plugins."
          : DENIED_MESSAGE;
    return { ok: false, message };
  }
  const snapshot = gate.competitionId ? await getSnapshotById(gate.competitionId) : null;
  return { ok: true, actor: gate.actor, competitionId: gate.competitionId, snapshot };
}

// Gate de Server Action: devolve a competição em edição ou a mensagem de recusa já no formato
// de ActionResult (o chamador só faz `if (!guard.ok) return guard`).
export async function guard(level: "manage" | "operate" = "manage"): Promise<{ ok: true; competitionId: string; actor: GameActor } | { ok: false; message: string }> {
  const gate = await requireGames(level);
  if (!gate.ok) return { ok: false, message: gate.message };
  return { ok: true, competitionId: gate.competitionId, actor: gate.actor };
}

export function fromOperation(result: OperationResult<unknown>, extra: { id?: string; message?: string } = {}): ActionResult {
  if (!result.success) return { ok: false, message: result.error.message };
  return { ok: true, ...extra };
}

// Valor inicial do MediaPickerField (precisa de nome/url/tipo, não só do id).
export async function pickableMedia(id: string | null | undefined): Promise<PickableMedia | null> {
  if (!id) return null;
  const result = await getMediaAsset({ id });
  if (!result.success || !result.data) return null;
  const { filename, url, contentType } = result.data;
  return { id: result.data.id, filename, url, contentType };
}

// Relógio do request (fora do corpo do componente: a regra de pureza do React proíbe Date.now()
// direto no render).
export function requestTime(): number {
  return Date.now();
}
