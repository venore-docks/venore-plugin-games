import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Trash2 } from "lucide-react";
import { Badge, Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tabs, TabsContent, TabsList, TabsTrigger } from "@venore/plugin-sdk/ui";
import type { CompetitionSnapshot, MatchView, ModalityView, StageView } from "../../../contracts/types";
import { indexes, isModalityComplete, modalityPlacements, stageStandings } from "../../../shared/derive";
import { formatScore } from "../../../shared/score";
import { getSportProfile } from "../../../shared/sport-profiles";
import { formatMatchDate } from "../../../shared/timezone";
import { describeSlotSource } from "../../../shared/tournament";
import { sanitizeStages } from "../../../shared/templates";
import { isUuid } from "../../../shared/ids";
import { PATHS } from "../../../shared/paths";
import { listSavedTemplates } from "../../../runtime/modalities";
import { AdminDenied, AdminFrame, NoCompetition } from "../_shared/admin-nav";
import { ConfirmAction } from "../_shared/confirm-action";
import { loadAdminPage, pickableMedia } from "../_shared/server";
import { Crest, MatchStatusBadge, ModalityStatusBadge, Notice, Section } from "../_shared/ui";
import { deleteModalityAction } from "./actions";
import { EntriesEditor, type EntryParticipant } from "./entries-editor";
import { FormatEditor } from "./format-editor";
import { RulesForm } from "./rules-form";
import { GroupMembersEditor, PlacementsEditor, StageResultsEditor } from "./stage-editors";

