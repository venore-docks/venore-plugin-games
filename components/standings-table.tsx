import Link from "next/link";
import { cn } from "@venore/plugin-sdk/ui";
import type { CompetitionSnapshot } from "../contracts/types";
import type { StandingRow } from "../shared/standings";
import { indexes } from "../shared/derive";
import { PATHS } from "../shared/paths";
import { Crest } from "./crest";
import { HScroll } from "./section";

// Tabela de classificação de um grupo: # Equipe J V E D SG Pts (+ CA/CV quando houve cartão). No
// celular a tabela rola na horizontal com a coluna da equipe presa à esquerda.
export function StandingsTable({
  snapshot,
  rows,
  title,
  highlightId,
  allowsDraw = true,
}: {
  snapshot: CompetitionSnapshot;
  rows: StandingRow[];
  title?: string;
  highlightId?: string | null;
  allowsDraw?: boolean;
}) {
  const { participants } = indexes(snapshot);
  const showCards = rows.some((row) => row.yellow > 0 || row.red > 0);
  const num = "px-2 py-2.5 text-center tabular-nums";
  return (
    <div className="overflow-hidden rounded-panel border border-border bg-card">
      {title && <p className="border-b border-border px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</p>}
      <HScroll label={title ? `Classificação — ${title}` : "Classificação"} className="mx-0 px-0 pb-0">
        <table className="w-full min-w-[22rem] border-collapse text-sm">
          <thead>
            <tr className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="sticky left-0 z-10 bg-card py-2 pl-3 pr-2 text-left">
                <span className="sr-only">Posição e equipe</span>#
              </th>
              <th scope="col" className={num} title="Jogos">J</th>
              <th scope="col" className={num} title="Vitórias">V</th>
              {allowsDraw && <th scope="col" className={num} title="Empates">E</th>}
              <th scope="col" className={num} title="Derrotas">D</th>
              <th scope="col" className={num} title="Saldo">SG</th>
              {showCards && <th scope="col" className={num} title="Cartões amarelos">CA</th>}
              {showCards && <th scope="col" className={num} title="Cartões vermelhos">CV</th>}
              <th scope="col" className={cn(num, "pr-3 text-foreground")} title="Pontos">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const participant = participants.get(row.participantId);
              const highlighted = row.participantId === highlightId;
              return (
                <tr key={row.participantId} className={cn("border-t border-border", highlighted && "bg-primary/8")}>
                  <th scope="row" className="sticky left-0 z-10 bg-card py-2 pl-3 pr-2 text-left font-normal">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="w-5 shrink-0 text-center text-xs font-bold tabular-nums text-muted-foreground">{row.rank}</span>
                      <Crest name={row.name} crestUrl={participant?.crestUrl ?? null} color={participant?.primaryColor ?? null} size="xs" />
                      {participant ? (
                        <Link href={PATHS.participant(participant.slug)} className="max-w-[9rem] truncate font-semibold text-foreground hover:underline @md:max-w-[14rem]">
                          {participant.shortName || participant.name}
                        </Link>
                      ) : (
                        <span className="max-w-[9rem] truncate font-semibold text-foreground">{row.name}</span>
                      )}
                    </span>
                  </th>
                  <td className={num}>{row.played}</td>
                  <td className={num}>{row.won}</td>
                  {allowsDraw && <td className={num}>{row.drawn}</td>}
                  <td className={num}>{row.lost}</td>
                  <td className={num}>{row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}</td>
                  {showCards && <td className={num}>{row.yellow}</td>}
                  {showCards && <td className={num}>{row.red}</td>}
                  <td className={cn(num, "pr-3 font-display text-base font-extrabold text-foreground")}>{row.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </HScroll>
    </div>
  );
}
