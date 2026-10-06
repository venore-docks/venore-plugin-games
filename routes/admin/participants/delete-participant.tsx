"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, Input } from "@venore/plugin-sdk/ui";
import type { ParticipantDeleteImpact } from "../../../runtime/competitions";
import { PATHS } from "../../../shared/paths";
import { useAction } from "../_shared/use-action";
import { deleteParticipantAction, getParticipantDeleteImpactAction } from "./actions";

// Exclusão com impacto calculado antes: equipe com jogo não sai (o histórico quebraria); sem jogo,
// sai junto com atletas, inscrições e votos — por isso pede o nome digitado.
export function DeleteParticipant({ participantId, participantName }: { participantId: string; participantName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [impact, setImpact] = useState<ParticipantDeleteImpact | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const { pending, run } = useAction();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setImpact(null);
      setLoadError(null);
      getParticipantDeleteImpactAction(participantId)
        .then((result) => (result.ok ? setImpact(result.impact) : setLoadError(result.message)))
        .catch(() => setLoadError("Não foi possível verificar o impacto."));
    } else {
      setTyped("");
    }
  }

  const blocked = Boolean(impact && impact.matches > 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="destructive" size="sm">
          <Trash2 aria-hidden /> Excluir equipe
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir {participantName}?</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              {!impact && !loadError && <p>Verificando o que será afetado…</p>}
              {loadError && <p className="text-destructive">{loadError}</p>}
              {impact && blocked && (
                <p>
                  A equipe está em {impact.matches} jogo{impact.matches === 1 ? "" : "s"} (agendado{impact.matches === 1 ? "" : "s"} ou disputado
                  {impact.matches === 1 ? "" : "s"}). Remova ou troque a equipe nesses jogos antes — excluir apagaria o histórico.
                </p>
              )}
              {impact && !blocked && (
                <>
                  <p>A equipe não tem jogos.</p>
                  <p>
                    {impact.athletes > 0 ? `Os ${impact.athletes} atleta(s) do elenco também serão excluídos, ` : "Sem atletas cadastrados; "}
                    junto com inscrições, grupos, ajustes do quadro geral e votos recebidos. Não dá pra desfazer.
                  </p>
                </>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        {impact && !blocked && (
          <div className="space-y-1.5">
            <label className="text-sm text-foreground">
              Digite <span className="font-semibold">{participantName}</span> para confirmar
            </label>
            <Input value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" />
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          {impact && !blocked && (
            <Button
              type="button"
              variant="destructive"
              disabled={pending || typed.trim() !== participantName}
              onClick={() =>
                run(() => deleteParticipantAction(participantId), "Equipe excluída.", () => {
                  setOpen(false);
                  router.push(PATHS.admin.participants());
                })
              }
            >
              {pending ? "Excluindo…" : "Excluir definitivamente"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
