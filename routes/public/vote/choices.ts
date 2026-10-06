import type { CompetitionSnapshot, MatchView } from "../../../contracts/types";
import { indexes } from "../../../shared/derive";
import type { VoteChoice } from "../../../components/vote-bars";
import { sideInfo } from "../../../components/lib/match-info";
import type { BallotSection } from "./ballot";

// Opções de voto montadas do snapshot (atletas das duas equipes do jogo / equipes da competição).

export function matchBallotSections(snapshot: CompetitionSnapshot, match: MatchView): BallotSection[] {
  const index = indexes(snapshot);
  return (["home", "away"] as const).map((side) => {
    const info = sideInfo(snapshot, match, side);
    const athletes = info.participant ? [...(index.athletesByParticipant.get(info.participant.id) ?? [])] : [];
    athletes.sort((a, b) => (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name, "pt-BR"));
    return {
      key: side,
      title: info.name,
      color: info.color,
      options: athletes.map((athlete) => ({
        id: athlete.id,
        name: athlete.name,
        imageUrl: athlete.photoUrl,
        caption: [athlete.number !== null ? `#${athlete.number}` : null, athlete.position, athlete.isCaptain ? "Capitão" : null].filter(Boolean).join(" · ") || null,
        color: info.color,
      })),
    };
  });
}

export function participantBallotSections(snapshot: CompetitionSnapshot): BallotSection[] {
  const participants = [...snapshot.participants].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR"));
  return [
    {
      key: "participants",
      title: "Equipes",
      color: null,
      options: participants.map((participant) => ({
        id: participant.id,
        name: participant.name,
        imageUrl: participant.crestUrl,
        caption: participant.shortName && participant.shortName !== participant.name ? participant.shortName : null,
        color: participant.primaryColor,
      })),
    },
  ];
}

export function choicesFromSections(sections: BallotSection[]): VoteChoice[] {
  return sections.flatMap((section) =>
    section.options.map((option) => ({ id: option.id, name: option.name, imageUrl: option.imageUrl, color: option.color, caption: section.key === "participants" ? null : section.title })),
  );
}
