import type { BlockRendererComponent } from "@venore/plugin-sdk";
import { HeroBlock, NextMatchCardBlock, TeamSpotlightBlock } from "./feature";
import { HomeBlock } from "./home";
import { LiveNowBlock, MatchesGalleryBlock, ResultsBlock, ScheduleBlock, UpcomingBlock } from "./matches";
import { AthletesRankingBlock, BracketBlock, ModalitiesBlock, OverallBlock, ParticipantsBlock, StandingsBlock } from "./tables";
import { VoteCtaBlock } from "./vote";

// key do bloco (blocks/definitions.ts) → renderer. Carregado sob demanda pelo contributions.ts.
export const blockRenderers: Record<string, BlockRendererComponent> = {
  "games.home": HomeBlock,
  "games.hero": HeroBlock,
  "games.live-now": LiveNowBlock,
  "games.next-match-card": NextMatchCardBlock,
  "games.upcoming": UpcomingBlock,
  "games.schedule": ScheduleBlock,
  "games.results": ResultsBlock,
  "games.matches-gallery": MatchesGalleryBlock,
  "games.standings": StandingsBlock,
  "games.bracket": BracketBlock,
  "games.overall": OverallBlock,
  "games.modalities": ModalitiesBlock,
  "games.participants": ParticipantsBlock,
  "games.team-spotlight": TeamSpotlightBlock,
  "games.athletes-ranking": AthletesRankingBlock,
  "games.vote-cta": VoteCtaBlock,
};
