import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Plus, Users } from "lucide-react";
import { Badge, Button } from "@venore/plugin-sdk/ui";
import { indexes } from "../../../shared/derive";
import { isUuid } from "../../../shared/ids";
import { PATHS } from "../../../shared/paths";
import { AdminDenied, AdminFrame, NoCompetition } from "../_shared/admin-nav";
import { CopyButton } from "../_shared/copy-button";
import { loadAdminPage, pickableMedia } from "../_shared/server";
import { Avatar, Section } from "../_shared/ui";
import { DeleteParticipant } from "./delete-participant";
import { ParticipantForm } from "./participant-form";

// /admin/games/equipes/:id — "new" = cadastro; uuid = edição + elenco.
export default async function AdminParticipantPage({ params }: { params: Promise<Record<string, string>> }) {
  const { id } = await params;
  const access = await loadAdminPage("manage");
  if (!access.ok) return <AdminDenied message={access.message} />;
  const { snapshot } = access;
  if (!snapshot) return <NoCompetition active="participants" />;

  const isNew = id === "new";
  if (!isNew && !isUuid(id)) notFound();
  const index = indexes(snapshot);
  const participant = isNew ? null : (index.participants.get(id) ?? null);
  if (!isNew && !participant) notFound();

  const crestMedia = await pickableMedia(participant?.crestMediaId);
  const roster = participant ? (index.athletesByParticipant.get(participant.id) ?? []) : [];
  const modalities = participant ? snapshot.modalities.filter((modality) => modality.entries.some((entry) => entry.participantId === participant.id)) : [];

  return (
    <AdminFrame
      active="participants"
      competitionName={snapshot.competition.name}
      title={participant ? participant.name : "Nova equipe"}
      description={
        participant ? (
          <span className="flex flex-wrap items-center gap-2">
            <span>ID (pro CSV):</span>
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">{participant.id}</code>
            <CopyButton value={participant.id} label="Copiar" size="xs" />
          </span>
        ) : (
          "Cadastre a equipe; depois inscreva-a nas modalidades."
        )
      }
      actions={
        participant && (
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={PATHS.participant(participant.slug)} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden /> Página pública
              </Link>
            </Button>
            <DeleteParticipant participantId={participant.id} participantName={participant.name} />
          </>
        )
      }
    >
      <div className="grid *:min-w-0 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Section title="Dados da equipe">
          <ParticipantForm participant={participant} crestMedia={crestMedia} />
        </Section>

        {participant && (
          <div className="space-y-4">
            <Section
              title={`Elenco (${roster.length})`}
              icon={<Users />}
              actions={
                <Button asChild variant="outline" size="sm">
                  <Link href={`${PATHS.admin.athlete("new")}?equipe=${participant.id}`}>
                    <Plus aria-hidden /> Atleta
                  </Link>
                </Button>
              }
            >
              {roster.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum atleta cadastrado nesta equipe.</p>
              ) : (
                <ul className="-mx-2 divide-y divide-border">
                  {roster
                    .slice()
                    .sort((a, b) => (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name, "pt-BR"))
                    .map((athlete) => (
                      <li key={athlete.id}>
                        <Link href={PATHS.admin.athlete(athlete.id)} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted">
                          <Avatar name={athlete.name} url={athlete.photoUrl} size="sm" />
                          <span className="min-w-0 flex-1 truncate text-sm text-foreground">{athlete.name}</span>
                          {athlete.isCaptain && <Badge variant="secondary">Capitão</Badge>}
                          {athlete.number !== null && <span className="text-xs font-semibold tabular-nums text-muted-foreground">#{athlete.number}</span>}
                        </Link>
                      </li>
                    ))}
                </ul>
              )}
            </Section>
            <Section title="Modalidades inscritas" description={modalities.length === 0 ? "Inscreva a equipe na aba Inscrições de cada modalidade." : undefined}>
              {modalities.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {modalities.map((modality) => (
                    <li key={modality.id}>
                      <Link href={PATHS.admin.modality(modality.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-sm text-foreground hover:border-ring">
                        {modality.emoji && <span aria-hidden>{modality.emoji}</span>}
                        {modality.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        )}
      </div>
    </AdminFrame>
  );
}
