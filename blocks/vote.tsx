import Link from "next/link";
import type { BlockRendererProps } from "@venore/plugin-sdk";
import type { CompetitionSnapshot } from "../contracts/types";
import { indexes } from "../shared/derive";
import { PATHS } from "../shared/paths";
import { BlockFrame, SectionHeader } from "../components/section";
import { MatchVoteCard } from "../components/vote-cards";
import { VoteBars } from "../components/vote-bars";
import { favoritePoll, loadSiteSnapshot, loadTallies, pollStates } from "../components/site-data";
import { emptyState, NO_COMPETITION } from "./common";
import { text } from "./fields";

// Chamada da votação: o jogo com votação aberta mais recente (ao vivo primeiro) + parcial da equipe
// favorita. Sem nada aberto, some (ou explica no modo de edição).
export async function VoteCtaSection({ snapshot, title, subtitle }: { snapshot: CompetitionSnapshot; title: string; subtitle: string }) {
  const index = indexes(snapshot);
  const states = await pollStates(snapshot);
  const openMatch = states
    .filter((state) => state.poll.kind === "match_athlete" && state.window.isOpen && state.poll.matchId)
    .map((state) => ({ poll: state.poll, match: index.matches.get(state.poll.matchId!) }))
    .filter((item): item is { poll: typeof item.poll; match: NonNullable<typeof item.match> } => Boolean(item.match))
    .sort((a, b) => Number(b.match.status === "live") - Number(a.match.status === "live") || (b.match.finishedAt ?? "").localeCompare(a.match.finishedAt ?? ""))[0];
  const favorite = favoritePoll(snapshot);
  const favoriteOpen = favorite ? states.find((state) => state.poll.id === favorite.id)?.window.isOpen === true : false;
  if (!openMatch && !favoriteOpen) return null;

  const tallies = await loadTallies([...(openMatch ? [openMatch.poll.id] : []), ...(favorite && favoriteOpen ? [favorite.id] : [])]);
  const teams = [...snapshot.participants].map((participant) => ({ id: participant.id, name: participant.name, imageUrl: participant.crestUrl, color: participant.primaryColor, caption: null }));
  return (
    <BlockFrame>
      <SectionHeader title={title} subtitle={subtitle || undefined} action={{ href: PATHS.vote(), label: "Todas as votações" }} />
      <div className="grid gap-3 @2xl:grid-cols-2">
        {openMatch && <MatchVoteCard snapshot={snapshot} match={openMatch.match} tallies={tallies.get(openMatch.poll.id)} />}
        {favorite && favoriteOpen && (
          <div className="flex flex-col gap-3 rounded-panel border border-border bg-card p-3 shadow-panel @sm:p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{favorite.title || "Equipe favorita"}</p>
            <VoteBars choices={teams} counts={tallies.get(favorite.id)?.counts ?? {}} limit={3} />
            <Link
              href={PATHS.voteFavorite()}
              className="mt-auto inline-flex min-h-11 items-center justify-center rounded-full border border-primary px-4 text-sm font-bold text-primary ui-motion-base hover:bg-primary/10"
            >
              Votar na minha equipe
            </Link>
          </div>
        )}
      </div>
    </BlockFrame>
  );
}

export async function VoteCtaBlock({ block, mode }: BlockRendererProps) {
  const snapshot = await loadSiteSnapshot();
  if (!snapshot) return emptyState(mode, "Votação da torcida", NO_COMPETITION);
  const title = text(block.data, "title") || "Votação da torcida";
  const section = await VoteCtaSection({ snapshot, title, subtitle: text(block.data, "subtitle") });
  return section ?? emptyState(mode, title, "Nenhuma votação aberta agora. A votação de cada jogo abre quando ele começa; a de equipe favorita, quando o admin a ativa.");
}
