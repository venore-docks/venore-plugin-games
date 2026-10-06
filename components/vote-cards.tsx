import Link from "next/link";
import { cn } from "@venore/plugin-sdk/ui";
import type { CompetitionSnapshot, MatchView, PollTallies } from "../contracts/types";
import { indexes } from "../shared/derive";
import { computeVoteShares, resolveTopChoiceIds } from "../shared/votes";
import { PATHS } from "../shared/paths";
import { Crest } from "./crest";
import { LiveBadge } from "./live-badge";
import { joinNames, matchContext, modalityLabel, plural, sideInfo } from "./lib/match-info";

// Card de votação aberta de um jogo (hub da votação, bloco de chamada): confronto, líder da parcial
// e o botão de votar.
export function MatchVoteCard({ snapshot, match, tallies, className }: { snapshot: CompetitionSnapshot; match: MatchView; tallies: PollTallies | undefined; className?: string }) {
  const index = indexes(snapshot);
  const home = sideInfo(snapshot, match, "home");
  const away = sideInfo(snapshot, match, "away");
  const { modality } = matchContext(snapshot, match);
  const counts = tallies?.counts ?? {};
  const leaders = resolveTopChoiceIds(counts)
    .map((id) => index.athletes.get(id)?.name)
    .filter((name): name is string => Boolean(name));
  const leaderShare = computeVoteShares(counts)[0];
  return (
    <article className={cn("relative flex flex-col gap-3 rounded-panel border border-border bg-card p-3 shadow-panel ui-motion-base hover:border-ring @sm:p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">{modalityLabel(modality)}</p>
        {match.status === "live" && <LiveBadge />}
      </div>
      <div className="flex items-center gap-2">
        <Crest name={home.name} crestUrl={home.crestUrl} color={home.color} size="sm" />
        <span className="min-w-0 flex-1 truncate font-semibold text-foreground">{home.shortName}</span>
        <span className="text-xs font-bold text-muted-foreground">×</span>
        <span className="min-w-0 flex-1 truncate text-end font-semibold text-foreground">{away.shortName}</span>
        <Crest name={away.name} crestUrl={away.crestUrl} color={away.color} size="sm" />
      </div>
      <p className="text-sm text-muted-foreground">
        {leaders.length > 0 ? (
          <>
            {leaders.length > 1 ? "Empate: " : "Liderando: "}
            <span className="font-semibold text-foreground">{joinNames(leaders)}</span>
            {leaderShare ? ` · ${leaderShare.percent}%` : ""} · {plural(tallies?.total ?? 0, "voto", "votos")}
          </>
        ) : (
          "Ninguém votou ainda."
        )}
      </p>
      <Link
        href={PATHS.voteMatch(match.id)}
        className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground ui-motion-base after:absolute after:inset-0 after:rounded-panel hover:bg-primary/90"
      >
        Votar no craque
      </Link>
    </article>
  );
}
