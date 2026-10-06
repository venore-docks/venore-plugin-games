"use client";

import { useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Button, Input, MediaPickerField, Switch, Textarea, type PickableMedia } from "@venore/plugin-sdk/ui";
import type { ModalityView } from "../../../contracts/types";
import type { ModalityRules } from "../../../shared/modality-rules";
import { DEFAULT_PLACEMENT_POINTS } from "../../../shared/placement";
import { getSportProfile, SPORT_PROFILE_KEYS, SPORT_PROFILES, type SportProfileKey } from "../../../shared/sport-profiles";
import { TIEBREAKER_KEYS, TIEBREAKER_LABELS, type TiebreakerKey } from "../../../shared/standings";
import { PointsTableEditor } from "../_shared/points-table-editor";
import { checkboxClass, Field, nativeSelectClass, Notice } from "../_shared/ui";
import { useAction } from "../_shared/use-action";
import { saveModalityAction } from "./actions";

function NumberField({ label, hint, value, onChange, min, max, step = 1 }: { label: string; hint?: string; value: number; onChange: (value: number) => void; min: number; max: number; step?: number }) {
  return (
    <Field label={label} hint={hint}>
      <Input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => {
          const parsed = Number(event.target.value.replace(",", "."));
          onChange(Number.isFinite(parsed) ? parsed : 0);
        }}
        className="tabular-nums"
      />
    </Field>
  );
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-border p-3">
      <Switch checked={checked} onCheckedChange={onChange} className="mt-0.5" />
      <span className="text-sm">
        <span className="block font-medium text-foreground">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

