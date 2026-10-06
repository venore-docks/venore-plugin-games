import { ArrowRightLeft, ClipboardList, Shield } from "lucide-react";
import { getSportProfile } from "../../../shared/sport-profiles";
import { getErastoMigrationStatus } from "../../../runtime/migrate-erasto";
import { AdminDenied, AdminFrame } from "../_shared/admin-nav";
import { loadAdminPage } from "../_shared/server";
import { Notice, Section } from "../_shared/ui";
import { MatchesImportForm, MigrateErastoButton, ParticipantsImportForm } from "./import-forms";

const TEAMS_EXAMPLE = `nome,sigla,cor,corSecundaria,fundacao,ordem,id
3º ano A,3A,#16a34a,#0f172a,2024-02-01,1,
3º ano B,3B,#2563eb,,,2,`;

const MATCHES_EXAMPLE = `fase,grupo,rodada,mandante,visitante,data,hora,local
Fase de grupos,A,1ª rodada,3º ano A,3º ano B,12/10/2026,10:30,Quadra 1
Mata-mata,,Final,,,19/10/2026,11:00,Quadra 1`;

function Example({ title, columns, csv }: { title: string; columns: string; csv: string }) {
  return (
    <details className="rounded-lg border border-border bg-muted p-3 text-sm">
      <summary className="cursor-pointer font-medium text-foreground">{title}</summary>
      <p className="mt-2 text-xs text-muted-foreground">{columns}</p>
      <pre className="mt-2 overflow-x-auto rounded-md bg-background p-2 font-mono text-xs text-foreground">{csv}</pre>
    </details>
  );
}

// /admin/games/importar — CSV de equipes e de jogos (por modalidade) e migração do Erasto League.
export default async function AdminImportPage() {
  const access = await loadAdminPage("manage");
  if (!access.ok) return <AdminDenied message={access.message} />;
  const { snapshot } = access;
  const status = await getErastoMigrationStatus().catch(() => ({ available: false, alreadyMigrated: false, counts: {} as Record<string, number> }));

  const migrate = (
    <Section title="Migrar do Erasto League" icon={<ArrowRightLeft />} description="Traz o campeonato do plugin antigo pra cá, mantendo ids, links antigos e votos.">
      {!status.available ? (
        <p className="text-sm text-muted-foreground">Não há dados do Erasto League neste banco.</p>
      ) : status.alreadyMigrated ? (
        <Notice>A migração já foi feita (existe a competição &ldquo;erasto-league&rdquo;).</Notice>
      ) : (
        <div className="space-y-3">
          <ul className="flex flex-wrap gap-2 text-xs">
            {Object.entries(status.counts).map(([key, value]) => (
              <li key={key} className="rounded-md bg-muted px-2 py-1 text-muted-foreground">
                {key.replace(/_/g, " ")}: <span className="font-semibold tabular-nums text-foreground">{value}</span>
              </li>
            ))}
          </ul>
          <MigrateErastoButton disabled={false} />
        </div>
      )}
    </Section>
  );

  if (!snapshot) {
    return (
      <AdminFrame active="import" title="Importar" description="Crie uma competição na visão geral para importar CSV — ou migre o Erasto League.">
        {migrate}
      </AdminFrame>
    );
  }

  const modalities = snapshot.modalities.map((modality) => ({ id: modality.id, name: modality.emoji ? `${modality.emoji} ${modality.name}` : modality.name, shape: getSportProfile(modality.sportProfile).shape }));

  return (
    <AdminFrame active="import" competitionName={snapshot.competition.name} title="Importar" description="Planilha CSV (vírgula ou ponto e vírgula, UTF-8). Todas as linhas são conferidas antes: com qualquer erro, nada é gravado.">
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Equipes" icon={<Shield />} description="Cria as novas e atualiza as existentes (casadas pelo id ou pelo nome). Campo vazio não apaga nada; o brasão nunca muda pelo CSV.">
          <div className="space-y-4">
            <Example
              title="Exemplo de CSV de equipes"
              columns="Colunas: nome (obrigatória), sigla, cor, corSecundaria, fundacao, descricao, ordem, id (uuid — copie da página da equipe para renomear sem duplicar)."
              csv={TEAMS_EXAMPLE}
            />
            <ParticipantsImportForm modalities={modalities.map(({ id, name }) => ({ id, name }))} />
          </div>
        </Section>
        <Section title="Jogos de uma modalidade" icon={<ClipboardList />} description="Equipes casadas por id (mandanteId/visitanteId) ou nome, sem acento/caixa. Sem equipe = jogo “a definir”.">
          <div className="space-y-4">
            <Example
              title="Exemplo de CSV de jogos"
              columns="Colunas: fase e grupo (nomes como estão na modalidade), rodada, mandante, visitante (ou mandanteId, visitanteId), rotuloMandante, rotuloVisitante, data (dd/mm/aaaa), hora, local, ordem."
              csv={MATCHES_EXAMPLE}
            />
            <MatchesImportForm modalities={modalities.filter((modality) => modality.shape === "match").map(({ id, name }) => ({ id, name }))} />
          </div>
        </Section>
      </div>
      {migrate}
    </AdminFrame>
  );
}
