import Link from "next/link";
import { cn } from "@venore/plugin-sdk/ui";
import type { CompetitionSnapshot, LiveMatchState, MatchSide, MatchView } from "../contracts/types";
import { formatScore } from "../shared/score";
import { formatMatchDate } from "../shared/timezone";
import { PATHS } from "../shared/paths";
import { Crest } from "./crest";
import { LiveBadge } from "./live-badge";
import { LiveScore } from "./live-score";
import { AddToCalendar } from "./add-to-calendar";
import type { MatchCalendarLinks } from "./lib/calendar-events";
import { matchContext, modalityLabel, penaltyWinnerSide, setsDetail, sideInfo, winnerSide } from "./lib/match-info";

export type LiveIsland = { channelKey: string; initial: LiveMatchState };

function Side({ snapshot, match, side, dim }: { snapshot: CompetitionSnapshot; match: MatchView; side: MatchSide; dim: boolean }) {
  const info = sideInfo(snapshot, match, side);
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center", dim && "opacity-60")}>
      <Crest name={info.name} crestUrl={info.crestUrl} color={info.color} size="md" />
      <span className={cn("line-clamp-2 text-sm leading-tight font-semibold", info.participant ? "text-foreground" : "text-muted-foreground italic")}>{info.shortName}</span>
    </div>
  );
}

function Center({ match, live }: { match: MatchView; live: LiveIsland | null }) {
  if (match.status === "live" && live) return <LiveScore initial={live.initial} channelKey={live.channelKey} matchId={match.id} size="md" />;
  if (match.status === "live" || match.status === "finished") {
    const penalty = penaltyWinnerSide(match);
    const sets = setsDetail(match);
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className="font-display text-3xl font-extrabold leading-none tabular-nums text-foreground">
          {formatScore(match.homeScore)}
          <span className="mx-1.5 text-muted-foreground/56" aria-hidden="true">
            ×
          </span>
          <span className="sr-only"> a </span>
          {formatScore(match.awayScore)}
        </span>
        {penalty && <span className="text-[0.7rem] font-semibold text-muted-foreground">nos pênaltis</span>}
        {sets && <span className="text-[0.7rem] tabular-nums text-muted-foreground">{sets}</span>}
      </div>
    );
  }
  if (match.status === "cancelled") return <span className="text-sm font-semibold text-muted-foreground">Cancelado</span>;
  return (
    <div className="flex flex-col items-center gap-0.5 text-center">
      <span className="font-display text-xl font-bold tabular-nums leading-none text-foreground">{match.scheduledTime ? match.scheduledTime.slice(0, 5) : "×"}</span>
      <span className="text-[0.7rem] font-medium text-muted-foreground">{match.scheduledDate ? formatMatchDate(match.scheduledDate, null) : "Data a definir"}</span>
    </div>
  );
}

// Cartão de jogo (agenda, resultados, ao vivo, galeria): equipes frente a frente, placar/horário no
// meio. O cartão inteiro leva à página do jogo (link "esticado" por ::after) e o menu da agenda fica
// acima dele — nada de elemento interativo dentro de <a>.
export function MatchCard({
  snapshot,
  match,
  live = null,
  calendar = null,
  showModality = true,
  className,
}: {
  snapshot: CompetitionSnapshot;
  match: MatchView;
  live?: LiveIsland | null;
  calendar?: MatchCalendarLinks | null;
  showModality?: boolean;
  className?: string;
}) {
  const { modality, stageLabel } = matchContext(snapshot, match);
  const winner = winnerSide(match);
  const home = sideInfo(snapshot, match, "home").name;
  const away = sideInfo(snapshot, match, "away").name;
  const meta = [showModality ? modalityLabel(modality) : null, stageLabel].filter(Boolean).join(" · ");
  const footer = [match.status !== "scheduled" && match.scheduledDate ? formatMatchDate(match.scheduledDate, match.scheduledTime) : null, match.venue].filter(Boolean).join(" · ");

  return (
    <article
      className={cn(
        "relative flex flex-col gap-3 rounded-panel border bg-card p-3 shadow-panel ui-motion-base hover:border-ring @sm:p-4",
        match.status === "live" ? "border-destructive/40" : "border-border",
        className,
      )}
    >
      <div className="flex min-h-5 items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">{meta || "Jogo"}</p>
        {match.status === "live" ? (
          <LiveBadge />
        ) : match.status === "finished" ? (
          <span className="shrink-0 text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">Final</span>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Side snapshot={snapshot} match={match} side="home" dim={winner === "away"} />
        <div className="flex w-24 shrink-0 justify-center @sm:w-28">
          <Center match={match} live={live} />
        </div>
        <Side snapshot={snapshot} match={match} side="away" dim={winner === "home"} />
      </div>

      {(footer || calendar) && (
        <div className="flex min-h-5 flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-border pt-2">
          <p className="min-w-0 truncate text-xs text-muted-foreground">{footer}</p>
          {calendar && (
            <div className="relative z-10">
              <AddToCalendar links={calendar} compact align="right" />
            </div>
          )}
        </div>
      )}

      <Link href={PATHS.match(match.id)} className="absolute inset-0 rounded-panel focus-visible:outline-2 focus-visible:outline-ring">
        <span className="sr-only">
          {home} × {away}
          {meta ? ` — ${meta}` : ""}
        </span>
      </Link>
    </article>
  );
}
