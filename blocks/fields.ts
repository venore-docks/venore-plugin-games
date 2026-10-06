import type { CompetitionSnapshot, ModalityView, ParticipantView } from "../contracts/types";
import { indexes } from "../shared/derive";

// Leitura defensiva de block.data (jsonb editado no page-builder — pode vir qualquer coisa de uma
// versão antiga do bloco ou de importação).

type Data = Record<string, unknown>;

export function text(data: Data, key: string, fallback = ""): string {
  const value = data[key];
  return typeof value === "string" ? value.trim() : fallback;
}

export function int(data: Data, key: string, min: number, max: number, fallback: number): number {
  const raw = data[key];
  const value = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function bool(data: Data, key: string, fallback: boolean): boolean {
  const value = data[key];
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

export function oneOf<T extends string>(data: Data, key: string, allowed: readonly T[], fallback: T): T {
  const value = data[key];
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

// Link editável: só caminho interno ("/agenda") ou http(s) — nunca "javascript:".
export function href(data: Data, key: string, fallback: string | null): string | null {
  const value = text(data, key);
  if (!value) return fallback;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return /^https?:\/\//i.test(value) ? value : fallback;
}

// Campo "Modalidade (slug, vazio = todas)": vazio → todas; slug desconhecido → `missing` (o modo de
// edição avisa; o publicado cai pra "todas" em vez de sumir).
export function modalityFilter(snapshot: CompetitionSnapshot, data: Data, key = "modality"): { modality: ModalityView | null; missing: string | null } {
  const slug = text(data, key).toLowerCase();
  if (!slug) return { modality: null, missing: null };
  const modality = indexes(snapshot).modalitiesBySlug.get(slug) ?? null;
  return { modality, missing: modality ? null : slug };
}

export function participantBySlug(snapshot: CompetitionSnapshot, data: Data, key = "participant"): ParticipantView | null {
  const slug = text(data, key).toLowerCase();
  return slug ? (indexes(snapshot).participantsBySlug.get(slug) ?? null) : null;
}
