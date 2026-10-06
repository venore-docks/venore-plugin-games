"use client";

import { useState } from "react";
import type { LiveMatchState } from "../../../contracts/types";
import { formatScore } from "../../../shared/score";
import { releaseChannelAction, setTeaserAction, startMatchAction, startQuickMatchAction } from "./actions";
import type { ControlOps } from "./ops";
import type { ControlActionResult, PickerGroup, PickerMatch, QuickModality } from "./types";

// Canal livre (ou com jogo já encerrado): prévia no overlay, escolher jogo agendado, jogo rápido.

const BUSY_CODE = "games.channel.busy";

function useStarter(ops: ControlOps) {
  // Canal ocupado por outro jogo ao vivo: o runtime recusa (games.channel.busy) e só troca com
  // confirmação explícita — reenvia com force.
  return async function start(key: string, action: (force: boolean) => Promise<ControlActionResult>, force = false): Promise<void> {
    const result = await ops.run(key, () => action(force), { refresh: true, silentCodes: [BUSY_CODE] });
    if (!result) return;
    if (!result.ok && result.code === BUSY_CODE) {
      ops.confirm({
        title: "Já tem jogo ao vivo neste canal",
        message: `${result.message} O jogo atual continua "ao vivo" e sai do overlay.`,
        confirmLabel: "Trocar de jogo",
        tone: "danger",
        onConfirm: () => void start(key, action, true),
      });
      return;
    }
    if (result.ok) ops.toast("Jogo no ar!", "ok");
  };
}

export function FinishedPanel({ state, ops, adminMatchHref }: { state: LiveMatchState; ops: ControlOps; adminMatchHref: string | null }) {
  const home = state.home;
  const away = state.away;
  return (
    <section className="gm-c-card gm-c-final" aria-label="Jogo encerrado">
      <h2 className="gm-c-card-title">{state.status === "finished" ? "Jogo encerrado" : "Jogo fora de andamento"}</h2>
      {home && away ? (
        <div className="gm-c-final-score">
          <span className="gm-c-final-team" style={{ textAlign: "right" }}>
            {home.shortName || home.name}
          </span>
          <span className="gm-c-final-num">
            {formatScore(home.score)} × {formatScore(away.score)}
          </span>
          <span className="gm-c-final-team" style={{ textAlign: "left" }}>
            {away.shortName || away.name}
          </span>
        </div>
      ) : null}
      <p className="gm-c-hint">O placar final continua no overlay até liberar o canal ou pôr outro jogo no ar.</p>
      <div className="gm-c-row" style={{ width: "100%" }}>
        <button type="button" className="gm-c-btn primary" disabled={ops.isBusy("release")} onClick={() => void ops.run("release", () => releaseChannelAction(ops.channelKey), { refresh: true })}>
          Liberar canal
        </button>
        {adminMatchHref ? (
          <a className="gm-c-btn" href={adminMatchHref}>
            Abrir súmula
          </a>
        ) : null}
      </div>
    </section>
  );
}

export function IdlePanel({ state, ops, pickerGroups, quickModalities }: { state: LiveMatchState; ops: ControlOps; pickerGroups: PickerGroup[]; quickModalities: QuickModality[] }) {
  const start = useStarter(ops);

  function pick(match: PickerMatch) {
    ops.confirm({
      title: match.live ? "Retomar este jogo?" : "Pôr este jogo no ar?",
      message: `${match.homeName} × ${match.awayName} no canal ${ops.channelName}.${match.live ? " Ele já está em andamento: placar e lances continuam de onde pararam." : ""}`,
      confirmLabel: match.live ? "Retomar" : "Começar jogo",
      onConfirm: () => void start(`start:${match.id}`, (force) => startMatchAction(ops.channelKey, match.id, force)),
    });
  }

  return (
    <>
      {state.matchId === null ? <TeaserCard state={state} ops={ops} /> : null}

      <section className="gm-c-card" aria-labelledby="gm-c-pick-title">
        <h2 className="gm-c-card-title" id="gm-c-pick-title">
          Escolher jogo
        </h2>
        {pickerGroups.length === 0 ? (
          <p className="gm-c-hint">Nenhum jogo agendado com as duas equipes definidas. Use o jogo rápido abaixo ou cadastre jogos no painel.</p>
        ) : (
          pickerGroups.map((group) => (
            <div key={group.modalityId} className="gm-c-group">
              <h3 className="gm-c-group-title">
                {group.emoji ? `${group.emoji} ` : ""}
                {group.modalityName}
              </h3>
              {group.matches.map((match) => (
                <button key={match.id} type="button" className="gm-c-match" disabled={ops.isBusy(`start:${match.id}`)} onClick={() => pick(match)}>
                  <span className="gm-c-match-teams">
                    {match.live ? <span className="gm-c-badge">AO VIVO</span> : null}
                    {match.homeName} × {match.awayName}
                  </span>
                  <span className="gm-c-match-meta">{[match.roundLabel, match.when].filter(Boolean).join(" · ")}</span>
                </button>
              ))}
            </div>
          ))
        )}
      </section>

      {quickModalities.length > 0 ? <QuickMatchCard ops={ops} modalities={quickModalities} onStart={start} /> : null}
    </>
  );
}

