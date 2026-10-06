import { isUuid } from "../../../shared/ids";

// Normalização de input das Server Actions: tudo que chega do client é `unknown` até passar por
// aqui (o client pode ser uma aba antiga ou uma chamada forjada).

export function text(raw: unknown, max: number): string {
  return typeof raw === "string" ? raw.trim().slice(0, max) : "";
}

export function optText(raw: unknown, max: number): string | null {
  const value = text(raw, max);
  return value ? value : null;
}

export function optUuid(raw: unknown): string | null {
  return isUuid(raw) ? raw : null;
}

export function bool(raw: unknown): boolean {
  return raw === true || raw === "true" || raw === "on" || raw === "1";
}

export function finite(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const value = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

export function intIn(raw: unknown, min: number, max: number, fallback: number): number {
  const value = finite(raw);
  if (value === null) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function optInt(raw: unknown, min: number, max: number): number | null {
  const value = finite(raw);
  if (value === null) return null;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function oneOf<T extends string>(raw: unknown, allowed: readonly T[]): T | null {
  return typeof raw === "string" && (allowed as readonly string[]).includes(raw) ? (raw as T) : null;
}

export function uuidList(raw: unknown, max = 500): string[] | null {
  if (!Array.isArray(raw) || raw.length > max) return null;
  return raw.every(isUuid) ? [...new Set(raw as string[])] : null;
}

// Tabela de pontos por colocação: números finitos ≥ 0, no máximo 64 posições.
export function pointsList(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length > 64) return null;
  const values = raw.map((value) => finite(value));
  if (values.some((value) => value === null || value < 0 || value > 100_000)) return null;
  return values as number[];
}

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function optHex(raw: unknown): string | null {
  const value = text(raw, 7);
  return HEX.test(value) ? value : null;
}
