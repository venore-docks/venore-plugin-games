"use client";

import { useState, type CSSProperties } from "react";
import type { LiveMatchState, LiveMarker, LiveSideState, MatchSide } from "../../../contracts/types";
import { elapsedMs, formatClock, type ClockCommand } from "../../../shared/clock";
import { formatScore } from "../../../shared/score";
import { getSportProfile, type EventKindDefinition, type ScoreButton } from "../../../shared/sport-profiles";
import { useNow } from "../../../shared/use-live-state";
import {
  addBoostAction,
  addMarkerAction,
  addScoreAction,
  attributeEventAction,
  cancelMatchAction,
  clockAction,
  finishMatchAction,
  removeBoostAction,
  removeEventAction,
  setLabelAction,
  undoLastScoreAction,
} from "./actions";
import { buildLabelChips, clockMinute, periodEndShortcuts } from "./control-model";
import type { ControlOps } from "./ops";
import { PeoplePicker, Sheet } from "./sheets";
import type { BoostOption, DeskAthlete, DeskEvent, MatchDesk } from "./types";

// Jogo ao vivo: relógio, etiqueta, placar por lado (botões do perfil esportivo), lances, power
// plays, encerrar/cancelar. Cada botão grava na hora; atribuir atleta é sempre opcional e pode
// ficar pra depois (lista de lances ou súmula).

type Attribution = { eventId: string; side: MatchSide; title: string; currentAthleteId: string | null };

const SIDES: MatchSide[] = ["home", "away"];

function teamLabel(team: LiveSideState | null): string {
  return team ? team.shortName || team.name : "";
}

function ClockFace({ state, offsetMs }: { state: LiveMatchState; offsetMs: number }) {
  // Componente isolado: só ele re-renderiza a cada tique do relógio.
  const now = useNow(offsetMs);
  const time = now === 0 ? state.clock.accumulatedMs : elapsedMs(state.clock, now);
  return (
    <div className={`gm-c-time ${state.clock.running ? "run" : ""}`} role="timer" aria-live="off">
      {formatClock(time)}
    </div>
  );
}

