"use client";

import { useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button, Input } from "@venore/plugin-sdk/ui";
import type { LiveChannelView, ParticipantView, PowerBoostView, ScoreAdjustmentView } from "../../../contracts/types";
import { ConfirmAction } from "../_shared/confirm-action";
import { Field, nativeSelectClass } from "../_shared/ui";
import { useAction } from "../_shared/use-action";
import {
  addScoreAdjustmentAction,
  deletePowerBoostAction,
  deleteScoreAdjustmentAction,
  saveLiveChannelAction,
  savePowerBoostAction,
} from "./actions";

// ---- Canais ao vivo ----

export function ChannelsEditor({ channels }: { channels: LiveChannelView[] }) {
  const [newName, setNewName] = useState("");
  const { pending, run } = useAction();

  function add(event: FormEvent) {
    event.preventDefault();
    run(() => saveLiveChannelAction(null, newName), "Canal criado.", () => setNewName(""));
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-border rounded-lg border border-border">
        {channels.map((channel) => (
          <ChannelRow key={channel.id} channel={channel} />
        ))}
      </ul>
      <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row">
        <Input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Novo canal (ex.: Quadra 2, Palco)" maxLength={40} aria-label="Nome do novo canal" />
        <Button type="submit" variant="outline" disabled={pending || !newName.trim()}>
          <Plus aria-hidden /> Adicionar canal
        </Button>
      </form>
    </div>
  );
}

function ChannelRow({ channel }: { channel: LiveChannelView }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(channel.name);
  const { pending, run } = useAction();

  if (!editing) {
    return (
      <li className="flex items-center gap-3 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{channel.name}</p>
          <p className="font-mono text-xs text-muted-foreground">?canal={channel.key}</p>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setEditing(true)} aria-label={`Renomear ${channel.name}`}>
          <Pencil aria-hidden />
        </Button>
      </li>
    );
  }
  return (
    <li className="px-3 py-2">
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          run(() => saveLiveChannelAction(channel.id, name), "Canal renomeado.", () => setEditing(false));
        }}
      >
        <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} aria-label="Nome do canal" autoFocus />
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={pending || !name.trim()}>
            Salvar
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
        </div>
      </form>
    </li>
  );
}

// ---- Power plays ----

type BoostDraft = { label: string; emoji: string; description: string; sortOrder: string };

const EMPTY_BOOST: BoostDraft = { label: "", emoji: "⚡", description: "", sortOrder: "0" };

export function BoostsEditor({ boosts }: { boosts: PowerBoostView[] }) {
  const [draft, setDraft] = useState<BoostDraft>(EMPTY_BOOST);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { pending, run } = useAction();

  function submit(event: FormEvent) {
    event.preventDefault();
    run(() => savePowerBoostAction(editingId, draft), editingId ? "Power play atualizado." : "Power play criado.", () => {
      setDraft(EMPTY_BOOST);
      setEditingId(null);
    });
  }

  return (
    <div className="space-y-4">
      {boosts.length > 0 ? (
        <ul className="grid *:min-w-0 gap-2 sm:grid-cols-2">
          {boosts.map((boost) => (
            <li key={boost.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
              <span className="text-2xl leading-none" aria-hidden>
                {boost.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{boost.label}</p>
                {boost.description && <p className="text-xs text-muted-foreground">{boost.description}</p>}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Editar ${boost.label}`}
                onClick={() => {
                  setEditingId(boost.id);
                  setDraft({ label: boost.label, emoji: boost.emoji, description: boost.description ?? "", sortOrder: String(boost.sortOrder) });
                }}
              >
                <Pencil aria-hidden />
              </Button>
              <ConfirmAction
                trigger={
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Excluir ${boost.label}`}>
                    <Trash2 aria-hidden />
                  </Button>
                }
                title={`Excluir “${boost.label}”?`}
                description="Some do catálogo do controle. Os jogos que já usaram mantêm o registro."
                confirmLabel="Excluir"
                successMessage="Power play excluído."
                onConfirm={() => deletePowerBoostAction(boost.id)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum power play cadastrado. São os poderes especiais que a equipe ativa durante o jogo (aparecem no overlay).</p>
      )}

      <form onSubmit={submit} className="space-y-3 rounded-lg border border-dashed border-border p-3">
        <p className="text-xs font-medium uppercase tracking-caps text-muted-foreground">{editingId ? "Editar power play" : "Novo power play"}</p>
        <div className="grid *:min-w-0 grid-cols-[4.5rem_1fr] gap-2 sm:grid-cols-[4.5rem_1fr_6rem]">
          <Field label="Emoji" htmlFor="boost-emoji">
            <Input id="boost-emoji" value={draft.emoji} onChange={(event) => setDraft({ ...draft, emoji: event.target.value })} maxLength={8} className="text-center text-lg" />
          </Field>
          <Field label="Nome" htmlFor="boost-label">
            <Input id="boost-label" value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} maxLength={40} required />
          </Field>
          <Field label="Ordem" htmlFor="boost-order" className="col-span-2 sm:col-span-1">
            <Input id="boost-order" type="number" min={0} max={999} value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: event.target.value })} />
          </Field>
        </div>
        <Field label="Descrição (opcional)" htmlFor="boost-description">
          <Input id="boost-description" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} maxLength={200} />
        </Field>
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={pending || !draft.label.trim()}>
            {editingId ? "Salvar" : "Adicionar"}
          </Button>
          {editingId && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditingId(null);
                setDraft(EMPTY_BOOST);
              }}
            >
              Cancelar
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

