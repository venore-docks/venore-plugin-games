// Horário de Brasília (UTC−3, sem horário de verão desde 2019). Data/hora de jogo são gravadas como
// texto puro ("YYYY-MM-DD" / "HH:mm") — este arquivo só converte pra ORDENAR e pra agenda (.ics),
// nunca na escrita.
export const SITE_UTC_OFFSET_MINUTES = -180;
export const SITE_TIMEZONE = "America/Sao_Paulo";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})(?::\d{2})?$/;

export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && DATE_RE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function isClockTime(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = TIME_RE.exec(value);
  return Boolean(match && Number(match[1]) < 24 && Number(match[2]) < 60);
}

// Epoch (ms) do horário local do site. Sem hora = meio-dia (só pra ordenar dentro do dia).
export function fixtureEpoch(date: string | null, time: string | null): number | null {
  if (!date) return null;
  const dateMatch = DATE_RE.exec(date);
  if (!dateMatch) return null;
  const timeMatch = time ? TIME_RE.exec(time) : null;
  const hours = timeMatch ? Number(timeMatch[1]) : 12;
  const minutes = timeMatch ? Number(timeMatch[2]) : 0;
  const utc = Date.UTC(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]), hours, minutes);
  return utc - SITE_UTC_OFFSET_MINUTES * 60 * 1000;
}

// "Hoje" no fuso do site (YYYY-MM-DD) — usado como default de formulário.
export function todayInSite(now = Date.now()): string {
  return new Date(now + SITE_UTC_OFFSET_MINUTES * 60 * 1000).toISOString().slice(0, 10);
}

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

// "sáb, 12/10 · 10:30" / "12/10" / "Data a definir".
export function formatMatchDate(date: string | null, time: string | null): string {
  if (!date || !DATE_RE.test(date)) return "Data a definir";
  const [, year, month, day] = DATE_RE.exec(date)!;
  const weekday = WEEKDAYS[new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).getUTCDay()];
  const base = `${weekday}, ${day}/${month}`;
  return time ? `${base} · ${time.slice(0, 5)}` : base;
}
