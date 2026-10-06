import Link from "next/link";
import { cn } from "@venore/plugin-sdk/ui";
import type { CompetitionSnapshot, MatchSide, MatchView, StageView } from "../contracts/types";
import { formatScore } from "../shared/score";
import { formatMatchDate } from "../shared/timezone";
import { PATHS } from "../shared/paths";
import { Crest } from "./crest";
import { LiveBadge } from "./live-badge";
import { HScroll } from "./section";
import { penaltyWinnerSide, sideInfo, winnerSide } from "./lib/match-info";

function BracketSide({ snapshot, match, side }: { snapshot: CompetitionSnapshot; match: MatchView; side: MatchSide }) {
  const info = sideInfo(snapshot, match, side);
  const winner = winnerSide(match);
  const lost = winner !== null && winner !== side;
  const showScore = match.status === "live" || match.status === "finished";
  return (
    <div className={cn("flex min-h-10 items-center gap-2 px-2.5", lost && "opacity-55")}>
      <Crest name={info.name} crestUrl={info.crestUrl} color={info.color} size="xs" />
      <span className={cn("min-w-0 flex-1 truncate text-sm", info.participant ? "font-semibold text-foreground" : "italic text-muted-foreground", winner === side && "font-bold")}>
        {info.shortName}
      </span>
      {showScore && (
        <span className="font-display text-base font-extrabold tabular-nums text-foreground">
          {formatScore(side === "home" ? match.homeScore : match.awayScore)}
          {penaltyWinnerSide(match) === side && <span className="ml-0.5 text-[0.65rem] font-semibold text-muted-foreground">(p)</span>}
        </span>
      )}
    </div>
  );
}

function BracketMatch({ snapshot, match }: { snapshot: CompetitionSnapshot; match: MatchView }) {
  return (
    <Link
      href={PATHS.match(match.id)}
      className={cn(
        "block w-56 overflow-hidden rounded-xl border bg-card shadow-panel ui-motion-base hover:border-ring",
        match.status === "live" ? "border-destructive/40" : "border-border",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/50 px-2.5 py-1 text-[0.68rem] font-semibold text-muted-foreground">
        <span>{match.matchKey ?? ""}</span>
        {match.status === "live" ? <LiveBadge className="px-1.5 py-0" /> : <span className="truncate">{formatMatchDate(match.scheduledDate, match.scheduledTime)}</span>}
      </div>
      <BracketSide snapshot={snapshot} match={match} side="home" />
      <div className="border-t border-border" />
      <BracketSide snapshot={snapshot} match={match} side="away" />
    </Link>
  );
}

// Chaveamento do mata-mata de uma fase: colunas por rodada (rola na horizontal no celular), lado sem
// equipe mostra a origem ("Vencedor J3"). Disputa de 3º separada, abaixo da final.
export function Bracket({ snapshot, stage }: { snapshot: CompetitionSnapshot; stage: StageView }) {
  const stageMatches = snapshot.matches.filter((match) => match.stageId === stage.id && match.status !== "cancelled");
  const main = stageMatches.filter((match) => !match.isThirdPlace);
  const thirdPlace = stageMatches.filter((match) => match.isThirdPlace);
  const rounds = [...new Set(main.map((match) => match.bracketRound ?? 1))].sort((a, b) => a - b);
  if (rounds.length === 0) return null;

  return (
    <HScroll label={`Chaveamento — ${stage.name}`}>
      <ol className="flex min-w-max gap-4">
        {rounds.map((round) => {
          const roundMatches = main.filter((match) => (match.bracketRound ?? 1) === round).sort((a, b) => (a.bracketPosition ?? 0) - (b.bracketPosition ?? 0));
          const isLast = round === rounds[rounds.length - 1];
          return (
            <li key={round} className="flex flex-col">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{roundMatches[0]?.roundLabel ?? `Rodada ${round}`}</p>
              <ul className="flex flex-1 flex-col justify-around gap-3">
                {roundMatches.map((match) => (
                  <li key={match.id}>
                    <BracketMatch snapshot={snapshot} match={match} />
                  </li>
                ))}
                {isLast &&
                  thirdPlace.map((match) => (
                    <li key={match.id} className="mt-2">
                      <p className="mb-1 text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground">Disputa de 3º lugar</p>
                      <BracketMatch snapshot={snapshot} match={match} />
                    </li>
                  ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </HScroll>
  );
}
