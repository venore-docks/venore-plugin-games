import Link from "next/link";
import type { BlockRendererProps } from "@venore/plugin-sdk";
import { cn } from "@venore/plugin-sdk/ui";
import type { CompetitionSnapshot, MatchView } from "../contracts/types";
import { finishedMatches, indexes, liveMatches, overallTable, participantRecord, upcomingMatches } from "../shared/derive";
import { formatScore } from "../shared/score";
import { PATHS } from "../shared/paths";
import { BlockFrame, SectionHeader } from "../components/section";
import { Crest, TeamStripe } from "../components/crest";
import { LiveBadge } from "../components/live-badge";
import { LiveScore } from "../components/live-score";
import { MatchCard } from "../components/match-card";
import { formatMatchDate } from "../shared/timezone";
import { AddToCalendar } from "../components/add-to-calendar";
import { StatTile } from "../components/stat-tile";
import { matchCalendarLinks } from "../components/lib/calendar-events";
import { matchContext, modalityLabel, safeColor, sideInfo } from "../components/lib/match-info";
import { relativeMatchLabel } from "../components/lib/schedule";
import { liveIslandFor, loadOrigin, loadSiteSnapshot, pollStates, requestNow } from "../components/site-data";
import { emptyState, missingModalityNote, NO_COMPETITION } from "./common";
import { bool, href, modalityFilter, participantBySlug, text } from "./fields";

// Jogo em destaque: o ao vivo (o primeiro) ou o próximo agendado.
function featuredMatch(snapshot: CompetitionSnapshot, now: number, modalityId?: string): MatchView | null {
  const live = liveMatches(snapshot).filter((match) => !modalityId || match.modalityId === modalityId);
  return live[0] ?? upcomingMatches(snapshot, now, modalityId)[0] ?? null;
}

async function hasOpenVote(snapshot: CompetitionSnapshot): Promise<boolean> {
  return (await pollStates(snapshot)).some((state) => state.window.isOpen && state.poll.kind === "match_athlete");
}

// ---- Card 16:9 do próximo jogo ----

