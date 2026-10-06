"use client";

import { useState, type FormEvent } from "react";
import { Button, Input, MediaPickerField, Switch, Textarea, type PickableMedia } from "@venore/plugin-sdk/ui";
import type { CompetitionView } from "../../../contracts/types";
import { DEFAULT_PLACEMENT_POINTS } from "../../../shared/placement";
import { PointsTableEditor } from "../_shared/points-table-editor";
import { Field } from "../_shared/ui";
import { useAction } from "../_shared/use-action";
import { updateCompetitionAction } from "./actions";

export function CompetitionForm({ competition, logoMedia }: { competition: CompetitionView; logoMedia: PickableMedia | null }) {
  const [name, setName] = useState(competition.name);
  const [description, setDescription] = useState(competition.description ?? "");
  const [logoMediaId, setLogoMediaId] = useState<string | null>(competition.logoMediaId);
  const [overallEnabled, setOverallEnabled] = useState(competition.overallEnabled);
  const [overallIncludesPartial, setOverallIncludesPartial] = useState(competition.overallIncludesPartial);
  const [pointsTable, setPointsTable] = useState<number[]>(competition.pointsTable.length > 0 ? competition.pointsTable : DEFAULT_PLACEMENT_POINTS);
  const { pending, run } = useAction();

  function submit(event: FormEvent) {
    event.preventDefault();
    run(
      () => updateCompetitionAction({ name, description, logoMediaId, overallEnabled, overallIncludesPartial, pointsTable }),
      "Competição atualizada.",
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid *:min-w-0 gap-4 md:grid-cols-2">
        <Field label="Nome" htmlFor="competition-name">
          <Input id="competition-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required />
        </Field>
        <MediaPickerField name="logoMediaId" label="Logo (opcional)" initialMedia={logoMedia} onSelect={(media) => setLogoMediaId(media?.id ?? null)} />
      </div>
      <Field label="Descrição" htmlFor="competition-description">
        <Textarea id="competition-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={2000} />
      </Field>

      <div className="grid *:min-w-0 gap-3 md:grid-cols-2">
        <label className="flex items-start gap-3 rounded-lg border border-border p-3">
          <Switch checked={overallEnabled} onCheckedChange={setOverallEnabled} className="mt-0.5" />
          <span className="text-sm">
            <span className="block font-medium text-foreground">Quadro geral</span>
            <span className="block text-xs text-muted-foreground">Soma pontos por colocação de cada modalidade (olimpíada). Desligado = campeonato simples.</span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-lg border border-border p-3">
          <Switch checked={overallIncludesPartial} onCheckedChange={setOverallIncludesPartial} disabled={!overallEnabled} className="mt-0.5" />
          <span className="text-sm">
            <span className="block font-medium text-foreground">Mostrar parcial</span>
            <span className="block text-xs text-muted-foreground">Conta modalidades ainda em andamento pela colocação atual. Desligado = só as finalizadas.</span>
          </span>
        </label>
      </div>

      <Field label="Pontos por colocação" hint="Usada no quadro geral (multiplicada pelo peso de cada modalidade). Uma modalidade pode ter tabela própria.">
        <PointsTableEditor value={pointsTable} onChange={setPointsTable} />
      </Field>

      <Button type="submit" disabled={pending || !name.trim()}>
        {pending ? "Salvando…" : "Salvar competição"}
      </Button>
    </form>
  );
}
