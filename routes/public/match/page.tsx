import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Badge, cn } from "@venore/plugin-sdk/ui";
import type { CompetitionSnapshot, MatchEventView, MatchSide, MatchView } from "../../../contracts/types";
import { indexes } from "../../../shared/derive";
import { getSportProfile, type SportProfile } from "../../../shared/sport-profiles";
import { formatScore } from "../../../shared/score";
import { formatMatchDate } from "../../../shared/timezone";
import { extractYoutubeVideoId } from "../../../shared/youtube";
import { isUuid } from "../../../shared/ids";
import { PATHS } from "../../../shared/paths";
import { pollWindowFromSnapshot } from "../../../runtime/votes";
import { AthletePhoto, Crest } from "../../../components/crest";
import { LiveBadge } from "../../../components/live-badge";
import { LiveScore } from "../../../components/live-score";
import { ShareBar } from "../../../components/share-bar";
import { AddToCalendar } from "../../../components/add-to-calendar";
import { matchCalendarLinks } from "../../../components/lib/calendar-events";
import {
  joinNames,
  matchContext,
  matchTitle,
  MATCH_STATUS_LABEL,
  modalityLabel,
  penaltyWinnerSide,
  safeColor,
  setsDetail,
  sideInfo,
  winnerSide,
} from "../../../components/lib/match-info";
import { liveIslandFor, loadFanAwards, loadOrigin, loadSiteSnapshot, loadVoteWindowHours, matchPoll, requestNow } from "../../../components/site-data";

type Props = { params: Promise<Record<string, string>>; searchParams: Promise<Record<string, string | string[] | undefined>> };

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="font-display text-lg font-bold tracking-tight text-foreground">{children}</h2>;
}

function TeamColumn({ snapshot, match, side }: { snapshot: CompetitionSnapshot; match: MatchView; side: MatchSide }) {
  const info = sideInfo(snapshot, match, side);
  const lost = winnerSide(match) !== null && winnerSide(match) !== side;
  const body = (
    <>
      <Crest name={info.name} crestUrl={info.crestUrl} color={info.color} size="xl" />
      <span className={cn("line-clamp-2 text-center text-sm font-bold leading-tight sm:text-base", info.participant ? "text-foreground" : "italic text-muted-foreground")}>{info.name}</span>
    </>
  );
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col items-center gap-2", lost && "opacity-60")}>
      {info.href ? (
        <Link href={info.href} className="flex min-h-11 flex-col items-center gap-2 rounded-xl ui-motion-base hover:opacity-85">
          {body}
        </Link>
      ) : (
        body
      )}
    </div>
  );
}