export async function NextMatchCardView({ snapshot, match, label }: { snapshot: CompetitionSnapshot; match: MatchView; label?: string }) {
  const now = requestNow();
  const origin = await loadOrigin();
  const home = sideInfo(snapshot, match, "home");
  const away = sideInfo(snapshot, match, "away");
  const { modality, stageLabel } = matchContext(snapshot, match);
  const live = liveIslandFor(snapshot, match);
  const calendar = matchCalendarLinks(snapshot, match, origin, now);
  const a = safeColor(home.color) ?? "var(--primary)";
  const b = safeColor(away.color) ?? "var(--accent)";
  return (
    <div className="@container relative overflow-hidden rounded-panel border border-border shadow-panel">
      <div className="relative flex aspect-[4/5] flex-col @sm:aspect-video" style={{ background: `linear-gradient(115deg, ${a} 0 49.5%, ${b} 50.5% 100%)` }}>
        <div className="absolute inset-0 bg-background/72" aria-hidden="true" />
        <div className="relative flex flex-1 flex-col justify-between gap-2 p-4 @md:p-6">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 text-xs font-bold uppercase tracking-wider text-muted-foreground @md:text-sm">
              {label ?? (match.status === "live" ? "Agora" : "Próximo jogo")}
              <span className="block truncate font-semibold normal-case tracking-normal text-foreground">{[modalityLabel(modality), stageLabel].filter(Boolean).join(" · ")}</span>
            </p>
            {match.status === "live" && <LiveBadge />}
          </div>
          <div className="flex items-center justify-center gap-3 @md:gap-8">
            <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
              <Crest name={home.name} crestUrl={home.crestUrl} color={home.color} size="xl" className="bg-card" />
              <span className="line-clamp-2 font-display text-sm font-bold leading-tight text-foreground @md:text-xl">{home.name}</span>
            </div>
            <div className="shrink-0">
              {live ? (
                <LiveScore initial={live.initial} channelKey={live.channelKey} matchId={match.id} size="xl" />
              ) : (
                <span className="font-display text-2xl font-extrabold text-muted-foreground @md:text-4xl" aria-hidden="true">
                  ×
                </span>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
              <Crest name={away.name} crestUrl={away.crestUrl} color={away.color} size="xl" className="bg-card" />
              <span className="line-clamp-2 font-display text-sm font-bold leading-tight text-foreground @md:text-xl">{away.name}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <p className="min-w-0 text-sm text-foreground">
              <span className="block font-display text-lg font-bold @md:text-2xl">{relativeMatchLabel(match.scheduledDate, match.scheduledTime, now)}</span>
              {match.venue && <span className="block text-xs text-muted-foreground @md:text-sm">{match.venue}</span>}
            </p>
            <div className="relative z-10 flex items-center gap-1">
              {calendar && <AddToCalendar links={calendar} compact align="right" />}
              <Link href={PATHS.match(match.id)} className="inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground ui-motion-base hover:bg-primary/90">
                Ver jogo
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export async function NextMatchCardBlock({ block, mode }: BlockRendererProps) {
  const snapshot = await loadSiteSnapshot();
  if (!snapshot) return emptyState(mode, "Próximo jogo", NO_COMPETITION);
  const { modality, missing } = modalityFilter(snapshot, block.data);
  const match = featuredMatch(snapshot, requestNow(), modality?.id);
  if (!match) return emptyState(mode, "Próximo jogo", "Nenhum jogo ao vivo ou agendado daqui pra frente.");
  const title = text(block.data, "title");
  return (
    <BlockFrame>
      {missingModalityNote(mode, missing)}
      {title && <SectionHeader title={title} />}
      <NextMatchCardView snapshot={snapshot} match={match} />
    </BlockFrame>
  );
}

// ---- Capa da competição ----

export async function HeroSection({
  snapshot,
  title,
  subtitle,
  cta,
  showLogo,
}: {
  snapshot: CompetitionSnapshot;
  title: string;
  subtitle: string;
  cta: { label: string; href: string } | null;
  showLogo: boolean;
}) {
  const now = requestNow();
  const match = featuredMatch(snapshot, now);
  const voteOpen = await hasOpenVote(snapshot);
  const logo = showLogo ? snapshot.competition.logoUrl : null;
  return (
    <BlockFrame>
      <div className="overflow-hidden rounded-panel bg-primary text-primary-foreground shadow-panel">
        <div
          className="grid *:min-w-0 gap-6 p-5 @md:p-8 @4xl:grid-cols-[1fr_minmax(0,26rem)] @4xl:items-center"
          style={{ backgroundImage: "radial-gradient(circle at 90% 10%, color-mix(in oklch, var(--accent) 55%, transparent), transparent 55%)" }}
        >
          <div className="space-y-4">
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" width={96} height={96} decoding="async" className="size-16 rounded-xl bg-primary-foreground/10 object-contain p-1 @md:size-20" />
            )}
            <div className="space-y-2">
              <h1 className="font-display text-3xl font-extrabold leading-[1.05] tracking-tight @md:text-5xl">{title}</h1>
              {subtitle && <p className="max-w-prose text-base text-primary-foreground/85 @md:text-lg">{subtitle}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {cta && (
                <Link href={cta.href} className="inline-flex min-h-11 items-center rounded-full bg-primary-foreground px-5 text-sm font-bold text-primary ui-motion-base hover:bg-primary-foreground/90">
                  {cta.label}
                </Link>
              )}
              {voteOpen && (
                <Link
                  href={PATHS.vote()}
                  className="inline-flex min-h-11 items-center rounded-full border border-primary-foreground/40 px-5 text-sm font-bold text-primary-foreground ui-motion-base hover:bg-primary-foreground/10"
                >
                  Votar no craque
                </Link>
              )}
            </div>
          </div>
          {match && (
            <div className="rounded-panel bg-card p-1 text-card-foreground">
              {/* Rótulo acima do card: "Ao vivo"/"Próximo jogo · Hoje 15:00". A data absoluta já está no card,
                  então só repete quando o rótulo relativo diz algo a mais (hoje, amanhã, em N dias). */}
              <p className="px-3 pt-2 text-xs font-bold uppercase tracking-caps text-muted-foreground">
                {match.status === "live" ? "Ao vivo agora" : "Próximo jogo"}
                {match.status === "scheduled" && relativeMatchLabel(match.scheduledDate, match.scheduledTime, now) !== formatMatchDate(match.scheduledDate, match.scheduledTime)
                  ? ` · ${relativeMatchLabel(match.scheduledDate, match.scheduledTime, now)}`
                  : ""}
              </p>
              <MatchCard snapshot={snapshot} match={match} live={liveIslandFor(snapshot, match)} calendar={matchCalendarLinks(snapshot, match, await loadOrigin(), now)} className="border-0 shadow-none" />
            </div>
          )}
        </div>
      </div>
    </BlockFrame>
  );
}

export async function HeroBlock({ block, mode }: BlockRendererProps) {
  const snapshot = await loadSiteSnapshot();
  if (!snapshot) return emptyState(mode, "Capa da competição", NO_COMPETITION);
  const ctaLabel = text(block.data, "ctaLabel");
  const ctaHref = href(block.data, "ctaHref", null);
  return (
    <HeroSection
      snapshot={snapshot}
      title={text(block.data, "title") || snapshot.competition.name}
      subtitle={text(block.data, "subtitle") || snapshot.competition.description || ""}
      cta={ctaLabel && ctaHref ? { label: ctaLabel, href: ctaHref } : null}
      showLogo={bool(block.data, "showLogo", true)}
    />
  );
}

// ---- Destaque de uma equipe ----

export async function TeamSpotlightBlock({ block, mode }: BlockRendererProps) {
  const snapshot = await loadSiteSnapshot();
  if (!snapshot) return emptyState(mode, "Destaque de equipe", NO_COMPETITION);
  const participant = participantBySlug(snapshot, block.data);
  if (!participant) {
    const slug = text(block.data, "participant");
    return emptyState(mode, "Destaque de equipe", slug ? `Equipe "${slug}" não encontrada. Confira o slug em Equipes.` : "Informe o slug da equipe nas configurações do bloco.");
  }
  const now = requestNow();
  const record = participantRecord(snapshot, participant.id);
  const involves = (match: MatchView) => match.homeId === participant.id || match.awayId === participant.id;
  const next = liveMatches(snapshot).find(involves) ?? upcomingMatches(snapshot, now).find(involves) ?? null;
  const last = finishedMatches(snapshot).find(involves) ?? null;
  const overall = snapshot.competition.overallEnabled ? overallTable(snapshot).find((row) => row.participantId === participant.id) : undefined;
  const athletes = indexes(snapshot).athletesByParticipant.get(participant.id)?.length ?? 0;
  const title = text(block.data, "title");
  return (
    <BlockFrame>
      {title && <SectionHeader title={title} />}
      <div className="overflow-hidden rounded-panel border border-border bg-card shadow-panel">
        <TeamStripe primary={participant.primaryColor} secondary={participant.secondaryColor} className="h-2" />
        <div className="grid *:min-w-0 gap-4 p-4 @2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @md:p-6">
          <div className="flex flex-col gap-4">
            <Link href={PATHS.participant(participant.slug)} className="flex items-center gap-3 rounded-xl ui-motion-base hover:opacity-85">
              <Crest name={participant.name} crestUrl={participant.crestUrl} color={participant.primaryColor} size="xl" />
              <span className="min-w-0">
                <span className="block font-display text-2xl font-extrabold leading-tight text-foreground">{participant.name}</span>
                <span className="block text-sm text-muted-foreground">
                  {athletes} atleta{athletes === 1 ? "" : "s"}
                  {overall ? ` · ${overall.position}º no quadro geral (${formatScore(overall.total)} pts)` : ""}
                </span>
              </span>
            </Link>
            {record.played > 0 && (
              <div className="grid *:min-w-0 grid-cols-4 gap-2">
                <StatTile label="Jogos" value={record.played} />
                <StatTile label="V" value={record.won} />
                <StatTile label="E" value={record.drawn} />
                <StatTile label="D" value={record.lost} />
              </div>
            )}
          </div>
          <div className={cn("flex flex-col gap-3", !next && !last && "justify-center")}>
            {next && <MatchCard snapshot={snapshot} match={next} live={liveIslandFor(snapshot, next)} calendar={matchCalendarLinks(snapshot, next, await loadOrigin(), now)} />}
            {!next && last && <MatchCard snapshot={snapshot} match={last} />}
            {!next && !last && <p className="text-sm text-muted-foreground">Sem jogos marcados.</p>}
          </div>
        </div>
      </div>
    </BlockFrame>
  );
}
