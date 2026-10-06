import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, Camera, ClipboardList, Crown, ExternalLink, Smartphone, Trash2, Vote, Video, Zap } from "lucide-react";
import { Button } from "@venore/plugin-sdk/ui";
import type { MatchView } from "../../../contracts/types";
import { indexes } from "../../../shared/derive";
import { formatScore } from "../../../shared/score";
import { getSportProfile } from "../../../shared/sport-profiles";
import { formatMatchDate } from "../../../shared/timezone";
import { describeSlotSource } from "../../../shared/tournament";
import { computeVoteShares } from "../../../shared/votes";
import { isUuid } from "../../../shared/ids";
import { PATHS } from "../../../shared/paths";
import { getPollTallies, pollWindowFromSnapshot, readVoteWindowHours } from "../../../runtime/votes";
import { AdminDenied, AdminFrame, NoCompetition } from "../_shared/admin-nav";
import { ConfirmAction } from "../_shared/confirm-action";
import { loadAdminPage, pickableMedia, requestTime } from "../_shared/server";
import { Crest, MatchStatusBadge, Notice, Section } from "../_shared/ui";
import { deleteMatchAction } from "./actions";
import { EventsEditor, type SideInfo } from "./events-editor";
import { AuditLink, MatchBoostsPanel, MvpForm, PhotoPanel, PollModeSelect, YoutubeForm } from "./match-extras";
import { ResultForm } from "./result-form";
import { ScheduleForm, type ScheduleModality } from "./schedule-form";

type PageProps = { params: Promise<Record<string, string>>; searchParams: Promise<Record<string, string | string[] | undefined>> };

