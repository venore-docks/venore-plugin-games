"use client";

import { useActionState, type ReactNode } from "react";
import { DatabaseZap } from "lucide-react";
import { Button, useActionToast } from "@venore/plugin-sdk/ui";
import { ConfirmAction } from "../_shared/confirm-action";
import { checkboxClass, Field, nativeSelectClass } from "../_shared/ui";
import { importMatchesAction, importParticipantsAction, migrateErastoAction, type CsvImportState } from "./actions";

const initialState: CsvImportState = { error: null, result: null };

function ResultBox({ state }: { state: CsvImportState }) {
  if (!state.result) return null;
  const { created, updated, errors } = state.result;
  if (errors.length > 0) {
    return (
      <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
        <p className="font-medium text-destructive">Nada foi importado: {errors.length} linha(s) com problema. Corrija e envie de novo.</p>
        <ul className="max-h-60 space-y-1 overflow-y-auto text-xs text-destructive">
          {errors.map((error, index) => (
            <li key={index}>
              Linha {error.line}: {error.message}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <p className="rounded-lg border border-border bg-muted p-3 text-sm text-foreground">
      {created} criado(s){updated > 0 ? `, ${updated} atualizado(s)` : ""}.
    </p>
  );
}

const fileInputClass =
  "block w-full text-sm text-foreground file:me-3 file:rounded-lg file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground";

function CsvForm({
  action,
  children,
  submitLabel,
}: {
  action: (state: CsvImportState, formData: FormData) => Promise<CsvImportState>;
  children?: ReactNode;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const success = state.result && state.result.errors.length === 0 ? "Importação concluída." : null;
  useActionToast({ pending, error: state.error ?? (state.result && state.result.errors.length > 0 ? "O arquivo tem erros — nada foi importado." : null), successMessage: success });

  return (
    <form action={formAction} className="space-y-4">
      <input type="file" name="file" accept=".csv,text/csv" required className={fileInputClass} aria-label="Arquivo CSV" />
      {children}
      <Button type="submit" disabled={pending}>
        {pending ? "Importando…" : submitLabel}
      </Button>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <ResultBox state={state} />
    </form>
  );
}

export function ParticipantsImportForm({ modalities }: { modalities: { id: string; name: string }[] }) {
  return (
    <CsvForm action={importParticipantsAction} submitLabel="Importar equipes">
      <Field label="Inscrever as equipes do arquivo numa modalidade (opcional)" htmlFor="import-enroll">
        <select id="import-enroll" name="modalityId" className={nativeSelectClass} defaultValue="">
          <option value="">Não inscrever</option>
          {modalities.map((modality) => (
            <option key={modality.id} value={modality.id}>
              {modality.name}
            </option>
          ))}
        </select>
      </Field>
    </CsvForm>
  );
}

export function MatchesImportForm({ modalities }: { modalities: { id: string; name: string }[] }) {
  if (modalities.length === 0) return <p className="text-sm text-muted-foreground">Crie uma modalidade de jogos (futsal, vôlei…) antes.</p>;
  return (
    <CsvForm action={importMatchesAction} submitLabel="Importar jogos">
      <Field label="Modalidade" htmlFor="import-modality">
        <select id="import-modality" name="modalityId" className={nativeSelectClass} required defaultValue={modalities[0].id}>
          {modalities.map((modality) => (
            <option key={modality.id} value={modality.id}>
              {modality.name}
            </option>
          ))}
        </select>
      </Field>
      <label className="flex items-start gap-2 text-sm text-foreground">
        <input type="checkbox" name="replaceScheduled" className={`${checkboxClass} mt-0.5`} />
        <span>
          Substituir: apagar os jogos <strong>agendados</strong> desta modalidade antes (jogos ao vivo e encerrados ficam).
        </span>
      </label>
    </CsvForm>
  );
}

export function MigrateErastoButton({ disabled }: { disabled: boolean }) {
  return (
    <ConfirmAction
      trigger={
        <Button disabled={disabled}>
          <DatabaseZap aria-hidden /> Migrar agora
        </Button>
      }
      title="Migrar os dados do Erasto League?"
      description={
        <>
          <p>Cria a competição &ldquo;Erasto League&rdquo; com futsal, equipes, atletas, fases, jogos, lances, power plays, votos e configurações.</p>
          <p>Os dados antigos não são apagados. A operação roda uma vez só.</p>
        </>
      }
      destructive={false}
      confirmLabel="Migrar"
      successMessage="Migração concluída."
      onConfirm={migrateErastoAction}
    />
  );
}
