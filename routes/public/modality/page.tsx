import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@venore/plugin-sdk/ui";
import type { ModalityStatus } from "../../../contracts/types";
import { finishedMatches, indexes, isModalityComplete, matchesOf, modalityPlacements, topMvps, topScorers } from "../../../shared/derive";
import { getSportProfile } from "../../../shared/sport-profiles";
import { PATHS } from "../../../shared/paths";
import { Crest } from "../../../components/crest";
import { MatchCard } from "../../../components/match-card";
import { MedalBadge } from "../../../components/medal";
import { ModalityStages } from "../../../components/modality-stages";
import { Schedule } from "../../../components/schedule";
import { AthleteRanking } from "../../../components/athlete-ranking";
import { SectionHeader } from "../../../components/section";
import { isSlugParam, loadOrigin, loadSiteSnapshot, requestNow } from "../../../components/site-data";

type Props = { params: Promise<Record<string, string>>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const STATUS_LABEL: Record<ModalityStatus, string> = { setup: "Em preparação", in_progress: "Em andamento", finished: "Encerrada" };

// Visão pública de uma modalidade (/modalidades/:slug): colocação final (quando encerrada), fases
// (classificação, chaveamento, prova única), agenda por rodada, resultados e destaques.
export default async function PublicModalityPage({ params }: Props) {
  const { slug } = await params;
  if (!isSlugParam(slug)) notFound();
  const snapshot = await loadSiteSnapshot();
  if (!snapshot) notFound();
  const index = indexes(snapshot);
  const modality = index.modalitiesBySlug.get(slug);
  if (!modality) notFound();

  const now = requestNow();
  const origin = await loadOrigin();
  const profile = getSportProfile(modality.sportProfile);
  const complete = isModalityComplete(snapshot, modality);
  const placements = complete ? modalityPlacements(snapshot, modality) : [];
  const pending = matchesOf(snapshot, modality.id).filter((match) => match.status === "scheduled" || match.status === "live");
  const results = finishedMatches(snapshot, modality.id).slice(0, 6);
  const scorers = profile.shape === "match" ? topScorers(snapshot, modality.id).slice(0, 5) : [];
  const mvps = profile.shape === "match" ? topMvps(snapshot, modality.id).slice(0, 5) : [];

  return (
    <article className="@container mx-auto w-full max-w-5xl space-y-10">
      <header className="overflow-hidden rounded-panel border border-border bg-card shadow-panel">
        {modality.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={modality.coverUrl} alt="" width={1280} height={480} decoding="async" className="aspect-[8/3] w-full bg-muted object-cover" />
        )}
        <div className="space-y-2 p-4 @md:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={modality.status === "in_progress" ? "default" : "secondary"}>{STATUS_LABEL[modality.status]}</Badge>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{snapshot.competition.name}</span>
          </div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground @md:text-4xl">
            {modality.emoji && <span className="me-2" aria-hidden="true">{modality.emoji}</span>}
            {modality.name}
          </h1>
          {modality.description && <p className="max-w-prose text-sm text-muted-foreground">{modality.description}</p>}
          <p className="text-xs text-muted-foreground">
            {modality.entries.length} equipe{modality.entries.length === 1 ? "" : "s"} inscrita{modality.entries.length === 1 ? "" : "s"}
            {snapshot.competition.overallEnabled && modality.weight !== 1 ? ` · peso ${modality.weight} no quadro geral` : ""}
          </p>
        </div>
      </header>

      {placements.length > 0 && (
        <section>
          <SectionHeader title="Colocação final" />
          <ol className="grid gap-2 @md:grid-cols-2 @3xl:grid-cols-3">
            {placements.map((placement) => {
              const participant = index.participants.get(placement.participantId);
              if (!participant) return null;
              return (
                <li key={placement.participantId}>
                  <Link href={PATHS.participant(participant.slug)} className="flex min-h-14 items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 ui-motion-base hover:border-ring">
                    <MedalBadge position={placement.position} />
                    <Crest name={participant.name} crestUrl={participant.crestUrl} color={participant.primaryColor} size="sm" />
                    <span className="min-w-0 flex-1 truncate font-semibold text-foreground">{participant.name}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section>
        <SectionHeader title={profile.shape === "event" ? "Resultado da prova" : "Classificação e chaveamento"} />
        <ModalityStages snapshot={snapshot} modality={modality} />
      </section>

      {profile.shape === "match" && pending.length > 0 && (
        <section>
          <SectionHeader title="Agenda" />
          <Schedule snapshot={snapshot} matches={pending} mode="round" origin={origin} now={now} showModality={false} />
        </section>
      )}

      {results.length > 0 && (
        <section>
          <SectionHeader title="Resultados" />
          <div className="grid gap-3 @xl:grid-cols-2 @4xl:grid-cols-3">
            {results.map((match) => (
              <MatchCard key={match.id} snapshot={snapshot} match={match} showModality={false} />
            ))}
          </div>
        </section>
      )}

      {(scorers.length > 0 || mvps.length > 0) && (
        <section className="grid gap-6 @3xl:grid-cols-2">
          {scorers.length > 0 && (
            <div>
              <SectionHeader title={profile.scoreUnit.plural === "gols" ? "Artilharia" : "Pontuadores"} />
              <AthleteRanking rows={scorers} unit={profile.scoreUnit} />
            </div>
          )}
          {mvps.length > 0 && (
            <div>
              <SectionHeader title="Craques do jogo" />
              <AthleteRanking rows={mvps} unit={{ singular: "prêmio", plural: "prêmios" }} />
            </div>
          )}
        </section>
      )}
    </article>
  );
}