export function RulesForm({ modality, coverMedia, profileLocked }: { modality: ModalityView; coverMedia: PickableMedia | null; profileLocked: boolean }) {
  const [name, setName] = useState(modality.name);
  const [emoji, setEmoji] = useState(modality.emoji ?? "");
  const [description, setDescription] = useState(modality.description ?? "");
  const [coverMediaId, setCoverMediaId] = useState<string | null>(modality.coverMediaId);
  const [profileKey, setProfileKey] = useState<SportProfileKey>(modality.sportProfile);
  const [rules, setRules] = useState<ModalityRules>(modality.rules);
  const [weight, setWeight] = useState(modality.weight);
  const [sortOrder, setSortOrder] = useState(modality.sortOrder);
  const [ownTable, setOwnTable] = useState(modality.pointsTable !== null);
  const [pointsTable, setPointsTable] = useState<number[]>(modality.pointsTable ?? DEFAULT_PLACEMENT_POINTS);
  const { pending, run } = useAction();

  const profile = getSportProfile(profileKey);
  const isMatch = profile.shape === "match";
  const setRule = <K extends keyof ModalityRules>(key: K, value: ModalityRules[K]) => setRules((current) => ({ ...current, [key]: value }));

  const enabled = rules.tiebreakers;
  const disabledKeys = TIEBREAKER_KEYS.filter((key) => !enabled.includes(key));

  function moveTiebreaker(index: number, delta: number) {
    const next = [...enabled];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setRule("tiebreakers", next);
  }

  function toggleTiebreaker(key: TiebreakerKey, on: boolean) {
    setRule("tiebreakers", on ? [...enabled, key] : enabled.filter((candidate) => candidate !== key));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    run(
      () =>
        saveModalityAction(modality.id, {
          name,
          emoji,
          description,
          coverMediaId,
          sportProfile: profileKey,
          rules,
          weight,
          pointsTable: ownTable ? pointsTable : null,
          sortOrder,
        }),
      "Modalidade salva.",
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground">Identificação</legend>
        <div className="grid *:min-w-0 grid-cols-[4.5rem_1fr] gap-3 md:grid-cols-[4.5rem_1fr_1fr]">
          <Field label="Emoji" htmlFor="modality-emoji">
            <Input id="modality-emoji" value={emoji} onChange={(event) => setEmoji(event.target.value)} maxLength={8} className="text-center text-lg" />
          </Field>
          <Field label="Nome" htmlFor="modality-name">
            <Input id="modality-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} required />
          </Field>
          <Field
            label="Tipo"
            htmlFor="modality-profile"
            className="col-span-2 md:col-span-1"
            hint={profileLocked ? "Bloqueado: já há jogos disputados." : undefined}
          >
            <select
              id="modality-profile"
              className={nativeSelectClass}
              value={profileKey}
              disabled={profileLocked}
              onChange={(event) => {
                const next = event.target.value as SportProfileKey;
                setProfileKey(next);
                // Troca de perfil: zera os campos que só fazem sentido no perfil anterior.
                const nextProfile = SPORT_PROFILES[next];
                setRules((current) => ({
                  ...current,
                  periodMinutes: nextProfile.clock.defaultPeriodMinutes,
                  periodCount: nextProfile.clock.defaultPeriodCount,
                  setsToWin: nextProfile.usesSets ? current.setsToWin || 2 : 0,
                  pointsPerSet: nextProfile.usesSets ? current.pointsPerSet || 25 : 0,
                  tieBreakPoints: nextProfile.usesSets ? current.tieBreakPoints || 15 : 0,
                  measureUnit: nextProfile.eventResult?.unit ?? "",
                  lowerIsBetter: nextProfile.eventResult?.lowerIsBetter ?? false,
                }));
              }}
            >
              {SPORT_PROFILE_KEYS.map((key) => (
                <option key={key} value={key}>
                  {SPORT_PROFILES[key].label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Descrição (opcional)" htmlFor="modality-description">
          <Textarea id="modality-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={2} maxLength={2000} />
        </Field>
        <MediaPickerField name="coverMediaId" label="Capa (opcional)" initialMedia={coverMedia} onSelect={(media) => setCoverMediaId(media?.id ?? null)} />
      </fieldset>

      {isMatch && (
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-foreground">Pontos na tabela</legend>
          <div className="grid *:min-w-0 grid-cols-3 gap-3 sm:max-w-md">
            <NumberField label="Vitória" value={rules.pointsWin} onChange={(value) => setRule("pointsWin", value)} min={0} max={100} />
            <NumberField label="Empate" value={rules.pointsDraw} onChange={(value) => setRule("pointsDraw", value)} min={0} max={100} />
            <NumberField label="Derrota" value={rules.pointsLoss} onChange={(value) => setRule("pointsLoss", value)} min={-100} max={100} />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Critérios de desempate (em ordem)</p>
            <ol className="space-y-1.5">
              {enabled.map((key, index) => (
                <li key={key} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5">
                  <input type="checkbox" className={checkboxClass} checked onChange={() => toggleTiebreaker(key, false)} aria-label={`Desativar ${TIEBREAKER_LABELS[key]}`} />
                  <span className="w-5 text-xs font-semibold tabular-nums text-muted-foreground">{index + 1}.</span>
                  <span className="min-w-0 flex-1 text-sm text-foreground">{TIEBREAKER_LABELS[key]}</span>
                  <Button type="button" variant="ghost" size="icon-xs" onClick={() => moveTiebreaker(index, -1)} disabled={index === 0} aria-label="Subir">
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-xs" onClick={() => moveTiebreaker(index, 1)} disabled={index === enabled.length - 1} aria-label="Descer">
                    <ArrowDown aria-hidden />
                  </Button>
                </li>
              ))}
            </ol>
            {disabledKeys.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
                {disabledKeys.map((key) => (
                  <label key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input type="checkbox" className={checkboxClass} checked={false} onChange={() => toggleTiebreaker(key, true)} />
                    {TIEBREAKER_LABELS[key]}
                  </label>
                ))}
              </div>
            )}
          </div>

          <ToggleRow
            label="Mata-mata exige vencedor"
            hint="Empate no tempo normal pede o vencedor (pênaltis/desempate) ao encerrar."
            checked={rules.knockoutNeedsWinner}
            onChange={(checked) => setRule("knockoutNeedsWinner", checked)}
          />
        </fieldset>
      )}

      {profile.clock.enabled && (
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-foreground">Relógio</legend>
          <div className="grid *:min-w-0 grid-cols-2 gap-3 sm:max-w-sm">
            <NumberField label={`Minutos por ${profile.clock.periodLabel}`} value={rules.periodMinutes} onChange={(value) => setRule("periodMinutes", value)} min={0} max={120} />
            <NumberField label={`Nº de ${profile.clock.periodLabel}s`} value={rules.periodCount} onChange={(value) => setRule("periodCount", value)} min={0} max={8} />
          </div>
        </fieldset>
      )}

      {isMatch && !profile.usesSets && (
        <ToggleRow
          label="Permitir meio ponto (+0,5)"
          hint="Mostra o botão +0,5 no controle ao vivo."
          checked={rules.allowHalfPoints}
          onChange={(checked) => setRule("allowHalfPoints", checked)}
        />
      )}

      {profile.usesSets && (
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-foreground">Sets</legend>
          <div className="grid *:min-w-0 grid-cols-3 gap-3 sm:max-w-md">
            <NumberField label="Sets pra vencer" hint="Melhor de 3 = 2" value={rules.setsToWin} onChange={(value) => setRule("setsToWin", value)} min={1} max={5} />
            <NumberField label="Pontos por set" value={rules.pointsPerSet} onChange={(value) => setRule("pointsPerSet", value)} min={1} max={100} />
            <NumberField label="Tie-break" hint="Set decisivo" value={rules.tieBreakPoints} onChange={(value) => setRule("tieBreakPoints", value)} min={0} max={100} />
          </div>
        </fieldset>
      )}

      {profile.eventResult?.kind === "measure" && (
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-foreground">Medida</legend>
          <div className="grid *:min-w-0 gap-3 sm:grid-cols-2">
            <Field label="Unidade" hint="Ex.: kg, R$, s, m." htmlFor="modality-unit">
              <Input id="modality-unit" value={rules.measureUnit} onChange={(event) => setRule("measureUnit", event.target.value)} maxLength={16} />
            </Field>
            <ToggleRow label="Menor é melhor" hint="Tempo de prova, por exemplo." checked={rules.lowerIsBetter} onChange={(checked) => setRule("lowerIsBetter", checked)} />
          </div>
        </fieldset>
      )}
      {profile.eventResult?.kind === "score" && (
        <Notice>Resultado: média das notas dos jurados (maior vence). As notas são lançadas na aba Resultados.</Notice>
      )}
      {profile.eventResult?.kind === "placement" && <Notice>Resultado: a colocação lançada na aba Resultados (1 = primeiro).</Notice>}

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground">Quadro geral</legend>
        <div className="grid *:min-w-0 grid-cols-2 gap-3 sm:max-w-sm">
          <NumberField label="Peso" hint="Multiplica os pontos da colocação." value={weight} onChange={setWeight} min={0} max={100} step={0.1} />
          <NumberField label="Ordem" hint="Nas listas do site." value={sortOrder} onChange={setSortOrder} min={0} max={999} />
        </div>
        <ToggleRow
          label="Tabela de pontos própria"
          hint="Desligado = usa a tabela da competição."
          checked={ownTable}
          onChange={setOwnTable}
        />
        {ownTable && <PointsTableEditor value={pointsTable} onChange={setPointsTable} />}
      </fieldset>

      <Button type="submit" disabled={pending || !name.trim()}>
        {pending ? "Salvando…" : "Salvar regras"}
      </Button>
    </form>
  );
}
