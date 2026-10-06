import type { CompetitionSnapshot, MatchSide, MatchStatus, MatchView, ModalityView, ParticipantView, StageView } from "../../contracts/types";
import { indexes } from "../../shared/derive";
import { describeSlotSource } from "../../shared/tournament";
import { formatScore } from "../../shared/score";
import { getSportProfile } from "../../shared/sport-profiles";
import { PATHS } from "../../shared/paths";

// Rótulos de jogo derivados do snapshot — puros (servem a páginas, blocos, agenda e metadata).

export type SideInfo = {
  participant: ParticipantView | null;
  name: string;
  shortName: string;
  color: string | null;
  crestUrl: string | null;
  href: string | null;
};

// Lado sem equipe definida (mata-mata esperando origem): rótulo gravado ou a origem ("Vencedor J3").
export function sideInfo(snapshot: CompetitionSnapshot, match: MatchView, side: MatchSide): SideInfo {
  const id = side === "home" ? match.homeId : match.awayId;
  const participant = id ? (indexes(snapshot).participants.get(id) ?? null) : null;
  if (participant) {
    return {
      participant,
      name: participant.name,
      shortName: participant.shortName || participant.name,
      color: participant.primaryColor,
      crestUrl: participant.crestUrl,
      href: PATHS.participant(participant.slug),
    };
  }
  const label = (side === "home" ? match.homeLabel : match.awayLabel) || describeSlotSource(side === "home" ? match.homeSource : match.awaySource);
  return { participant: null, name: label, shortName: label, color: null, crestUrl: null, href: null };
}

export function matchTitle(snapshot: CompetitionSnapshot, match: MatchView): string {
  return `${sideInfo(snapshot, match, "home").name} × ${sideInfo(snapshot, match, "away").name}`;
}

export function modalityLabel(modality: ModalityView | null | undefined): string {
  if (!modality) return "";
  return modality.emoji ? `${modality.emoji} ${modality.name}` : modality.name;
}

export type MatchContext = { modality: ModalityView | null; stage: StageView | null; groupName: string | null; stageLabel: string | null };

// "Fase de grupos · Grupo A · 2ª rodada" / "Semifinal" / "Disputa de 3º lugar". O nome da fase só
// entra quando a modalidade tem mais de uma (liga simples não precisa repetir "Pontos corridos").
export function matchContext(snapshot: CompetitionSnapshot, match: MatchView): MatchContext {
  const modality = indexes(snapshot).modalities.get(match.modalityId) ?? null;
  const stage = modality?.stages.find((item) => item.id === match.stageId) ?? null;
  const group = stage?.groups.find((item) => item.id === match.groupId) ?? null;
  const groupName = group && stage && stage.groups.length > 1 ? `Grupo ${group.name}` : null;
  const parts: string[] = [];
  if (stage && modality && modality.stages.length > 1 && stage.type !== "knockout") parts.push(stage.name);
  if (groupName) parts.push(groupName);
  if (match.isThirdPlace) parts.push("Disputa de 3º lugar");
  else if (match.roundLabel) parts.push(match.roundLabel);
  return { modality, stage, groupName, stageLabel: parts.length > 0 ? parts.join(" · ") : null };
}

export const MATCH_STATUS_LABEL: Record<MatchStatus, string> = {
  scheduled: "Agendado",
  live: "Ao vivo",
  finished: "Encerrado",
  cancelled: "Cancelado",
};

// Placar "2 × 1"; no vôlei o placar do jogo é em sets e o detalhe vem por set ("25-20, 18-25, 15-12").
export function setsDetail(match: MatchView): string | null {
  if (!match.sets || match.sets.length === 0) return null;
  const played = match.sets.filter((set) => set.home > 0 || set.away > 0);
  return played.length > 0 ? played.map((set) => `${set.home}-${set.away}`).join(", ") : null;
}

export function scoreLine(match: MatchView): string {
  return `${formatScore(match.homeScore)} × ${formatScore(match.awayScore)}`;
}

// Vencedor decidido fora do placar (pênaltis/sorteio num empate de mata-mata).
export function penaltyWinnerSide(match: MatchView): MatchSide | null {
  if (match.status !== "finished" || !match.decidedWinnerId || match.homeScore !== match.awayScore) return null;
  if (match.decidedWinnerId === match.homeId) return "home";
  if (match.decidedWinnerId === match.awayId) return "away";
  return null;
}

export function winnerSide(match: MatchView): MatchSide | null {
  if (match.status !== "finished") return null;
  if (match.homeScore > match.awayScore) return "home";
  if (match.awayScore > match.homeScore) return "away";
  return penaltyWinnerSide(match);
}

export function scoreUnitOf(snapshot: CompetitionSnapshot, match: MatchView): { singular: string; plural: string } {
  const modality = indexes(snapshot).modalities.get(match.modalityId);
  return getSportProfile(modality?.sportProfile ?? "pontos").scoreUnit;
}

// Canal ao vivo que está mostrando o jogo agora (o placar ao vivo do site acompanha esse canal).
export function liveChannelKeyFor(snapshot: CompetitionSnapshot, matchId: string): string | null {
  return snapshot.channels.find((channel) => channel.currentMatchId === matchId)?.key ?? null;
}

export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// "Fulano, Beltrano e Sicrano".
export function joinNames(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

// Cor de equipe é dado do cadastro (hex já validado na escrita); só aceita hex aqui também, pra
// nunca injetar outra coisa num style.
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
export function safeColor(color: string | null | undefined): string | null {
  return color && HEX.test(color) ? color : null;
}
