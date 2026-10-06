import Link from "next/link";
import type { BlockRendererProps } from "@venore/plugin-sdk";
import { Badge, cn } from "@venore/plugin-sdk/ui";
import type { CompetitionSnapshot, ModalityView } from "../contracts/types";
import { indexes, isModalityComplete, modalityPlacements, overallTable, participantRecord, topMvps, topScorers, type AthleteRankingRow } from "../shared/derive";
import { getSportProfile } from "../shared/sport-profiles";
import { formatScore } from "../shared/score";
import { PATHS } from "../shared/paths";
import { BlockFrame, HScroll, SectionHeader } from "../components/section";
import { ModalityStages } from "../components/modality-stages";
import { Crest, TeamStripe } from "../components/crest";
import { MedalBadge } from "../components/medal";
import { AthleteRanking } from "../components/athlete-ranking";
import { modalityLabel } from "../components/lib/match-info";
import { loadFanAwards, loadSiteSnapshot } from "../components/site-data";
import { emptyState, missingModalityNote, NO_COMPETITION } from "./common";
import { bool, int, modalityFilter, oneOf, text } from "./fields";

// ---- Classificação / chaveamento de uma modalidade ----

async function modalityBlock({ block, mode }: BlockRendererProps, only: "standings" | "bracket") {
  const label = only === "standings" ? "Classificação" : "Chaveamento";
  const snapshot = await loadSiteSnapshot();
  if (!snapshot) return emptyState(mode, label, NO_COMPETITION);
  const { modality, missing } = modalityFilter(snapshot, block.data);
  // Liga simples (uma modalidade só): o campo pode ficar vazio.
  const target = modality ?? (snapshot.modalities.length === 1 ? snapshot.modalities[0] : null);
  if (!target) {
    return emptyState(mode, label, missing ? `Modalidade "${missing}" não encontrada. Confira o slug em Modalidades.` : "Informe o slug da modalidade nas configurações do bloco.");
  }
  if (only === "bracket" && !target.stages.some((stage) => stage.type === "knockout")) return emptyState(mode, label, `${target.name} não tem fase de mata-mata.`);
  if (target.stages.length === 0) return emptyState(mode, label, `As fases de ${target.name} ainda não foram montadas.`);
  return (
    <BlockFrame>
      <SectionHeader title={text(block.data, "title") || `${label} — ${target.name}`} action={{ href: PATHS.modality(target.slug), label: "Ver modalidade" }} />
      <ModalityStages snapshot={snapshot} modality={target} only={only} />
    </BlockFrame>
  );
}

export function StandingsBlock(props: BlockRendererProps) {
  return modalityBlock(props, "standings");
}

export function BracketBlock(props: BlockRendererProps) {
  return modalityBlock(props, "bracket");
}

// ---- Quadro geral ----

