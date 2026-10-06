import { Medal, Radio, Scale, Settings2, Zap } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@venore/plugin-sdk/ui";
import { indexes, isModalityComplete, overallTable } from "../../../shared/derive";
import { AdminDenied, AdminFrame, NoCompetition } from "../_shared/admin-nav";
import { loadAdminPage, pickableMedia } from "../_shared/server";
import { Crest, Notice, Section } from "../_shared/ui";
import { AdjustmentsEditor, BoostsEditor, ChannelsEditor } from "./catalog-editors";
import { CompetitionForm } from "./competition-form";

// /admin/games/competicao — dados da edição, canais ao vivo, catálogo de power plays e quadro
// geral (ajustes + prévia).
export default async function AdminCompetitionPage() {
  const access = await loadAdminPage("manage");
  if (!access.ok) return <AdminDenied message={access.message} />;
  const { snapshot } = access;
  if (!snapshot) return <NoCompetition active="competition" />;

  const { competition } = snapshot;
  const logoMedia = await pickableMedia(competition.logoMediaId);
  const index = indexes(snapshot);
  const overall = overallTable(snapshot);
  const counted = snapshot.modalities.filter((modality) => competition.overallIncludesPartial || isModalityComplete(snapshot, modality));

  return (
    <AdminFrame active="competition" competitionName={competition.name} title="Competição" description="Dados da edição, canais ao vivo, power plays e quadro geral.">
      <Section title="Dados da competição" icon={<Settings2 />}>
        <CompetitionForm competition={competition} logoMedia={logoMedia} />
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Canais ao vivo" icon={<Radio />} description="Cada canal é uma quadra/palco com o próprio jogo no overlay e no controle.">
          <ChannelsEditor channels={snapshot.channels} />
        </Section>
        <Section title="Power plays" icon={<Zap />} description="Catálogo de poderes que o operador ativa durante o jogo.">
          <BoostsEditor boosts={snapshot.boostCatalog} />
        </Section>
      </div>

      <Section
        title="Quadro geral"
        icon={<Medal />}
        description={
          competition.overallEnabled
            ? `Pontos por colocação × peso da modalidade + ajustes. ${competition.overallIncludesPartial ? "Mostrando parcial (modalidades em andamento contam pela colocação atual)." : "Só modalidades finalizadas contam."}`
            : "O quadro geral está desligado — ligue em Dados da competição para uma olimpíada com várias modalidades."
        }
      >
        {competition.overallEnabled && (
          <div className="space-y-5">
            {snapshot.participants.length === 0 ? (
              <Notice>Cadastre equipes para ver o quadro geral.</Notice>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 text-right">#</TableHead>
                      <TableHead>Equipe</TableHead>
                      {counted.map((modality) => (
                        <TableHead key={modality.id} className="text-right whitespace-nowrap" title={modality.name}>
                          {modality.emoji ? `${modality.emoji} ` : ""}
                          {modality.name}
                        </TableHead>
                      ))}
                      <TableHead className="text-right">Ajustes</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overall.map((row) => {
                      const participant = index.participants.get(row.participantId);
                      return (
                        <TableRow key={row.participantId}>
                          <TableCell className="text-right font-semibold tabular-nums">{row.position}º</TableCell>
                          <TableCell>
                            <span className="flex items-center gap-2">
                              <Crest name={row.name} url={participant?.crestUrl ?? null} color={participant?.primaryColor} size="sm" />
                              <span className="font-medium whitespace-nowrap text-foreground">{row.name}</span>
                            </span>
                          </TableCell>
                          {counted.map((modality) => (
                            <TableCell key={modality.id} className="text-right tabular-nums text-muted-foreground">
                              {row.byModality[modality.id] !== undefined ? row.byModality[modality.id].toLocaleString("pt-BR") : "–"}
                            </TableCell>
                          ))}
                          <TableCell className={row.adjustments < 0 ? "text-right tabular-nums text-destructive" : "text-right tabular-nums text-muted-foreground"}>
                            {row.adjustments === 0 ? "–" : `${row.adjustments > 0 ? "+" : ""}${row.adjustments.toLocaleString("pt-BR")}`}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums text-foreground">{row.total.toLocaleString("pt-BR")}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Scale className="size-4 text-muted-foreground" aria-hidden /> Ajustes (bônus e penalidades)
              </h3>
              <AdjustmentsEditor
                adjustments={snapshot.adjustments}
                participants={snapshot.participants.map(({ id, name }) => ({ id, name }))}
                modalities={snapshot.modalities.map(({ id, name }) => ({ id, name }))}
              />
            </div>
          </div>
        )}
      </Section>
    </AdminFrame>
  );
}
