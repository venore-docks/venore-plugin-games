import type { Metadata } from "next";
import { indexes } from "../../shared/derive";
import { formatScore } from "../../shared/score";
import { formatMatchDate } from "../../shared/timezone";
import { isUuid } from "../../shared/ids";
import { PATHS } from "../../shared/paths";
import { matchContext, matchTitle, modalityLabel, sideInfo } from "../../components/lib/match-info";
import { isSlugParam, loadOrigin, loadSiteSnapshot } from "../../components/site-data";

// <head> das páginas públicas (título, descrição, Open Graph — preview no WhatsApp). Imagem de
// preview = arquivo PRONTO (capa 1280×720 do jogo, brasão, foto), nunca gerada aqui. O layout raiz
// não declara metadataBase, então URL relativa vira absoluta pela origem do site.

function absolute(origin: string, url: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

function build(input: { title: string; description: string; path: string; origin: string; image: { url: string; width?: number; height?: number; alt: string } | null }): Metadata {
  const url = `${input.origin}${input.path}`;
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title: input.title,
      description: input.description,
      url,
      ...(input.image ? { images: [input.image] } : {}),
    },
    twitter: { card: input.image && (input.image.width ?? 0) >= 600 ? "summary_large_image" : "summary", title: input.title, description: input.description },
  };
}

export async function buildMatchMetadata(matchId: string): Promise<Metadata> {
  if (!isUuid(matchId)) return {};
  const snapshot = await loadSiteSnapshot();
  const match = snapshot ? indexes(snapshot).matches.get(matchId) : undefined;
  if (!snapshot || !match || match.status === "cancelled") return {};
  const origin = await loadOrigin();
  const { modality, stageLabel } = matchContext(snapshot, match);
  const home = sideInfo(snapshot, match, "home");
  const away = sideInfo(snapshot, match, "away");
  const title = `${home.name} × ${away.name} — ${modality?.name ?? "Jogo"} | ${snapshot.competition.name}`;
  const lead =
    match.status === "finished"
      ? `Final: ${home.name} ${formatScore(match.homeScore)} × ${formatScore(match.awayScore)} ${away.name}.`
      : match.status === "live"
        ? `Ao vivo: ${home.name} ${formatScore(match.homeScore)} × ${formatScore(match.awayScore)} ${away.name}.`
        : `${formatMatchDate(match.scheduledDate, match.scheduledTime)}${match.venue ? ` · ${match.venue}` : ""}.`;
  const description = [lead, [modalityLabel(modality), stageLabel].filter(Boolean).join(" · ")].filter(Boolean).join(" ");
  const cover = absolute(origin, match.coverImageUrl);
  const crest = absolute(origin, home.crestUrl ?? away.crestUrl);
  return build({
    title,
    description,
    path: PATHS.match(match.id),
    origin,
    image: cover ? { url: cover, width: 1280, height: 720, alt: matchTitle(snapshot, match) } : crest ? { url: crest, alt: home.name } : null,
  });
}

export async function buildVoteHubMetadata(): Promise<Metadata> {
  const snapshot = await loadSiteSnapshot();
  if (!snapshot) return {};
  const origin = await loadOrigin();
  const logo = absolute(origin, snapshot.competition.logoUrl);
  return build({
    title: `Votação da torcida | ${snapshot.competition.name}`,
    description: `Vote no craque de cada jogo e na sua equipe favorita do ${snapshot.competition.name}.`,
    path: PATHS.vote(),
    origin,
    image: logo ? { url: logo, alt: snapshot.competition.name } : null,
  });
}

export async function buildVoteMatchMetadata(matchId: string): Promise<Metadata> {
  if (!isUuid(matchId)) return {};
  const snapshot = await loadSiteSnapshot();
  const match = snapshot ? indexes(snapshot).matches.get(matchId) : undefined;
  if (!snapshot || !match || match.status === "cancelled") return {};
  const origin = await loadOrigin();
  const { modality } = matchContext(snapshot, match);
  const versus = matchTitle(snapshot, match);
  const cover = absolute(origin, match.coverImageUrl);
  return build({
    title: `Craque da torcida: ${versus} | ${snapshot.competition.name}`,
    description: `Quem foi o craque de ${versus}${modality ? ` (${modality.name})` : ""}? Vote agora.`,
    path: PATHS.voteMatch(match.id),
    origin,
    image: cover ? { url: cover, width: 1280, height: 720, alt: versus } : null,
  });
}

export async function buildParticipantMetadata(slug: string): Promise<Metadata> {
  if (!isSlugParam(slug)) return {};
  const snapshot = await loadSiteSnapshot();
  const participant = snapshot ? indexes(snapshot).participantsBySlug.get(slug) : undefined;
  if (!snapshot || !participant) return {};
  const origin = await loadOrigin();
  const crest = absolute(origin, participant.crestUrl);
  return build({
    title: `${participant.name} | ${snapshot.competition.name}`,
    description: participant.description?.slice(0, 200) || `Jogos, resultados e elenco de ${participant.name} no ${snapshot.competition.name}.`,
    path: PATHS.participant(participant.slug),
    origin,
    image: crest ? { url: crest, alt: participant.name } : null,
  });
}

export async function buildAthleteMetadata(slug: string): Promise<Metadata> {
  if (!isSlugParam(slug)) return {};
  const snapshot = await loadSiteSnapshot();
  const index = snapshot ? indexes(snapshot) : null;
  const athlete = index?.athletesBySlug.get(slug);
  if (!snapshot || !index || !athlete) return {};
  const origin = await loadOrigin();
  const participant = index.participants.get(athlete.participantId);
  const photo = absolute(origin, athlete.photoUrl ?? participant?.crestUrl ?? null);
  return build({
    title: `${athlete.name}${participant ? ` (${participant.name})` : ""} | ${snapshot.competition.name}`,
    description: athlete.bio?.slice(0, 200) || `Números e prêmios de ${athlete.name} no ${snapshot.competition.name}.`,
    path: PATHS.athlete(athlete.slug),
    origin,
    image: photo ? { url: photo, alt: athlete.name } : null,
  });
}

// Ainda não ligada na route-table (entrada "modalidades/:slug" sem generateMetadata) — pronta pra ligar.
export async function buildModalityMetadata(slug: string): Promise<Metadata> {
  if (!isSlugParam(slug)) return {};
  const snapshot = await loadSiteSnapshot();
  const modality = snapshot ? indexes(snapshot).modalitiesBySlug.get(slug) : undefined;
  if (!snapshot || !modality) return {};
  const origin = await loadOrigin();
  const cover = absolute(origin, modality.coverUrl ?? snapshot.competition.logoUrl);
  return build({
    title: `${modality.name} | ${snapshot.competition.name}`,
    description: modality.description?.slice(0, 200) || `Classificação, jogos e resultados de ${modality.name} no ${snapshot.competition.name}.`,
    path: PATHS.modality(modality.slug),
    origin,
    image: cover ? { url: cover, alt: modality.name } : null,
  });
}