// ---- Ajustes do quadro geral ----

export function AdjustmentsEditor({
  adjustments,
  participants,
  modalities,
}: {
  adjustments: ScoreAdjustmentView[];
  participants: Pick<ParticipantView, "id" | "name">[];
  modalities: { id: string; name: string }[];
}) {
  const [participantId, setParticipantId] = useState("");
  const [modalityId, setModalityId] = useState("");
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const { pending, run } = useAction();
  const participantName = new Map(participants.map((p) => [p.id, p.name]));
  const modalityName = new Map(modalities.map((m) => [m.id, m.name]));

  function submit(event: FormEvent) {
    event.preventDefault();
    run(() => addScoreAdjustmentAction({ participantId, modalityId: modalityId || null, points, reason }), "Ajuste lançado.", () => {
      setPoints("");
      setReason("");
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="grid *:min-w-0 gap-3 rounded-lg border border-dashed border-border p-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_7rem_2fr_auto] lg:items-end">
        <Field label="Equipe" htmlFor="adj-participant">
          <select id="adj-participant" className={nativeSelectClass} value={participantId} onChange={(event) => setParticipantId(event.target.value)} required>
            <option value="">Escolha…</option>
            {participants.map((participant) => (
              <option key={participant.id} value={participant.id}>
                {participant.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Modalidade (opcional)" htmlFor="adj-modality">
          <select id="adj-modality" className={nativeSelectClass} value={modalityId} onChange={(event) => setModalityId(event.target.value)}>
            <option value="">Geral</option>
            {modalities.map((modality) => (
              <option key={modality.id} value={modality.id}>
                {modality.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Pontos (±)" htmlFor="adj-points">
          <Input id="adj-points" type="number" step="any" inputMode="decimal" value={points} onChange={(event) => setPoints(event.target.value)} placeholder="-10" required />
        </Field>
        <Field label="Motivo" htmlFor="adj-reason">
          <Input id="adj-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={200} placeholder="Ex.: atraso na apresentação" required />
        </Field>
        <Button type="submit" disabled={pending || !participantId || !points || !reason.trim()}>
          Lançar
        </Button>
      </form>

      {adjustments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum ajuste lançado.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {adjustments.map((adjustment) => (
            <li key={adjustment.id} className="flex items-center gap-3 px-3 py-2">
              <span className={adjustment.points >= 0 ? "w-16 shrink-0 text-sm font-semibold tabular-nums text-foreground" : "w-16 shrink-0 text-sm font-semibold tabular-nums text-destructive"}>
                {adjustment.points > 0 ? "+" : ""}
                {adjustment.points.toLocaleString("pt-BR")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">
                  {participantName.get(adjustment.participantId) ?? "Equipe removida"}
                  {adjustment.modalityId && <span className="text-muted-foreground"> · {modalityName.get(adjustment.modalityId) ?? "modalidade"}</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">{adjustment.reason}</p>
              </div>
              <ConfirmAction
                trigger={
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Excluir ajuste">
                    <Trash2 aria-hidden />
                  </Button>
                }
                title="Excluir ajuste?"
                description={`${adjustment.points > 0 ? "+" : ""}${adjustment.points} — ${adjustment.reason}`}
                confirmLabel="Excluir"
                successMessage="Ajuste excluído."
                onConfirm={() => deleteScoreAdjustmentAction(adjustment.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
