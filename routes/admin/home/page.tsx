import type { ReactNode } from "react";
import Link from "next/link";
import { ClipboardList, ExternalLink, FileText, MonitorPlay, Radio, Settings2, Smartphone, Trophy, Tv, Vote } from "lucide-react";
import { AdminStatTile, Button, EmptyState } from "@venore/plugin-sdk/ui";
import type { MatchView } from "../../../contracts/types";
import { indexes, liveMatches, upcomingMatches } from "../../../shared/derive";
import { formatMatchDate } from "../../../shared/timezone";
import { formatScore } from "../../../shared/score";
import { PATHS } from "../../../shared/paths";
import { listCompetitions } from "../../../runtime/competitions";
import { resolveRequestOrigin } from "../../../runtime/request-origin";
import { AdminDenied, AdminFrame } from "../_shared/admin-nav";
import { CopyButton } from "../_shared/copy-button";
import { loadAdminPage, requestTime } from "../_shared/server";
import { readGeneralSettings } from "../_shared/settings-read";
import { Crest, MatchStatusBadge, Notice, Section } from "../_shared/ui";
import { CompetitionList, CreateCompetitionButton } from "./competition-panel";
import { GeneralSettingsForm } from "./settings-form";

// /admin/games — escolha/criação da competição, resumo da ativa, atalhos das telas ao vivo e
// configurações gerais do plugin.
export default async function AdminHomePage() {
  const access = await loadAdminPage("manage");
  if (!access.ok) return <AdminDenied message={access.message} />;

  const [competitions, settings, origin] = await Promise.all([listCompetitions(), readGeneralSettings(), resolveRequestOrigin()]);
  const { snapshot } = access;

  if (competitions.length === 0 || !snapshot) {
    return (
      <AdminFrame active="home" title="Competições" description="Campeonatos e olimpíadas do colégio: modalidades, equipes, jogos ao vivo e votação.">
        <EmptyState
          icon={<Trophy className="size-8" strokeWidth={1.5} />}
          title="Nenhuma competição ainda"
          description="Crie a primeira edição (ex.: Erasto Games 2026) para cadastrar modalidades, equipes e jogos. Vindo do Erasto League? Use Importar → Migrar."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <CreateCompetitionButton label="Criar primeira competição" />
              <Button asChild variant="outline" size="sm">
                <Link href={PATHS.admin.import()}>Migrar do Erasto League</Link>
              </Button>
            </div>
          }
        />
      </AdminFrame>
    );
  }

  const index = indexes(snapshot);
  const live = liveMatches(snapshot);
  const upcoming = upcomingMatches(snapshot, requestTime()).slice(0, 6);
  const finishedCount = snapshot.matches.filter((match) => match.status === "finished").length;
  const absolute = (path: string) => `${origin}${path}`;

  return (
    <AdminFrame
      active="home"
      competitionName={snapshot.competition.name}
      title="Visão geral"
      description="Resumo da competição ativa, telas ao vivo e configurações gerais."
      actions={
        <Button asChild size="sm">
          <Link href={PATHS.control()} target="_blank" rel="noreferrer">
            <Smartphone aria-hidden /> Abrir controle ao vivo
          </Link>
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <AdminStatTile label="Modalidades" value={snapshot.modalities.length} hint={`${snapshot.modalities.filter((m) => m.status === "finished").length} finalizada(s)`} />
        <AdminStatTile label="Equipes" value={snapshot.participants.length} />
        <AdminStatTile label="Atletas" value={snapshot.athletes.length} />
        <AdminStatTile label="Jogos" value={snapshot.matches.length} hint={`${finishedCount} encerrado(s)`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Ao vivo agora" icon={<Radio />} description={live.length === 0 ? "Nenhum jogo em andamento." : undefined}>
          {live.length > 0 && <MatchList matches={live} index={index} />}
        </Section>
        <Section
          title="Próximos jogos"
          icon={<ClipboardList />}
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link href={PATHS.admin.matches()}>Ver todos</Link>
            </Button>
          }
          description={upcoming.length === 0 ? "Nada agendado. Monte o formato de uma modalidade ou crie jogos avulsos." : undefined}
        >
          {upcoming.length > 0 && <MatchList matches={upcoming} index={index} />}
        </Section>
      </div>

      <Section title="Telas ao vivo" icon={<MonitorPlay />} description="Controle pelo celular, placar pro OBS (fundo transparente) e TVs. Cada canal (quadra) tem o próprio jogo.">
        <div className="space-y-3">
          {snapshot.channels.map((channel) => {
            const current = channel.currentMatchId ? index.matches.get(channel.currentMatchId) : null;
            return (
              <div key={channel.id} className="flex flex-col gap-3 rounded-lg border border-border p-3 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{channel.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {current ? `${matchTitle(index, current)} · ${current.status === "live" ? "ao vivo" : "no ar"}` : "Ocioso"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={PATHS.control(channel.key)} target="_blank" rel="noreferrer">
                      <Smartphone aria-hidden /> Controle
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={PATHS.overlay(channel.key)} target="_blank" rel="noreferrer">
                      <ExternalLink aria-hidden /> Overlay OBS
                    </Link>
                  </Button>
                  <CopyButton value={absolute(PATHS.overlay(channel.key))} label="Copiar URL do overlay" />
                </div>
              </div>
            );
          })}
          <div className="grid gap-2 sm:grid-cols-3">
            <ScreenLink icon={<Tv aria-hidden />} label="TV (placar + agenda)" href={PATHS.tv()} absolute={absolute(PATHS.tv())} />
            <ScreenLink icon={<Vote aria-hidden />} label="Overlay da votação" href={PATHS.voteOverlay()} absolute={absolute(PATHS.voteOverlay())} />
            <ScreenLink icon={<Tv aria-hidden />} label="TV da votação" href={PATHS.voteTv()} absolute={absolute(PATHS.voteTv())} />
          </div>
          <p className="text-xs text-muted-foreground">
            Novos canais (Quadra 2, Palco…) em{" "}
            <Link href={PATHS.admin.competition()} className="text-primary underline-offset-4 hover:underline">
              Competição
            </Link>
            .
          </p>
        </div>
      </Section>

      <Section title="Competições" icon={<Trophy />} description="O site mostra uma competição por vez; as edições anteriores ficam guardadas." actions={<CreateCompetitionButton variant="outline" />}>
        <CompetitionList
          items={competitions
            .slice()
            .reverse()
            .map((row) => ({ id: row.id, name: row.name, createdAt: row.createdAt.toISOString(), isActive: row.id === snapshot.competition.id }))}
        />
      </Section>

      <Section title="Configurações gerais" icon={<Settings2 />}>
        <GeneralSettingsForm initial={settings} />
      </Section>

      <Notice>
        <span className="flex items-start gap-2">
          <FileText className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            As páginas do site (Início, Agenda, Classificação, Equipes, Jogos, Votação) são criadas pelo seed <strong>Páginas do site</strong> em{" "}
            <Link href="/admin/plugins" className="font-medium text-primary underline-offset-4 hover:underline">
              Admin → Plugins
            </Link>{" "}
            (botão &ldquo;Popular dados de exemplo&rdquo;). Depois, edite-as livremente no page-builder.
          </span>
        </span>
      </Notice>
    </AdminFrame>
  );
}

