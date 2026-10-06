import Link from "next/link";
import { Layers } from "lucide-react";
import { EmptyState } from "@venore/plugin-sdk/ui";
import { getSportProfile } from "../../../shared/sport-profiles";
import { PATHS } from "../../../shared/paths";
import { AdminDenied, AdminFrame, NoCompetition } from "../_shared/admin-nav";
import { loadAdminPage } from "../_shared/server";
import { ModalityStatusBadge } from "../_shared/ui";
import { CreateModalityButton } from "./create-modality";

// /admin/games/modalidades — uma modalidade por card (futsal, vôlei, dança…).
export default async function AdminModalitiesPage() {
  const access = await loadAdminPage("manage");
  if (!access.ok) return <AdminDenied message={access.message} />;
  const { snapshot } = access;
  if (!snapshot) return <NoCompetition active="modalities" />;

  const matchCounts = new Map<string, { total: number; finished: number }>();
  for (const match of snapshot.matches) {
    if (match.status === "cancelled") continue;
    const count = matchCounts.get(match.modalityId) ?? { total: 0, finished: 0 };
    count.total += 1;
    if (match.status === "finished") count.finished += 1;
    matchCounts.set(match.modalityId, count);
  }

  return (
    <AdminFrame
      active="modalities"
      competitionName={snapshot.competition.name}
      title="Modalidades"
      description="Cada modalidade tem regras, inscrições, formato (fases) e colocação final."
      actions={<CreateModalityButton />}
    >
      {snapshot.modalities.length === 0 ? (
        <EmptyState
          icon={<Layers className="size-8" strokeWidth={1.5} />}
          title="Nenhuma modalidade"
          description="Um campeonato simples tem uma modalidade (ex.: Futsal). Uma olimpíada tem várias, somando no quadro geral."
          action={<CreateModalityButton label="Criar primeira modalidade" />}
        />
      ) : (
        <ul className="grid *:min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {snapshot.modalities.map((modality) => {
            const profile = getSportProfile(modality.sportProfile);
            const counts = matchCounts.get(modality.id) ?? { total: 0, finished: 0 };
            return (
              <li key={modality.id}>
                <Link
                  href={PATHS.admin.modality(modality.id)}
                  className="flex h-full flex-col gap-3 rounded-panel border border-border bg-card p-4 outline-none hover:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-2xl" aria-hidden>
                      {modality.emoji || "🏆"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-foreground">{modality.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{profile.label}</p>
                    </div>
                    <ModalityStatusBadge status={modality.status} />
                  </div>
                  <dl className="grid *:min-w-0 grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-muted px-2 py-1.5">
                      <dt className="text-[11px] text-muted-foreground">Inscritas</dt>
                      <dd className="text-sm font-semibold tabular-nums text-foreground">{modality.entries.length}</dd>
                    </div>
                    <div className="rounded-lg bg-muted px-2 py-1.5">
                      <dt className="text-[11px] text-muted-foreground">{profile.shape === "event" ? "Fases" : "Jogos"}</dt>
                      <dd className="text-sm font-semibold tabular-nums text-foreground">
                        {profile.shape === "event" ? modality.stages.length : `${counts.finished}/${counts.total}`}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-muted px-2 py-1.5">
                      <dt className="text-[11px] text-muted-foreground">Peso</dt>
                      <dd className="text-sm font-semibold tabular-nums text-foreground">×{modality.weight.toLocaleString("pt-BR")}</dd>
                    </div>
                  </dl>
                  {modality.stages.length === 0 && <p className="text-xs text-warning">Formato ainda não definido.</p>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AdminFrame>
  );
}
