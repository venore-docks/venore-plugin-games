"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Plus, RotateCcw, X } from "lucide-react";
import { Button, Input, Textarea } from "@venore/plugin-sdk/ui";
import type { MatchView } from "../../../contracts/types";
import type { ModalityRules } from "../../../shared/modality-rules";
import { PATHS } from "../../../shared/paths";
import { getSportProfile, type SportProfileKey } from "../../../shared/sport-profiles";
import { todayInSite } from "../../../shared/timezone";
import { ConfirmAction } from "../_shared/confirm-action";
import { Field, nativeSelectClass, Notice } from "../_shared/ui";
import { useAction } from "../_shared/use-action";
import { saveMatchResultAction } from "./actions";

type Side = { id: string; name: string } | null;

export function ResultForm({
  match,
  profileKey,
  rules,
  home,
  away,
  hasScoringEvents,
  isKnockout,
}: {
  match: MatchView;
  profileKey: SportProfileKey;
  rules: ModalityRules;
  home: Side;
  away: Side;
  hasScoringEvents: boolean;
  isKnockout: boolean;
}) {
  const profile = getSportProfile(profileKey);
  const [homeScore, setHomeScore] = useState(String(match.homeScore).replace(".", ","));
  const [awayScore, setAwayScore] = useState(String(match.awayScore).replace(".", ","));
  const [sets, setSets] = useState<{ home: string; away: string }[]>(
    match.sets && match.sets.length > 0 ? match.sets.map((set) => ({ home: String(set.home), away: String(set.away) })) : [{ home: "", away: "" }],
  );
  const [decidedWinnerId, setDecidedWinnerId] = useState(match.decidedWinnerId ?? "");
  const [resultNote, setResultNote] = useState(match.resultNote ?? "");
  const [finishedDate, setFinishedDate] = useState(match.finishedAt ? match.finishedAt.slice(0, 10) : (match.scheduledDate ?? todayInSite()));
  const { pending, run } = useAction();

  if (match.status === "live") {
    return (
      <Notice tone="warning">
        Jogo em andamento — placar e encerramento pelo{" "}
        <Link href={PATHS.control()} className="font-medium underline-offset-4 hover:underline" target="_blank" rel="noreferrer">
          controle ao vivo
        </Link>
        .
      </Notice>
    );
  }
  if (!home || !away) return <Notice>Defina as duas equipes (Agenda) antes de lançar o resultado.</Notice>;

  const num = (raw: string) => (raw.trim() ? Number(raw.replace(",", ".")) : null);
  const step = rules.allowHalfPoints ? 0.5 : 1;
  const usesSets = profile.usesSets && !hasScoringEvents;

  function submit(event: FormEvent) {
    event.preventDefault();
    run(
      () =>
        saveMatchResultAction({
          matchId: match.id,
          status: "finished",
          homeScore: num(homeScore),
          awayScore: num(awayScore),
          sets: usesSets ? sets.filter((set) => set.home.trim() || set.away.trim()).map((set) => ({ home: num(set.home) ?? 0, away: num(set.away) ?? 0 })) : null,
          decidedWinnerId: decidedWinnerId || null,
          resultNote,
          finishedDate,
        }),
      match.status === "finished" ? "Resultado corrigido." : "Jogo encerrado.",
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {hasScoringEvents && <Notice>O placar vem dos lances lançados abaixo ({profile.scoreUnit.plural}). Para mudar o placar, corrija os lances.</Notice>}

      {usesSets ? (
        <div className="space-y-2">
          <div className="grid grid-cols-[3rem_1fr_1fr_2rem] items-center gap-2 text-xs font-medium text-muted-foreground">
            <span>Set</span>
            <span className="truncate">{home.name}</span>
            <span className="truncate">{away.name}</span>
            <span />
          </div>
          {sets.map((set, index) => (
            <div key={index} className="grid grid-cols-[3rem_1fr_1fr_2rem] items-center gap-2">
              <span className="text-sm font-semibold tabular-nums text-muted-foreground">{index + 1}º</span>
              <Input type="number" min={0} inputMode="numeric" value={set.home} onChange={(event) => setSets(sets.map((s, i) => (i === index ? { ...s, home: event.target.value } : s)))} aria-label={`Set ${index + 1} — ${home.name}`} />
              <Input type="number" min={0} inputMode="numeric" value={set.away} onChange={(event) => setSets(sets.map((s, i) => (i === index ? { ...s, away: event.target.value } : s)))} aria-label={`Set ${index + 1} — ${away.name}`} />
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setSets(sets.filter((_, i) => i !== index))} disabled={sets.length === 1} aria-label="Remover set">
                <X aria-hidden />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setSets([...sets, { home: "", away: "" }])} disabled={sets.length >= 9}>
            <Plus aria-hidden /> Set
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
          <Field label={home.name} htmlFor="result-home">
            <Input id="result-home" type="number" min={0} step={step} inputMode="decimal" value={homeScore} onChange={(event) => setHomeScore(event.target.value)} disabled={hasScoringEvents} className="h-12 text-center text-2xl font-semibold tabular-nums" />
          </Field>
          <span className="pb-3 text-lg font-semibold text-muted-foreground">×</span>
          <Field label={away.name} htmlFor="result-away">
            <Input id="result-away" type="number" min={0} step={step} inputMode="decimal" value={awayScore} onChange={(event) => setAwayScore(event.target.value)} disabled={hasScoringEvents} className="h-12 text-center text-2xl font-semibold tabular-nums" />
          </Field>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Vencedor no desempate" hint={isKnockout ? "Obrigatório em mata-mata empatado (pênaltis)." : "Só se o jogo precisou de desempate."} htmlFor="result-winner">
          <select id="result-winner" className={nativeSelectClass} value={decidedWinnerId} onChange={(event) => setDecidedWinnerId(event.target.value)}>
            <option value="">Nenhum (pelo placar)</option>
            <option value={home.id}>{home.name}</option>
            <option value={away.id}>{away.name}</option>
          </select>
        </Field>
        <Field label="Data do jogo" htmlFor="result-date">
          <Input id="result-date" type="date" value={finishedDate} onChange={(event) => setFinishedDate(event.target.value)} />
        </Field>
      </div>
      <Field label="Observação (opcional)" htmlFor="result-note">
        <Textarea id="result-note" rows={2} value={resultNote} onChange={(event) => setResultNote(event.target.value)} maxLength={200} placeholder="Ex.: vitória nos pênaltis (4 × 3), W.O." />
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : match.status === "finished" ? "Salvar correção" : "Encerrar jogo com este resultado"}
        </Button>
        {match.status === "finished" && (
          <ConfirmAction
            trigger={
              <Button type="button" variant="outline">
                <RotateCcw aria-hidden /> Voltar para agendado
              </Button>
            }
            title="Voltar o jogo para agendado?"
            description={<p>O placar zera e os lances e power plays deste jogo são apagados. A classificação e o chaveamento são recalculados.</p>}
            confirmLabel="Voltar para agendado"
            successMessage="Jogo voltou para agendado."
            onConfirm={() =>
              saveMatchResultAction({ matchId: match.id, status: "scheduled", homeScore: null, awayScore: null, sets: null, decidedWinnerId: null, resultNote: null, finishedDate: null })
            }
          />
        )}
      </div>
    </form>
  );
}