type PageProps = { params: Promise<Record<string, string>>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const TABS = ["regras", "inscricoes", "formato", "fases", "resultados", "colocacao"] as const;

// /admin/games/modalidades/:id — a tela central: regras, inscrições, formato (com prévia), fases,
// resultados de prova única e colocação final. ?aba=<nome> abre direto numa aba.
export default async function AdminModalityPage({ params, searchParams }: PageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!isUuid(id)) notFound();
  const access = await loadAdminPage("manage");
  if (!access.ok) return <AdminDenied message={access.message} />;
  const { snapshot } = access;
  if (!snapshot) return <NoCompetition active="modalities" />;

  const index = indexes(snapshot);
  const modality = index.modalities.get(id);
  if (!modality) notFound();

  const profile = getSportProfile(modality.sportProfile);
  const isEvent = profile.shape === "event";
  const modalityMatches = snapshot.matches.filter((match) => match.modalityId === modality.id && match.status !== "cancelled");
  const hasPlayed = modalityMatches.some((match) => match.status === "live" || match.status === "finished");
  const [coverMedia, savedRows] = await Promise.all([pickableMedia(modality.coverMediaId), listSavedTemplates()]);

  const toEntry = (participantId: string): EntryParticipant | null => {
    const participant = index.participants.get(participantId);
    return participant ? { id: participant.id, name: participant.name, crestUrl: participant.crestUrl, primaryColor: participant.primaryColor } : null;
  };
  const allParticipants = snapshot.participants.map((participant) => toEntry(participant.id)!).filter(Boolean);
  const entrants = modality.entries.map((entry) => toEntry(entry.participantId)).filter((entry): entry is EntryParticipant => entry !== null);
  const names = Object.fromEntries(snapshot.participants.map((participant) => [participant.id, participant.name]));
  const placements = modalityPlacements(snapshot, modality);
  const eventStages = modality.stages.filter((stage) => stage.type === "single_event");
  const requestedTab = typeof query.aba === "string" && (TABS as readonly string[]).includes(query.aba) ? query.aba : null;
  const defaultTab = requestedTab ?? (modality.entries.length === 0 ? "inscricoes" : modality.stages.length === 0 ? "formato" : isEvent ? "resultados" : "fases");

  return (
    <AdminFrame
      active="modalities"
      competitionName={snapshot.competition.name}
      title={
        <span className="flex flex-wrap items-center gap-2">
          {modality.emoji && <span aria-hidden>{modality.emoji}</span>}
          {modality.name}
          <ModalityStatusBadge status={modality.status} />
        </span>
      }
      description={`${profile.label} · ${modality.entries.length} equipe(s) · ${isEvent ? `${modality.stages.length} fase(s)` : `${modalityMatches.length} jogo(s)`} · peso ×${modality.weight.toLocaleString("pt-BR")}`}
      actions={
        <>
          {!isEvent && (
            <Button asChild variant="outline" size="sm">
              <Link href={`${PATHS.admin.matches()}?modalidade=${modality.id}`}>Jogos</Link>
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href={PATHS.modality(modality.slug)} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden /> Página pública
            </Link>
          </Button>
          <ConfirmAction
            trigger={
              <Button variant="destructive" size="sm">
                <Trash2 aria-hidden /> Excluir
              </Button>
            }
            title={`Excluir ${modality.name}?`}
            description={
              hasPlayed ? (
                <p>A modalidade tem jogos disputados e não pode ser excluída. Apague os resultados antes.</p>
              ) : (
                <p>Saem junto as fases, os grupos, os {modalityMatches.length} jogo(s) agendado(s), as inscrições e a colocação. Não dá pra desfazer.</p>
              )
            }
            requireText={hasPlayed ? undefined : modality.name}
            confirmLabel="Excluir modalidade"
            successMessage="Modalidade excluída."
            onConfirm={deleteModalityAction.bind(null, modality.id)}
            redirectTo={PATHS.admin.modalities()}
          />
        </>
      }
    >
      <Tabs defaultValue={defaultTab} className="gap-4">
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList>
            <TabsTrigger value="regras">Regras</TabsTrigger>
            <TabsTrigger value="inscricoes">Inscrições ({modality.entries.length})</TabsTrigger>
            <TabsTrigger value="formato">Formato</TabsTrigger>
            <TabsTrigger value="fases">Fases</TabsTrigger>
            {eventStages.length > 0 && <TabsTrigger value="resultados">Resultados</TabsTrigger>}
            <TabsTrigger value="colocacao">Colocação final</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="regras">
          <Section title="Regras e identificação">
            <RulesForm modality={modality} coverMedia={coverMedia} profileLocked={hasPlayed} />
          </Section>
        </TabsContent>

        <TabsContent value="inscricoes">
          <Section title="Inscrições" description="Quem disputa esta modalidade, na ordem de cabeça de chave (1 = mais forte).">
            <EntriesEditor
              key={modality.entries.map((entry) => entry.participantId).join(",")}
              modalityId={modality.id}
              participants={allParticipants}
              initial={modality.entries.map((entry) => entry.participantId)}
              structureApplied={modality.stages.length > 0}
            />
          </Section>
        </TabsContent>

        <TabsContent value="formato">
          <Section title="Formato do torneio" description="Escolha um formato, confira a prévia e aplique — fases, grupos e jogos são gerados das inscrições.">
            <FormatEditor
              modalityId={modality.id}
              shape={profile.shape}
              entryIds={modality.entries.map((entry) => entry.participantId)}
              names={names}
              savedTemplates={savedRows.map((row) => ({
                id: row.id,
                name: row.name,
                description: row.description,
                shape: row.shape === "event" ? "event" : "match",
                stages: sanitizeStages(row.stages),
              }))}
              hasPlayed={hasPlayed}
              hasStructure={modality.stages.length > 0}
            />
          </Section>
        </TabsContent>

        <TabsContent value="fases" className="space-y-4">
          {modality.stages.length === 0 ? (
            <Notice>Nenhuma fase ainda. Defina o formato na aba Formato.</Notice>
          ) : (
            modality.stages.map((stage) => (
              <StagePanel key={stage.id} snapshot={snapshot} modality={modality} stage={stage} entrants={entrants} matches={modalityMatches} />
            ))
          )}
        </TabsContent>

        {eventStages.length > 0 && (
          <TabsContent value="resultados" className="space-y-4">
            {eventStages.map((stage) => (
              <Section key={stage.id} title={stage.name} description={stage.status === "finished" ? "Encerrada" : "Lance o resultado de cada equipe."}>
                <StageResultsEditor
                  key={`${stage.id}:${snapshot.version}`}
                  stageId={stage.id}
                  stageName={stage.name}
                  kind={profile.eventResult?.kind ?? "score"}
                  unit={modality.rules.measureUnit}
                  participants={entrants}
                  results={stage.results}
                  finished={stage.status === "finished"}
                />
              </Section>
            ))}
          </TabsContent>
        )}

        <TabsContent value="colocacao">
          <Section
            title="Colocação final"
            description={
              modality.status === "finished"
                ? "Finalizada: esta colocação vale no quadro geral. Reabra para corrigir."
                : isModalityComplete(snapshot, modality)
                  ? "Todas as fases encerradas. Confira a colocação calculada (ajuste à mão se precisar) e finalize."
                  : "Calculada das fases até agora. Ajuste à mão se precisar e finalize quando a modalidade acabar."
            }
          >
            <PlacementsEditor
              key={`${modality.status}:${placements.map((row) => `${row.participantId}=${row.position}`).join(",")}`}
              modalityId={modality.id}
              participants={entrants}
              computed={placements}
              finished={modality.status === "finished"}
            />
          </Section>
        </TabsContent>
      </Tabs>
    </AdminFrame>
  );
}

function teamLabel(snapshot: CompetitionSnapshot, match: MatchView, side: "home" | "away", matchLabels: Record<string, string>): { name: string; resolved: boolean } {
  const participantId = side === "home" ? match.homeId : match.awayId;
  if (participantId) return { name: indexes(snapshot).participants.get(participantId)?.name ?? "Equipe", resolved: true };
  const label = side === "home" ? match.homeLabel : match.awayLabel;
  const source = side === "home" ? match.homeSource : match.awaySource;
  return { name: label ?? describeSlotSource(source, matchLabels), resolved: false };
}

function StagePanel({
  snapshot,
  modality,
  stage,
  entrants,
  matches,
}: {
  snapshot: CompetitionSnapshot;
  modality: ModalityView;
  stage: StageView;
  entrants: EntryParticipant[];
  matches: MatchView[];
}) {
  const index = indexes(snapshot);
  const statusLabel = stage.status === "finished" ? "Encerrada" : stage.status === "in_progress" ? "Em andamento" : "Não iniciada";
  const header = (
    <span className="flex items-center gap-2">
      {stage.index + 1}. {stage.name}
      <Badge variant={stage.status === "finished" ? "default" : "outline"}>{statusLabel}</Badge>
    </span>
  );

  if (stage.type === "single_event") {
    const results = [...stage.results].filter((result) => result.value !== null).sort((a, b) => (modality.rules.lowerIsBetter ? (a.value ?? 0) - (b.value ?? 0) : (b.value ?? 0) - (a.value ?? 0)));
    return (
      <Section title={header} description="Prova única — resultados na aba Resultados.">
        {results.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum resultado lançado.</p>
        ) : (
          <ol className="space-y-1">
            {results.map((result, position) => (
              <li key={result.participantId} className="flex items-center gap-2 text-sm">
                <span className="w-6 text-right font-semibold tabular-nums text-muted-foreground">{position + 1}º</span>
                <span className="min-w-0 flex-1 truncate text-foreground">{index.participants.get(result.participantId)?.name}</span>
                <span className="tabular-nums text-foreground">
                  {result.value?.toLocaleString("pt-BR")} {modality.rules.measureUnit}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Section>
    );
  }

  const stageMatches = matches.filter((match) => match.stageId === stage.id);

  if (stage.type === "round_robin") {
    const standings = stageStandings(snapshot, modality, stage);
    const groupOf: Record<string, string> = {};
    for (const group of stage.groups) for (const participantId of group.participantIds) groupOf[participantId] = group.name;
    return (
      <Section title={header} description={`Pontos corridos${stage.config.doubleRound === true ? " (ida e volta)" : ""} · ${stageMatches.length} jogo(s)`}>
        <div className="grid gap-4 xl:grid-cols-2">
          {standings.map((group) => {
            const locked = group.matches.some((match) => match.status === "live" || match.status === "finished");
            const others = Object.fromEntries(Object.entries(groupOf).filter(([, name]) => name !== group.groupName));
            return (
              <div key={group.groupId} className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    Grupo {group.groupName} {group.complete && <span className="text-xs font-normal text-muted-foreground">· encerrado</span>}
                  </p>
                  <GroupMembersEditor
                    groupId={group.groupId}
                    groupName={group.groupName}
                    members={group.rows.map((row) => row.participantId)}
                    candidates={entrants}
                    otherGroupOf={others}
                    locked={locked}
                  />
                </div>
                {group.rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem equipes.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8 text-right">#</TableHead>
                          <TableHead>Equipe</TableHead>
                          <TableHead className="text-right">P</TableHead>
                          <TableHead className="text-right">J</TableHead>
                          <TableHead className="text-right">V</TableHead>
                          <TableHead className="text-right">E</TableHead>
                          <TableHead className="text-right">D</TableHead>
                          <TableHead className="text-right">S</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.rows.map((row) => (
                          <TableRow key={row.participantId}>
                            <TableCell className="text-right tabular-nums text-muted-foreground">{row.rank}</TableCell>
                            <TableCell className="max-w-40 truncate font-medium text-foreground">{row.name}</TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">{row.points}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.played}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.won}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.drawn}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.lost}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatScore(row.goalDiff)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {group.matches.filter((match) => match.status === "finished").length}/{group.matches.length} jogos encerrados ·{" "}
                  <Link href={`${PATHS.admin.matches()}?modalidade=${modality.id}&fase=${stage.id}`} className="text-primary underline-offset-4 hover:underline">
                    ver jogos
                  </Link>
                </p>
              </div>
            );
          })}
        </div>
      </Section>
    );
  }

  // Mata-mata: rodadas em colunas, cada jogo com o lado resolvido ou a origem descrita.
  const matchLabels = Object.fromEntries(stageMatches.filter((match) => match.matchKey).map((match) => [match.matchKey!, match.matchKey!]));
  const rounds = new Map<number, MatchView[]>();
  for (const match of stageMatches) {
    const round = match.bracketRound ?? 1;
    rounds.set(round, [...(rounds.get(round) ?? []), match]);
  }
  const ordered = [...rounds.entries()].sort((a, b) => a[0] - b[0]);
  return (
    <Section title={header} description={`Mata-mata · ${stageMatches.length} jogo(s). Os lados se preenchem sozinhos quando a origem resolve; trave na súmula para fixar à mão.`}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {ordered.map(([round, roundMatches]) => (
          <div key={round} className="w-60 shrink-0 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-caps text-muted-foreground">{roundMatches.find((match) => !match.isThirdPlace)?.roundLabel ?? roundMatches[0].roundLabel}</p>
            {roundMatches
              .sort((a, b) => Number(a.isThirdPlace) - Number(b.isThirdPlace) || (a.bracketPosition ?? 0) - (b.bracketPosition ?? 0))
              .map((match) => {
                const home = teamLabel(snapshot, match, "home", matchLabels);
                const away = teamLabel(snapshot, match, "away", matchLabels);
                const homeP = match.homeId ? index.participants.get(match.homeId) : undefined;
                const awayP = match.awayId ? index.participants.get(match.awayId) : undefined;
                return (
                  <Link key={match.id} href={PATHS.admin.match(match.id)} className="block space-y-1 rounded-lg border border-border p-2 hover:border-ring">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span className="font-semibold">
                        {match.matchKey}
                        {match.isThirdPlace ? " · 3º lugar" : ""}
                        {match.slotsLocked ? " · travado" : ""}
                      </span>
                      <MatchStatusBadge status={match.status} />
                    </div>
                    {[
                      { label: home, participant: homeP, score: match.homeScore },
                      { label: away, participant: awayP, score: match.awayScore },
                    ].map((side, sideIndex) => (
                      <div key={sideIndex} className="flex items-center gap-2">
                        {side.participant ? <Crest name={side.participant.name} url={side.participant.crestUrl} color={side.participant.primaryColor} size="sm" /> : <span className="size-6 shrink-0 rounded-full border border-dashed border-border" />}
                        <span className={side.label.resolved ? "min-w-0 flex-1 truncate text-sm text-foreground" : "min-w-0 flex-1 truncate text-xs text-muted-foreground italic"}>{side.label.name}</span>
                        {match.status !== "scheduled" && <span className="text-sm font-semibold tabular-nums text-foreground">{formatScore(side.score)}</span>}
                      </div>
                    ))}
                    <p className="text-[11px] text-muted-foreground">{formatMatchDate(match.scheduledDate, match.scheduledTime)}</p>
                  </Link>
                );
              })}
          </div>
        ))}
      </div>
    </Section>
  );
}