type Index = ReturnType<typeof indexes>;

function matchTitle(index: Index, match: MatchView): string {
  const home = match.homeId ? index.participants.get(match.homeId)?.name : null;
  const away = match.awayId ? index.participants.get(match.awayId)?.name : null;
  return `${home ?? match.homeLabel ?? "A definir"} × ${away ?? match.awayLabel ?? "A definir"}`;
}

function MatchList({ matches, index }: { matches: MatchView[]; index: Index }) {
  return (
    <ul className="divide-y divide-border">
      {matches.map((match) => {
        const modality = index.modalities.get(match.modalityId);
        const home = match.homeId ? index.participants.get(match.homeId) : undefined;
        const away = match.awayId ? index.participants.get(match.awayId) : undefined;
        return (
          <li key={match.id}>
            <Link href={PATHS.admin.match(match.id)} className="flex items-center gap-3 rounded-md py-2.5 hover:bg-muted">
              <div className="flex -space-x-2">
                <Crest name={home?.name ?? "?"} url={home?.crestUrl ?? null} color={home?.primaryColor} size="sm" />
                <Crest name={away?.name ?? "?"} url={away?.crestUrl ?? null} color={away?.primaryColor} size="sm" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{matchTitle(index, match)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {modality ? `${modality.emoji ?? ""} ${modality.name}`.trim() : ""} {match.roundLabel ? `· ${match.roundLabel}` : ""} · {formatMatchDate(match.scheduledDate, match.scheduledTime)}
                </p>
              </div>
              {match.status === "live" ? (
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {formatScore(match.homeScore)} × {formatScore(match.awayScore)}
                </span>
              ) : (
                <MatchStatusBadge status={match.status} />
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ScreenLink({ icon, label, href, absolute }: { icon: ReactNode; label: string; href: string; absolute: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
      <Link href={href} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground hover:text-primary [&_svg]:size-4 [&_svg]:text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </Link>
      <CopyButton value={absolute} label="URL" size="xs" />
    </div>
  );
}
