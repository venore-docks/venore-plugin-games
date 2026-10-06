"use client";

import { cn } from "@venore/plugin-sdk/ui";
import type { LiveMatchState } from "../contracts/types";
import { useLiveState, useNow } from "../shared/use-live-state";
import { elapsedMs, formatClock } from "../shared/clock";
import { formatScore } from "../shared/score";
import { getSportProfile } from "../shared/sport-profiles";

// Placar ao vivo no site (página do jogo e cards de "ao vivo"). Só é montado quando o jogo está ao
// vivo num canal — polling do JSON de /api/games/live a cada 5s (cache curto na CDN absorve o pico);
// jogo agendado/encerrado nunca monta isto, então não há polling à toa.

const POLL_MS = 5000;

function periodText(state: LiveMatchState): string | null {
  if (state.label.trim()) return state.label.trim();
  const profile = getSportProfile(state.sportProfile ?? "pontos");
  if (!profile.clock.enabled || !profile.clock.periodLabel) return null;
  return `${state.period}º ${profile.clock.periodLabel}`;
}

function Clock({ state, offsetMs }: { state: LiveMatchState; offsetMs: number }) {
  const now = useNow(offsetMs);
  const profile = getSportProfile(state.sportProfile ?? "pontos");
  if (!profile.clock.enabled || now === 0) return null;
  return <span className="tabular-nums">{formatClock(elapsedMs(state.clock, now))}</span>;
}

export function LiveScore({
  initial,
  channelKey,
  matchId,
  size = "md",
}: {
  initial: LiveMatchState;
  channelKey: string;
  matchId: string;
  size?: "sm" | "md" | "xl";
}) {
  const { state, online, clockOffsetMs } = useLiveState(initial, { channelKey, mode: "poll", pollMs: POLL_MS });
  // O canal passou pra outro jogo (este acabou): congela no último placar conhecido deste jogo.
  const current = state.matchId === matchId ? state : initial;
  const moved = state.matchId !== matchId;
  const home = current.home?.score ?? 0;
  const away = current.away?.score ?? 0;
  const period = moved ? null : periodText(current);

  const scoreClass = size === "xl" ? "text-5xl @md:text-6xl" : size === "md" ? "text-3xl" : "text-xl";
  return (
    <div className="flex flex-col items-center gap-1" aria-live="polite">
      <div className={cn("flex items-center gap-2 font-display font-extrabold tabular-nums leading-none text-foreground", scoreClass)}>
        <span>{formatScore(home)}</span>
        <span className="text-muted-foreground/56" aria-hidden="true">
          ×
        </span>
        <span className="sr-only">a</span>
        <span>{formatScore(away)}</span>
      </div>
      {current.currentSet && !moved && (
        <span className="text-xs font-semibold tabular-nums text-muted-foreground">
          Set atual {current.currentSet.home}–{current.currentSet.away}
        </span>
      )}
      {!moved && (
        <span className={cn("flex items-center gap-1.5 font-semibold text-destructive", size === "sm" ? "text-[0.7rem]" : "text-xs")}>
          <Clock state={current} offsetMs={clockOffsetMs} />
          {period && <span className="text-muted-foreground">{period}</span>}
          {!online && <span className="text-muted-foreground">· reconectando…</span>}
        </span>
      )}
      {moved && <span className="text-xs text-muted-foreground">Jogo encerrado — atualize a página</span>}
    </div>
  );
}
