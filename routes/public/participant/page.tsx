import Link from "next/link";
import { notFound } from "next/navigation";
import type { CompetitionSnapshot, MatchView, ParticipantView } from "../../../contracts/types";
import { finishedMatches, indexes, isModalityComplete, modalityPlacements, overallTable, participantRecord, upcomingMatches } from "../../../shared/derive";
import { formatScore } from "../../../shared/score";
import { PATHS } from "../../../shared/paths";
import { AthletePhoto, Crest } from "../../../components/crest";
import { MatchCard } from "../../../components/match-card";
import { StatTile } from "../../../components/stat-tile";
import { EmptyNote, SectionHeader } from "../../../components/section";
import { MedalBadge } from "../../../components/medal";
import { matchCalendarLinks } from "../../../components/lib/calendar-events";
import { modalityLabel, safeColor } from "../../../components/lib/match-info";
import { isSlugParam, liveIslandFor, loadOrigin, loadSiteSnapshot, requestNow } from "../../../components/site-data";

type Props = { params: Promise<Record<string, string>>; searchParams: Promise<Record<string, string | string[] | undefined>> };

function involves(match: MatchView, participantId: string) {
  return match.homeId === participantId || match.awayId === participantId;
}

function ModalityPositions({ snapshot, participant }: { snapshot: CompetitionSnapshot; participant: ParticipantView }) {
  const enrolled = snapshot.modalities.filter((modality) => modality.entries.some((entry) => entry.participantId === participant.id));
  if (enrolled.length === 0) return <EmptyNote>Esta equipe ainda não está inscrita em nenhuma modalidade.</EmptyNote>;
  return (
    <ul className="grid gap-2 @md:grid-cols-2">
      {enrolled.map((modality) => {
        const placement = modalityPlacements(snapshot, modality).find((item) => item.participantId === participant.id);
        const complete = isModalityComplete(snapshot, modality);
        return (
          <li key={modality.id}>
            <Link href={PATHS.modality(modality.slug)} className="flex min-h-14 items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 ui-motion-base hover:border-ring">
              {placement ? <MedalBadge position={placement.position} /> : <span className="flex size-8 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">–</span>}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-foreground">{modalityLabel(modality)}</span>
                <span className="block text-xs text-muted-foreground">
                  {placement ? (complete ? `Colocação final: ${placement.position}º` : `Posição atual: ${placement.position}º (parcial)`) : "Ainda sem posição"}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// Perfil público da equipe (/equipes/:slug): capa com cores e brasão, recorde, modalidades com
// posição, jogos e elenco. Tudo do snapshot.
export default async function PublicParticipantPage({ params }: Props) {
  const { slug } = await params;
  if (!isSlugParam(slug)) notFound();
  const snapshot = await loadSiteSnapshot();
  if (!snapshot) notFound();
  const index = indexes(snapshot);
  const participant = index.participantsBySlug.get(slug);
  if (!participant) notFound();

  const now = requestNow();
  const origin = await loadOrigin();
  const record = participantRecord(snapshot, participant.id);
  const upcoming = [...snapshot.matches.filter((match) => match.status === "live" && involves(match, participant.id)), ...upcomingMatches(snapshot, now).filter((match) => involves(match, participant.id))].slice(0, 4);
  const recent = finishedMatches(snapshot).filter((match) => involves(match, participant.id)).slice(0, 4);
  const roster = [...(index.athletesByParticipant.get(participant.id) ?? [])].sort(
    (a, b) => Number(b.isCaptain) - Number(a.isCaptain) || (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name, "pt-BR"),
  );
  const overall = snapshot.competition.overallEnabled ? overallTable(snapshot).find((row) => row.participantId === participant.id) : undefined;
  const primary = safeColor(participant.primaryColor);
  const secondary = safeColor(participant.secondaryColor) ?? primary;
  const hasMatches = record.played > 0;

  return (
    <article className="@container mx-auto w-full max-w-4xl space-y-8">
      <header className="overflow-hidden rounded-panel border border-border bg-card shadow-panel">
        <div
          aria-hidden="true"
          className="h-24 bg-primary @md:h-32"
          style={primary ? { background: `linear-gradient(135deg, ${primary} 0%, ${primary} 55%, ${secondary} 55%, ${secondary} 100%)` } : undefined}
        />
        <div className="-mt-12 flex flex-col items-center gap-3 px-4 pb-5 text-center @md:-mt-14 @md:flex-row @md:items-end @md:text-start">
          <Crest name={participant.name} crestUrl={participant.crestUrl} color={participant.primaryColor} size="xl" className="border-4 border-card bg-card" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{snapshot.competition.name}</p>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">{participant.name}</h1>
            {participant.description && <p className="mt-1 text-sm text-muted-foreground">{participant.description}</p>}
          </div>
          {overall && (
            <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5">
              <MedalBadge position={overall.position} />
              <span className="text-start text-xs leading-tight text-muted-foreground">
                <span className="block font-semibold text-foreground">Quadro geral</span>
                <span className="tabular-nums">{formatScore(overall.total)} pts</span>
              </span>
            </div>
          )}
        </div>
      </header>

      {hasMatches && (
        <section aria-label="Recorde">
          <div className="grid grid-cols-3 gap-2 @md:grid-cols-6">
            <StatTile label="Jogos" value={record.played} />
            <StatTile label="Vitórias" value={record.won} />
            <StatTile label="Empates" value={record.drawn} />
            <StatTile label="Derrotas" value={record.lost} />
            <StatTile label="Pró" value={formatScore(record.scored)} />
            <StatTile label="Contra" value={formatScore(record.conceded)} />
          </div>
        </section>
      )}

      <section>
        <SectionHeader title="Modalidades" />
        <ModalityPositions snapshot={snapshot} participant={participant} />
      </section>

      {upcoming.length > 0 && (
        <section>
          <SectionHeader title="Próximos jogos" />
          <div className="grid gap-3 @xl:grid-cols-2">
            {upcoming.map((match) => (
              <MatchCard key={match.id} snapshot={snapshot} match={match} live={liveIslandFor(snapshot, match)} calendar={matchCalendarLinks(snapshot, match, origin, now)} />
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section>
          <SectionHeader title="Últimos jogos" />
          <div className="grid gap-3 @xl:grid-cols-2">
            {recent.map((match) => (
              <MatchCard key={match.id} snapshot={snapshot} match={match} />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionHeader title="Elenco" subtitle={roster.length > 0 ? `${roster.length} atleta${roster.length === 1 ? "" : "s"}` : undefined} />
        {roster.length === 0 ? (
          <EmptyNote>Elenco ainda não cadastrado.</EmptyNote>
        ) : (
          <ul className="grid grid-cols-2 gap-2 @md:grid-cols-3 @2xl:grid-cols-4">
            {roster.map((athlete) => (
              <li key={athlete.id}>
                <Link href={PATHS.athlete(athlete.slug)} className="flex min-h-full flex-col items-center gap-2 rounded-xl border border-border bg-card p-3 text-center ui-motion-base hover:border-ring">
                  <span className="relative">
                    <AthletePhoto name={athlete.name} photoUrl={athlete.photoUrl} color={participant.primaryColor} size="lg" />
                    {athlete.isCaptain && (
                      <span className="absolute -end-1 -top-1 flex size-6 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-primary-foreground" title="Capitão">
                        C<span className="sr-only">apitão</span>
                      </span>
                    )}
                  </span>
                  <span className="w-full truncate text-sm font-semibold text-foreground">{athlete.name}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{[athlete.number !== null ? `#${athlete.number}` : null, athlete.position].filter(Boolean).join(" · ") || " "}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
