import Link from "next/link";
import { notFound } from "next/navigation";
import { indexes } from "../../../shared/derive";
import { PATHS } from "../../../shared/paths";
import { readVoterChoices } from "../../../runtime/vote-public-read";
import { VoteBars } from "../../../components/vote-bars";
import { MatchVoteCard } from "../../../components/vote-cards";
import { Crest } from "../../../components/crest";
import { EmptyNote, SectionHeader } from "../../../components/section";
import { joinNames, matchTitle, modalityLabel } from "../../../components/lib/match-info";
import { favoritePoll, loadFanAwards, loadSiteSnapshot, loadTallies, pollStates } from "../../../components/site-data";
import { choicesFromSections, participantBallotSections } from "./choices";

type Props = { params: Promise<Record<string, string>>; searchParams: Promise<Record<string, string | string[] | undefined>> };

// Hub da votação (/votar): jogos com votação aberta, equipe favorita (parcial) e resultados recentes
// do craque da torcida.
export default async function VoteHubPage(_props: Props) {
  const snapshot = await loadSiteSnapshot();
  if (!snapshot) notFound();
  const index = indexes(snapshot);
  const states = await pollStates(snapshot);

  const openMatches = states
    .filter((state) => state.poll.kind === "match_athlete" && state.window.isOpen && state.poll.matchId)
    .map((state) => ({ poll: state.poll, match: index.matches.get(state.poll.matchId!) }))
    .filter((item): item is { poll: typeof item.poll; match: NonNullable<typeof item.match> } => Boolean(item.match))
    .sort((a, b) => Number(b.match.status === "live") - Number(a.match.status === "live") || (b.match.finishedAt ?? "").localeCompare(a.match.finishedAt ?? ""));
  const favorite = favoritePoll(snapshot);
  const favoriteState = favorite ? states.find((state) => state.poll.id === favorite.id) : undefined;
  const closed = states.filter((state) => state.poll.kind === "match_athlete" && state.window.closedForGood).map((state) => state.poll.id);
  const [tallies, fanAwards, myChoices] = await Promise.all([
    loadTallies([...openMatches.map((item) => item.poll.id), ...(favorite ? [favorite.id] : [])], favoriteState?.window.isOpen ? [] : favorite ? [favorite.id] : []),
    loadFanAwards(),
    favorite ? readVoterChoices([favorite.id]) : Promise.resolve(new Map<string, string>()),
  ]);
  const recentResults = snapshot.polls
    .filter((poll) => closed.includes(poll.id) && poll.matchId && fanAwards.has(poll.matchId))
    .map((poll) => index.matches.get(poll.matchId!))
    .filter((match) => match !== undefined)
    .sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""))
    .slice(0, 8);

  return (
    <article className="@container mx-auto w-full max-w-5xl space-y-10">
      <header className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-wider text-primary">{snapshot.competition.name}</p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">Votação da torcida</h1>
        <p className="max-w-prose text-sm text-muted-foreground">Escolha o craque de cada jogo e a sua equipe favorita. Sem cadastro — um voto por aparelho.</p>
      </header>

      <section>
        <SectionHeader title="Craque da torcida" subtitle="Jogos com votação aberta" />
        {openMatches.length === 0 ? (
          <EmptyNote>Nenhuma votação aberta agora. A votação de cada jogo abre quando ele começa.</EmptyNote>
        ) : (
          <div className="grid gap-3 @xl:grid-cols-2 @4xl:grid-cols-3">
            {openMatches.map(({ poll, match }) => (
              <MatchVoteCard key={poll.id} snapshot={snapshot} match={match} tallies={tallies.get(poll.id)} />
            ))}
          </div>
        )}
      </section>

      {favorite && favoriteState && (
        <section>
          <SectionHeader
            title={favorite.title || "Equipe favorita"}
            subtitle={favoriteState.window.isOpen ? "Parcial — dá pra trocar o voto enquanto estiver aberta" : "Votação encerrada"}
            action={{ href: PATHS.voteFavorite(), label: favoriteState.window.isOpen ? "Votar" : "Ver resultado" }}
          />
          <VoteBars
            choices={choicesFromSections(participantBallotSections(snapshot))}
            counts={tallies.get(favorite.id)?.counts ?? {}}
            limit={5}
            highlightId={myChoices.get(favorite.id) ?? null}
            closed={!favoriteState.window.isOpen}
          />
        </section>
      )}

      {recentResults.length > 0 && (
        <section>
          <SectionHeader title="Resultados recentes" />
          <ul className="grid gap-2 @xl:grid-cols-2">
            {recentResults.map((match) => {
              const winners = (fanAwards.get(match.id) ?? []).map((id) => index.athletes.get(id)).filter((athlete) => athlete !== undefined);
              const team = winners[0] ? index.participants.get(winners[0].participantId) : undefined;
              return (
                <li key={match.id}>
                  <Link href={PATHS.voteMatch(match.id)} className="flex min-h-14 items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 ui-motion-base hover:border-ring">
                    <Crest name={team?.name ?? "?"} crestUrl={team?.crestUrl ?? null} color={team?.primaryColor ?? null} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-foreground">{joinNames(winners.map((athlete) => athlete.name))}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {matchTitle(snapshot, match)} · {modalityLabel(index.modalities.get(match.modalityId))}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </article>
  );
}
