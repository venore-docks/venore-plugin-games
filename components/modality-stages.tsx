import type { CompetitionSnapshot, ModalityView } from "../contracts/types";
import { stageStandings } from "../shared/derive";
import { getSportProfile } from "../shared/sport-profiles";
import { Bracket } from "./bracket";
import { EventResults } from "./event-results";
import { StandingsTable } from "./standings-table";
import { EmptyNote } from "./section";

const STAGE_STATUS: Record<string, string> = { pending: "Aguardando", in_progress: "Em andamento", finished: "Encerrada" };

// Todas as fases de uma modalidade: tabela por grupo (pontos corridos), chaveamento (mata-mata) e
// ranking (prova única). `only` restringe a um tipo (bloco de chaveamento).
export function ModalityStages({
  snapshot,
  modality,
  only,
  highlightId,
}: {
  snapshot: CompetitionSnapshot;
  modality: ModalityView;
  only?: "standings" | "bracket";
  highlightId?: string | null;
}) {
  const stages = [...modality.stages]
    .sort((a, b) => a.index - b.index)
    // Bloco de classificação não repete o chaveamento (o seed coloca um bloco de mata-mata ao lado).
    .filter((stage) => (only === "bracket" ? stage.type === "knockout" : only === "standings" ? stage.type !== "knockout" : true));
  if (stages.length === 0) {
    const message =
      only === "bracket"
        ? "Esta modalidade não tem mata-mata."
        : only === "standings" && modality.stages.length > 0
          ? "Esta modalidade é disputada só em mata-mata — veja o chaveamento."
          : "As fases desta modalidade ainda não foram montadas.";
    return <EmptyNote>{message}</EmptyNote>;
  }
  const allowsDraw = modality.rules.pointsDraw > 0 || getSportProfile(modality.sportProfile).defaultAllowsDraw;
  const showStageNames = modality.stages.length > 1;

  return (
    <div className="space-y-6">
      {stages.map((stage) => (
        <div key={stage.id} className="space-y-3">
          {showStageNames && (
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-display text-lg font-bold text-foreground">{stage.name}</h3>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{STAGE_STATUS[stage.status] ?? ""}</span>
            </div>
          )}
          {stage.type === "round_robin" &&
            (() => {
              const groups = stageStandings(snapshot, modality, stage).filter((group) => group.rows.length > 0);
              if (groups.length === 0) return <EmptyNote>Grupos ainda não definidos.</EmptyNote>;
              return (
                <div className="grid *:min-w-0 gap-3 @3xl:grid-cols-2">
                  {groups.map((group) => (
                    <StandingsTable
                      key={group.groupId}
                      snapshot={snapshot}
                      rows={group.rows}
                      title={groups.length > 1 || stage.groups.length > 1 ? `Grupo ${group.groupName}` : undefined}
                      highlightId={highlightId}
                      allowsDraw={allowsDraw}
                    />
                  ))}
                </div>
              );
            })()}
          {stage.type === "knockout" && <Bracket snapshot={snapshot} stage={stage} />}
          {stage.type === "single_event" && <EventResults snapshot={snapshot} modality={modality} stage={stage} />}
        </div>
      ))}
    </div>
  );
}