function TeaserCard({ state, ops }: { state: LiveMatchState; ops: ControlOps }) {
  const save = (teaser: string) => void ops.run("teaser", () => setTeaserAction(ops.channelKey, teaser)).then((result) => result?.ok && ops.toast(teaser ? "Prévia no overlay." : "Prévia removida.", "ok"));
  return (
    <section className="gm-c-card" aria-labelledby="gm-c-teaser-title">
      <h2 className="gm-c-card-title" id="gm-c-teaser-title">
        Prévia no overlay
      </h2>
      <p className="gm-c-hint">Enquanto o canal está livre, o overlay mostra este aviso (ex.: “Em breve: 9º A × 9º B”). Vazio = overlay transparente.</p>
      <form
        key={state.teaser ?? ""}
        className="gm-c-row"
        onSubmit={(event) => {
          event.preventDefault();
          const value = new FormData(event.currentTarget).get("teaser");
          save(typeof value === "string" ? value.trim() : "");
        }}
      >
        <input className="gm-c-input" name="teaser" defaultValue={state.teaser ?? ""} maxLength={80} placeholder="Texto da prévia" aria-label="Texto da prévia" style={{ flex: "1 1 100%" }} />
        <button type="submit" className="gm-c-btn primary" disabled={ops.isBusy("teaser")}>
          Mostrar
        </button>
        {state.teaser ? (
          <button type="button" className="gm-c-btn" disabled={ops.isBusy("teaser")} onClick={() => save("")}>
            Tirar
          </button>
        ) : null}
      </form>
    </section>
  );
}

function QuickMatchCard({ ops, modalities, onStart }: { ops: ControlOps; modalities: QuickModality[]; onStart: ReturnType<typeof useStarter> }) {
  const [modalityId, setModalityId] = useState(modalities[0].id);
  const [homeId, setHomeId] = useState("");
  const [awayId, setAwayId] = useState("");
  const modality = modalities.find((item) => item.id === modalityId) ?? modalities[0];
  const ready = Boolean(homeId && awayId && homeId !== awayId);
  const teamName = (id: string) => modality.teams.find((team) => team.id === id)?.name ?? "";

  return (
    <section className="gm-c-card" aria-labelledby="gm-c-quick-title">
      <h2 className="gm-c-card-title" id="gm-c-quick-title">
        Jogo rápido
      </h2>
      <p className="gm-c-hint">Amistoso fora da tabela (recreio, treino): não conta na classificação.</p>
      <label className="gm-c-field">
        Modalidade
        <select
          className="gm-c-select"
          value={modality.id}
          onChange={(event) => {
            setModalityId(event.target.value);
            setHomeId("");
            setAwayId("");
          }}
        >
          {modalities.map((item) => (
            <option key={item.id} value={item.id}>
              {item.emoji ? `${item.emoji} ` : ""}
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <div className="gm-c-row">
        <label className="gm-c-field">
          Equipe 1
          <select className="gm-c-select" value={homeId} onChange={(event) => setHomeId(event.target.value)}>
            <option value="">Escolher…</option>
            {modality.teams.map((team) => (
              <option key={team.id} value={team.id} disabled={team.id === awayId}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
        <label className="gm-c-field">
          Equipe 2
          <select className="gm-c-select" value={awayId} onChange={(event) => setAwayId(event.target.value)}>
            <option value="">Escolher…</option>
            {modality.teams.map((team) => (
              <option key={team.id} value={team.id} disabled={team.id === homeId}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        type="button"
        className="gm-c-btn primary block big"
        disabled={!ready || ops.isBusy("quick")}
        onClick={() =>
          ops.confirm({
            title: "Começar jogo rápido?",
            message: `${teamName(homeId)} × ${teamName(awayId)} (${modality.name}) no canal ${ops.channelName}.`,
            confirmLabel: "Começar",
            onConfirm: () => void onStart("quick", (force) => startQuickMatchAction(ops.channelKey, modality.id, homeId, awayId, force)),
          })
        }
      >
        Começar jogo rápido
      </button>
    </section>
  );
}
