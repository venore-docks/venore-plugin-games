"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Switch } from "@venore/plugin-sdk/ui";
import type { MatchView } from "../../../contracts/types";
import { PATHS } from "../../../shared/paths";
import { Field, nativeSelectClass, Notice } from "../_shared/ui";
import { useAction } from "../_shared/use-action";
import { saveMatchScheduleAction } from "./actions";

export type ScheduleModality = {
  id: string;
  name: string;
  emoji: string | null;
  entryIds: string[];
  stages: { id: string; name: string; groups: { id: string; name: string }[] }[];
};

export function ScheduleForm({
  match,
  modalities,
  participants,
  defaultModalityId,
}: {
  match: MatchView | null;
  modalities: ScheduleModality[];
  participants: { id: string; name: string }[];
  defaultModalityId: string | null;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState({
    modalityId: match?.modalityId ?? defaultModalityId ?? modalities[0]?.id ?? "",
    stageId: match?.stageId ?? "",
    groupId: match?.groupId ?? "",
    roundLabel: match?.roundLabel ?? "",
    homeParticipantId: match?.homeId ?? "",
    awayParticipantId: match?.awayId ?? "",
    homeLabel: match?.homeLabel ?? "",
    awayLabel: match?.awayLabel ?? "",
    scheduledDate: match?.scheduledDate ?? "",
    scheduledTime: match?.scheduledTime ?? "",
    venue: match?.venue ?? "",
    slotsLocked: match?.slotsLocked ?? false,
  });
  const { pending, run } = useAction();
  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const modality = modalities.find((candidate) => candidate.id === draft.modalityId);
  const stage = modality?.stages.find((candidate) => candidate.id === draft.stageId);
  // Inscritos primeiro; as demais equipes ficam disponíveis (amistoso, equipe inscrita depois).
  const entrySet = new Set(modality?.entryIds ?? []);
  const entrants = participants.filter((participant) => entrySet.has(participant.id));
  const others = participants.filter((participant) => !entrySet.has(participant.id));
  const sidesLocked = match !== null && match.status !== "scheduled";

  function submit(event: FormEvent) {
    event.preventDefault();
    run(
      () =>
        saveMatchScheduleAction(match?.id ?? null, {
          ...draft,
          stageId: draft.stageId || null,
          groupId: draft.groupId || null,
          homeParticipantId: draft.homeParticipantId || null,
          awayParticipantId: draft.awayParticipantId || null,
        }),
      match ? "Agenda salva." : "Jogo criado.",
      (result) => {
        if (!match && result.id) router.replace(PATHS.admin.match(result.id));
      },
    );
  }

  const sideSelect = (side: "home" | "away") => {
    const key = side === "home" ? "homeParticipantId" : "awayParticipantId";
    const labelKey = side === "home" ? "homeLabel" : "awayLabel";
    return (
      <div className="space-y-2">
        <Field label={side === "home" ? "Mandante" : "Visitante"} htmlFor={`schedule-${side}`}>
          <select id={`schedule-${side}`} className={nativeSelectClass} value={draft[key]} onChange={(event) => set(key, event.target.value)} disabled={sidesLocked}>
            <option value="">A definir</option>
            {entrants.length > 0 && (
              <optgroup label="Inscritas na modalidade">
                {entrants.map((participant) => (
                  <option key={participant.id} value={participant.id}>
                    {participant.name}
                  </option>
                ))}
              </optgroup>
            )}
            {others.length > 0 && (
              <optgroup label="Outras equipes">
                {others.map((participant) => (
                  <option key={participant.id} value={participant.id}>
                    {participant.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </Field>
        {!draft[key] && (
          <Input value={draft[labelKey]} onChange={(event) => set(labelKey, event.target.value)} maxLength={60} placeholder="Rótulo (ex.: Vencedor Grupo A)" aria-label={`Rótulo do ${side === "home" ? "mandante" : "visitante"}`} />
        )}
      </div>
    );
  };

  if (modalities.length === 0) return <Notice>Crie uma modalidade antes de cadastrar jogos.</Notice>;

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid *:min-w-0 gap-3 sm:grid-cols-2">
        <Field label="Modalidade" htmlFor="schedule-modality">
          <select
            id="schedule-modality"
            className={nativeSelectClass}
            value={draft.modalityId}
            disabled={match !== null}
            onChange={(event) => setDraft((current) => ({ ...current, modalityId: event.target.value, stageId: "", groupId: "" }))}
          >
            {modalities.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.emoji ? `${candidate.emoji} ` : ""}
                {candidate.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Rodada / rótulo" htmlFor="schedule-round">
          <Input id="schedule-round" value={draft.roundLabel} onChange={(event) => set("roundLabel", event.target.value)} maxLength={40} placeholder="Ex.: 2ª rodada, Semifinal" />
        </Field>
        <Field label="Fase" htmlFor="schedule-stage">
          <select id="schedule-stage" className={nativeSelectClass} value={draft.stageId} onChange={(event) => setDraft((current) => ({ ...current, stageId: event.target.value, groupId: "" }))}>
            <option value="">Sem fase (avulso)</option>
            {modality?.stages.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Grupo" htmlFor="schedule-group">
          <select id="schedule-group" className={nativeSelectClass} value={draft.groupId} onChange={(event) => set("groupId", event.target.value)} disabled={!stage || stage.groups.length === 0}>
            <option value="">Sem grupo</option>
            {stage?.groups.map((group) => (
              <option key={group.id} value={group.id}>
                Grupo {group.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid *:min-w-0 gap-3 sm:grid-cols-2">
        {sideSelect("home")}
        {sideSelect("away")}
      </div>
      {sidesLocked && <p className="text-xs text-muted-foreground">As equipes de um jogo já iniciado não mudam.</p>}

      <div className="grid *:min-w-0 grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Data" htmlFor="schedule-date">
          <Input id="schedule-date" type="date" value={draft.scheduledDate} onChange={(event) => set("scheduledDate", event.target.value)} />
        </Field>
        <Field label="Hora" htmlFor="schedule-time">
          <Input id="schedule-time" type="time" value={draft.scheduledTime} onChange={(event) => set("scheduledTime", event.target.value)} disabled={!draft.scheduledDate} />
        </Field>
        <Field label="Local" htmlFor="schedule-venue" className="col-span-2 sm:col-span-1">
          <Input id="schedule-venue" value={draft.venue} onChange={(event) => set("venue", event.target.value)} maxLength={60} placeholder="Quadra 1" />
        </Field>
      </div>

      <label className="flex items-start gap-3 rounded-lg border border-border p-3">
        <Switch checked={draft.slotsLocked} onCheckedChange={(checked) => set("slotsLocked", checked)} className="mt-0.5" />
        <span className="text-sm">
          <span className="block font-medium text-foreground">Travar lados</span>
          <span className="block text-xs text-muted-foreground">Impede o mata-mata de preencher/trocar as equipes sozinho a partir das origens.</span>
        </span>
      </label>

      <Button type="submit" disabled={pending || !draft.modalityId}>
        {pending ? "Salvando…" : match ? "Salvar agenda" : "Criar jogo"}
      </Button>
    </form>
  );
}
