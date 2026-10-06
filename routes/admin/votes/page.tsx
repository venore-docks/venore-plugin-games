import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Heart, Settings2, ShieldAlert, ShieldCheck, Vote } from "lucide-react";
import { Badge, Button } from "@venore/plugin-sdk/ui";
import type { CompetitionSnapshot, PollTallies, PollView } from "../../../contracts/types";
import { indexes } from "../../../shared/derive";
import { buildAuditGroups, computeVoteShares } from "../../../shared/votes";
import { isUuid } from "../../../shared/ids";
import { PATHS } from "../../../shared/paths";
import { countVotesByPoll, getPollTallies, listAuditVotes, pollWindowFromSnapshot, readVoteWindowHours } from "../../../runtime/votes";
import { getTurnstileSiteKey } from "../../../runtime/turnstile";
import { AdminDenied, AdminFrame, NoCompetition } from "../_shared/admin-nav";
import { loadAdminPage, requestTime } from "../_shared/server";
import { readVoteSettings } from "../_shared/settings-read";
import { Notice, Section } from "../_shared/ui";
import { AuditLink, PollModeSelect } from "../matches/match-extras";
import { AuditGroups, CreateFavoritePollButton, ResetPollButton, VoteSettingsForm } from "./vote-controls";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// /admin/games/votacao — votações (craque de cada jogo + equipe favorita), parcial, abrir/fechar,
// zerar, auditoria por rede (?votacao=<id>) e o custo do voto.
export default async function AdminVotesPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const access = await loadAdminPage("manage");
  if (!access.ok) return <AdminDenied message={access.message} />;
  const { snapshot } = access;
  if (!snapshot) return <NoCompetition active="votes" />;

  const auditId = typeof query.votacao === "string" ? query.votacao : null;
  if (auditId) {
    if (!isUuid(auditId)) notFound();
    const poll = snapshot.polls.find((candidate) => candidate.id === auditId);
    if (!poll) notFound();
    return <AuditView snapshot={snapshot} poll={poll} />;
  }

  const index = indexes(snapshot);
  const [windowHours, settings, counts] = await Promise.all([readVoteWindowHours(), readVoteSettings(), countVotesByPoll(snapshot.competition.id)]);
  const now = requestTime();
  const tallies = await getPollTallies(snapshot.polls.map((poll) => poll.id));
  const favorite = snapshot.polls.find((poll) => poll.kind === "participant") ?? null;
  // Votações de jogo: mais recentes primeiro (abertas antes).
  const matchPolls = snapshot.polls
    .filter((poll) => poll.kind === "match_athlete")
    .map((poll) => ({ poll, match: poll.matchId ? index.matches.get(poll.matchId) : undefined, window: pollWindowFromSnapshot(snapshot, poll, windowHours, now) }))
    .sort((a, b) => Number(b.window.isOpen) - Number(a.window.isOpen) || (b.match?.finishedAt ?? b.match?.startedAt ?? "").localeCompare(a.match?.finishedAt ?? a.match?.startedAt ?? ""));

  const turnstileOn = Boolean(getTurnstileSiteKey());
  const trustedIp = Boolean(process.env.VERCEL) || Boolean(process.env.GAMES_TRUSTED_IP_HEADER?.trim());
  const name = (id: string) => index.athletes.get(id)?.name ?? index.participants.get(id)?.name ?? "Removido";

  return (
    <AdminFrame active="votes" competitionName={snapshot.competition.name} title="Votação da torcida" description="Craque de cada jogo e equipe favorita — sem login, com espera acumulada por rede e auditoria.">
      <div className="grid *:min-w-0 gap-3 md:grid-cols-2">
        {turnstileOn ? (
          <Notice>
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-4 shrink-0" aria-hidden /> Anti-robô (Cloudflare Turnstile) ligado.
            </span>
          </Notice>
        ) : (
          <Notice tone="warning">
            <span className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>Anti-robô desligado. Configure GAMES_TURNSTILE_SITE_KEY e GAMES_TURNSTILE_SECRET_KEY para barrar votos por script.</span>
            </span>
          </Notice>
        )}
        {trustedIp ? (
          <Notice>
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-4 shrink-0" aria-hidden /> IP de confiança configurado ({process.env.VERCEL ? "Vercel" : "GAMES_TRUSTED_IP_HEADER"}).
            </span>
          </Notice>
        ) : (
          <Notice tone="warning">
            <span className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>Sem IP de confiança: todos os votos caem numa rede só (a espera acumula pra todo mundo). Fora da Vercel, defina GAMES_TRUSTED_IP_HEADER com o cabeçalho do seu proxy.</span>
            </span>
          </Notice>
        )}
      </div>

      <Section
        title="Equipe favorita"
        icon={<Heart />}
        actions={
          favorite && (
            <Button asChild variant="ghost" size="sm">
              <Link href={PATHS.voteFavorite()} target="_blank" rel="noreferrer">
                Página de voto
              </Link>
            </Button>
          )
        }
        description={favorite ? undefined : "Votação contínua em qual equipe a torcida prefere. Ainda não existe nesta competição."}
      >
        {favorite ? (
          <ul>
            <PollCard poll={favorite} title={favorite.title} isOpen={favorite.openMode !== "closed"} tallies={tallies.get(favorite.id)} voided={counts.get(favorite.id)?.voided ?? 0} name={name} />
          </ul>
        ) : (
          <CreateFavoritePollButton />
        )}
      </Section>

      <Section title={`Craque da torcida (${matchPolls.length})`} icon={<Vote />} description="Criada no início de cada jogo; fica aberta até o prazo depois do fim (configurável abaixo).">
        {matchPolls.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma votação de jogo ainda.</p>
        ) : (
          <ul className="grid *:min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {matchPolls.map(({ poll, match, window }) => {
              const home = match?.homeId ? index.participants.get(match.homeId)?.name : null;
              const away = match?.awayId ? index.participants.get(match.awayId)?.name : null;
              const modality = match ? index.modalities.get(match.modalityId) : undefined;
              return (
                <PollCard
                  key={poll.id}
                  poll={poll}
                  title={match ? `${home ?? "A definir"} × ${away ?? "A definir"}` : poll.title}
                  subtitle={[modality?.name, match?.roundLabel].filter(Boolean).join(" · ") || undefined}
                  isOpen={window.isOpen}
                  tallies={tallies.get(poll.id)}
                  voided={counts.get(poll.id)?.voided ?? 0}
                  name={name}
                />
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Custo do voto" icon={<Settings2 />} description="A espera é acumulada por rede: 30 votos seguidos da mesma rede esperam 5 s, 10 s, 15 s… somados.">
        <VoteSettingsForm initial={settings} />
      </Section>
    </AdminFrame>
  );
}

async function AuditView({ snapshot, poll }: { snapshot: CompetitionSnapshot; poll: PollView }) {
  const index = indexes(snapshot);
  const match = poll.matchId ? index.matches.get(poll.matchId) : undefined;
  const title = match
    ? `${match.homeId ? index.participants.get(match.homeId)?.name : "A definir"} × ${match.awayId ? index.participants.get(match.awayId)?.name : "A definir"}`
    : poll.title;
  const votes = await listAuditVotes(poll.id);
  const groups = buildAuditGroups(votes);
  const active = votes.filter((vote) => !vote.voided).length;

  return (
    <AdminFrame
      active="votes"
      competitionName={snapshot.competition.name}
      title={`Auditoria: ${title}`}
      description={`${votes.length} voto(s) registrados · ${active} válido(s) · ${groups.filter((group) => group.level === "suspect").length} rede(s) suspeita(s)`}
      actions={
        <Button asChild variant="outline" size="sm">
          <Link href={PATHS.admin.votes()}>
            <ArrowLeft aria-hidden /> Votações
          </Link>
        </Button>
      }
    >
      <Notice>
        Redes com 3 ou mais votos. &ldquo;Manter 1 por navegador&rdquo; deixa só o voto mais antigo de cada aparelho; &ldquo;Anular todos&rdquo; tira a rede inteira da parcial.
        Tudo pode ser restaurado.
      </Notice>
      <Section title="Redes" icon={<ShieldAlert />}>
        <AuditGroups pollId={poll.id} groups={groups} />
      </Section>
    </AdminFrame>
  );
}

function PollCard({ poll, title, subtitle, isOpen, tallies, voided, name }: { poll: PollView; title: string; subtitle?: string; isOpen: boolean; tallies: PollTallies | undefined; voided: number; name: (id: string) => string }) {
  const pollTallies = tallies;
  const shares = pollTallies ? computeVoteShares(pollTallies.counts).slice(0, 3) : [];
  return (
    <li className="space-y-3 rounded-panel border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <Badge variant={isOpen ? "default" : "outline"}>{isOpen ? "Aberta" : "Fechada"}</Badge>
      </div>
      <p className="text-sm text-foreground">
        <span className="text-lg font-semibold tabular-nums">{pollTallies?.total ?? 0}</span> voto(s) válido(s)
        {voided > 0 && <span className="text-xs text-muted-foreground"> · {voided} anulado(s)</span>}
      </p>
      {shares.length > 0 && (
        <ol className="space-y-1 text-sm">
          {shares.map((share, position) => (
            <li key={share.choiceId} className="flex items-center gap-2">
              <span className="w-5 text-xs font-semibold text-muted-foreground">{position + 1}º</span>
              <span className="min-w-0 flex-1 truncate text-foreground">{name(share.choiceId)}</span>
              <span className="tabular-nums text-muted-foreground">
                {share.votes} · {share.percent}%
              </span>
            </li>
          ))}
        </ol>
      )}
      <PollModeSelect pollId={poll.id} mode={poll.openMode} />
      <div className="flex flex-wrap gap-2">
        <AuditLink pollId={poll.id} />
        <ResetPollButton pollId={poll.id} title={title} />
      </div>
    </li>
  );
}
