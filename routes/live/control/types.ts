import type { LiveMatchState, MatchSide } from "../../../contracts/types";

// Tipos trocados entre a página do controle (server), as Server Actions e o console (client).

export type ControlActionResult =
  | { ok: true; state: LiveMatchState | null; eventId?: string }
  | { ok: false; message: string; code?: string };

export type DeskAthlete = { id: string; name: string; number: number | null; photoUrl: string | null };

export type DeskEvent = {
  id: string;
  side: MatchSide;
  kind: string;
  label: string;
  emoji: string;
  scores: boolean;
  amount: number;
  athleteId: string | null;
  athleteName: string | null;
  clockMs: number | null;
  period: number | null;
};

// Dados do jogo atual que não cabem no estado ao vivo (que é público e enxuto): elenco, lances com
// id (pra remover/atribuir), regras que mudam os botões.
export type MatchDesk = {
  matchId: string;
  allowHalfPoints: boolean;
  periodMinutes: number;
  // Mata-mata com desempate obrigatório: empate exige escolher o vencedor ao encerrar.
  tieNeedsWinner: boolean;
  homeId: string | null;
  awayId: string | null;
  roster: { home: DeskAthlete[]; away: DeskAthlete[] };
  events: DeskEvent[];
  sets: { home: number; away: number }[] | null;
  mvpAthleteId: string | null;
};

export type PickerMatch = { id: string; homeName: string; awayName: string; roundLabel: string | null; when: string; live: boolean };
export type PickerGroup = { modalityId: string; modalityName: string; emoji: string | null; matches: PickerMatch[] };

export type QuickTeam = { id: string; name: string };
export type QuickModality = { id: string; name: string; emoji: string | null; teams: QuickTeam[] };

export type ChannelOption = { key: string; name: string };
export type BoostOption = { id: string; label: string; emoji: string; description: string | null };
