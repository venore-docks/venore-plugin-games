import Link from "next/link";
import { notFound } from "next/navigation";
import { PATHS } from "../../../shared/paths";
import { pollWindowFromSnapshot } from "../../../runtime/votes";
import { readVoterChoices } from "../../../runtime/vote-public-read";
import { ShareBar } from "../../../components/share-bar";
import { VoteBars } from "../../../components/vote-bars";
import { EmptyNote, SectionHeader } from "../../../components/section";
import { favoritePoll, loadOrigin, loadSiteSnapshot, loadTallies, loadTurnstileSiteKey, loadVoteWindowHours, requestNow } from "../../../components/site-data";
import { Ballot } from "./ballot";
import { choicesFromSections, participantBallotSections } from "./choices";

// Equipe favorita (/votar/favorito): um voto por aparelho, que pode ser trocado enquanto aberta.
export default async function VoteFavoritePage() {
  const snapshot = await loadSiteSnapshot();
  if (!snapshot) notFound();
  const poll = favoritePoll(snapshot);
  const [origin, windowHours] = await Promise.all([loadOrigin(), loadVoteWindowHours()]);
  const window = poll ? pollWindowFromSnapshot(snapshot, poll, windowHours, requestNow()) : null;
  const sections = participantBallotSections(snapshot);
  const [tallies, myChoices] = poll ? await Promise.all([loadTallies([poll.id], window?.isOpen ? [] : [poll.id]), readVoterChoices([poll.id])]) : [new Map(), new Map<string, string>()];
  const counts = poll ? (tallies.get(poll.id)?.counts ?? {}) : {};
  const mine = poll ? (myChoices.get(poll.id) ?? null) : null;

  return (
    <article className="@container mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Votação da torcida</p>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">{poll?.title || "Equipe favorita"}</h1>
        <p className="text-sm text-muted-foreground">
          {snapshot.competition.name} ·{" "}
          <Link href={PATHS.vote()} className="font-semibold text-primary hover:underline">
            Todas as votações
          </Link>
        </p>
      </header>

      {!poll || !window ? (
        <EmptyNote>A votação de equipe favorita não está ativa nesta competição.</EmptyNote>
      ) : window.isOpen ? (
        <section className="space-y-3">
          <SectionHeader title="Qual é a sua equipe?" subtitle="Você pode trocar o voto enquanto a votação estiver aberta." />
          <Ballot pollId={poll.id} kind="favorite" sections={sections} currentChoiceId={mine} allowChange turnstileSiteKey={loadTurnstileSiteKey()} />
        </section>
      ) : (
        <EmptyNote>A votação de equipe favorita está encerrada.</EmptyNote>
      )}

      {poll && (
        <section className="space-y-3">
          <SectionHeader title={window?.isOpen ? "Parcial" : "Resultado"} />
          <VoteBars choices={choicesFromSections(sections)} counts={counts} highlightId={mine} closed={!window?.isOpen} />
        </section>
      )}

      <ShareBar url={`${origin}${PATHS.voteFavorite()}`} text={`Vote na sua equipe favorita — ${snapshot.competition.name}!`} storyImageUrl={null} />
    </article>
  );
}
