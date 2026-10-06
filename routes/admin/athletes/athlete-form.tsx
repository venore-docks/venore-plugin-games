"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, MediaPickerField, Switch, Textarea, type PickableMedia } from "@venore/plugin-sdk/ui";
import type { AthleteView } from "../../../contracts/types";
import { PATHS } from "../../../shared/paths";
import { Field, nativeSelectClass } from "../_shared/ui";
import { useAction } from "../_shared/use-action";
import { saveAthleteAction } from "./actions";

export function AthleteForm({
  athlete,
  photoMedia,
  participants,
  defaultParticipantId,
}: {
  athlete: AthleteView | null;
  photoMedia: PickableMedia | null;
  participants: { id: string; name: string }[];
  defaultParticipantId: string | null;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState({
    participantId: athlete?.participantId ?? defaultParticipantId ?? "",
    name: athlete?.name ?? "",
    number: athlete?.number !== null && athlete?.number !== undefined ? String(athlete.number) : "",
    gender: athlete?.gender ?? "",
    position: athlete?.position ?? "",
    isCaptain: athlete?.isCaptain ?? false,
    photoMediaId: athlete?.photoMediaId ?? null,
    bio: athlete?.bio ?? "",
  });
  const { pending, run } = useAction();
  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) => setDraft((current) => ({ ...current, [key]: value }));

  function submit(event: FormEvent) {
    event.preventDefault();
    run(() => saveAthleteAction(athlete?.id ?? null, draft), athlete ? "Atleta atualizado." : "Atleta cadastrado.", (result) => {
      if (!athlete && result.id) router.replace(PATHS.admin.athlete(result.id));
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid *:min-w-0 gap-4 sm:grid-cols-2">
        <Field label="Equipe" htmlFor="athlete-participant">
          <select id="athlete-participant" className={nativeSelectClass} value={draft.participantId} onChange={(event) => set("participantId", event.target.value)} required>
            <option value="">Escolha…</option>
            {participants.map((participant) => (
              <option key={participant.id} value={participant.id}>
                {participant.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nome" htmlFor="athlete-name">
          <Input id="athlete-name" value={draft.name} onChange={(event) => set("name", event.target.value)} maxLength={80} required />
        </Field>
      </div>

      <div className="grid *:min-w-0 grid-cols-2 gap-4 sm:grid-cols-3">
        <Field label="Número" htmlFor="athlete-number">
          <Input id="athlete-number" type="number" inputMode="numeric" min={0} max={999} value={draft.number} onChange={(event) => set("number", event.target.value)} />
        </Field>
        <Field label="Gênero (opcional)" htmlFor="athlete-gender">
          <select id="athlete-gender" className={nativeSelectClass} value={draft.gender} onChange={(event) => set("gender", event.target.value)}>
            <option value="">Não informar</option>
            <option value="male">Masculino</option>
            <option value="female">Feminino</option>
          </select>
        </Field>
        <Field label="Posição" htmlFor="athlete-position" className="col-span-2 sm:col-span-1">
          <Input id="athlete-position" value={draft.position} onChange={(event) => set("position", event.target.value)} maxLength={30} placeholder="Ex.: Goleiro, Levantadora" />
        </Field>
      </div>

      <label className="flex items-center gap-3">
        <Switch checked={draft.isCaptain} onCheckedChange={(checked) => set("isCaptain", checked)} />
        <span className="text-sm font-medium text-foreground">Capitão da equipe</span>
      </label>

      <MediaPickerField name="photoMediaId" label="Foto (opcional)" initialMedia={photoMedia} onSelect={(media) => set("photoMediaId", media?.id ?? null)} />

      <Field label="Bio (opcional)" htmlFor="athlete-bio">
        <Textarea id="athlete-bio" value={draft.bio} onChange={(event) => set("bio", event.target.value)} rows={3} maxLength={2000} />
      </Field>

      <Button type="submit" disabled={pending || !draft.name.trim() || !draft.participantId}>
        {pending ? "Salvando…" : athlete ? "Salvar alterações" : "Cadastrar atleta"}
      </Button>
    </form>
  );
}
