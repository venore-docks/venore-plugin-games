import Link from "next/link";
import { ClipboardList, ExternalLink, Plus, Smartphone } from "lucide-react";
import { Button, EmptyState } from "@venore/plugin-sdk/ui";
import { MATCH_STATUSES, type MatchView } from "../../../contracts/types";
import { compareMatchesChronologically, indexes } from "../../../shared/derive";
import { formatScore } from "../../../shared/score";
import { getSportProfile } from "../../../shared/sport-profiles";
import { formatMatchDate } from "../../../shared/timezone";
import { describeSlotSource } from "../../../shared/tournament";
import { PATHS } from "../../../shared/paths";
import { AdminDenied, AdminFrame, NoCompetition } from "../_shared/admin-nav";
import { loadAdminPage } from "../_shared/server";
import { Crest, MatchStatusBadge } from "../_shared/ui";
import { MatchFilters } from "./match-filters";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const pick = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

// /admin/games/jogos — todos os jogos, filtráveis e agrupados por data.
export default async function AdminMatchesPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const access = await loadAdminPage("manage");
  if (!access.ok) return <AdminDenied message={access.message} />;
  const { snapshot } = access;
  if (!snapshot) return <NoCompetition active="matches" />;

  const index = indexes(snapshot);
  const matchModalities = snapshot.modalities.filter((modality) => getSportProfile(modality.sportProfile).shape === "match");
  const modalityId = index.modalities.has(pick(query.modalidade)) ? pick(query.modalidade) : "";
  const status = (MATCH_STATUSES as string[]).includes(pick(query.status)) ? pick(query.status) : "";
  const stages = modalityId ? (index.modalities.get(modalityId)?.stages.filter((stage) => stage.type !== "single_event") ?? []) : [];
  const stageId = stages.some((stage) => stage.id === pick(query.fase)) ? pick(query.fase) : "";

  const filtered = snapshot.matches
    .filter((match) => (!modalityId || match.modalityId === modalityId) && (!status || match.status === status) && (!stageId || match.stageId === stageId))
    .sort(compareMatchesChronologically);

  const groups = new Map<string, MatchView[]>();
  for (const match of filtered) {
    const key = match.scheduledDate ?? "";
    groups.set(key, [...(groups.get(key) ?? []), match]);
  }
  const newHref = `${PATHS.admin.match("new")}${modalityId ? `?modalidade=${modalityId}` : ""}`;

  const sideName = (match: MatchView, side: "home" | "away") => {
    const participantId = side === "home" ? match.homeId : match.awayId;
    if (participantId) return index.participants.get(participantId)?.name ?? "Equipe";
    return (side === "home" ? match.homeLabel : match.awayLabel) ?? describeSlotSource(side === "home" ? match.homeSource : match.awaySource);
  };

  return (
    <AdminFrame
      active="matches"
      competitionName={snapshot.competition.name}
      title="Jogos"
      description={`${filtered.length} jogo(s)${filtered.length !== snapshot.matches.length ? ` de ${snapshot.matches.length}` : ""}.`}
      actions={
        matchModalities.length > 0 && (
          <Button asChild size="sm">
            <Link href={newHref}>
              <Plus aria-hidden /> Novo jogo
            </Link>
          </Button>
        )
      }
    >
      <MatchFilters
        modalities={matchModalities.map(({ id, name, emoji }) => ({ id, name: emoji ? `${emoji} ${name}` : name }))}
        stages={stages.map(({ id, name }) => ({ id, name }))}
        current={{ modalidade: modalityId, status, fase: stageId }}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-8" strokeWidth={1.5} />}
          title={snapshot.matches.length === 0 ? "Nenhum jogo ainda" : "Nenhum jogo com esses filtros"}
          description={snapshot.matches.length === 0 ? "Aplique o formato de uma modalidade (aba Formato) para gerar os jogos, ou crie um jogo avulso." : undefined}
        />
      ) : (
        <div className="space-y-5">
          {[...groups.entries()].map(([date, matches]) => (
            <section key={date || "sem-data"} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-caps text-muted-foreground">{date ? formatMatchDate(date, null) : "Sem data"}</h2>
              <ul className="divide-y divide-border overflow-hidden rounded-panel border border-border bg-card">
                {matches.map((match) => {
                  const modality = index.modalities.get(match.modalityId);
                  const home = match.homeId ? index.participants.get(match.homeId) : undefined;
                  const away = match.awayId ? index.participants.get(match.awayId) : undefined;
                  const showScore = match.status === "live" || match.status === "finished";
                  return (
                    <li key={match.id} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center">
                      <Link href={PATHS.admin.match(match.id)} className="flex min-w-0 flex-1 items-center gap-3 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                        <span className="w-12 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">{match.scheduledTime ?? "--:--"}</span>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <Crest name={sideName(match, "home")} url={home?.crestUrl ?? null} color={home?.primaryColor} size="sm" />
                            <span className={home ? "truncate text-sm font-medium text-foreground" : "truncate text-sm text-muted-foreground italic"}>{sideName(match, "home")}</span>
                            {showScore && <span className="ms-auto text-sm font-semibold tabular-nums text-foreground">{formatScore(match.homeScore)}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <Crest name={sideName(match, "away")} url={away?.crestUrl ?? null} color={away?.primaryColor} size="sm" />
                            <span className={away ? "truncate text-sm font-medium text-foreground" : "truncate text-sm text-muted-foreground italic"}>{sideName(match, "away")}</span>
                            {showScore && <span className="ms-auto text-sm font-semibold tabular-nums text-foreground">{formatScore(match.awayScore)}</span>}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            {[modality ? `${modality.emoji ?? ""} ${modality.name}`.trim() : null, match.roundLabel, match.venue].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                      </Link>
                      <div className="flex items-center gap-1.5 ps-15 sm:ps-0">
                        <MatchStatusBadge status={match.status} />
                        {(match.status === "scheduled" || match.status === "live") && (
                          <Button asChild variant="ghost" size="icon-sm" title="Abrir no controle ao vivo">
                            <Link href={PATHS.control()} target="_blank" rel="noreferrer" aria-label="Abrir no controle ao vivo">
                              <Smartphone aria-hidden />
                            </Link>
                          </Button>
                        )}
                        <Button asChild variant="ghost" size="icon-sm" title="Página pública">
                          <Link href={PATHS.match(match.id)} target="_blank" rel="noreferrer" aria-label="Página pública">
                            <ExternalLink aria-hidden />
                          </Link>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                          <Link href={PATHS.admin.match(match.id)}>Súmula</Link>
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </AdminFrame>
  );
}
