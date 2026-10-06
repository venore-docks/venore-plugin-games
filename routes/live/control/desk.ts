import type { CompetitionSnapshot, MatchView } from "../../../contracts/types";
import { indexes, liveMatches, upcomingMatches } from "../../../shared/derive";
import { getSportProfile } from "../../../shared/sport-profiles";
import { formatMatchDate } from "../../../shared/timezone";
import type { DeskAthlete, MatchDesk, PickerGroup, QuickModality } from "./types";

// Derivações do snapshot usadas só pelo controle. Sem banco: a página e as actions passam o
// snapshot já carregado (runtime/snapshot.ts).

const RECENT_EVENTS = 20;

function deskAthletes(snapshot: CompetitionSnapshot, participantId: string | null): DeskAthlete[] {
  if (!participantId) return [];
  return (indexes(snapshot).athletesByParticipant.get(participantId) ?? [])
    .map((athlete) => ({ id: athlete.id, name: athlete.name, number: athlete.number, photoUrl: athlete.photoUrl }))
    .sort((a, b) => (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name, "pt-BR"));
}

export function buildMatchDesk(snapshot: CompetitionSnapshot, matchId: string): MatchDesk | null {
  const index = indexes(snapshot);
  const match = index.matches.get(matchId);
  if (!match) return null;
  const modality = index.modalities.get(match.modalityId);
  const profile = getSportProfile(modality?.sportProfile ?? "pontos");
  const stage = modality?.stages.find((item) => item.id === match.stageId);
  const kinds = new Map(profile.eventKinds.map((kind) => [kind.key, kind]));
  const events = (index.eventsByMatch.get(match.id) ?? [])
    .slice(-RECENT_EVENTS)
    .reverse()
    .map((event) => {
      const kind = kinds.get(event.kind);
      return {
        id: event.id,
        side: event.side,
        kind: event.kind,
        label: kind?.label ?? event.kind,
        emoji: kind?.emoji ?? "•",
        scores: Boolean(kind?.scores) && event.amount > 0,
        amount: event.amount,
        athleteId: event.athleteId,
        athleteName: event.athleteId ? (index.athletes.get(event.athleteId)?.name ?? null) : null,
        clockMs: event.clockMs,
        period: event.period,
      };
    });
  return {
    matchId: match.id,
    allowHalfPoints: modality?.rules.allowHalfPoints ?? false,
    periodMinutes: modality?.rules.periodMinutes ?? 0,
    tieNeedsWinner: stage?.type === "knockout" && (modality?.rules.knockoutNeedsWinner ?? true),
    homeId: match.homeId,
    awayId: match.awayId,
    roster: { home: deskAthletes(snapshot, match.homeId), away: deskAthletes(snapshot, match.awayId) },
    events,
    sets: match.sets,
    mvpAthleteId: match.mvpAthleteId,
  };
}

function sideName(snapshot: CompetitionSnapshot, id: string | null, fallback: string | null): string {
  const participant = id ? indexes(snapshot).participants.get(id) : undefined;
  return participant?.shortName || participant?.name || fallback || "A definir";
}

// Jogos que dá pra pôr no ar: modalidade de placar, as duas equipes definidas. Inclui jogo "ao
// vivo" que não está em canal nenhum (aba fechada no meio do jogo) pra poder retomá-lo.
export function buildPickerGroups(snapshot: CompetitionSnapshot, now: number): PickerGroup[] {
  const index = indexes(snapshot);
  const onChannel = new Set(snapshot.channels.map((channel) => channel.currentMatchId).filter(Boolean));
  const playable = (match: MatchView) => {
    const modality = index.modalities.get(match.modalityId);
    return Boolean(modality && getSportProfile(modality.sportProfile).shape === "match" && match.homeId && match.awayId);
  };
  const orphanLive = liveMatches(snapshot).filter((match) => !onChannel.has(match.id) && playable(match));
  const scheduled = upcomingMatches(snapshot, now).filter(playable);
  const groups = new Map<string, PickerGroup>();
  for (const match of [...orphanLive, ...scheduled]) {
    const modality = index.modalities.get(match.modalityId)!;
    let group = groups.get(modality.id);
    if (!group) {
      group = { modalityId: modality.id, modalityName: modality.name, emoji: modality.emoji, matches: [] };
      groups.set(modality.id, group);
    }
    if (group.matches.length >= 30) continue;
    group.matches.push({
      id: match.id,
      homeName: sideName(snapshot, match.homeId, match.homeLabel),
      awayName: sideName(snapshot, match.awayId, match.awayLabel),
      roundLabel: match.roundLabel,
      when: formatMatchDate(match.scheduledDate, match.scheduledTime),
      live: match.status === "live",
    });
  }
  const order = new Map(snapshot.modalities.map((modality) => [modality.id, modality.sortOrder]));
  return [...groups.values()].sort((a, b) => (order.get(a.modalityId) ?? 0) - (order.get(b.modalityId) ?? 0));
}

// "Jogo rápido": modalidades de placar e as equipes inscritas nelas (sem inscrição = todas).
export function buildQuickModalities(snapshot: CompetitionSnapshot): QuickModality[] {
  const index = indexes(snapshot);
  const allTeams = [...snapshot.participants]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR"))
    .map((participant) => ({ id: participant.id, name: participant.name }));
  return [...snapshot.modalities]
    .filter((modality) => getSportProfile(modality.sportProfile).shape === "match")
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((modality) => {
      const entered = modality.entries
        .map((entry) => index.participants.get(entry.participantId))
        .filter((participant): participant is NonNullable<typeof participant> => Boolean(participant))
        .map((participant) => ({ id: participant.id, name: participant.name }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      return { id: modality.id, name: modality.name, emoji: modality.emoji, teams: entered.length >= 2 ? entered : allTeams };
    })
    .filter((modality) => modality.teams.length >= 2);
}
