import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, Star } from "lucide-react";
import type { MatchView } from "../../../contracts/types";
import { finishedMatches, indexes, scoringEvents } from "../../../shared/derive";
import { getSportProfile } from "../../../shared/sport-profiles";
import { formatScore } from "../../../shared/score";
import { formatMatchDate } from "../../../shared/timezone";
import { PATHS } from "../../../shared/paths";
import { AthletePhoto, Crest } from "../../../components/crest";
import { MatchCard } from "../../../components/match-card";
import { ShareBar } from "../../../components/share-bar";
import { StatTile } from "../../../components/stat-tile";
import { EmptyNote, SectionHeader } from "../../../components/section";
import { matchTitle, modalityLabel, safeColor } from "../../../components/lib/match-info";
import { isSlugParam, loadFanAwards, loadOrigin, loadSiteSnapshot } from "../../../components/site-data";

type Props = { params: Promise<Record<string, string>>; searchParams: Promise<Record<string, string | string[] | undefined>> };

type AwardItem = { match: MatchView; kind: "mvp" | "fan" };

// Perfil público do atleta (/atletas/:slug): foto, equipe, números, prêmios e últimos jogos da equipe.
export default async function PublicAthletePage({ params }: Props) {
  const { slug } = await params;
  if (!isSlugParam(slug)) notFound();
  const snapshot = await loadSiteSnapshot();
  if (!snapshot) notFound();
  const index = indexes(snapshot);
  const athlete = index.athletesBySlug.get(slug);
  if (!athlete) notFound();

  const [origin, fanAwards] = await Promise.all([loadOrigin(), loadFanAwards()]);
  const participant = index.participants.get(athlete.participantId) ?? null;

  // Pontos/gols: a unidade é a do perfil da modalidade; atleta em modalidades de unidades
  // diferentes (gols e pontos) vê "pontos" genérico.
  const scoring = scoringEvents(snapshot).filter((event) => event.athleteId === athlete.id);
  const scored = scoring.reduce((sum, event) => sum + event.amount, 0);
  const units = new Set(
    scoring.map((event) => {
      const match = index.matches.get(event.matchId);
      const modality = match ? index.modalities.get(match.modalityId) : undefined;
      return getSportProfile(modality?.sportProfile ?? "pontos").scoreUnit.plural;
    }),
  );
  const scoreLabel = units.size === 1 ? [...units][0] : "pontos";
  const cards = snapshot.events.filter((event) => event.athleteId === athlete.id && (event.kind === "yellow_card" || event.kind === "red_card"));
  const yellow = cards.filter((event) => event.kind === "yellow_card").length;
  const red = cards.length - yellow;

  const teamFinished = participant ? finishedMatches(snapshot).filter((match) => match.homeId === participant.id || match.awayId === participant.id) : [];
  const awards: AwardItem[] = [
    ...teamFinished.filter((match) => match.mvpAthleteId === athlete.id).map((match) => ({ match, kind: "mvp" as const })),
    ...teamFinished.filter((match) => (fanAwards.get(match.id) ?? []).includes(athlete.id)).map((match) => ({ match, kind: "fan" as const })),
  ];
  const mvpCount = awards.filter((award) => award.kind === "mvp").length;
  const fanCount = awards.length - mvpCount;
  const meta = [athlete.number !== null ? `#${athlete.number}` : null, athlete.position, athlete.isCaptain ? "Capitão" : null].filter(Boolean).join(" · ");
  const color = safeColor(participant?.primaryColor);

  return (
    <article className="@container mx-auto w-full max-w-3xl space-y-8">
      <header className="overflow-hidden rounded-panel border border-border bg-card shadow-panel">
        <div aria-hidden="true" className="h-20 bg-primary" style={color ? { background: `linear-gradient(135deg, ${color}, ${safeColor(participant?.secondaryColor) ?? color})` } : undefined} />
        <div className="-mt-12 flex flex-col items-center gap-2 px-4 pb-5 text-center">
          <AthletePhoto name={athlete.name} photoUrl={athlete.photoUrl} color={participant?.primaryColor ?? null} size="xl" className="border-4 border-card bg-card" />
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">{athlete.name}</h1>
          {meta && <p className="text-sm tabular-nums text-muted-foreground">{meta}</p>}
          {participant && (
            <Link href={PATHS.participant(participant.slug)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-3 text-sm font-semibold text-foreground ui-motion-base hover:bg-muted">
              <Crest name={participant.name} crestUrl={participant.crestUrl} color={participant.primaryColor} size="xs" />
              {participant.name}
            </Link>
          )}
          {athlete.bio && <p className="max-w-prose text-sm text-muted-foreground">{athlete.bio}</p>}
        </div>
      </header>

      <section aria-label="Números">
        <div className="grid grid-cols-2 gap-2 @md:grid-cols-4">
          <StatTile label={scoreLabel} value={formatScore(scored)} />
          <StatTile label="Craque do jogo" value={mvpCount} />
          <StatTile label="Craque da torcida" value={fanCount} />
          <StatTile label="Jogos da equipe" value={teamFinished.length} hint={yellow + red > 0 ? `${yellow} amarelo${yellow === 1 ? "" : "s"} · ${red} vermelho${red === 1 ? "" : "s"}` : undefined} />
        </div>
      </section>

      <ShareBar url={`${origin}${PATHS.athlete(athlete.slug)}`} text={`${athlete.name}${participant ? ` (${participant.name})` : ""} — ${snapshot.competition.name}`} storyImageUrl={null} />

      <section>
        <SectionHeader title="Prêmios" />
        {awards.length === 0 ? (
          <EmptyNote>Nenhum prêmio ainda.</EmptyNote>
        ) : (
          <ul className="space-y-2">
            {awards.map(({ match, kind }) => {
              const modality = index.modalities.get(match.modalityId);
              return (
                <li key={`${kind}-${match.id}`}>
                  <Link href={PATHS.match(match.id)} className="flex min-h-14 items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 ui-motion-base hover:border-ring">
                    <span className={kind === "mvp" ? "flex size-9 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning" : "flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary"}>
                      {kind === "mvp" ? <Star aria-hidden="true" className="size-4" /> : <Award aria-hidden="true" className="size-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{kind === "mvp" ? "Craque do jogo" : "Craque da torcida"}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {matchTitle(snapshot, match)} · {modalityLabel(modality)} · {formatMatchDate(match.scheduledDate, null)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {teamFinished.length > 0 && (
        <section>
          <SectionHeader title="Últimos jogos da equipe" />
          <div className="grid gap-3 @xl:grid-cols-2">
            {teamFinished.slice(0, 4).map((match) => (
              <MatchCard key={match.id} snapshot={snapshot} match={match} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
