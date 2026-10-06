"use client";

import { useState, type FormEvent } from "react";
import { Plus, RotateCcw } from "lucide-react";
import { Badge, Button, Input } from "@venore/plugin-sdk/ui";
import type { AuditGroup } from "../../../shared/votes";
import { ConfirmAction } from "../_shared/confirm-action";
import { Field } from "../_shared/ui";
import { useAction } from "../_shared/use-action";
import type { VoteSettingsValues } from "../_shared/settings-read";
import { applyAuditActionAction, ensureParticipantPollAction, resetPollVotesAction, saveVoteSettingsAction } from "./actions";

export function CreateFavoritePollButton() {
  const { pending, run } = useAction();
  return (
    <Button size="sm" disabled={pending} onClick={() => run(() => ensureParticipantPollAction("Equipe favorita"), "Votação de equipe favorita criada.")}>
      <Plus aria-hidden /> Criar votação de equipe favorita
    </Button>
  );
}

export function ResetPollButton({ pollId, title }: { pollId: string; title: string }) {
  return (
    <ConfirmAction
      trigger={
        <Button variant="destructive" size="sm">
          <RotateCcw aria-hidden /> Zerar votos
        </Button>
      }
      title={`Zerar os votos de “${title}”?`}
      description={<p>Todos os votos e a parcial desta votação são apagados de vez. Use só pra começar uma nova temporada.</p>}
      requireText="ZERAR"
      confirmLabel="Zerar votos"
      successMessage="Votos zerados."
      onConfirm={() => resetPollVotesAction(pollId)}
    />
  );
}

const LEVEL: Record<AuditGroup["level"], { label: string; variant: "destructive" | "secondary" | "outline" }> = {
  suspect: { label: "Suspeito", variant: "destructive" },
  watch: { label: "Atenção", variant: "secondary" },
  none: { label: "Normal", variant: "outline" },
};

// Grupos por rede (IP com hash). "Suspeito" = muitos votos por navegador — típico de quem limpa
// cookie ou usa aba anônima pra votar de novo.
export function AuditGroups({ pollId, groups }: { pollId: string; groups: AuditGroup[] }) {
  const { pending, run } = useAction();
  if (groups.length === 0) return <p className="text-sm text-muted-foreground">Nenhuma rede com 3 ou mais votos. Nada a auditar.</p>;

  return (
    <ul className="space-y-2">
      {groups.map((group) => {
        const level = LEVEL[group.level];
        const voided = group.total - group.active;
        return (
          <li key={group.ipHash} className="flex flex-col gap-3 rounded-lg border border-border p-3 md:flex-row md:items-center">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={level.variant}>{level.label}</Badge>
                <code className="truncate font-mono text-xs text-muted-foreground">{group.ipHash === "unknown" ? "rede desconhecida" : `rede ${group.ipHash.slice(0, 10)}`}</code>
              </div>
              <p className="text-sm text-foreground">
                {group.total} voto(s) de {group.browsers} navegador(es) · {group.active} válido(s)
                {voided > 0 ? ` · ${voided} anulado(s)` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={pending || group.active <= group.browsers} onClick={() => run(() => applyAuditActionAction(pollId, group.ipHash, "keep_one_per_browser"), null)}>
                Manter 1 por navegador
              </Button>
              <ConfirmAction
                trigger={
                  <Button size="sm" variant="destructive" disabled={pending || group.active === 0}>
                    Anular todos
                  </Button>
                }
                title="Anular todos os votos desta rede?"
                description={<p>Os {group.active} voto(s) válidos saem da parcial. Dá pra restaurar depois.</p>}
                confirmLabel="Anular"
                successMessage="Votos anulados."
                onConfirm={() => applyAuditActionAction(pollId, group.ipHash, "void_all")}
              />
              <Button size="sm" variant="ghost" disabled={pending || voided === 0} onClick={() => run(() => applyAuditActionAction(pollId, group.ipHash, "restore"), null)}>
                Restaurar
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const SETTING_FIELDS: { key: keyof VoteSettingsValues; label: string; hint: string }[] = [
  { key: "voteWaitBaseSeconds", label: "Espera do 1º voto (s)", hint: "Quanto o primeiro voto de uma rede espera antes de valer." },
  { key: "voteWaitStepSeconds", label: "Espera a mais por voto (s)", hint: "Cada voto seguido da mesma rede espera isso a mais (acumula)." },
  { key: "voteWaitMaxSeconds", label: "Espera máxima (s)", hint: "Teto da espera de um voto, por mais que a rede vote." },
  { key: "voteMaxPerNetwork", label: "Máx. de votos por rede", hint: "Por votação; 0 = sem limite. Uma escola inteira pode estar na mesma rede." },
  { key: "fanVoteWindowHours", label: "Votação aberta por (h)", hint: "Quanto tempo depois do fim do jogo a votação do craque fica aberta." },
];

export function VoteSettingsForm({ initial }: { initial: VoteSettingsValues }) {
  const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(Object.entries(initial).map(([key, value]) => [key, String(value)])));
  const { pending, run } = useAction();

  function submit(event: FormEvent) {
    event.preventDefault();
    run(() => saveVoteSettingsAction(values), "Configurações da votação salvas.");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SETTING_FIELDS.map((field) => (
          <Field key={field.key} label={field.label} hint={field.hint} htmlFor={`vote-${field.key}`}>
            <Input
              id={`vote-${field.key}`}
              type="number"
              min={0}
              value={values[field.key]}
              onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
              className="tabular-nums"
            />
          </Field>
        ))}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Salvando…" : "Salvar configurações"}
      </Button>
    </form>
  );
}
