import Link from "next/link";
import { Play } from "lucide-react";
import type { BlockRendererProps } from "@venore/plugin-sdk";
import type { CompetitionSnapshot, MatchView } from "../contracts/types";
import { finishedMatches, liveMatches, matchesOf, upcomingMatches } from "../shared/derive";
import { formatScore } from "../shared/score";
import { youtubeThumbnailUrl } from "../shared/youtube";
import { calendarSubscriptionUrls } from "../shared/calendar";
import { PATHS } from "../shared/paths";
import { BlockFrame, SectionHeader } from "../components/section";
import { MatchCard } from "../components/match-card";
import { Schedule } from "../components/schedule";
import { SubscribeCalendar } from "../components/add-to-calendar";
import { Crest } from "../components/crest";
import { LiveBadge } from "../components/live-badge";
import { matchCalendarLinks } from "../components/lib/calendar-events";
import { matchContext, matchTitle, modalityLabel, safeColor, sideInfo } from "../components/lib/match-info";
import { relativeMatchLabel } from "../components/lib/schedule";
import { liveIslandFor, loadOrigin, loadSiteSnapshot, requestNow } from "../components/site-data";
import { emptyState, missingModalityNote, NO_COMPETITION } from "./common";
import { bool, href, int, modalityFilter, oneOf, text } from "./fields";

const GRID = "grid *:min-w-0 gap-3 @xl:grid-cols-2 @4xl:grid-cols-3";

// ---- Ao vivo ----

export function LiveNowSection({ snapshot, title }: { snapshot: CompetitionSnapshot; title: string }) {
  const live = liveMatches(snapshot);
  if (live.length === 0) return null;
  return (
    <BlockFrame>
      <SectionHeader title={<span className="inline-flex items-center gap-2">{title}<LiveBadge label={String(live.length)} /></span>} />
      <div className={GRID}>
        {live.map((match) => (
          <MatchCard key={match.id} snapshot={snapshot} match={match} live={liveIslandFor(snapshot, match)} />
        ))}
      </div>
    </BlockFrame>
  );
}

export async function LiveNowBlock({ block, mode }: BlockRendererProps) {
  const snapshot = await loadSiteSnapshot();
  if (!snapshot) return emptyState(mode, "Ao vivo agora", NO_COMPETITION);
  const title = text(block.data, "title") || "Ao vivo agora";
  if (liveMatches(snapshot).length === 0) return emptyState(mode, title, "Nenhum jogo ao vivo agora. No site, este bloco aparece sozinho quando um jogo começa.");
  return <LiveNowSection snapshot={snapshot} title={title} />;
}

// ---- Próximos jogos ----

export async function UpcomingSection({
  snapshot,
  title,
  limit,
  modalityId,
  scheduleHref,
}: {
  snapshot: CompetitionSnapshot;
  title: string;
  limit: number;
  modalityId?: string;
  scheduleHref: string | null;
}) {
  const now = requestNow();
  const origin = await loadOrigin();
  const matches = upcomingMatches(snapshot, now, modalityId).slice(0, limit);
  if (matches.length === 0) return null;
  return (
    <BlockFrame>
      <SectionHeader
        title={title}
        action={scheduleHref ? { href: scheduleHref, label: "Agenda completa" } : null}
        extra={<SubscribeCalendar urls={calendarSubscriptionUrls(`${origin}${PATHS.calendarFeed()}`)} />}
      />
      <div className={GRID}>
        {matches.map((match) => (
          <MatchCard key={match.id} snapshot={snapshot} match={match} calendar={matchCalendarLinks(snapshot, match, origin, now)} showModality={!modalityId} />
        ))}
      </div>
    </BlockFrame>
  );
}

export async function UpcomingBlock({ block, mode }: BlockRendererProps) {
  const snapshot = await loadSiteSnapshot();
  if (!snapshot) return emptyState(mode, "Próximos jogos", NO_COMPETITION);
  const title = text(block.data, "title") || "Próximos jogos";
  const { modality, missing } = modalityFilter(snapshot, block.data);
  if (upcomingMatches(snapshot, requestNow(), modality?.id).length === 0) return emptyState(mode, title, "Nenhum jogo agendado daqui pra frente.");
  return (
    <>
      {missingModalityNote(mode, missing)}
      <UpcomingSection snapshot={snapshot} title={title} limit={int(block.data, "limit", 1, 24, 6)} modalityId={modality?.id} scheduleHref={href(block.data, "scheduleHref", null)} />
    </>
  );
}

// ---- Agenda completa ----

export async function ScheduleBlock({ block, mode }: BlockRendererProps) {
  const snapshot = await loadSiteSnapshot();
  if (!snapshot) return emptyState(mode, "Agenda", NO_COMPETITION);
  const title = text(block.data, "title") || "Agenda";
  const { modality, missing } = modalityFilter(snapshot, block.data);
  const matches = matchesOf(snapshot, modality?.id);
  if (matches.length === 0) return emptyState(mode, title, "Ainda não há jogos cadastrados.");
  const now = requestNow();
  const origin = await loadOrigin();
  return (
    <BlockFrame>
      {missingModalityNote(mode, missing)}
      <SectionHeader title={title} extra={<SubscribeCalendar urls={calendarSubscriptionUrls(`${origin}${PATHS.calendarFeed()}`)} />} />
      <Schedule snapshot={snapshot} matches={matches} mode={oneOf(block.data, "groupBy", ["day", "round"] as const, "day")} origin={origin} now={now} showModality={!modality} />
    </BlockFrame>
  );
}

