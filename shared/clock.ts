import type { LiveClock } from "../contracts/types";

// Relógio crescente. O estado guarda só {running, anchorMs, accumulatedMs}; o cliente calcula o
// tempo decorrido localmente, corrigido pela diferença entre o relógio dele e o do servidor
// (serverNow do snapshot ao vivo) — sem isso, máquina sem NTP mostrava o tempo errado e o destaque
// de gol podia nem aparecer.

export type ClockCommand =
  | { kind: "start" }
  | { kind: "pause" }
  | { kind: "reset" }
  | { kind: "set"; elapsedMs: number }
  | { kind: "adjust"; deltaMs: number };

export function isClockCommand(value: unknown): value is ClockCommand {
  if (!value || typeof value !== "object") return false;
  const command = value as Record<string, unknown>;
  switch (command.kind) {
    case "start":
    case "pause":
    case "reset":
      return true;
    case "set":
      return typeof command.elapsedMs === "number" && Number.isFinite(command.elapsedMs);
    case "adjust":
      return typeof command.deltaMs === "number" && Number.isFinite(command.deltaMs);
    default:
      return false;
  }
}

export function elapsedMs(clock: LiveClock, nowMs: number): number {
  if (!clock.running || clock.anchorMs === null) return Math.max(0, clock.accumulatedMs);
  return Math.max(0, clock.accumulatedMs + (nowMs - clock.anchorMs));
}

export function applyClockCommand(clock: LiveClock, command: ClockCommand, nowMs: number): LiveClock {
  const current = elapsedMs(clock, nowMs);
  switch (command.kind) {
    case "start":
      return clock.running ? clock : { running: true, anchorMs: nowMs, accumulatedMs: current };
    case "pause":
      return { running: false, anchorMs: null, accumulatedMs: current };
    case "reset":
      return { running: false, anchorMs: null, accumulatedMs: 0 };
    case "set":
      return { running: clock.running, anchorMs: clock.running ? nowMs : null, accumulatedMs: Math.max(0, Math.round(command.elapsedMs)) };
    case "adjust":
      return { running: clock.running, anchorMs: clock.running ? nowMs : null, accumulatedMs: Math.max(0, current + Math.round(command.deltaMs)) };
  }
}

export function formatClock(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
