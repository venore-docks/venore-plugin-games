"use client";

import { useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@venore/plugin-sdk/ui";
import type { MatchEventView, MatchSide } from "../../../contracts/types";
import type { ModalityRules } from "../../../shared/modality-rules";
import { allowedScoreAmounts, formatScore } from "../../../shared/score";
import { getSportProfile, type SportProfileKey } from "../../../shared/sport-profiles";
import { formatClock } from "../../../shared/clock";
import { ConfirmAction } from "../_shared/confirm-action";
import { Field, nativeSelectClass, Notice } from "../_shared/ui";
import { useAction } from "../_shared/use-action";
import { addMatchEventAction, deleteMatchEventAction, updateMatchEventAction } from "./actions";

export type RosterAthlete = { id: string; name: string; number: number | null };
export type SideInfo = { id: string; name: string; roster: RosterAthlete[] } | null;

function athleteLabel(athlete: RosterAthlete): string {
  return athlete.number !== null ? `${athlete.number} · ${athlete.name}` : athlete.name;
}

// Lances da súmula. O caso comum depois do jogo: atribuir o atleta de gols lançados sem atleta
// no controle ao vivo — por isso o select de atleta é editável direto na linha.
export function EventsEditor({
  matchId,
  profileKey,
  rules,
  events,
  home,
  away,
}: {
  matchId: string;
  profileKey: SportProfileKey;
  rules: ModalityRules;
  events: MatchEventView[];
  home: SideInfo;
  away: SideInfo;
}) {
  const profile = getSportProfile(profileKey);
  const amounts = allowedScoreAmounts(profile, rules);
  const [side, setSide] = useState<MatchSide>("home");
  const [kind, setKind] = useState(profile.eventKinds[0]?.key ?? "");
  const [amount, setAmount] = useState(String(amounts[0] ?? 1));
  const [athleteId, setAthleteId] = useState("");
  const { pending, run } = useAction();

  if (profile.eventKinds.length === 0) return <Notice>Este tipo de modalidade não tem lances.</Notice>;
  if (!home || !away) return <Notice>Defina as duas equipes para lançar lances.</Notice>;

  const sides = { home, away };
  const kindDef = (key: string) => profile.eventKinds.find((candidate) => candidate.key === key);
  const unassigned = events.filter((event) => kindDef(event.kind)?.scores && !event.athleteId).length;

  function add(event: FormEvent) {
    event.preventDefault();
    run(() => addMatchEventAction({ matchId, side, kind, amount: Number(amount), athleteId: athleteId || null }), "Lance adicionado.", () => setAthleteId(""));
  }

  return (
    <div className="space-y-4">
      {unassigned > 0 && <Notice tone="warning">{unassigned} lance(s) que pontuaram sem atleta. Escolha quem marcou na lista (vale pra artilharia).</Notice>}

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum lance registrado.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {events.map((event) => (
            <EventRow key={event.id} matchId={matchId} event={event} sideInfo={sides[event.side]} label={kindDef(event.kind)} />
          ))}
        </ul>
      )}

      <form onSubmit={add} className="grid *:min-w-0 gap-3 rounded-lg border border-dashed border-border p-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_6rem_1.4fr_auto] lg:items-end">
        <Field label="Equipe" htmlFor="event-side">
          <select
            id="event-side"
            className={nativeSelectClass}
            value={side}
            onChange={(event) => {
              setSide(event.target.value as MatchSide);
              setAthleteId("");
            }}
          >
            <option value="home">{home.name}</option>
            <option value="away">{away.name}</option>
          </select>
        </Field>
        <Field label="Lance" htmlFor="event-kind">
          <select id="event-kind" className={nativeSelectClass} value={kind} onChange={(event) => setKind(event.target.value)}>
            {profile.eventKinds.map((candidate) => (
              <option key={candidate.key} value={candidate.key}>
                {candidate.emoji} {candidate.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Valor" htmlFor="event-amount">
          <select id="event-amount" className={nativeSelectClass} value={amount} onChange={(event) => setAmount(event.target.value)} disabled={!kindDef(kind)?.scores}>
            {amounts.map((value) => (
              <option key={value} value={value}>
                +{formatScore(value)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Atleta (opcional)" htmlFor="event-athlete">
          <select id="event-athlete" className={nativeSelectClass} value={athleteId} onChange={(event) => setAthleteId(event.target.value)}>
            <option value="">Sem atleta</option>
            {sides[side].roster.map((athlete) => (
              <option key={athlete.id} value={athlete.id}>
                {athleteLabel(athlete)}
              </option>
            ))}
          </select>
        </Field>
        <Button type="submit" disabled={pending || !kind}>
          <Plus aria-hidden /> Lançar
        </Button>
      </form>
    </div>
  );
}

function EventRow({
  matchId,
  event,
  sideInfo,
  label,
}: {
  matchId: string;
  event: MatchEventView;
  sideInfo: NonNullable<SideInfo>;
  label: { label: string; emoji: string; scores: boolean } | undefined;
}) {
  const { pending, run } = useAction();

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
      <span className="text-lg leading-none" aria-hidden>
        {label?.emoji ?? "•"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {label?.label ?? event.kind}
          {label?.scores && event.amount !== 1 ? ` +${formatScore(event.amount)}` : ""}
          <span className="font-normal text-muted-foreground"> · {sideInfo.name}</span>
        </p>
        {event.clockMs !== null && (
          <p className="text-xs text-muted-foreground">
            {event.period ? `${event.period}º · ` : ""}
            {formatClock(event.clockMs)}
          </p>
        )}
      </div>
      <select
        className={`${nativeSelectClass} h-8 w-full sm:w-52`}
        value={event.athleteId ?? ""}
        disabled={pending}
        aria-label="Atleta do lance"
        onChange={(change) =>
          run(
            () => updateMatchEventAction({ matchId, eventId: event.id, side: event.side, kind: event.kind, amount: event.amount, athleteId: change.target.value || null }),
            "Lance atualizado.",
          )
        }
      >
        <option value="">Sem atleta</option>
        {sideInfo.roster.map((athlete) => (
          <option key={athlete.id} value={athlete.id}>
            {athleteLabel(athlete)}
          </option>
        ))}
      </select>
      <ConfirmAction
        trigger={
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Excluir lance">
            <Trash2 aria-hidden />
          </Button>
        }
        title="Excluir este lance?"
        description={label?.scores ? "O placar é recalculado sem ele." : "O lance some da súmula."}
        confirmLabel="Excluir"
        successMessage="Lance excluído."
        onConfirm={() => deleteMatchEventAction(matchId, event.id)}
      />
    </li>
  );
}
