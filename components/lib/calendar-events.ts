import type { CompetitionSnapshot, MatchView } from "../../contracts/types";
import { indexes, matchesOf } from "../../shared/derive";
import { getSportProfile } from "../../shared/sport-profiles";
import { buildMatchCalendarEvent, googleCalendarUrl, matchDurationMinutes, shouldOfferCalendar, type CalendarEvent } from "../../shared/calendar";
import { PATHS } from "../../shared/paths";
import { matchContext, modalityLabel, sideInfo } from "./match-info";

// Eventos de agenda a partir do snapshot (feed de assinatura, .ics de um jogo e o menu "Adicionar à
// agenda"). Só jogos agendados com data; cancelados/encerrados ficam fora.

export function matchCalendarEvent(snapshot: CompetitionSnapshot, match: MatchView, origin: string): CalendarEvent | null {
  const { modality, stageLabel } = matchContext(snapshot, match);
  const profile = getSportProfile(modality?.sportProfile ?? "pontos");
  return buildMatchCalendarEvent({
    matchId: match.id,
    competitionName: snapshot.competition.name,
    modalityLabel: modality ? modalityLabel(modality) : null,
    homeName: sideInfo(snapshot, match, "home").name,
    awayName: sideInfo(snapshot, match, "away").name,
    stageLabel,
    scheduledDate: match.scheduledDate,
    scheduledTime: match.scheduledTime,
    venue: match.venue,
    durationMinutes: matchDurationMinutes(modality?.rules.periodMinutes ?? 0, modality?.rules.periodCount ?? 0, profile.clock.enabled),
    url: `${origin}${PATHS.match(match.id)}`,
  });
}

export function scheduledCalendarEvents(snapshot: CompetitionSnapshot, origin: string): CalendarEvent[] {
  return matchesOf(snapshot)
    .filter((match) => match.status === "scheduled" || match.status === "live")
    .map((match) => matchCalendarEvent(snapshot, match, origin))
    .filter((event): event is CalendarEvent => event !== null);
}

export type MatchCalendarLinks = { google: string; ics: string };

// Os dois destinos do "Adicionar à agenda"; null = jogo sem data, já disputado ou passado.
export function matchCalendarLinks(snapshot: CompetitionSnapshot, match: MatchView, origin: string, now: number): MatchCalendarLinks | null {
  if (!shouldOfferCalendar(match.scheduledDate, match.scheduledTime, match.status === "scheduled", now)) return null;
  const event = matchCalendarEvent(snapshot, match, origin);
  return event ? { google: googleCalendarUrl(event), ics: PATHS.matchCalendar(match.id) } : null;
}

export function findMatch(snapshot: CompetitionSnapshot, matchId: string): MatchView | null {
  return indexes(snapshot).matches.get(matchId) ?? null;
}