function Broadcast({ youtubeUrl, status }: { youtubeUrl: string | null; status: MatchView["status"] }) {
  if (!youtubeUrl) {
    return (
      <p className="rounded-panel border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
        {status === "finished" ? "Este jogo não tem transmissão registrada." : "Transmissão ainda não disponível."}
      </p>
    );
  }
  const videoId = extractYoutubeVideoId(youtubeUrl);
  if (!videoId) {
    return (
      <a
        href={youtubeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-14 items-center justify-center gap-2 rounded-panel border border-border bg-card p-4 text-sm font-bold text-primary hover:underline"
      >
        Assistir no YouTube ↗
      </a>
    );
  }
  return (
    <div className="space-y-2">
      <div className="aspect-video w-full overflow-hidden rounded-panel border border-border bg-muted shadow-panel">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}`}
          title="Transmissão do jogo"
          loading="lazy"
          className="size-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
      <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">
        Assistir no YouTube ↗
      </a>
    </div>
  );
}

function minuteLabel(clockMs: number | null): string | null {
  return clockMs === null ? null : `${Math.floor(clockMs / 60_000) + 1}'`;
}

function EventItem({ snapshot, match, event, profile }: { snapshot: CompetitionSnapshot; match: MatchView; event: MatchEventView; profile: SportProfile }) {
  const kind = profile.eventKinds.find((item) => item.key === event.kind);
  const athlete = event.athleteId ? indexes(snapshot).athletes.get(event.athleteId) : undefined;
  const team = sideInfo(snapshot, match, event.side);
  const isHome = event.side === "home";
  return (
    <li className={cn("flex items-center gap-3", isHome ? "flex-row" : "flex-row-reverse text-end")}>
      <span className="w-10 shrink-0 text-center text-xs font-bold tabular-nums text-muted-foreground">{minuteLabel(event.clockMs) ?? ""}</span>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-base" aria-hidden="true">
        {kind?.emoji ?? "•"}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">
          {athlete ? (
            <Link href={PATHS.athlete(athlete.slug)} className="hover:underline">
              {athlete.name}
            </Link>
          ) : (
            (kind?.label ?? "Lance")
          )}
          {kind?.scores && event.amount !== 1 ? ` (+${formatScore(event.amount)})` : ""}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {athlete ? `${kind?.label ?? "Lance"} · ` : ""}
          {team.shortName}
        </p>
      </div>
    </li>
  );
}

function Timeline({ snapshot, match, profile }: { snapshot: CompetitionSnapshot; match: MatchView; profile: SportProfile }) {
  const events = (indexes(snapshot).eventsByMatch.get(match.id) ?? [])
    // Vôlei: cada ponto é um lance — a súmula mostra os sets, não 100 linhas de "ponto".
    .filter((event) => event.kind !== "foul" && !(profile.usesSets && profile.eventKinds.some((kind) => kind.key === event.kind && kind.scores)))
    .filter((event) => event.amount > 0 || !profile.eventKinds.some((kind) => kind.key === event.kind && kind.scores))
    .sort((a, b) => (a.period ?? 0) - (b.period ?? 0) || (a.clockMs ?? 0) - (b.clockMs ?? 0) || a.createdAt.localeCompare(b.createdAt));
  if (events.length === 0) return <p className="text-sm text-muted-foreground">Nenhum lance registrado.</p>;
  const periods = profile.clock.enabled ? [...new Set(events.map((event) => event.period ?? 1))] : [null];
  return (
    <div className="space-y-4">
      {periods.map((period) => {
        const list = period === null ? events : events.filter((event) => (event.period ?? 1) === period);
        return (
          <div key={period ?? "all"} className="space-y-2">
            {period !== null && periods.length > 0 && (
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {period}º {profile.clock.periodLabel}
              </p>
            )}
            <ul className="space-y-2">
              {list.map((event) => (
                <EventItem key={event.id} snapshot={snapshot} match={match} event={event} profile={profile} />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// Página pública de UM jogo (/jogos/:id) — dentro do tema do site. Tudo do snapshot; placar ao vivo
// por island só quando o jogo está ao vivo num canal.
export default async function PublicMatchPage({ params }: Props) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const snapshot = await loadSiteSnapshot();
  if (!snapshot) notFound();
  const index = indexes(snapshot);
  const match = index.matches.get(id);
  if (!match || match.status === "cancelled") notFound();

  const now = requestNow();
  const [origin, windowHours, fanAwards] = await Promise.all([loadOrigin(), loadVoteWindowHours(), loadFanAwards()]);
  const { modality, stageLabel } = matchContext(snapshot, match);
  const profile = getSportProfile(modality?.sportProfile ?? "pontos");
  const home = sideInfo(snapshot, match, "home");
  const away = sideInfo(snapshot, match, "away");
  const live = liveIslandFor(snapshot, match);
  const calendar = matchCalendarLinks(snapshot, match, origin, now);
  const penalty = penaltyWinnerSide(match);
  const sets = setsDetail(match);
  const mvp = match.mvpAthleteId ? index.athletes.get(match.mvpAthleteId) : undefined;
  const poll = matchPoll(snapshot, match.id);
  const pollWindow = poll ? pollWindowFromSnapshot(snapshot, poll, windowHours, now) : null;
  const fanWinners = (fanAwards.get(match.id) ?? []).map((athleteId) => index.athletes.get(athleteId)).filter((athlete) => athlete !== undefined);
  const boosts = index.boostsByMatch.get(match.id) ?? [];
  const title = matchTitle(snapshot, match);
  const shareText =
    match.status === "finished"
      ? `${home.name} ${formatScore(match.homeScore)} × ${formatScore(match.awayScore)} ${away.name} — ${modality?.name ?? snapshot.competition.name}`
      : `${title} — ${modality?.name ?? snapshot.competition.name}`;
  const homeColor = safeColor(home.color);
  const awayColor = safeColor(away.color);
  const showScore = match.status === "live" || match.status === "finished";

  return (
    <article className="@container mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {[snapshot.competition.name, modality ? modalityLabel(modality) : null].filter(Boolean).join(" · ")}
        </p>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {match.status === "live" ? <LiveBadge /> : <Badge variant={match.status === "finished" ? "secondary" : "outline"}>{MATCH_STATUS_LABEL[match.status]}</Badge>}
          {stageLabel && <span>{stageLabel}</span>}
          <span aria-hidden="true">·</span>
          <span>{formatMatchDate(match.scheduledDate, match.scheduledTime)}</span>
          {match.venue && (
            <>
              <span aria-hidden="true">·</span>
              <span>{match.venue}</span>
            </>
          )}
        </div>
      </header>

      {match.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={match.coverImageUrl}
          alt={title}
          width={1280}
          height={720}
          decoding="async"
          className="aspect-video w-full rounded-panel border border-border bg-muted object-cover shadow-panel"
        />
      )}

      <section aria-label="Placar" className="overflow-hidden rounded-panel border border-border bg-card shadow-panel">
        <div
          aria-hidden="true"
          className="h-1.5"
          style={{ background: homeColor || awayColor ? `linear-gradient(90deg, ${homeColor ?? "var(--primary)"} 0 50%, ${awayColor ?? "var(--accent)"} 50% 100%)` : "var(--primary)" }}
        />
        <div className="flex items-center gap-2 p-4 sm:gap-6 sm:p-6">
          <TeamColumn snapshot={snapshot} match={match} side="home" />
          <div className="flex w-28 shrink-0 flex-col items-center gap-1 sm:w-40">
            {live ? (
              <LiveScore initial={live.initial} channelKey={live.channelKey} matchId={match.id} size="xl" />
            ) : showScore ? (
              <span className="font-display text-5xl font-extrabold leading-none tabular-nums text-foreground sm:text-6xl">
                {formatScore(match.homeScore)}
                <span className="mx-2 text-muted-foreground/56" aria-hidden="true">
                  ×
                </span>
                <span className="sr-only"> a </span>
                {formatScore(match.awayScore)}
              </span>
            ) : (
              <span className="text-center">
                <span className="block font-display text-3xl font-extrabold tabular-nums text-foreground">{match.scheduledTime ? match.scheduledTime.slice(0, 5) : "×"}</span>
                <span className="text-xs text-muted-foreground">{match.scheduledDate ? formatMatchDate(match.scheduledDate, null) : "Data a definir"}</span>
              </span>
            )}
            {sets && <span className="text-center text-xs tabular-nums text-muted-foreground">Sets: {sets}</span>}
            {penalty && <span className="text-center text-xs font-semibold text-foreground">{sideInfo(snapshot, match, penalty).shortName} venceu nos pênaltis</span>}
          </div>
          <TeamColumn snapshot={snapshot} match={match} side="away" />
        </div>
        {(match.resultNote || calendar) && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2">
            {match.resultNote ? <p className="text-sm text-muted-foreground">{match.resultNote}</p> : <span />}
            {calendar && <AddToCalendar links={calendar} align="right" />}
          </div>
        )}
      </section>

      <ShareBar url={`${origin}${PATHS.match(match.id)}`} text={shareText} storyImageUrl={match.storyImageUrl} storyFileName={`jogo-${match.id.slice(0, 8)}`} />

      {(mvp || poll) && (
        <section className="grid gap-3 @lg:grid-cols-2" aria-label="Destaques do jogo">
          {mvp && (
            <Link href={PATHS.athlete(mvp.slug)} className="flex min-h-16 items-center gap-3 rounded-panel border border-warning-border bg-warning-soft p-3 ui-motion-base hover:border-ring">
              <AthletePhoto name={mvp.name} photoUrl={mvp.photoUrl} color={index.participants.get(mvp.participantId)?.primaryColor ?? null} size="lg" />
              <span className="min-w-0">
                <span className="block text-xs font-bold uppercase tracking-wider text-warning">Craque do jogo</span>
                <span className="block truncate font-display text-lg font-bold text-foreground">{mvp.name}</span>
                {match.mvpNote && <span className="block truncate text-xs text-muted-foreground">“{match.mvpNote}”</span>}
              </span>
            </Link>
          )}
          {poll && pollWindow && (
            <div className="flex min-h-16 items-center gap-3 rounded-panel border border-border bg-card p-3">
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold uppercase tracking-wider text-primary">Craque da torcida</span>
                {pollWindow.isOpen ? (
                  <span className="block text-sm text-foreground">A votação está aberta — escolha quem jogou mais.</span>
                ) : pollWindow.closedForGood ? (
                  fanWinners.length > 0 ? (
                    <span className="block truncate font-display text-lg font-bold text-foreground">{joinNames(fanWinners.map((athlete) => athlete.name))}</span>
                  ) : (
                    <span className="block text-sm text-muted-foreground">Votação encerrada sem votos.</span>
                  )
                ) : (
                  <span className="block text-sm text-muted-foreground">A votação abre quando o jogo começar.</span>
                )}
              </span>
              {pollWindow.isOpen ? (
                <Link href={PATHS.voteMatch(match.id)} className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground ui-motion-base hover:bg-primary/90">
                  Votar
                </Link>
              ) : pollWindow.closedForGood ? (
                <Link href={PATHS.voteMatch(match.id)} className="inline-flex min-h-11 shrink-0 items-center px-2 text-sm font-semibold text-primary hover:underline">
                  Resultado
                </Link>
              ) : null}
            </div>
          )}
        </section>
      )}

      <section className="space-y-3">
        <SectionTitle>Transmissão</SectionTitle>
        <Broadcast youtubeUrl={match.youtubeUrl} status={match.status} />
      </section>

      {profile.shape === "match" && match.status !== "scheduled" && (
        <section className="space-y-3">
          <SectionTitle>Lances</SectionTitle>
          <Timeline snapshot={snapshot} match={match} profile={profile} />
        </section>
      )}

      {boosts.length > 0 && (
        <section className="space-y-3">
          <SectionTitle>Power plays</SectionTitle>
          <ul className="grid gap-2 @md:grid-cols-2">
            {boosts.map((boost) => {
              const team = sideInfo(snapshot, match, boost.side);
              return (
                <li key={boost.id} className="flex min-h-12 items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
                  <span className="text-lg" aria-hidden="true">
                    {boost.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">{boost.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{team.shortName}</span>
                  </span>
                  {boost.clockMs !== null && <span className="text-xs font-bold tabular-nums text-muted-foreground">{minuteLabel(boost.clockMs)}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {modality && (
        <nav className="flex flex-wrap gap-2 border-t border-border pt-4 text-sm">
          <Link href={PATHS.modality(modality.slug)} className="inline-flex min-h-11 items-center rounded-full border border-border px-4 font-semibold text-foreground ui-motion-base hover:bg-muted">
            Ver {modality.name}
          </Link>
          {home.href && (
            <Link href={home.href} className="inline-flex min-h-11 items-center rounded-full border border-border px-4 font-semibold text-foreground ui-motion-base hover:bg-muted">
              {home.shortName}
            </Link>
          )}
          {away.href && (
            <Link href={away.href} className="inline-flex min-h-11 items-center rounded-full border border-border px-4 font-semibold text-foreground ui-motion-base hover:bg-muted">
              {away.shortName}
            </Link>
          )}
        </nav>
      )}
    </article>
  );
}
