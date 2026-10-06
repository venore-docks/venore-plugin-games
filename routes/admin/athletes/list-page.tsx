import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { Button, EmptyState } from "@venore/plugin-sdk/ui";
import { indexes } from "../../../shared/derive";
import { isUuid } from "../../../shared/ids";
import { PATHS } from "../../../shared/paths";
import { AdminDenied, AdminFrame, NoCompetition } from "../_shared/admin-nav";
import { loadAdminPage } from "../_shared/server";
import { AthletesBrowser } from "./athletes-browser";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// /admin/games/atletas — lista com busca e filtro por equipe (?equipe=<id> já filtra).
export default async function AdminAthletesPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const access = await loadAdminPage("manage");
  if (!access.ok) return <AdminDenied message={access.message} />;
  const { snapshot } = access;
  if (!snapshot) return <NoCompetition active="athletes" />;

  const index = indexes(snapshot);
  const requested = typeof query.equipe === "string" && isUuid(query.equipe) && index.participants.has(query.equipe) ? query.equipe : "";
  const newHref = `${PATHS.admin.athlete("new")}${requested ? `?equipe=${requested}` : ""}`;

  return (
    <AdminFrame
      active="athletes"
      competitionName={snapshot.competition.name}
      title="Atletas"
      description="Elenco de cada equipe — usado nos lances, craque do jogo e votação da torcida."
      actions={
        snapshot.participants.length > 0 && (
          <Button asChild size="sm">
            <Link href={newHref}>
              <Plus aria-hidden /> Novo atleta
            </Link>
          </Button>
        )
      }
    >
      {snapshot.participants.length === 0 ? (
        <EmptyState
          icon={<Users className="size-8" strokeWidth={1.5} />}
          title="Cadastre as equipes primeiro"
          description="Todo atleta pertence a uma equipe."
          action={
            <Button asChild size="sm">
              <Link href={PATHS.admin.participant("new")}>Nova equipe</Link>
            </Button>
          }
        />
      ) : snapshot.athletes.length === 0 ? (
        <EmptyState
          icon={<Users className="size-8" strokeWidth={1.5} />}
          title="Nenhum atleta cadastrado"
          action={
            <Button asChild size="sm">
              <Link href={newHref}>Novo atleta</Link>
            </Button>
          }
        />
      ) : (
        <AthletesBrowser
          initialParticipantId={requested}
          participants={snapshot.participants.map(({ id, name }) => ({ id, name }))}
          athletes={snapshot.athletes.map((athlete) => ({
            id: athlete.id,
            name: athlete.name,
            number: athlete.number,
            position: athlete.position,
            isCaptain: athlete.isCaptain,
            photoUrl: athlete.photoUrl,
            participantId: athlete.participantId,
            participantName: index.participants.get(athlete.participantId)?.name ?? "",
          }))}
        />
      )}
    </AdminFrame>
  );
}
