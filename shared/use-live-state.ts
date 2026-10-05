"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { LiveMatchState } from "../contracts/types";

// Estado ao vivo no cliente: SSE com reconexão; sem SSE, polling do JSON (cache curto na CDN).
// "Sem sinal" só depois de OFFLINE_GRACE_MS sem nenhum dado — o fechamento proposital do SSE a cada
// ~4,5 min (teto da Vercel) não pisca mais "Sem sinal" no overlay.
const POLL_MS = 2000;
const OFFLINE_GRACE_MS = 8000;

export type LiveConnection = { state: LiveMatchState; online: boolean; clockOffsetMs: number };

export function useLiveState(initial: LiveMatchState, options: { channelKey: string; mode?: "sse" | "poll"; pollMs?: number }): LiveConnection {
  const [state, setState] = useState(initial);
  const [online, setOnline] = useState(true);
  // Diferença servidor − cliente: relógio e destaque de ponto usam o "agora" do servidor.
  const [clockOffsetMs, setClockOffsetMs] = useState(() => initial.serverNow - Date.now());
  const lastDataAt = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let source: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    const query = `?canal=${encodeURIComponent(options.channelKey)}`;
    lastDataAt.current = Date.now();

    const accept = (next: LiveMatchState) => {
      if (cancelled) return;
      lastDataAt.current = Date.now();
      setOnline(true);
      setClockOffsetMs(next.serverNow - Date.now());
      setState((current) => (next.version >= current.version || next.matchId !== current.matchId ? next : current));
    };

    const poll = async () => {
      try {
        const response = await fetch(`/api/games/live${query}`, { cache: "no-store" });
        if (response.ok) accept((await response.json()) as LiveMatchState);
      } catch {
        /* próximo ciclo tenta de novo */
      }
    };

    const startPolling = () => {
      if (pollTimer) return;
      pollTimer = setInterval(() => void poll(), options.pollMs ?? POLL_MS);
    };
    const stopPolling = () => {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    };

    if (options.mode === "poll" || typeof EventSource === "undefined") {
      void poll();
      startPolling();
    } else {
      source = new EventSource(`/api/games/live/stream${query}`);
      source.onmessage = (event) => {
        try {
          accept(JSON.parse(event.data) as LiveMatchState);
          stopPolling();
        } catch {
          /* mensagem malformada */
        }
      };
      // Ping do servidor a cada 5s: prova de vida mesmo sem lance (jogo parado, canal ocioso).
      source.addEventListener("ping", () => {
        lastDataAt.current = Date.now();
        setOnline(true);
      });
      // EventSource reconecta sozinho; polling cobre o intervalo.
      source.onerror = () => startPolling();
    }

    const watchdog = setInterval(() => {
      if (Date.now() - lastDataAt.current > OFFLINE_GRACE_MS) setOnline(false);
    }, 1000);

    return () => {
      cancelled = true;
      source?.close();
      stopPolling();
      clearInterval(watchdog);
    };
  }, [options.channelKey, options.mode, options.pollMs]);

  return { state, online, clockOffsetMs };
}

// Tick de relógio sem setState por render: componentes que mostram o tempo corrido assinam isto.
const tickListeners = new Set<() => void>();
let tickTimer: ReturnType<typeof setInterval> | null = null;

function subscribeTick(listener: () => void) {
  tickListeners.add(listener);
  if (!tickTimer) tickTimer = setInterval(() => tickListeners.forEach((fn) => fn()), 250);
  return () => {
    tickListeners.delete(listener);
    if (tickListeners.size === 0 && tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  };
}

export function useNow(offsetMs = 0): number {
  return useSyncExternalStore(
    subscribeTick,
    () => Math.floor((Date.now() + offsetMs) / 250) * 250,
    () => 0,
  );
}
