"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import type { LiveMatchState } from "../../../contracts/types";
import { PATHS } from "../../../shared/paths";
import { useLiveState } from "../../../shared/use-live-state";
import { accentVars } from "../live-style";
import { getMatchDeskAction } from "./actions";
import { CONTROL_CSS } from "./control-css";
import { FinishedPanel, IdlePanel } from "./idle-panel";
import { LivePanel } from "./live-panel";
import type { ControlOps, RunOptions } from "./ops";
import { ConfirmSheet, type ConfirmRequest } from "./sheets";
import type { BoostOption, ChannelOption, ControlActionResult, MatchDesk, PickerGroup, QuickModality } from "./types";

// Console do controle ao vivo (celular). Estado do canal: SSE (useLiveState) + respostas das
// actions — vale sempre o de maior versão, então uma resposta atrasada nunca desfaz um lance que
// já chegou pelo SSE (dois operadores, rede lenta).

type Toast = { id: number; text: string; tone: "error" | "ok" };

const subscribeNothing = () => () => {};

export function Console({
  initialState,
  initialDesk,
  channels,
  pickerGroups,
  quickModalities,
  boosts,
  competitionName,
  accentColor,
  accentInk,
  overlayPath,
  canManage,
}: {
  initialState: LiveMatchState;
  initialDesk: MatchDesk | null;
  channels: ChannelOption[];
  pickerGroups: PickerGroup[];
  quickModalities: QuickModality[];
  boosts: BoostOption[];
  competitionName: string;
  accentColor: string;
  accentInk: string;
  overlayPath: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const connection = useLiveState(initialState, { channelKey: initialState.channelKey });
  const [pushed, setPushed] = useState<LiveMatchState | null>(null);
  const state = pushed && pushed.channelKey === connection.state.channelKey && pushed.version > connection.state.version ? pushed : connection.state;

  const [busyKeys, setBusyKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [toast, setToast] = useState<Toast | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  // Elenco e lances com id: recarregados quando muda o jogo ou a versão do canal.
  const [deskState, setDesk] = useState<MatchDesk | null>(initialDesk);
  const desk = deskState && deskState.matchId === state.matchId ? deskState : null;
  const deskKey = useRef(initialDesk ? `${initialState.matchId}:${initialState.version}` : "");
  useEffect(() => {
    const matchId = state.matchId;
    if (!matchId) return;
    const key = `${matchId}:${state.version}`;
    if (deskKey.current === key) return;
    deskKey.current = key;
    let cancelled = false;
    getMatchDeskAction(matchId)
      .then((result) => {
        if (!cancelled && result.ok) setDesk(result.desk);
      })
      .catch(() => {
        // próxima versão tenta de novo
      });
    return () => {
      cancelled = true;
    };
  }, [state.matchId, state.version]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.tone === "error" ? 5000 : 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = useCallback((text: string, tone: "error" | "ok" = "error") => setToast({ id: Date.now(), text, tone }), []);

  const run = useCallback(
    async (key: string, action: () => Promise<ControlActionResult>, options?: RunOptions): Promise<ControlActionResult | null> => {
      setBusyKeys((current) => new Set(current).add(key));
      try {
        const result = await action();
        if (result.ok) {
          if (result.state) setPushed(result.state);
          if (options?.refresh) router.refresh();
        } else if (!options?.silentCodes?.includes(result.code ?? "")) {
          showToast(result.message);
        }
        return result;
      } catch {
        showToast("Sem conexão com o servidor. Confira a internet e tente de novo.");
        return null;
      } finally {
        setBusyKeys((current) => {
          const next = new Set(current);
          next.delete(key);
          return next;
        });
      }
    },
    [router, showToast],
  );

  const ops: ControlOps = useMemo(
    () => ({
      channelKey: state.channelKey,
      channelName: state.channelName,
      isBusy: (key: string) => busyKeys.has(key),
      run,
      toast: showToast,
      confirm: setConfirm,
    }),
    [state.channelKey, state.channelName, busyKeys, run, showToast],
  );

  // URL absoluta do overlay pro operador colar no OBS — a origem só existe no cliente.
  const overlayUrl = useSyncExternalStore(
    subscribeNothing,
    () => `${window.location.origin}${overlayPath}`,
    () => overlayPath,
  );

  const live = state.matchId !== null && state.status === "live";

  return (
    <>
      <style>{CONTROL_CSS}</style>
      <main className="gm-c" style={accentVars(accentColor, accentInk)}>
        <div className="gm-c-inner">
          <header className="gm-c-head">
            <h1 className="gm-c-title">
              <span className="gm-c-eyebrow">{competitionName}</span>
              <span className="gm-c-channel">{state.channelName}</span>
            </h1>
            <span className="gm-c-conn" role="status">
              <span className={`gm-c-dot ${connection.online ? "" : "off"}`} aria-hidden="true" />
              {connection.online ? (live ? "ao vivo" : "conectado") : "reconectando…"}
            </span>
          </header>

          {channels.length > 1 ? (
            <nav className="gm-c-channels" aria-label="Canais">
              {channels.map((channel) => (
                <a key={channel.key} href={PATHS.control(channel.key)} className={`gm-c-channel-chip ${channel.key === state.channelKey ? "on" : ""}`} aria-current={channel.key === state.channelKey ? "page" : undefined}>
                  {channel.name}
                </a>
              ))}
            </nav>
          ) : null}

          {live ? (
            <LivePanel state={state} desk={desk} clockOffsetMs={connection.clockOffsetMs} boosts={boosts} ops={ops} />
          ) : (
            <>
              {state.matchId ? <FinishedPanel state={state} ops={ops} adminMatchHref={canManage ? PATHS.admin.match(state.matchId) : null} /> : null}
              <IdlePanel state={state} ops={ops} pickerGroups={pickerGroups} quickModalities={quickModalities} />
            </>
          )}

          <p className="gm-c-foot">
            OBS → fonte de navegador: {overlayUrl}
          </p>
        </div>
      </main>

      {toast ? (
        <div key={toast.id} className={`gm-c-toast ${toast.tone === "ok" ? "ok" : ""}`} role={toast.tone === "error" ? "alert" : "status"} style={accentVars(accentColor, accentInk)}>
          {toast.text}
        </div>
      ) : null}

      {confirm ? (
        <div style={accentVars(accentColor, accentInk)}>
          <ConfirmSheet request={confirm} onClose={() => setConfirm(null)} />
        </div>
      ) : null}
    </>
  );
}