export function LivePanel({
  state,
  desk,
  clockOffsetMs,
  boosts,
  ops,
}: {
  state: LiveMatchState;
  desk: MatchDesk | null;
  clockOffsetMs: number;
  boosts: BoostOption[];
  ops: ControlOps;
}) {
  const matchId = state.matchId!;
  const profile = getSportProfile(state.sportProfile ?? "pontos");
  const [attribution, setAttribution] = useState<Attribution | null>(null);
  const [finish, setFinish] = useState<{ forceWinner: boolean } | null>(null);
  const { channelKey } = ops;

  const scoreButtons: ScoreButton[] = [...profile.scoreButtons];
  if (desk?.allowHalfPoints && profile.scoreButtons[0] && !scoreButtons.some((button) => button.amount === 0.5)) {
    scoreButtons.push({ amount: 0.5, label: "+0,5", eventKind: profile.scoreButtons[0].eventKind });
  }
  const markerKinds = profile.eventKinds.filter((kind) => !kind.scores);
  const roster = (side: MatchSide): DeskAthlete[] => desk?.roster[side] ?? [];

  async function score(side: MatchSide, button: ScoreButton) {
    const result = await ops.run(`score:${side}`, () => addScoreAction(channelKey, matchId, side, button.amount, button.eventKind));
    const kind = profile.eventKinds.find((item) => item.key === button.eventKind);
    if (result?.ok && result.eventId && roster(side).length > 0) {
      setAttribution({ eventId: result.eventId, side, title: `${kind?.label ?? "Ponto"} de ${teamLabel(state[side])} — quem fez?`, currentAthleteId: null });
    }
  }

  async function marker(side: MatchSide, kind: EventKindDefinition) {
    const result = await ops.run(`marker:${side}:${kind.key}`, () => addMarkerAction(channelKey, matchId, side, kind.key));
    if (result?.ok && result.eventId && roster(side).length > 0) {
      setAttribution({ eventId: result.eventId, side, title: `${kind.label} para ${teamLabel(state[side])} — quem foi?`, currentAthleteId: null });
    }
  }

  function attribute(athleteId: string | null) {
    if (!attribution) return;
    const { eventId } = attribution;
    setAttribution(null);
    void ops.run(`attr:${eventId}`, () => attributeEventAction(channelKey, matchId, eventId, athleteId));
  }

  function removeMarker(item: LiveMarker) {
    void ops.run(`rm:${item.id}`, () => (item.kind === "boost" ? removeBoostAction(channelKey, matchId, item.id) : removeEventAction(channelKey, matchId, item.id)));
  }

  function removeEvent(event: DeskEvent) {
    ops.confirm({
      title: "Remover lance?",
      message: `${event.emoji} ${event.label} de ${teamLabel(state[event.side])}${event.athleteName ? ` (${event.athleteName})` : ""}.${event.scores ? " O placar é recalculado." : ""}`,
      confirmLabel: "Remover",
      tone: "danger",
      onConfirm: () => void ops.run(`rm:${event.id}`, () => removeEventAction(channelKey, matchId, event.id)),
    });
  }

  const clock = (key: string, command: ClockCommand) => void ops.run(`clock:${key}`, () => clockAction(channelKey, matchId, command));

  return (
    <>
      {profile.clock.enabled ? (
        <ClockCard state={state} desk={desk} clockOffsetMs={clockOffsetMs} ops={ops} onCommand={clock} />
      ) : null}

      <LabelCard state={state} ops={ops} matchId={matchId} />

      <div className="gm-c-sides">
        {SIDES.map((side) => {
          const team = state[side];
          if (!team) return null;
          const setPoints = state.currentSet ? state.currentSet[side] : 0;
          const empty = profile.usesSets ? team.score === 0 && setPoints === 0 : team.score === 0;
          const sideMarkers = state.markers.filter((item) => item.side === side);
          return (
            <section key={side} className="gm-c-card gm-c-side" style={{ "--gm-team": team.color ?? undefined } as CSSProperties} aria-label={team.name}>
              <div className="gm-c-side-name" title={team.name}>
                {teamLabel(team)}
              </div>
              <div className="gm-c-score" aria-live="polite">
                {formatScore(profile.usesSets ? setPoints : team.score)}
              </div>
              {profile.usesSets ? (
                <div className="gm-c-sets">
                  Sets <strong>{team.score}</strong>
                </div>
              ) : null}
              {scoreButtons.map((button, index) => (
                <button
                  key={`${button.eventKind}:${button.amount}`}
                  type="button"
                  className={`gm-c-plus ${index > 0 && button.amount < 1 ? "alt" : ""}`}
                  disabled={ops.isBusy(`score:${side}`)}
                  onClick={() => void score(side, button)}
                >
                  {button.label}
                </button>
              ))}
              <button type="button" className="gm-c-btn small" disabled={empty || ops.isBusy(`undo:${side}`)} onClick={() => void ops.run(`undo:${side}`, () => undoLastScoreAction(channelKey, matchId, side))}>
                ↶ Desfazer último
              </button>

              {markerKinds.length > 0 ? (
                <div className="gm-c-kinds">
                  {markerKinds.map((kind) => (
                    <button key={kind.key} type="button" className="gm-c-kind" disabled={ops.isBusy(`marker:${side}:${kind.key}`)} onClick={() => void marker(side, kind)}>
                      <span aria-hidden="true">{kind.emoji}</span> {kind.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {boosts.length > 0 ? (
                <>
                  <p className="gm-c-sub">Power play</p>
                  <div className="gm-c-kinds">
                    {boosts.map((boost) => (
                      <button
                        key={boost.id}
                        type="button"
                        className="gm-c-kind"
                        title={boost.description ?? undefined}
                        disabled={ops.isBusy(`boost:${side}:${boost.id}`)}
                        onClick={() => void ops.run(`boost:${side}:${boost.id}`, () => addBoostAction(channelKey, matchId, side, boost.id))}
                      >
                        <span aria-hidden="true">{boost.emoji}</span> {boost.label}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}

              {sideMarkers.length > 0 ? (
                <div className="gm-c-pills" aria-label="No overlay (toque para tirar)">
                  {sideMarkers.map((item) => (
                    <button key={item.id} type="button" className="gm-c-pill" disabled={ops.isBusy(`rm:${item.id}`)} title="Tirar do overlay" onClick={() => removeMarker(item)}>
                      <span aria-hidden="true">{item.emoji}</span>
                      <span className="t">{item.athleteName ?? item.label}</span>
                      <span className="x" aria-label="Tirar">
                        ×
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      {profile.usesSets && desk?.sets && desk.sets.length > 1 ? (
        <p className="gm-c-hint" style={{ textAlign: "center" }}>
          Sets: {desk.sets.map((set) => `${set.home}–${set.away}`).join(" · ")}
        </p>
      ) : null}

      <EventsCard
        state={state}
        desk={desk}
        ops={ops}
        onAttribute={(event) =>
          setAttribution({ eventId: event.id, side: event.side, title: `${event.label} de ${teamLabel(state[event.side])} — quem foi?`, currentAthleteId: event.athleteId })
        }
        onRemove={removeEvent}
      />

      <section className="gm-c-card">
        <button type="button" className="gm-c-btn danger block big" onClick={() => setFinish({ forceWinner: false })}>
          Encerrar jogo
        </button>
        <button
          type="button"
          className="gm-c-link"
          disabled={ops.isBusy("cancel")}
          onClick={() =>
            ops.confirm({
              title: "Cancelar este jogo?",
              message: "Use só se começou o jogo errado: placar, lances e relógio são apagados e o jogo volta para agendado (jogo rápido é apagado). Não conta na classificação.",
              confirmLabel: "Cancelar jogo",
              tone: "danger",
              onConfirm: () =>
                void ops.run("cancel", () => cancelMatchAction(channelKey, matchId), { refresh: true }).then((result) => result?.ok && ops.toast("Jogo cancelado.", "ok")),
            })
          }
        >
          Cancelar jogo (comecei errado)
        </button>
      </section>

      {attribution ? (
        <Sheet title={attribution.title} onClose={() => setAttribution(null)} closeLabel="Pular">
          <PeoplePicker
            athletes={roster(attribution.side)}
            selectedId={attribution.currentAthleteId}
            onPick={(athlete) => attribute(athlete.id)}
            emptyMessage="Nenhum atleta cadastrado nesta equipe — dá pra atribuir depois na súmula."
          />
          {attribution.currentAthleteId ? (
            <button type="button" className="gm-c-btn block" onClick={() => attribute(null)}>
              Tirar atleta deste lance
            </button>
          ) : null}
        </Sheet>
      ) : null}

      {finish ? <FinishSheet state={state} desk={desk} ops={ops} forceWinner={finish.forceWinner} onNeedWinner={() => setFinish({ forceWinner: true })} onClose={() => setFinish(null)} /> : null}
    </>
  );
}

function ClockCard({
  state,
  desk,
  clockOffsetMs,
  ops,
  onCommand,
}: {
  state: LiveMatchState;
  desk: MatchDesk | null;
  clockOffsetMs: number;
  ops: ControlOps;
  onCommand: (key: string, command: ClockCommand) => void;
}) {
  const profile = getSportProfile(state.sportProfile ?? "pontos");
  const periodMinutes = desk?.periodMinutes ?? Math.round(state.periodMs / 60_000);
  const shortcuts = periodEndShortcuts(profile, periodMinutes, state.periodCount);
  const anyBusy = ["toggle", "minus", "plus", "reset", "set"].some((key) => ops.isBusy(`clock:${key}`));
  return (
    <section className="gm-c-card gm-c-clock" aria-label="Relógio">
      <ClockFace state={state} offsetMs={clockOffsetMs} />
      {state.periodCount > 0 ? (
        <span className="gm-c-period">
          {state.period}º {profile.clock.periodLabel} de {state.periodCount}
        </span>
      ) : null}
      <button
        type="button"
        className={`gm-c-btn block big ${state.clock.running ? "warn" : "primary"}`}
        disabled={anyBusy}
        onClick={() => onCommand("toggle", { kind: state.clock.running ? "pause" : "start" })}
      >
        {state.clock.running ? "❚❚ Pausar relógio" : "▶ Iniciar relógio"}
      </button>
      <div className="gm-c-row">
        <button type="button" className="gm-c-btn small" disabled={anyBusy} onClick={() => onCommand("minus", { kind: "adjust", deltaMs: -60_000 })}>
          −1:00
        </button>
        <button type="button" className="gm-c-btn small" disabled={anyBusy} onClick={() => onCommand("plus", { kind: "adjust", deltaMs: 60_000 })}>
          +1:00
        </button>
        <button
          type="button"
          className="gm-c-btn small"
          disabled={anyBusy}
          onClick={() =>
            ops.confirm({ title: "Zerar o relógio?", message: "O relógio volta para 00:00 e fica parado.", confirmLabel: "Zerar", tone: "danger", onConfirm: () => onCommand("reset", { kind: "reset" }) })
          }
        >
          Zerar
        </button>
      </div>
      {shortcuts.length > 0 ? (
        <div className="gm-c-row">
          {shortcuts.map((shortcut) => (
            <button key={shortcut.label} type="button" className="gm-c-btn small" disabled={anyBusy} onClick={() => onCommand("set", { kind: "set", elapsedMs: shortcut.elapsedMs })}>
              {shortcut.label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function LabelCard({ state, ops, matchId }: { state: LiveMatchState; ops: ControlOps; matchId: string }) {
  const profile = getSportProfile(state.sportProfile ?? "pontos");
  const chips = buildLabelChips(profile, state.periodCount);
  const busy = ops.isBusy("label");
  const commit = (label: string, period: number | null) => void ops.run("label", () => setLabelAction(ops.channelKey, matchId, label, period));
  return (
    <section className="gm-c-card" aria-labelledby="gm-c-label-title">
      <h2 className="gm-c-card-title" id="gm-c-label-title">
        Etiqueta no placar
      </h2>
      <div className="gm-c-chips">
        {chips.map((chip) => {
          const on = state.label === chip.label;
          return (
            <button key={chip.label} type="button" className={`gm-c-chip ${on ? "on" : ""}`} aria-pressed={on} disabled={busy} onClick={() => commit(on ? "" : chip.label, on ? null : chip.period)}>
              {chip.label}
            </button>
          );
        })}
      </div>
      <form
        key={state.label}
        className="gm-c-row"
        onSubmit={(event) => {
          event.preventDefault();
          const value = new FormData(event.currentTarget).get("label");
          const label = typeof value === "string" ? value.trim() : "";
          if (label.toUpperCase() !== state.label) commit(label, null);
        }}
      >
        <input className="gm-c-input" name="label" defaultValue={state.label} maxLength={24} placeholder="Texto livre (ex.: PRORROGAÇÃO)" aria-label="Etiqueta do placar" style={{ flex: "3 1 0" }} />
        <button type="submit" className="gm-c-btn" disabled={busy}>
          Salvar
        </button>
      </form>
    </section>
  );
}

function EventsCard({ state, desk, ops, onAttribute, onRemove }: { state: LiveMatchState; desk: MatchDesk | null; ops: ControlOps; onAttribute: (event: DeskEvent) => void; onRemove: (event: DeskEvent) => void }) {
  if (!desk || desk.events.length === 0) return null;
  return (
    <section className="gm-c-card" aria-labelledby="gm-c-events-title">
      <h2 className="gm-c-card-title" id="gm-c-events-title">
        Lances recentes
      </h2>
      <ul className="gm-c-events">
        {desk.events.map((event) => {
          const minute = clockMinute(event.clockMs);
          const hasRoster = (desk.roster[event.side] ?? []).length > 0;
          return (
            <li key={event.id} className="gm-c-event">
              <span className="gm-c-event-emoji" aria-hidden="true">
                {event.emoji}
              </span>
              <div className="gm-c-event-main">
                <span className="gm-c-event-title">
                  {event.label}
                  {event.scores && event.amount !== 1 ? ` (+${formatScore(event.amount)})` : ""} · {teamLabel(state[event.side])}
                </span>
                <span className="gm-c-event-meta">{[minute, event.athleteName ?? "sem atleta"].filter(Boolean).join(" · ")}</span>
              </div>
              {hasRoster ? (
                <button type="button" className="gm-c-event-who" disabled={ops.isBusy(`attr:${event.id}`)} onClick={() => onAttribute(event)}>
                  {event.athleteName ? "Trocar" : "Quem foi?"}
                </button>
              ) : null}
              <button type="button" className="gm-c-event-x" aria-label={`Remover ${event.label}`} disabled={ops.isBusy(`rm:${event.id}`)} onClick={() => onRemove(event)}>
                ×
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function FinishSheet({
  state,
  desk,
  ops,
  forceWinner,
  onNeedWinner,
  onClose,
}: {
  state: LiveMatchState;
  desk: MatchDesk | null;
  ops: ControlOps;
  forceWinner: boolean;
  onNeedWinner: () => void;
  onClose: () => void;
}) {
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [mvpId, setMvpId] = useState<string | null>(desk?.mvpAthleteId ?? null);
  const home = state.home!;
  const away = state.away!;
  const tied = home.score === away.score;
  const askWinner = forceWinner || Boolean(desk?.tieNeedsWinner && tied);
  const busy = ops.isBusy("finish");

  async function submit() {
    const result = await ops.run("finish", () => finishMatchAction(ops.channelKey, state.matchId!, askWinner ? winnerId : null, mvpId), {
      refresh: true,
      silentCodes: ["games.match.needs_winner"],
    });
    if (!result) return;
    if (!result.ok && result.code === "games.match.needs_winner") {
      ops.toast(result.message);
      onNeedWinner();
      return;
    }
    if (result.ok) {
      onClose();
      ops.toast("Jogo encerrado. Placar salvo.", "ok");
    }
  }

  return (
    <Sheet title="Encerrar jogo" onClose={onClose} closeLabel="Voltar">
      <p className="gm-c-sheet-text">
        Placar final: <strong>{teamLabel(home)}</strong> {formatScore(home.score)} × {formatScore(away.score)} <strong>{teamLabel(away)}</strong>. O resultado entra na classificação.
      </p>

      {askWinner ? (
        <>
          <p className="gm-c-sub">Empate no mata-mata — quem venceu no desempate?</p>
          <div className="gm-c-winner">
            {SIDES.map((side) => {
              const team = state[side]!;
              const on = winnerId !== null && winnerId === team.participantId;
              return (
                <button key={side} type="button" className={`gm-c-person ${on ? "on" : ""}`} style={{ minHeight: 56 }} aria-pressed={on} onClick={() => setWinnerId(team.participantId)}>
                  <span className="gm-c-person-name">{team.name}</span>
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      <p className="gm-c-sub">Craque do jogo (opcional)</p>
      {SIDES.map((side) => {
        const athletes = desk?.roster[side] ?? [];
        if (athletes.length === 0) return null;
        return (
          <div key={side} className="gm-c-group">
            <h3 className="gm-c-group-title">{state[side]?.name}</h3>
            <PeoplePicker athletes={athletes} selectedId={mvpId} onPick={(athlete) => setMvpId((current) => (current === athlete.id ? null : athlete.id))} emptyMessage="" />
          </div>
        );
      })}
      {(desk?.roster.home.length ?? 0) + (desk?.roster.away.length ?? 0) === 0 ? <p className="gm-c-sheet-text">Sem atletas cadastrados — o craque pode ser escolhido depois na súmula.</p> : null}

      <div className="gm-c-row">
        <button type="button" className="gm-c-btn" onClick={onClose}>
          Voltar
        </button>
        <button type="button" className="gm-c-btn danger" disabled={busy || (askWinner && !winnerId)} onClick={() => void submit()}>
          {busy ? "Encerrando…" : "Encerrar jogo"}
        </button>
      </div>
    </Sheet>
  );
}
