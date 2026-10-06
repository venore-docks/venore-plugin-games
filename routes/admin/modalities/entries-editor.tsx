"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { Button } from "@venore/plugin-sdk/ui";
import { checkboxClass, Crest, Notice } from "../_shared/ui";
import { useAction } from "../_shared/use-action";
import { setEntriesAction } from "./actions";

export type EntryParticipant = { id: string; name: string; crestUrl: string | null; primaryColor: string | null };

// Inscrições + ordem de cabeça de chave (índice = seed). A ordem decide os grupos (serpentina) e
// o chaveamento do mata-mata quando o formato é aplicado.
export function EntriesEditor({ modalityId, participants, initial, structureApplied }: { modalityId: string; participants: EntryParticipant[]; initial: string[]; structureApplied: boolean }) {
  const [selected, setSelected] = useState<string[]>(initial);
  const { pending, run } = useAction();
  const byId = new Map(participants.map((participant) => [participant.id, participant]));
  const dirty = selected.join(",") !== initial.join(",");

  function toggle(id: string, on: boolean) {
    setSelected((current) => (on ? [...current, id] : current.filter((candidate) => candidate !== id)));
  }

  function move(index: number, delta: number) {
    setSelected((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  if (participants.length === 0) return <Notice>Cadastre as equipes antes (menu Equipes).</Notice>;

  return (
    <div className="grid *:min-w-0 gap-5 lg:grid-cols-2">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground">Equipes da competição</p>
          <div className="flex gap-1">
            <Button type="button" variant="ghost" size="xs" onClick={() => setSelected((current) => [...current, ...participants.map((p) => p.id).filter((id) => !current.includes(id))])}>
              Todas
            </Button>
            <Button type="button" variant="ghost" size="xs" onClick={() => setSelected([])}>
              Nenhuma
            </Button>
          </div>
        </div>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {participants.map((participant) => (
            <li key={participant.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted">
                <input type="checkbox" className={checkboxClass} checked={selected.includes(participant.id)} onChange={(event) => toggle(participant.id, event.target.checked)} />
                <Crest name={participant.name} url={participant.crestUrl} color={participant.primaryColor} size="sm" />
                <span className="truncate text-sm text-foreground">{participant.name}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Ordem de cabeça de chave ({selected.length})</p>
        {selected.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Marque as equipes que disputam esta modalidade.</p>
        ) : (
          <ol className="space-y-1.5">
            {selected.map((id, index) => {
              const participant = byId.get(id);
              if (!participant) return null;
              return (
                <li key={id} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5">
                  <span className="w-6 text-xs font-semibold tabular-nums text-muted-foreground">{index + 1}</span>
                  <Crest name={participant.name} url={participant.crestUrl} color={participant.primaryColor} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{participant.name}</span>
                  <Button type="button" variant="ghost" size="icon-xs" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Subir">
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-xs" onClick={() => move(index, 1)} disabled={index === selected.length - 1} aria-label="Descer">
                    <ArrowDown aria-hidden />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-xs" onClick={() => toggle(id, false)} aria-label={`Remover ${participant.name}`}>
                    <X aria-hidden />
                  </Button>
                </li>
              );
            })}
          </ol>
        )}
        {structureApplied && dirty && (
          <Notice tone="warning">O formato já foi aplicado: mudar as inscrições não mexe nos grupos/jogos existentes. Reaplique o formato (aba Formato) ou edite os grupos na aba Fases.</Notice>
        )}
        <Button type="button" disabled={pending || !dirty} onClick={() => run(() => setEntriesAction(modalityId, selected), "Inscrições salvas.")}>
          {pending ? "Salvando…" : "Salvar inscrições"}
        </Button>
      </div>
    </div>
  );
}
