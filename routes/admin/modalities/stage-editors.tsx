"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, Input, Textarea } from "@venore/plugin-sdk/ui";
import type { StageResultView } from "../../../contracts/types";
import { checkboxClass, Crest, Notice } from "../_shared/ui";
import { useAction } from "../_shared/use-action";
import { finalizeModalityAction, reopenModalityAction, saveStageResultsAction, setGroupMembersAction } from "./actions";
import type { EntryParticipant } from "./entries-editor";

// ---- Grupo: membros editados à mão ----

export function GroupMembersEditor({
  groupId,
  groupName,
  members,
  candidates,
  otherGroupOf,
  locked,
}: {
  groupId: string;
  groupName: string;
  members: string[];
  candidates: EntryParticipant[];
  // Equipe → grupo onde já está (marcar aqui tira de lá).
  otherGroupOf: Record<string, string>;
  locked: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(members);
  const { pending, run } = useAction();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setSelected(members);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="xs" disabled={locked} title={locked ? "O grupo já tem jogos disputados" : undefined}>
          <Pencil aria-hidden /> Equipes
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Equipes do Grupo {groupName}</DialogTitle>
          <DialogDescription>Os jogos deste grupo ainda não disputados são gerados de novo (todos contra todos).</DialogDescription>
        </DialogHeader>
        <ul className="max-h-[50vh] divide-y divide-border overflow-y-auto rounded-lg border border-border">
          {candidates.map((participant) => (
            <li key={participant.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted">
                <input
                  type="checkbox"
                  className={checkboxClass}
                  checked={selected.includes(participant.id)}
                  onChange={(event) => setSelected((current) => (event.target.checked ? [...current, participant.id] : current.filter((id) => id !== participant.id)))}
                />
                <Crest name={participant.name} url={participant.crestUrl} color={participant.primaryColor} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{participant.name}</span>
                {otherGroupOf[participant.id] && <span className="text-xs text-muted-foreground">no Grupo {otherGroupOf[participant.id]}</span>}
              </label>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button
            type="button"
            disabled={pending}
            onClick={() => run(() => setGroupMembersAction(groupId, selected), `Grupo ${groupName} atualizado.`, () => setOpen(false))}
          >
            {pending ? "Salvando…" : "Salvar grupo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Prova única: resultado por equipe ----

type ResultDraft = { value: string; judges: string; note: string };

function parseJudges(raw: string): number[] {
  return raw
    .split(/[;\s]+/)
    .map((part) => Number(part.replace(",", ".")))
    .filter((value) => Number.isFinite(value));
}

export function StageResultsEditor({
  stageId,
  stageName,
  kind,
  unit,
  participants,
  results,
  finished,
}: {
  stageId: string;
  stageName: string;
  kind: "score" | "measure" | "placement";
  unit: string;
  participants: EntryParticipant[];
  results: StageResultView[];
  finished: boolean;
}) {
  const initial = Object.fromEntries(
    participants.map((participant) => {
      const result = results.find((row) => row.participantId === participant.id);
      const hasJudges = Boolean(result?.judgeScores && result.judgeScores.length > 0);
      return [
        participant.id,
        {
          value: result?.value !== null && result?.value !== undefined && !hasJudges ? String(result.value).replace(".", ",") : "",
          judges: hasJudges ? (result!.judgeScores ?? []).join("; ").replace(/\./g, ",") : "",
          note: result?.note ?? "",
        } satisfies ResultDraft,
      ];
    }),
  );
  const [drafts, setDrafts] = useState<Record<string, ResultDraft>>(initial);
  const { pending, run } = useAction();
  const set = (id: string, patch: Partial<ResultDraft>) => setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));

  if (participants.length === 0) return <Notice>Inscreva as equipes antes de lançar resultados.</Notice>;

  function save(close: boolean) {
    const payload = participants.map((participant) => {
      const draft = drafts[participant.id];
      const judges = kind === "score" ? parseJudges(draft.judges) : [];
      const value = draft.value.trim() ? Number(draft.value.replace(",", ".")) : null;
      return { participantId: participant.id, value: judges.length > 0 ? null : value, judgeScores: judges.length > 0 ? judges : null, note: draft.note };
    });
    run(() => saveStageResultsAction(stageId, payload, close), close ? "Prova encerrada." : "Resultados salvos.");
  }

  const valueLabel = kind === "placement" ? "Colocação" : kind === "measure" ? `Valor${unit ? ` (${unit})` : ""}` : "Nota final";

  return (
    <div className="space-y-3">
      {finished && <Notice>{stageName} está encerrada. Pode corrigir e salvar de novo.</Notice>}
      <ul className="space-y-2">
        {participants.map((participant) => {
          const draft = drafts[participant.id];
          const judges = kind === "score" ? parseJudges(draft.judges) : [];
          const average = judges.length > 0 ? judges.reduce((sum, value) => sum + value, 0) / judges.length : null;
          return (
            <li key={participant.id} className="grid *:min-w-0 gap-2 rounded-lg border border-border p-3 md:grid-cols-[minmax(0,1fr)_8rem_minmax(0,1.3fr)_minmax(0,1fr)] md:items-center">
              <span className="flex min-w-0 items-center gap-2">
                <Crest name={participant.name} url={participant.crestUrl} color={participant.primaryColor} size="sm" />
                <span className="truncate text-sm font-medium text-foreground">{participant.name}</span>
              </span>
              <Input
                inputMode="decimal"
                value={draft.value}
                onChange={(event) => set(participant.id, { value: event.target.value })}
                placeholder={valueLabel}
                aria-label={`${valueLabel} — ${participant.name}`}
                disabled={judges.length > 0}
                className="tabular-nums"
              />
              {kind === "score" ? (
                <div className="space-y-0.5">
                  <Input value={draft.judges} onChange={(event) => set(participant.id, { judges: event.target.value })} placeholder="Notas dos jurados: 9,5; 8; 9" aria-label={`Notas dos jurados — ${participant.name}`} />
                  {average !== null && <p className="text-xs text-muted-foreground">Média: {average.toFixed(2).replace(".", ",")}</p>}
                </div>
              ) : (
                <span className="hidden md:block" />
              )}
              <Textarea rows={1} value={draft.note} onChange={(event) => set(participant.id, { note: event.target.value })} placeholder="Observação" maxLength={200} aria-label={`Observação — ${participant.name}`} className="min-h-9" />
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={pending} onClick={() => save(false)}>
          Salvar parcial
        </Button>
        <Button type="button" disabled={pending} onClick={() => save(true)}>
          {pending ? "Salvando…" : "Salvar e encerrar prova"}
        </Button>
      </div>
    </div>
  );
}

// ---- Colocação final ----

export function PlacementsEditor({
  modalityId,
  participants,
  computed,
  finished,
}: {
  modalityId: string;
  participants: EntryParticipant[];
  computed: { participantId: string; position: number }[];
  finished: boolean;
}) {
  const initial = Object.fromEntries(participants.map((participant) => [participant.id, String(computed.find((row) => row.participantId === participant.id)?.position ?? "")]));
  const [positions, setPositions] = useState<Record<string, string>>(initial);
  const { pending, run } = useAction();

  const ordered = [...participants].sort((a, b) => (Number(positions[a.id]) || 999) - (Number(positions[b.id]) || 999) || a.name.localeCompare(b.name, "pt-BR"));

  if (participants.length === 0) return <Notice>Sem equipes inscritas.</Notice>;

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-border rounded-lg border border-border">
        {ordered.map((participant) => (
          <li key={participant.id} className="flex items-center gap-3 px-3 py-2">
            <Input
              type="number"
              min={1}
              max={999}
              value={positions[participant.id]}
              onChange={(event) => setPositions((current) => ({ ...current, [participant.id]: event.target.value }))}
              disabled={finished}
              aria-label={`Posição de ${participant.name}`}
              className="h-8 w-16 text-center tabular-nums"
            />
            <Crest name={participant.name} url={participant.crestUrl} color={participant.primaryColor} size="sm" />
            <span className="min-w-0 flex-1 truncate text-sm text-foreground">{participant.name}</span>
          </li>
        ))}
      </ul>
      {finished ? (
        <Button type="button" variant="outline" disabled={pending} onClick={() => run(() => reopenModalityAction(modalityId), "Modalidade reaberta.")}>
          Reabrir modalidade
        </Button>
      ) : (
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            run(
              () => finalizeModalityAction(modalityId, participants.map((participant) => ({ participantId: participant.id, position: Number(positions[participant.id]) || 0 }))),
              "Modalidade finalizada.",
            )
          }
        >
          {pending ? "Salvando…" : "Finalizar modalidade com esta colocação"}
        </Button>
      )}
    </div>
  );
}
