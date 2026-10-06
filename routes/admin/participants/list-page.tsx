import Link from "next/link";
import { Plus, Shield } from "lucide-react";
import { Button, EmptyState } from "@venore/plugin-sdk/ui";
import { indexes } from "../../../shared/derive";
import { PATHS } from "../../../shared/paths";
import { AdminDenied, AdminFrame, NoCompetition } from "../_shared/admin-nav";
import { loadAdminPage } from "../_shared/server";
import { Crest } from "../_shared/ui";

// /admin/games/equipes — grade das equipes da competição.
export default async function AdminParticipantsPage() {
  const access = await loadAdminPage("manage");
  if (!access.ok) return <AdminDenied message={access.message} />;
  const { snapshot } = access;
  if (!snapshot) return <NoCompetition active="participants" />;

  const index = indexes(snapshot);
  const modalitiesByParticipant = new Map<string, string[]>();
  for (const modality of snapshot.modalities) {
    for (const entry of modality.entries) {
      const list = modalitiesByParticipant.get(entry.participantId) ?? [];
      list.push(modality.emoji ?? modality.name.slice(0, 3));
      modalitiesByParticipant.set(entry.participantId, list);
    }
  }

  return (
    <AdminFrame
      active="participants"
      competitionName={snapshot.competition.name}
      title="Equipes"
      description="Turmas/times da competição. Uma equipe pode disputar várias modalidades."
      actions={
        <Button asChild size="sm">
          <Link href={PATHS.admin.participant("new")}>
            <Plus aria-hidden /> Nova equipe
          </Link>
        </Button>
      }
    >
      {snapshot.participants.length === 0 ? (
        <EmptyState
          icon={<Shield className="size-8" strokeWidth={1.5} />}
          title="Nenhuma equipe cadastrada"
          description="Cadastre uma a uma ou importe uma planilha CSV."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild size="sm">
                <Link href={PATHS.admin.participant("new")}>Nova equipe</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={PATHS.admin.import()}>Importar CSV</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <ul className="grid *:min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {snapshot.participants.map((participant) => {
            const athleteCount = index.athletesByParticipant.get(participant.id)?.length ?? 0;
            const modalities = modalitiesByParticipant.get(participant.id) ?? [];
            return (
              <li key={participant.id}>
                <Link
                  href={PATHS.admin.participant(participant.id)}
                  className="group flex h-full items-center gap-3 overflow-hidden rounded-panel border border-border bg-card p-3 outline-none hover:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  style={participant.primaryColor ? { borderInlineStartColor: participant.primaryColor, borderInlineStartWidth: 4 } : undefined}
                >
                  <Crest name={participant.name} url={participant.crestUrl} color={participant.primaryColor} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {participant.name}
                      {participant.shortName && <span className="ms-1.5 text-xs font-medium text-muted-foreground">{participant.shortName}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {athleteCount} atleta{athleteCount === 1 ? "" : "s"}
                    </p>
                    <p className="mt-1 truncate text-sm" title={`${modalities.length} modalidade(s)`}>
                      {modalities.length > 0 ? modalities.join(" ") : <span className="text-xs text-muted-foreground">Sem modalidade</span>}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AdminFrame>
  );
}
