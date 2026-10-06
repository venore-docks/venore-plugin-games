import type { MatchView } from "../../contracts/types";
import { formatMatchDate, todayInSite } from "../../shared/timezone";

// Agrupamento da agenda em abas (por dia ou por rodada) — puro. A aba aberta por padrão é a de hoje
// ou, sem jogo hoje, a próxima com jogo; se tudo já passou, a última.

export type ScheduleGroup = { key: string; label: string; matches: MatchView[] };

const NO_DATE = "sem-data";

export function groupByDay(matches: MatchView[]): ScheduleGroup[] {
  const groups = new Map<string, ScheduleGroup>();
  for (const match of matches) {
    const key = match.scheduledDate ?? NO_DATE;
    const group = groups.get(key) ?? { key, label: key === NO_DATE ? "A definir" : formatMatchDate(key, null), matches: [] };
    group.matches.push(match);
    groups.set(key, group);
  }
  // Datas ISO ordenam como texto; "sem data" vai pro fim.
  return [...groups.values()].sort((a, b) => (a.key === NO_DATE ? 1 : b.key === NO_DATE ? -1 : a.key.localeCompare(b.key)));
}

// Rodada: pontos corridos usam roundNumber ("1ª rodada"); mata-mata, o rótulo da fase ("Semifinal").
export function groupByRound(matches: MatchView[]): ScheduleGroup[] {
  const groups = new Map<string, ScheduleGroup & { order: number }>();
  matches.forEach((match, position) => {
    const label = match.isThirdPlace ? "3º lugar" : (match.roundLabel ?? (match.roundNumber !== null ? `${match.roundNumber}ª rodada` : "Jogos"));
    const key = `${match.stageId ?? "x"}:${match.roundNumber ?? match.bracketRound ?? label}:${match.isThirdPlace ? "3" : ""}`;
    const group = groups.get(key) ?? { key, label, matches: [], order: position };
    group.matches.push(match);
    groups.set(key, group);
  });
  return [...groups.values()].sort((a, b) => a.order - b.order).map(({ order: _order, ...group }) => group);
}

export function defaultGroupKey(groups: ScheduleGroup[], now: number, mode: "day" | "round"): string | null {
  if (groups.length === 0) return null;
  if (mode === "day") {
    const today = todayInSite(now);
    const next = groups.find((group) => group.key !== NO_DATE && group.key >= today);
    const dated = groups.filter((group) => group.key !== NO_DATE);
    return (next ?? dated[dated.length - 1] ?? groups[0]).key;
  }
  const pending = groups.find((group) => group.matches.some((match) => match.status === "scheduled" || match.status === "live"));
  return (pending ?? groups[groups.length - 1]).key;
}

// "Hoje · 15:00", "Amanhã · 09:30", "Em 3 dias", ou a data ("sáb, 12/10 · 10:30") — contagem no
// fuso do site, calculada no servidor (sem relógio no cliente: não muda de dia durante a visita).
export function relativeMatchLabel(date: string | null, time: string | null, now: number): string {
  if (!date) return "Data a definir";
  const today = todayInSite(now);
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  const hour = time ? ` · ${time.slice(0, 5)}` : "";
  if (days === 0) return `Hoje${hour}`;
  if (days === 1) return `Amanhã${hour}`;
  if (days > 1 && days <= 6) return `Em ${days} dias · ${formatMatchDate(date, time)}`;
  return formatMatchDate(date, time);
}
