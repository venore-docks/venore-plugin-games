import Link from "next/link";
import { notFound } from "next/navigation";
import { indexes } from "../../../shared/derive";
import { isUuid } from "../../../shared/ids";
import { PATHS } from "../../../shared/paths";
import { pollWindowFromSnapshot } from "../../../runtime/votes";
import { readVoterChoices } from "../../../runtime/vote-public-read";
import { MatchCard } from "../../../components/match-card";
import { ShareBar } from "../../../components/share-bar";
import { VoteBars } from "../../../components/vote-bars";
import { EmptyNote, SectionHeader } from "../../../components/section";
import { joinNames, matchTitle } from "../../../components/lib/match-info";
import { liveIslandFor, loadFanAwards, loadOrigin, loadSiteSnapshot, loadTallies, loadTurnstileSiteKey, loadVoteWindowHours, matchPoll, requestNow } from "../../../components/site-data";
import { Ballot } from "./ballot";
import { choicesFromSections, matchBallotSections } from "./choices";

type Props = { params: Promise<Record<string, string>>; searchParams: Promise<Record<string, string | string[] | undefined>> };

// Votação do craque da torcida de UM jogo (/votar/jogo/:id): cédula com os atletas das duas equipes
// enquanto aberta; parcial; resultado quando encerrada de vez.
export default async function VoteMatchPage({ params }: Props) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const snapshot = await loadSiteSnapshot();
  if (!snapshot) notFound();
  const index = indexes(snapshot);
  const match = index.matches.get(id);
  if (!match || match.status === "cancelled") notFound();

  const now = requestNow();
  const poll = matchPoll(snapshot, match.id);
  const [origin, windowHours, fanAwards] = await Promise.all([loadOrigin(), loadVoteWindowHours(), loadFanAwards()]);
  const window = poll ? pollWindowFromSnapshot(snapshot, poll, windowHours, now) : null;
  const sections = matchBallotSections(snapshot, match);
  const [tallies, myChoices] = poll
    ? await Promise.all([loadTallies([poll.id], window?.closedForGood ? [poll.id] : []), window?.isOpen ? readVoterChoices([poll.id]) : Promise.resolve(new Map<string, string>())])
    : [new Map(), new Map<string, string>()];
  const counts = poll ? (tallies.get(poll.id)?.counts ?? {}) : {};
  const winners = (fanAwards.get(match.id) ?? []).map((athleteId) => index.athletes.get(athleteId)?.name).filter((name): name is string => Boolean(name));
  const title = matchTitle(snapshot, match);

  return (
    <article className="@container mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Craque da torcida</p>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        <p className="text-sm text-muted-foreground">
          <Link href={PATHS.vote()} className="font-semibold text-primary hover:underline">
            Todas as votações
          </Link>
        </p>
      </header>

      <MatchCard snapshot={snapshot} match={match} live={liveIslandFor(snapshot, match)} />

      {!poll || !window ? (
        <EmptyNote>A votação deste jogo ainda não foi aberta.</EmptyNote>
      ) : window.isOpen ? (
        <section className="space-y-3">
          <SectionHeader title="Quem foi o craque?" subtitle="Toque no atleta e confirme. Cada aparelho vota uma vez por jogo." />
          <Ballot pollId={poll.id} kind="match" sections={sections} currentChoiceId={myChoices.get(poll.id) ?? null} allowChange={false} turnstileSiteKey={loadTurnstileSiteKey()} />
        </section>
      ) : window.closedForGood ? (
        <section className="rounded-panel border border-border bg-card p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Votação encerrada</p>
          <p className="mt-1 font-display text-xl font-bold text-foreground">{winners.length > 0 ? joinNames(winners) : "Sem votos"}</p>
          {winners.length > 1 && <p className="text-sm text-muted-foreground">Empate na liderança — todos levam o prêmio.</p>}
        </section>
      ) : (
        <EmptyNote>A votação abre quando o jogo começar.</EmptyNote>
      )}

      {poll && window && (window.isOpen || window.closedForGood) && (
        <section className="space-y-3">
          <SectionHeader title={window.isOpen ? "Parcial" : "Resultado"} />
          <VoteBars choices={choicesFromSections(sections)} counts={counts} limit={10} highlightId={myChoices.get(poll.id) ?? null} closed={window.closedForGood} />
        </section>
      )}

      <ShareBar url={`${origin}${PATHS.voteMatch(match.id)}`} text={`Vote no craque da torcida de ${title}!`} storyImageUrl={null} />
    </article>
  );
}
