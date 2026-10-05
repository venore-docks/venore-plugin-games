import { eq } from "drizzle-orm";
import { liveChannels } from "../database/schema";
import type { LiveMatchState } from "../contracts/types";
import { db } from "./db";
import { buildLiveState } from "./live-state";

// UM poller por processo (globalThis), não um por conexão SSE: a cada 1s lê só (id, versão) dos
// canais da competição — uma consulta minúscula — e, quando a versão de um canal muda, monta o
// estado UMA vez e entrega pra todas as conexões daquele canal. O plugin antigo fazia 4–5
// consultas por segundo POR conexão aberta. Sem assinantes, o poller para.

const POLL_MS = 1000;

type Listener = (state: LiveMatchState) => void;

type FeedState = {
  listeners: Map<string, Set<Listener>>; // chave: `${competitionId}:${channelKey}`
  versions: Map<string, number>;
  latest: Map<string, LiveMatchState>;
  timer: ReturnType<typeof setInterval> | null;
  polling: boolean;
};

type FeedGlobal = typeof globalThis & { __gamesLiveFeed?: FeedState };

function feed(): FeedState {
  const g = globalThis as FeedGlobal;
  if (!g.__gamesLiveFeed) g.__gamesLiveFeed = { listeners: new Map(), versions: new Map(), latest: new Map(), timer: null, polling: false };
  return g.__gamesLiveFeed;
}

function competitionsWithListeners(state: FeedState): Set<string> {
  const ids = new Set<string>();
  for (const [key, set] of state.listeners) if (set.size > 0) ids.add(key.split(":")[0]);
  return ids;
}

async function tick(): Promise<void> {
  const state = feed();
  if (state.polling) return;
  state.polling = true;
  try {
    for (const competitionId of competitionsWithListeners(state)) {
      const rows = await db.select().from(liveChannels).where(eq(liveChannels.competitionId, competitionId));
      for (const row of rows) {
        const key = `${competitionId}:${row.key}`;
        const listeners = state.listeners.get(key);
        if (!listeners || listeners.size === 0) continue;
        if (state.versions.get(key) === row.version && state.latest.has(key)) continue;
        const live = await buildLiveState(competitionId, row);
        state.versions.set(key, row.version);
        state.latest.set(key, live);
        for (const listener of listeners) listener(live);
      }
    }
  } catch (error) {
    console.error("[games] live feed tick failed", error);
  } finally {
    state.polling = false;
  }
}

export function subscribeLive(competitionId: string, channelKey: string, listener: Listener): () => void {
  const state = feed();
  const key = `${competitionId}:${channelKey}`;
  let set = state.listeners.get(key);
  if (!set) {
    set = new Set();
    state.listeners.set(key, set);
  }
  set.add(listener);
  if (!state.timer) state.timer = setInterval(() => void tick(), POLL_MS);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) {
      state.listeners.delete(key);
      state.versions.delete(key);
      state.latest.delete(key);
    }
    if (state.listeners.size === 0 && state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
  };
}
