// Barrel público do plugin — só tipos e constantes; nenhum outro plugin/context consome runtime daqui.
export type { CompetitionSnapshot, LiveMatchState, MatchView, ParticipantView, AthleteView, ModalityView } from "./contracts/types";
export { GAMES_SETTINGS } from "./shared/settings";
export { SPORT_PROFILES } from "./shared/sport-profiles";
