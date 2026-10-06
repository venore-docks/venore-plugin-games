import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@venore/plugin-sdk/ui";
import { indexes, scoringEvents } from "../../../shared/derive";
import { isUuid } from "../../../shared/ids";
import { PATHS } from "../../../shared/paths";
import { AdminDenied, AdminFrame, NoCompetition } from "../_shared/admin-nav";
import { ConfirmAction } from "../_shared/confirm-action";
import { loadAdminPage, pickableMedia } from "../_shared/server";
import { Section } from "../_shared/ui";
import { deleteAthleteAction } from "./actions";
import { AthleteForm } from "./athlete-form";

type PageProps = { params: Promise<Record<string, string>>; searchParams: Promise<Record<string, string | string[] | undefined>> };

// /admin/games/atletas/:id — "new" (com ?equipe=<id> opcional) = cadastro; uuid = edição.
export default async function AdminAthletePage({ params, searchParams }: PageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const access = await loadAdminPage("manage");
  if (!access.ok) return <AdminDenied message={access.message} />;
  const { snapshot } = access;
  if (!snapshot) return <NoCompetition active="athletes" />;

  const isNew = id === "new";
  if (!isNew && !isUuid(id)) notFound();
  const index = indexes(snapshot);
  const athlete = isNew ? null : (index.athletes.get(id) ?? null);
  if (!isNew && !athlete) notFound();

  const defaultParticipantId = typeof query.equipe === "string" && index.participants.has(query.equipe) ? query.equipe : null;
  const photoMedia = await pickableMedia(athlete?.photoMediaId);
  const participant = athlete ? index.participants.get(athlete.participantId) : null;
  const goals = athlete ? scoringEvents(snapshot).filter((event) => event.athleteId === athlete.id).reduce((sum, event) => sum + event.amount, 0) : 0;
  const mvps = athlete ? snapshot.matches.filter((match) => match.mvpAthleteId === athlete.id).length : 0;

  return (
    <AdminFrame
      active="athletes"
      competitionName={snapshot.competition.name}
      title={athlete ? athlete.name : "Novo atleta"}
      description={athlete ? `${participant?.name ?? ""} · ${goals} ponto(s)/gol(s) atribuído(s) · ${mvps}× craque do jogo` : "Cadastre o atleta na equipe."}
      actions={
        athlete && (
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={PATHS.athlete(athlete.slug)} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden /> Página pública
              </Link>
            </Button>
            <ConfirmAction
              trigger={
                <Button variant="destructive" size="sm">
                  <Trash2 aria-hidden /> Excluir
                </Button>
              }
              title={`Excluir ${athlete.name}?`}
              description={
                <>
                  <p>Os lances dele continuam no placar, mas ficam sem atribuição; se foi craque de algum jogo, o campo fica vazio.</p>
                  <p>Os votos da torcida que ele recebeu são apagados. Não dá pra desfazer.</p>
                </>
              }
              confirmLabel="Excluir atleta"
              successMessage="Atleta excluído."
              onConfirm={deleteAthleteAction.bind(null, athlete.id)}
              redirectTo={`${PATHS.admin.athletes()}?equipe=${athlete.participantId}`}
            />
          </>
        )
      }
    >
      <Section title="Dados do atleta" className="max-w-3xl">
        <AthleteForm
          athlete={athlete}
          photoMedia={photoMedia}
          participants={snapshot.participants.map(({ id: participantId, name }) => ({ id: participantId, name }))}
          defaultParticipantId={defaultParticipantId}
        />
      </Section>
    </AdminFrame>
  );
}
