import Link from "next/link";
import { cn } from "@venore/plugin-sdk/ui";
import type { CompetitionSnapshot, ModalityView, StageView } from "../contracts/types";
import { indexes } from "../shared/derive";
import { placementsFromEventResults } from "../shared/placement";
import { getSportProfile } from "../shared/sport-profiles";
import { formatScore } from "../shared/score";
import { PATHS } from "../shared/paths";
import { Crest } from "./crest";
import { MedalBadge } from "./medal";

function resultValue(result: StageView["results"][number]): number | null {
  if (result.value !== null) return result.value;
  if (result.judgeScores && result.judgeScores.length > 0) return result.judgeScores.reduce((sum, value) => sum + value, 0) / result.judgeScores.length;
  return null;
}

function formatValue(value: number, kind: "score" | "measure" | "placement", unit: string): string {
  if (kind === "placement") return `${value}º`;
  const text = Number.isInteger(value) ? String(value) : value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return unit ? `${text} ${unit}` : text;
}

// Prova única (dança, arrecadação…): ranking por nota/medida/colocação, empate divide a posição.
// Inscritas sem resultado aparecem no fim como "aguardando".
export function EventResults({ snapshot, modality, stage }: { snapshot: CompetitionSnapshot; modality: ModalityView; stage: StageView }) {
  const { participants } = indexes(snapshot);
  const profile = getSportProfile(modality.sportProfile);
  const kind = profile.eventResult?.kind ?? "score";
  const unit = kind === "measure" ? modality.rules.measureUnit : (profile.eventResult?.unit ?? "");
  const lowerIsBetter = modality.rules.lowerIsBetter || kind === "placement";
  const byParticipant = new Map(stage.results.map((result) => [result.participantId, result]));
  const ranked = placementsFromEventResults(
    stage.results.map((result) => ({ participantId: result.participantId, value: resultValue(result) })),
    lowerIsBetter,
  );
  const rankedIds = new Set(ranked.map((item) => item.participantId));
  const pending = modality.entries.map((entry) => entry.participantId).filter((id) => !rankedIds.has(id));

  if (ranked.length === 0 && pending.length === 0) return null;
  return (
    <ol className="divide-y divide-border overflow-hidden rounded-panel border border-border bg-card">
      {ranked.map((placement) => {
        const participant = participants.get(placement.participantId);
        const result = byParticipant.get(placement.participantId);
        const value = result ? resultValue(result) : null;
        return (
          <li key={placement.participantId} className="flex min-h-14 items-center gap-3 px-3 py-2">
            <MedalBadge position={placement.position} />
            <Crest name={participant?.name ?? "?"} crestUrl={participant?.crestUrl ?? null} color={participant?.primaryColor ?? null} size="sm" />
            <div className="min-w-0 flex-1">
              {participant ? (
                <Link href={PATHS.participant(participant.slug)} className="block truncate font-semibold text-foreground hover:underline">
                  {participant.name}
                </Link>
              ) : (
                <span className="block truncate font-semibold text-foreground">Equipe removida</span>
              )}
              {result?.judgeScores && result.judgeScores.length > 1 && (
                <span className="block truncate text-xs tabular-nums text-muted-foreground">Notas: {result.judgeScores.map((score) => formatScore(score)).join(" · ")}</span>
              )}
              {result?.note && <span className="block truncate text-xs text-muted-foreground">{result.note}</span>}
            </div>
            {value !== null && <span className="shrink-0 font-display text-lg font-extrabold tabular-nums text-foreground">{formatValue(value, kind, unit)}</span>}
          </li>
        );
      })}
      {pending.map((participantId) => {
        const participant = participants.get(participantId);
        if (!participant) return null;
        return (
          <li key={participantId} className={cn("flex min-h-14 items-center gap-3 px-3 py-2 text-muted-foreground")}>
            <span className="w-8 shrink-0 text-center text-sm">–</span>
            <Crest name={participant.name} crestUrl={participant.crestUrl} color={participant.primaryColor} size="sm" />
            <span className="min-w-0 flex-1 truncate font-semibold">{participant.name}</span>
            <span className="shrink-0 text-xs">aguardando</span>
          </li>
        );
      })}
    </ol>
  );
}
