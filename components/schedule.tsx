import type { CompetitionSnapshot, MatchView } from "../contracts/types";
import { MatchCard } from "./match-card";
import { PillTabs } from "./pill-tabs";
import { EmptyNote } from "./section";
import { matchCalendarLinks } from "./lib/calendar-events";
import { defaultGroupKey, groupByDay, groupByRound } from "./lib/schedule";
import { liveIslandFor } from "./site-data";

// Agenda em abas (por dia ou por rodada), cards de jogo empilhados no celular e em grade quando o
// container é largo.
export function Schedule({
  snapshot,
  matches,
  mode,
  origin,
  now,
  showModality = true,
  emptyMessage = "Nenhum jogo na agenda ainda.",
}: {
  snapshot: CompetitionSnapshot;
  matches: MatchView[];
  mode: "day" | "round";
  origin: string;
  now: number;
  showModality?: boolean;
  emptyMessage?: string;
}) {
  if (matches.length === 0) return <EmptyNote>{emptyMessage}</EmptyNote>;
  const groups = mode === "day" ? groupByDay(matches) : groupByRound(matches);
  const tabs = groups.map((group) => {
    const live = group.matches.filter((match) => match.status === "live").length;
    return {
      key: group.key,
      label: group.label,
      badge: live > 0 ? "ao vivo" : String(group.matches.length),
      content: (
        <div className="grid *:min-w-0 gap-3 @xl:grid-cols-2 @4xl:grid-cols-3">
          {group.matches.map((match) => (
            <MatchCard
              key={match.id}
              snapshot={snapshot}
              match={match}
              live={liveIslandFor(snapshot, match)}
              calendar={matchCalendarLinks(snapshot, match, origin, now)}
              showModality={showModality}
            />
          ))}
        </div>
      ),
    };
  });
  return <PillTabs tabs={tabs} defaultKey={defaultGroupKey(groups, now, mode)} label={mode === "day" ? "Dias" : "Rodadas"} />;
}