export function OverallSection({ snapshot, title, limit }: { snapshot: CompetitionSnapshot; title: string; limit?: number }) {
  const { participants } = indexes(snapshot);
  const rows = overallTable(snapshot).slice(0, limit ?? undefined);
  const modalities = [...snapshot.modalities].sort((a, b) => a.sortOrder - b.sortOrder);
  const showAdjustments = rows.some((row) => row.adjustments !== 0);
  const finished = modalities.filter((modality) => isModalityComplete(snapshot, modality)).length;
  const num = "px-2 py-2.5 text-center tabular-nums";
  return (
    <BlockFrame>
      <SectionHeader
        title={title}
        subtitle={`${finished} de ${modalities.length} modalidade${modalities.length === 1 ? "" : "s"} encerrada${finished === 1 ? "" : "s"}${snapshot.competition.overallIncludesPartial ? " · inclui parciais" : ""}`}
      />
      <div className="overflow-hidden rounded-panel border border-border bg-card shadow-panel">
        <HScroll label="Quadro geral" className="mx-0 px-0 pb-0">
          <table className="w-full min-w-[20rem] border-collapse text-sm">
            <thead>
              <tr className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="sticky left-0 z-10 bg-card py-2 pl-3 pr-2 text-left">
                  Equipe
                </th>
                {modalities.map((modality) => (
                  <th key={modality.id} scope="col" className={num} title={modality.name}>
                    <Link href={PATHS.modality(modality.slug)} className="hover:text-foreground">
                      {modality.emoji ?? modality.name.slice(0, 3)}
                      <span className="sr-only"> {modality.name}</span>
                    </Link>
                  </th>
                ))}
                {showAdjustments && (
                  <th scope="col" className={num} title="Bônus e penalidades">
                    ±
                  </th>
                )}
                <th scope="col" className={num} title="1º / 2º / 3º lugares">
                  Pódios
                </th>
                <th scope="col" className={cn(num, "pr-3 text-foreground")}>
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const participant = participants.get(row.participantId);
                return (
                  <tr key={row.participantId} className="border-t border-border">
                    <th scope="row" className="sticky left-0 z-10 bg-card py-2 pl-3 pr-2 text-left font-normal">
                      <span className="flex min-w-0 items-center gap-2">
                        <MedalBadge position={row.position} className="size-7 text-xs" />
                        <Crest name={row.name} crestUrl={participant?.crestUrl ?? null} color={participant?.primaryColor ?? null} size="xs" />
                        {participant ? (
                          <Link href={PATHS.participant(participant.slug)} className="max-w-[8rem] truncate font-semibold text-foreground hover:underline @md:max-w-[14rem]">
                            {participant.shortName || participant.name}
                          </Link>
                        ) : (
                          <span className="max-w-[8rem] truncate font-semibold text-foreground">{row.name}</span>
                        )}
                      </span>
                    </th>
                    {modalities.map((modality) => (
                      <td key={modality.id} className={cn(num, "text-muted-foreground")}>
                        {row.byModality[modality.id] ? formatScore(row.byModality[modality.id]) : "–"}
                      </td>
                    ))}
                    {showAdjustments && <td className={num}>{row.adjustments > 0 ? `+${formatScore(row.adjustments)}` : formatScore(row.adjustments)}</td>}
                    <td className={cn(num, "whitespace-nowrap text-xs text-muted-foreground")}>
                      {row.golds}/{row.silvers}/{row.bronzes}
                    </td>
                    <td className={cn(num, "pr-3 font-display text-base font-extrabold text-foreground")}>{formatScore(row.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </HScroll>
      </div>
    </BlockFrame>
  );
}

export async function OverallBlock({ block, mode }: BlockRendererProps) {
  const snapshot = await loadSiteSnapshot();
  if (!snapshot) return emptyState(mode, "Quadro geral", NO_COMPETITION);
  if (!snapshot.competition.overallEnabled) return emptyState(mode, "Quadro geral", "O quadro geral está desligado nesta competição (Admin → Competição). Em campeonato de uma modalidade, use o bloco de classificação.");
  if (snapshot.participants.length === 0) return emptyState(mode, "Quadro geral", "Nenhuma equipe cadastrada ainda.");
  const limit = int(block.data, "limit", 0, 100, 0);
  return <OverallSection snapshot={snapshot} title={text(block.data, "title") || "Quadro geral"} limit={limit || undefined} />;
}

// ---- Modalidades ----

const MODALITY_STATUS: Record<ModalityView["status"], string> = { setup: "Em breve", in_progress: "Em andamento", finished: "Encerrada" };

export function ModalitiesSection({ snapshot, title }: { snapshot: CompetitionSnapshot; title: string }) {
  const { participants } = indexes(snapshot);
  const modalities = [...snapshot.modalities].sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <BlockFrame>
      <SectionHeader title={title} />
      <ul className="grid grid-cols-1 gap-3 @md:grid-cols-2 @3xl:grid-cols-3">
        {modalities.map((modality) => {
          const complete = isModalityComplete(snapshot, modality);
          const leader = modalityPlacements(snapshot, modality).find((placement) => placement.position === 1);
          const team = leader ? participants.get(leader.participantId) : undefined;
          const hasProgress = modality.status !== "setup" || complete;
          return (
            <li key={modality.id}>
              <Link href={PATHS.modality(modality.slug)} className="flex h-full flex-col gap-3 rounded-panel border border-border bg-card p-4 shadow-panel ui-motion-base hover:border-ring">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    {modality.emoji && (
                      <span className="text-2xl" aria-hidden="true">
                        {modality.emoji}
                      </span>
                    )}
                    <span className="truncate font-display text-lg font-bold text-foreground">{modality.name}</span>
                  </span>
                  <Badge variant={complete ? "default" : modality.status === "in_progress" ? "secondary" : "outline"}>{complete ? "Encerrada" : MODALITY_STATUS[modality.status]}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {getSportProfile(modality.sportProfile).label} · {modality.entries.length} equipe{modality.entries.length === 1 ? "" : "s"}
                </p>
                {team && hasProgress ? (
                  <span className="mt-auto flex items-center gap-2 rounded-xl bg-muted/60 px-2.5 py-2">
                    <Crest name={team.name} crestUrl={team.crestUrl} color={team.primaryColor} size="sm" />
                    <span className="min-w-0">
                      <span className="block text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground">{complete ? "Campeã" : "Lidera"}</span>
                      <span className="block truncate text-sm font-semibold text-foreground">{team.name}</span>
                    </span>
                  </span>
                ) : (
                  <span className="mt-auto text-sm text-muted-foreground">Ainda sem resultados.</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </BlockFrame>
  );
}

export async function ModalitiesBlock({ block, mode }: BlockRendererProps) {
  const snapshot = await loadSiteSnapshot();
  if (!snapshot) return emptyState(mode, "Modalidades", NO_COMPETITION);
  if (snapshot.modalities.length === 0) return emptyState(mode, "Modalidades", "Nenhuma modalidade cadastrada ainda.");
  return <ModalitiesSection snapshot={snapshot} title={text(block.data, "title") || "Modalidades"} />;
}

// ---- Equipes ----

export function ParticipantsSection({ snapshot, title, showRecord }: { snapshot: CompetitionSnapshot; title: string; showRecord: boolean }) {
  const overall = snapshot.competition.overallEnabled ? new Map(overallTable(snapshot).map((row) => [row.participantId, row])) : null;
  const participants = [...snapshot.participants].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR"));
  return (
    <BlockFrame>
      <SectionHeader title={title} />
      <ul className="grid grid-cols-2 gap-3 @lg:grid-cols-3 @3xl:grid-cols-4 @5xl:grid-cols-6">
        {participants.map((participant) => {
          const record = showRecord ? participantRecord(snapshot, participant.id) : null;
          const position = overall?.get(participant.id);
          return (
            <li key={participant.id}>
              <Link href={PATHS.participant(participant.slug)} className="flex h-full flex-col overflow-hidden rounded-panel border border-border bg-card shadow-panel ui-motion-base hover:border-ring">
                <TeamStripe primary={participant.primaryColor} secondary={participant.secondaryColor} className="h-1.5" />
                <span className="flex flex-1 flex-col items-center gap-2 p-3 text-center">
                  <Crest name={participant.name} crestUrl={participant.crestUrl} color={participant.primaryColor} size="lg" />
                  <span className="line-clamp-2 text-sm font-bold leading-tight text-foreground">{participant.name}</span>
                  {position ? (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {position.position}º · {formatScore(position.total)} pts
                    </span>
                  ) : record && record.played > 0 ? (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {record.won}V {record.drawn}E {record.lost}D
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </BlockFrame>
  );
}

export async function ParticipantsBlock({ block, mode }: BlockRendererProps) {
  const snapshot = await loadSiteSnapshot();
  if (!snapshot) return emptyState(mode, "Equipes", NO_COMPETITION);
  if (snapshot.participants.length === 0) return emptyState(mode, "Equipes", "Nenhuma equipe cadastrada ainda.");
  return <ParticipantsSection snapshot={snapshot} title={text(block.data, "title") || "Equipes"} showRecord={bool(block.data, "showRecord", true)} />;
}

// ---- Ranking de atletas ----

export type RankingKind = "scorers" | "mvps" | "fan";
export const RANKING_KINDS = ["scorers", "mvps", "fan"] as const;

export async function rankingRows(snapshot: CompetitionSnapshot, kind: RankingKind, modalityId?: string): Promise<AthleteRankingRow[]> {
  if (kind === "scorers") return topScorers(snapshot, modalityId);
  if (kind === "mvps") return topMvps(snapshot, modalityId);
  const { athletes, participants, matches } = indexes(snapshot);
  const totals = new Map<string, number>();
  for (const [matchId, winners] of await loadFanAwards()) {
    if (modalityId && matches.get(matchId)?.modalityId !== modalityId) continue;
    for (const athleteId of winners) totals.set(athleteId, (totals.get(athleteId) ?? 0) + 1);
  }
  return [...totals.entries()]
    .map(([athleteId, value]) => {
      const athlete = athletes.get(athleteId);
      return athlete ? { athlete, participant: participants.get(athlete.participantId) ?? null, value } : null;
    })
    .filter((row): row is AthleteRankingRow => row !== null)
    .sort((a, b) => b.value - a.value || a.athlete.name.localeCompare(b.athlete.name, "pt-BR"));
}

export function rankingTitle(snapshot: CompetitionSnapshot, kind: RankingKind, modality: ModalityView | null): { title: string; unit: { singular: string; plural: string } } {
  if (kind === "mvps") return { title: "Craques do jogo", unit: { singular: "prêmio", plural: "prêmios" } };
  if (kind === "fan") return { title: "Craques da torcida", unit: { singular: "prêmio", plural: "prêmios" } };
  const profiles = (modality ? [modality] : snapshot.modalities).map((item) => getSportProfile(item.sportProfile)).filter((profile) => profile.shape === "match");
  const units = new Set(profiles.map((profile) => profile.scoreUnit.plural));
  const unit = units.size === 1 ? profiles[0].scoreUnit : { singular: "ponto", plural: "pontos" };
  return { title: unit.plural === "gols" ? "Artilharia" : "Pontuadores", unit };
}

export async function AthletesRankingSection({
  snapshot,
  kind,
  modality,
  limit,
  title,
}: {
  snapshot: CompetitionSnapshot;
  kind: RankingKind;
  modality: ModalityView | null;
  limit: number;
  title?: string;
}) {
  const rows = (await rankingRows(snapshot, kind, modality?.id)).slice(0, limit);
  if (rows.length === 0) return null;
  const meta = rankingTitle(snapshot, kind, modality);
  return (
    <BlockFrame>
      <SectionHeader title={title || meta.title} subtitle={modality ? modalityLabel(modality) : undefined} />
      <AthleteRanking rows={rows} unit={meta.unit} />
    </BlockFrame>
  );
}

export async function AthletesRankingBlock({ block, mode }: BlockRendererProps) {
  const snapshot = await loadSiteSnapshot();
  if (!snapshot) return emptyState(mode, "Ranking de atletas", NO_COMPETITION);
  const kind = oneOf(block.data, "kind", RANKING_KINDS, "scorers");
  const { modality, missing } = modalityFilter(snapshot, block.data);
  const meta = rankingTitle(snapshot, kind, modality);
  const title = text(block.data, "title") || meta.title;
  if ((await rankingRows(snapshot, kind, modality?.id)).length === 0) {
    return emptyState(mode, title, kind === "fan" ? "Nenhuma votação de craque da torcida encerrada ainda." : "Ninguém pontuou ainda.");
  }
  return (
    <>
      {missingModalityNote(mode, missing)}
      <AthletesRankingSection snapshot={snapshot} kind={kind} modality={modality} limit={int(block.data, "limit", 1, 100, 10)} title={title} />
    </>
  );
}
