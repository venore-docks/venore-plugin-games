import Link from "next/link";
import type { AthleteRankingRow } from "../shared/derive";
import { rankPositions } from "../shared/ranking";
import { PATHS } from "../shared/paths";
import { AthletePhoto } from "./crest";
import { MedalBadge } from "./medal";

// Ranking de atletas (artilharia/pontuadores, MVPs, craque da torcida). Empate divide a posição.
export function AthleteRanking({ rows, unit }: { rows: AthleteRankingRow[]; unit: { singular: string; plural: string } }) {
  const positions = rankPositions(rows.map((row) => row.value));
  return (
    <ol className="divide-y divide-border overflow-hidden rounded-panel border border-border bg-card">
      {rows.map((row, index) => (
        <li key={row.athlete.id} className="relative flex min-h-14 items-center gap-3 px-3 py-2 ui-motion-base hover:bg-muted/50">
          <MedalBadge position={positions[index]} />
          <AthletePhoto name={row.athlete.name} photoUrl={row.athlete.photoUrl} color={row.participant?.primaryColor ?? null} size="md" />
          <div className="min-w-0 flex-1">
            <Link href={PATHS.athlete(row.athlete.slug)} className="block truncate font-semibold text-foreground after:absolute after:inset-0">
              {row.athlete.name}
            </Link>
            <span className="block truncate text-xs text-muted-foreground">{row.participant?.name ?? ""}</span>
          </div>
          <span className="shrink-0 text-right">
            <span className="block font-display text-xl font-extrabold leading-none tabular-nums text-foreground">{row.value}</span>
            <span className="text-[0.68rem] text-muted-foreground">{row.value === 1 ? unit.singular : unit.plural}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
