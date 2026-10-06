import { fixtureEpoch, SITE_TIMEZONE } from "./timezone";

// "Adicionar à agenda" dos jogos agendados — sem banco nem next/*: monta o evento a partir do jogo e
// serializa em .ics (iPhone/Outlook/qualquer app de agenda, e o feed de assinatura com todos os
// jogos) ou em link do Google Agenda (Android não abre .ics sozinho). Os eventos saem do snapshot em
// components/lib/calendar-events.ts; rotas em routes/api/calendar-feed.ts e match-calendar.ts.

export type CalendarEvent = {
  // Estável por jogo: reimportar/atualizar o feed troca o evento em vez de duplicar.
  uid: string;
  title: string;
  // Com hora marcada: início/fim em epoch ms. Sem hora ("dia marcado, horário a definir"): dia
  // inteiro — nunca um "00:00" inventado.
  when: { kind: "timed"; startMs: number; endMs: number } | { kind: "allDay"; date: string };
  description: string;
  location: string | null;
  url: string | null;
};

export type MatchCalendarInput = {
  matchId: string;
  // "Erasto Games 2026" — prefixo do título (quem assina vários calendários sabe de onde é o evento).
  competitionName: string;
  // "⚽ Futsal" (emoji opcional da modalidade).
  modalityLabel: string | null;
  homeName: string;
  awayName: string;
  // "Grupo A · 2ª rodada", "Semifinal"...
  stageLabel: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  venue: string | null;
  durationMinutes: number;
  // Página do jogo (absoluta).
  url: string | null;
};

// null = jogo sem data — não tem o que pôr na agenda.
export function buildMatchCalendarEvent(input: MatchCalendarInput): CalendarEvent | null {
  if (!input.scheduledDate) return null;
  const versus = `${input.homeName} × ${input.awayName}`;
  const title = input.modalityLabel ? `${input.modalityLabel}: ${versus}` : versus;
  const description = [input.competitionName, input.stageLabel, input.url ? `Acompanhe: ${input.url}` : null].filter(Boolean).join("\n");
  const uid = `match-${input.matchId}@games`;
  const base = { uid, title, description, location: input.venue, url: input.url };

  const startMs = input.scheduledTime ? fixtureEpoch(input.scheduledDate, input.scheduledTime) : null;
  if (startMs === null) return { ...base, when: { kind: "allDay", date: input.scheduledDate } };
  return { ...base, when: { kind: "timed", startMs, endMs: startMs + input.durationMinutes * 60_000 } };
}

// Duração do evento: tempos × minutos da modalidade + 10 min de intervalo/margem; modalidade sem
// relógio (vôlei, e-sports) ganha 1h fixa.
export function matchDurationMinutes(periodMinutes: number, periodCount: number, hasClock: boolean): number {
  if (!hasClock || periodMinutes <= 0 || periodCount <= 0) return 60;
  return Math.round(periodMinutes * periodCount) + 10;
}

function pad(value: number, size = 2): string {
  return String(value).padStart(size, "0");
}

// 20260925T133000Z
function formatUtcStamp(epochMs: number): string {
  const d = new Date(epochMs);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

// "2026-09-25" -> "20260925"; nextDay=true -> "20260926" (fim exclusivo de evento de dia inteiro).
function formatDate(date: string, nextDay = false): string {
  const [year, month, day] = date.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + (nextDay ? 1 : 0)));
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

// RFC 5545 §3.3.11: \ ; , e quebra de linha escapados em TEXT.
function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// RFC 5545 §3.1: linha de no máximo 75 octetos, continuação com CRLF + espaço — contando BYTES
// UTF-8 (acento/emoji ocupam mais de um) sem partir um caractere no meio.
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (currentBytes + bytes > limit) {
      parts.push(current);
      current = "";
      currentBytes = 0;
    }
    current += char;
    currentBytes += bytes;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

function eventLines(event: CalendarEvent, stampMs: number): string[] {
  const lines = ["BEGIN:VEVENT", `UID:${event.uid}`, `DTSTAMP:${formatUtcStamp(stampMs)}`];
  if (event.when.kind === "timed") {
    lines.push(`DTSTART:${formatUtcStamp(event.when.startMs)}`, `DTEND:${formatUtcStamp(event.when.endMs)}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${formatDate(event.when.date)}`, `DTEND;VALUE=DATE:${formatDate(event.when.date, true)}`);
  }
  lines.push(`SUMMARY:${escapeText(event.title)}`);
  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  if (event.url) lines.push(`URL:${event.url}`);
  lines.push("END:VEVENT");
  return lines;
}

// Um ou vários eventos num VCALENDAR. `feedName` marca o calendário de assinatura (nome + intervalo
// de atualização que Apple/Outlook/Google respeitam) — o arquivo de um jogo só não precisa disso.
export function toIcs(events: CalendarEvent[], options: { feedName?: string; now?: number } = {}): string {
  const stampMs = options.now ?? Date.now();
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Venore Docks//Games//PT-BR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  if (options.feedName) {
    lines.push(`X-WR-CALNAME:${escapeText(options.feedName)}`, `X-WR-TIMEZONE:${SITE_TIMEZONE}`, "REFRESH-INTERVAL;VALUE=DURATION:PT6H", "X-PUBLISHED-TTL:PT6H");
  }
  for (const event of events) lines.push(...eventLines(event, stampMs));
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

// Link "adicionar evento" do Google Agenda (abre já preenchido, a pessoa só confirma).
export function googleCalendarUrl(event: CalendarEvent): string {
  const dates =
    event.when.kind === "timed"
      ? `${formatUtcStamp(event.when.startMs)}/${formatUtcStamp(event.when.endMs)}`
      : `${formatDate(event.when.date)}/${formatDate(event.when.date, true)}`;
  const params = new URLSearchParams({ action: "TEMPLATE", text: event.title, dates, details: event.description, ctz: SITE_TIMEZONE });
  if (event.location) params.set("location", event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// Assinatura do feed com todos os jogos: webcal:// abre "assinar calendário" no iPhone/Mac/Outlook;
// o Google Agenda assina pela própria URL via ?cid=.
export function calendarSubscriptionUrls(feedUrl: string): { webcal: string; google: string } {
  const webcal = feedUrl.replace(/^https?:\/\//, "webcal://");
  return { webcal, google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}` };
}

// Jogo que começou há mais de 3h (ou já foi disputado) não ganha "Adicionar à agenda" — mesma folga
// de shared/derive.ts upcomingMatches.
const CALENDAR_GRACE_MS = 3 * 60 * 60 * 1000;

export function shouldOfferCalendar(scheduledDate: string | null, scheduledTime: string | null, scheduled: boolean, now = Date.now()): boolean {
  const epoch = fixtureEpoch(scheduledDate, scheduledTime);
  return scheduled && epoch !== null && epoch + CALENDAR_GRACE_MS >= now;
}