// /admin/games/jogos/:id — súmula. "new" (?modalidade=<id>) = criar jogo avulso.
export default async function AdminMatchPage({ params, searchParams }: PageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const isNew = id === "new";
  if (!isNew && !isUuid(id)) notFound();
  const access = await loadAdminPage("manage");
  if (!access.ok) return <AdminDenied message={access.message} />;
  const { snapshot } = access;
  if (!snapshot) return <NoCompetition active="matches" />;

  const index = indexes(snapshot);
  const match = isNew ? null : (index.matches.get(id) ?? null);
  if (!isNew && !match) notFound();

  const scheduleModalities: ScheduleModality[] = snapshot.modalities
    .filter((modality) => getSportProfile(modality.sportProfile).shape === "match")
    .map((modality) => ({
      id: modality.id,
      name: modality.name,
      emoji: modality.emoji,
      entryIds: modality.entries.map((entry) => entry.participantId),
      stages: modality.stages.filter((stage) => stage.type !== "single_event").map((stage) => ({ id: stage.id, name: stage.name, groups: stage.groups.map(({ id: groupId, name }) => ({ id: groupId, name })) })),
    }));
  const participants = snapshot.participants.map(({ id: participantId, name }) => ({ id: participantId, name }));

  if (!match) {
    const requested = typeof query.modalidade === "string" && scheduleModalities.some((modality) => modality.id === query.modalidade) ? query.modalidade : null;
    return (
      <AdminFrame active="matches" competitionName={snapshot.competition.name} title="Novo jogo" description="Jogo avulso ou complemento de uma fase. Jogos de grupo/mata-mata são gerados pelo formato da modalidade.">
        <Section title="Agenda" icon={<CalendarClock />} className="max-w-3xl">
          <ScheduleForm match={null} modalities={scheduleModalities} participants={participants} defaultModalityId={requested} />
        </Section>
      </AdminFrame>
    );
  }

  const modality = index.modalities.get(match.modalityId);
  if (!modality) notFound();
  const profile = getSportProfile(modality.sportProfile);
  const stage = modality.stages.find((candidate) => candidate.id === match.stageId) ?? null;
  const group = stage?.groups.find((candidate) => candidate.id === match.groupId) ?? null;
  const events = index.eventsByMatch.get(match.id) ?? [];
  const boosts = index.boostsByMatch.get(match.id) ?? [];
  const hasScoringEvents = events.some((event) => profile.eventKinds.some((kind) => kind.key === event.kind && kind.scores) && event.amount > 0);

  const sideInfo = (participantId: string | null): SideInfo => {
    const participant = participantId ? index.participants.get(participantId) : undefined;
    if (!participant) return null;
    const roster = (index.athletesByParticipant.get(participant.id) ?? [])
      .slice()
      .sort((a, b) => (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name, "pt-BR"))
      .map((athlete) => ({ id: athlete.id, name: athlete.name, number: athlete.number }));
    return { id: participant.id, name: participant.name, roster };
  };
  const home = sideInfo(match.homeId);
  const away = sideInfo(match.awayId);

  const poll = snapshot.polls.find((candidate) => candidate.kind === "match_athlete" && candidate.matchId === match.id) ?? null;
  const [photo, windowHours] = await Promise.all([pickableMedia(match.coverPhotoMediaId), readVoteWindowHours()]);
  const tallies = poll ? (await getPollTallies([poll.id])).get(poll.id) : undefined;
  const pollWindow = poll ? pollWindowFromSnapshot(snapshot, poll, windowHours, requestTime()) : null;
  const shares = tallies ? computeVoteShares(tallies.counts).slice(0, 5) : [];

  const matchLabels = Object.fromEntries(snapshot.matches.filter((m) => m.modalityId === modality.id && m.matchKey).map((m) => [m.matchKey!, m.matchKey!]));
  const sideName = (side: "home" | "away") => {
    const participantId = side === "home" ? match.homeId : match.awayId;
    if (participantId) return index.participants.get(participantId)?.name ?? "Equipe";
    return (side === "home" ? match.homeLabel : match.awayLabel) ?? describeSlotSource(side === "home" ? match.homeSource : match.awaySource, matchLabels);
  };

  return (
    <AdminFrame
      active="matches"
      competitionName={snapshot.competition.name}
      title={`${sideName("home")} × ${sideName("away")}`}
      description={[modality.emoji ? `${modality.emoji} ${modality.name}` : modality.name, stage?.name, group ? `Grupo ${group.name}` : null, match.roundLabel, match.matchKey]
        .filter(Boolean)
        .join(" · ")}
      actions={
        <>
          {match.status !== "finished" && (
            <Button asChild size="sm">
              <Link href={PATHS.control()} target="_blank" rel="noreferrer">
                <Smartphone aria-hidden /> {match.status === "live" ? "Controle ao vivo" : "Iniciar no controle"}
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href={PATHS.match(match.id)} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden /> Página pública
            </Link>
          </Button>
        </>
      }
    >
      <Scoreboard match={match} homeName={sideName("home")} awayName={sideName("away")} index={index} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          <Section title="Resultado" icon={<ClipboardList />} description="Súmula: lance ou corrija o resultado sem passar pelo ao vivo.">
            <ResultForm
              key={`${match.status}:${match.homeScore}:${match.awayScore}:${snapshot.version}`}
              match={match}
              profileKey={modality.sportProfile}
              rules={modality.rules}
              home={home}
              away={away}
              hasScoringEvents={hasScoringEvents}
              isKnockout={stage?.type === "knockout"}
            />
          </Section>
          {profile.eventKinds.length > 0 && (
            <Section title={`Lances (${events.length})`} description="Gols/pontos, cartões e faltas. Atribua o atleta para a artilharia.">
              <EventsEditor matchId={match.id} profileKey={modality.sportProfile} rules={modality.rules} events={events} home={home} away={away} />
            </Section>
          )}
          <Section title="Power plays" icon={<Zap />}>
            <MatchBoostsPanel matchId={match.id} boosts={boosts} catalog={snapshot.boostCatalog} home={home} away={away} />
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Agenda" icon={<CalendarClock />}>
            <ScheduleForm key={snapshot.version} match={match} modalities={scheduleModalities} participants={participants} defaultModalityId={null} />
          </Section>
          <Section title="Craque do jogo" icon={<Crown />}>
            <MvpForm key={`${match.mvpAthleteId}`} matchId={match.id} athleteId={match.mvpAthleteId} note={match.mvpNote} home={home} away={away} />
          </Section>
          <Section title="Transmissão" icon={<Video />} description="Link do vídeo/live no YouTube (aparece na página do jogo).">
            <YoutubeForm matchId={match.id} url={match.youtubeUrl} />
          </Section>
          <Section title="Foto e imagens de compartilhamento" icon={<Camera />} description="Capa 16:9 (YouTube/WhatsApp) e story 9:16 geradas a partir da foto e do placar.">
            <PhotoPanel
              key={match.coverPhotoMediaId ?? "none"}
              matchId={match.id}
              photo={photo}
              coverImageUrl={match.coverImageUrl}
              storyImageUrl={match.storyImageUrl}
              canGenerate={Boolean(match.homeId && match.awayId)}
            />
          </Section>
          <Section
            title="Craque da torcida"
            icon={<Vote />}
            description={
              poll && pollWindow
                ? pollWindow.isOpen
                  ? `Votação aberta${pollWindow.closesAt ? ` até ${new Date(pollWindow.closesAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}` : ""}.`
                  : "Votação fechada."
                : "A votação é criada quando o jogo começa no controle ou é encerrado na súmula."
            }
            actions={poll && <AuditLink pollId={poll.id} />}
          >
            {poll && (
              <div className="space-y-3">
                <PollModeSelect pollId={poll.id} mode={poll.openMode} />
                <p className="text-sm text-foreground">
                  {tallies?.total ?? 0} voto(s){" "}
                  <Link href={PATHS.voteMatch(match.id)} target="_blank" rel="noreferrer" className="text-xs text-primary underline-offset-4 hover:underline">
                    página de voto
                  </Link>
                </p>
                {shares.length > 0 && (
                  <ol className="space-y-1.5">
                    {shares.map((share) => {
                      const athlete = index.athletes.get(share.choiceId);
                      return (
                        <li key={share.choiceId} className="space-y-0.5">
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="truncate text-foreground">{athlete?.name ?? "Atleta removido"}</span>
                            <span className="tabular-nums text-muted-foreground">
                              {share.votes} · {share.percent}%
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${share.percent}%` }} />
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            )}
          </Section>

          <Section title="Excluir jogo" icon={<Trash2 />} description={match.status === "live" ? "Jogo ao vivo: cancele pelo controle." : "Lances, power plays, votação e imagens saem junto."}>
            {match.status !== "live" && (
              <ConfirmAction
                trigger={
                  <Button variant="destructive" size="sm">
                    <Trash2 aria-hidden /> Excluir jogo
                  </Button>
                }
                title="Excluir este jogo?"
                description={
                  <>
                    <p>
                      {sideName("home")} × {sideName("away")} — {formatMatchDate(match.scheduledDate, match.scheduledTime)}
                    </p>
                    {match.matchKey && <p>Jogos do mata-mata que dependiam deste ({match.matchKey}) voltam para &ldquo;a definir&rdquo;.</p>}
                    <p>Não dá pra desfazer.</p>
                  </>
                }
                confirmLabel="Excluir jogo"
                successMessage="Jogo excluído."
                onConfirm={deleteMatchAction.bind(null, match.id)}
                redirectTo={`${PATHS.admin.matches()}?modalidade=${modality.id}`}
              />
            )}
          </Section>
        </div>
      </div>
    </AdminFrame>
  );
}

function Scoreboard({ match, homeName, awayName, index }: { match: MatchView; homeName: string; awayName: string; index: ReturnType<typeof indexes> }) {
  const home = match.homeId ? index.participants.get(match.homeId) : undefined;
  const away = match.awayId ? index.participants.get(match.awayId) : undefined;
  const showScore = match.status === "live" || match.status === "finished";
  return (
    <div className="rounded-panel border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {formatMatchDate(match.scheduledDate, match.scheduledTime)}
          {match.venue ? ` · ${match.venue}` : ""}
        </span>
        <MatchStatusBadge status={match.status} />
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex min-w-0 flex-col items-center gap-2 text-center sm:flex-row sm:text-start">
          <Crest name={homeName} url={home?.crestUrl ?? null} color={home?.primaryColor} size="lg" />
          <span className="line-clamp-2 text-sm font-semibold text-foreground sm:text-base">{homeName}</span>
        </div>
        <div className="text-center">
          {showScore ? (
            <p className="text-3xl font-bold tabular-nums text-foreground sm:text-4xl">
              {formatScore(match.homeScore)}
              <span className="mx-2 text-muted-foreground">×</span>
              {formatScore(match.awayScore)}
            </p>
          ) : (
            <p className="text-xl font-semibold text-muted-foreground">×</p>
          )}
          {match.sets && match.sets.length > 0 && <p className="mt-1 text-xs tabular-nums text-muted-foreground">{match.sets.map((set) => `${set.home}-${set.away}`).join(" · ")}</p>}
        </div>
        <div className="flex min-w-0 flex-col items-center gap-2 text-center sm:flex-row-reverse sm:text-end">
          <Crest name={awayName} url={away?.crestUrl ?? null} color={away?.primaryColor} size="lg" />
          <span className="line-clamp-2 text-sm font-semibold text-foreground sm:text-base">{awayName}</span>
        </div>
      </div>
      {match.resultNote && <Notice className="mt-3">{match.resultNote}</Notice>}
    </div>
  );
}
