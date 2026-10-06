"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, MediaPickerField, Textarea, type PickableMedia } from "@venore/plugin-sdk/ui";
import type { ParticipantView } from "../../../contracts/types";
import { PATHS } from "../../../shared/paths";
import { Field } from "../_shared/ui";
import { useAction } from "../_shared/use-action";
import { saveParticipantAction } from "./actions";

export function ParticipantForm({ participant, crestMedia }: { participant: ParticipantView | null; crestMedia: PickableMedia | null }) {
  const router = useRouter();
  const [draft, setDraft] = useState({
    name: participant?.name ?? "",
    shortName: participant?.shortName ?? "",
    crestMediaId: participant?.crestMediaId ?? null,
    primaryColor: participant?.primaryColor ?? "#16a34a",
    secondaryColor: participant?.secondaryColor ?? "#0f172a",
    description: participant?.description ?? "",
    foundedDate: participant?.foundedDate ?? "",
    sortOrder: String(participant?.sortOrder ?? 0),
  });
  const { pending, run } = useAction();
  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) => setDraft((current) => ({ ...current, [key]: value }));

  function submit(event: FormEvent) {
    event.preventDefault();
    run(() => saveParticipantAction(participant?.id ?? null, draft), participant ? "Equipe atualizada." : "Equipe cadastrada.", (result) => {
      if (!participant && result.id) router.replace(PATHS.admin.participant(result.id));
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid *:min-w-0 gap-4 sm:grid-cols-[1fr_8rem]">
        <Field label="Nome da equipe" htmlFor="participant-name">
          <Input id="participant-name" value={draft.name} onChange={(event) => set("name", event.target.value)} maxLength={60} required placeholder="Ex.: 3º ano A" />
        </Field>
        <Field label="Sigla" hint="Placar e tabelas." htmlFor="participant-short">
          <Input id="participant-short" value={draft.shortName} onChange={(event) => set("shortName", event.target.value.toUpperCase())} maxLength={8} placeholder="3A" className="uppercase" />
        </Field>
      </div>

      <MediaPickerField name="crestMediaId" label="Brasão (opcional)" initialMedia={crestMedia} onSelect={(media) => set("crestMediaId", media?.id ?? null)} />

      <div className="grid *:min-w-0 gap-4 sm:grid-cols-3">
        <Field label="Cor primária" htmlFor="participant-primary">
          <input
            id="participant-primary"
            type="color"
            value={draft.primaryColor}
            onChange={(event) => set("primaryColor", event.target.value)}
            className="h-9 w-full cursor-pointer rounded-lg border border-border bg-card"
          />
        </Field>
        <Field label="Cor secundária" htmlFor="participant-secondary">
          <input
            id="participant-secondary"
            type="color"
            value={draft.secondaryColor}
            onChange={(event) => set("secondaryColor", event.target.value)}
            className="h-9 w-full cursor-pointer rounded-lg border border-border bg-card"
          />
        </Field>
        <Field label="Ordem" hint="Menor aparece primeiro." htmlFor="participant-order">
          <Input id="participant-order" type="number" min={0} max={9999} value={draft.sortOrder} onChange={(event) => set("sortOrder", event.target.value)} />
        </Field>
      </div>

      <Field label="Data de fundação (opcional)" htmlFor="participant-founded">
        <Input id="participant-founded" type="date" value={draft.foundedDate} onChange={(event) => set("foundedDate", event.target.value)} className="sm:max-w-xs" />
      </Field>

      <Field label="Descrição / história" htmlFor="participant-description">
        <Textarea id="participant-description" value={draft.description} onChange={(event) => set("description", event.target.value)} rows={4} maxLength={2000} />
      </Field>

      <Button type="submit" disabled={pending || !draft.name.trim()}>
        {pending ? "Salvando…" : participant ? "Salvar alterações" : "Cadastrar equipe"}
      </Button>
    </form>
  );
}