// ---- Resultados ----

export function ResultsSection({ snapshot, title, limit, modalityId, moreHref }: { snapshot: CompetitionSnapshot; title: string; limit: number; modalityId?: string; moreHref?: string | null }) {
  const matches = finishedMatches(snapshot, modalityId).slice(0, limit);
  if (matches.length === 0) return null;
  return (
    <BlockFrame>
      <SectionHeader title={title} action={moreHref ? { href: moreHref, label: "Todos os jogos" } : null} />
      <div className={GRID}>
        {matches.map((match) => (
          <MatchCard key={match.id} snapshot={snapshot} match={match} showModality={!modalityId} />
        ))}
      </div>
    </BlockFrame>
  );
}

export async function ResultsBlock({ block, mode }: BlockRendererProps) {
  const snapshot = await loadSiteSnapshot();
  if (!snapshot) return emptyState(mode, "Resultados", NO_COMPETITION);
  const title = text(block.data, "title") || "Últimos resultados";
  const { modality, missing } = modalityFilter(snapshot, block.data);
  if (finishedMatches(snapshot, modality?.id).length === 0) return emptyState(mode, title, "Nenhum jogo encerrado ainda.");
  return (
    <>
      {missingModalityNote(mode, missing)}
      <ResultsSection snapshot={snapshot} title={title} limit={int(block.data, "limit", 1, 48, 6)} modalityId={modality?.id} moreHref={href(block.data, "moreHref", null)} />
    </>
  );
}

// ---- Galeria de jogos e transmissões ----

function GalleryCard({ snapshot, match }: { snapshot: CompetitionSnapshot; match: MatchView }) {
  const home = sideInfo(snapshot, match, "home");
  const away = sideInfo(snapshot, match, "away");
  const { modality, stageLabel } = matchContext(snapshot, match);
  // Capa pronta → miniatura do YouTube → fundo com as cores das equipes. Nunca imagem gerada aqui.
  const image = match.coverImageUrl ?? youtubeThumbnailUrl(match.youtubeUrl);
  const a = safeColor(home.color) ?? "var(--primary)";
  const b = safeColor(away.color) ?? "var(--accent)";
  const score = match.status === "finished" || match.status === "live";
  return (
    <Link href={PATHS.match(match.id)} className="group flex flex-col overflow-hidden rounded-panel border border-border bg-card shadow-panel ui-motion-base hover:border-ring">
      <div className="relative aspect-video overflow-hidden bg-muted">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" width={480} height={270} loading="lazy" decoding="async" className="size-full object-cover ui-motion-base group-hover:scale-[1.02]" />
        ) : (
          <div className="flex size-full items-center justify-center gap-4" style={{ background: `linear-gradient(120deg, ${a} 0 50%, ${b} 50% 100%)` }}>
            <Crest name={home.name} crestUrl={home.crestUrl} color={null} size="lg" className="bg-card" />
            <Crest name={away.name} crestUrl={away.crestUrl} color={null} size="lg" className="bg-card" />
          </div>
        )}
        {match.youtubeUrl && (
          <span className="absolute bottom-2 end-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-xs font-bold text-foreground">
            <Play aria-hidden="true" className="size-3.5" />
            {match.status === "live" ? "Ao vivo" : "Assistir"}
          </span>
        )}
        {match.status === "live" && <LiveBadge className="absolute start-2 top-2 bg-background/90" />}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">{[modalityLabel(modality), stageLabel].filter(Boolean).join(" · ")}</p>
        <p className="line-clamp-2 font-semibold leading-snug text-foreground">
          {score ? `${home.shortName} ${formatScore(match.homeScore)} × ${formatScore(match.awayScore)} ${away.shortName}` : matchTitle(snapshot, match)}
        </p>
        <p className="mt-auto text-xs text-muted-foreground">{relativeMatchLabel(match.scheduledDate, match.scheduledTime, requestNow())}</p>
      </div>
    </Link>
  );
}

export async function MatchesGalleryBlock({ block, mode }: BlockRendererProps) {
  const snapshot = await loadSiteSnapshot();
  if (!snapshot) return emptyState(mode, "Jogos e transmissões", NO_COMPETITION);
  const title = text(block.data, "title") || "Jogos e transmissões";
  const { modality, missing } = modalityFilter(snapshot, block.data);
  const onlyWithVideo = bool(block.data, "onlyWithVideo", false);
  const limit = int(block.data, "limit", 1, 60, 12);
  // Ao vivo primeiro, depois os encerrados mais recentes, depois os próximos.
  const live = liveMatches(snapshot).filter((match) => !modality || match.modalityId === modality.id);
  const done = finishedMatches(snapshot, modality?.id);
  const next = upcomingMatches(snapshot, requestNow(), modality?.id);
  const matches = [...live, ...done, ...next].filter((match) => !onlyWithVideo || match.youtubeUrl).slice(0, limit);
  if (matches.length === 0) return emptyState(mode, title, onlyWithVideo ? "Nenhum jogo com transmissão cadastrada ainda." : "Ainda não há jogos cadastrados.");
  return (
    <BlockFrame>
      {missingModalityNote(mode, missing)}
      <SectionHeader title={title} />
      <div className="grid *:min-w-0 gap-3 @md:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4">
        {matches.map((match) => (
          <GalleryCard key={match.id} snapshot={snapshot} match={match} />
        ))}
      </div>
    </BlockFrame>
  );
}
