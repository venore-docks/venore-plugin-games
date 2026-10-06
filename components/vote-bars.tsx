import { cn } from "@venore/plugin-sdk/ui";
import { computeVoteShares } from "../shared/votes";
import { rankPositions } from "../shared/ranking";
import { AthletePhoto } from "./crest";
import { plural, safeColor } from "./lib/match-info";

export type VoteChoice = { id: string; name: string; imageUrl: string | null; color: string | null; caption: string | null };

// Parcial/resultado de uma votação: barras com % (maior resto, somam 100) e posição compartilhada no
// empate. Sem voto ainda: mensagem, nunca barras zeradas.
export function VoteBars({
  choices,
  counts,
  limit,
  highlightId,
  closed,
}: {
  choices: VoteChoice[];
  counts: Record<string, number>;
  limit?: number;
  highlightId?: string | null;
  closed?: boolean;
}) {
  const byId = new Map(choices.map((choice) => [choice.id, choice]));
  const shares = computeVoteShares(
    Object.fromEntries(Object.entries(counts).filter(([id]) => byId.has(id))),
    choices.map((choice) => choice.id),
  );
  if (shares.length === 0) return <p className="text-sm text-muted-foreground">{closed ? "Votação encerrada sem votos." : "Ninguém votou ainda — seja o primeiro!"}</p>;
  const total = shares.reduce((sum, share) => sum + share.votes, 0);
  const positions = rankPositions(shares.map((share) => share.votes));
  const visible = shares.slice(0, limit ?? shares.length);
  return (
    <div className="space-y-2">
      <ol className="space-y-2">
        {visible.map((share, index) => {
          const choice = byId.get(share.choiceId)!;
          const leader = positions[index] === 1;
          const color = safeColor(choice.color);
          return (
            <li key={share.choiceId} className={cn("rounded-xl border bg-card p-2.5", share.choiceId === highlightId ? "border-primary" : "border-border")}>
              <div className="flex items-center gap-2.5">
                <span className="w-5 shrink-0 text-center text-xs font-bold tabular-nums text-muted-foreground">{positions[index]}º</span>
                <AthletePhoto name={choice.name} photoUrl={choice.imageUrl} color={choice.color} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm text-foreground", leader ? "font-bold" : "font-semibold")}>{choice.name}</p>
                  {choice.caption && <p className="truncate text-xs text-muted-foreground">{choice.caption}</p>}
                </div>
                <span className="shrink-0 text-right">
                  <span className="block font-display text-lg font-extrabold leading-none tabular-nums text-foreground">{share.percent}%</span>
                  <span className="text-[0.68rem] tabular-nums text-muted-foreground">{plural(share.votes, "voto", "votos")}</span>
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div className={cn("h-full rounded-full", leader ? "bg-primary" : "bg-ring")} style={{ width: `${share.percent}%`, ...(color && !leader ? { background: color } : {}) }} />
              </div>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-muted-foreground">{plural(total, "voto", "votos")} no total</p>
    </div>
  );
}
