import type { BlockRendererProps } from "@venore/plugin-sdk";
import type { CompetitionSnapshot } from "../contracts/types";
import { topScorers } from "../shared/derive";
import { emptyState, NO_COMPETITION } from "./common";
import { bool, href, text } from "./fields";
import { HeroSection } from "./feature";
import { LiveNowSection, ResultsSection, UpcomingSection } from "./matches";
import { AthletesRankingSection, ModalitiesSection, OverallSection, ParticipantsSection } from "./tables";
import { ModalityStages } from "../components/modality-stages";
import { BlockFrame, SectionHeader } from "../components/section";
import { PATHS } from "../shared/paths";
import { loadSiteSnapshot } from "../components/site-data";
import { VoteCtaSection } from "./vote";

// Classificação da home quando não há quadro geral: a modalidade única (campeonato simples).
function MainStandings({ snapshot }: { snapshot: CompetitionSnapshot }) {
  const modality = snapshot.modalities.find((item) => item.stages.length > 0);
  if (!modality) return null;
  return (
    <BlockFrame>
      <SectionHeader title="Classificação" action={{ href: PATHS.modality(modality.slug), label: "Ver tudo" }} />
      <ModalityStages snapshot={snapshot} modality={modality} />
    </BlockFrame>
  );
}

// "Página inicial completa": composição pronta (capa → ao vivo → próximos → resultados → quadro
// geral/classificação → votação → destaques → modalidades → equipes). Cada seção some sozinha
// quando não tem dado, então o mesmo bloco serve pra antes, durante e depois da competição.
export async function HomeBlock({ block, mode }: BlockRendererProps) {
  const snapshot = await loadSiteSnapshot();
  if (!snapshot) return emptyState(mode, "Página inicial", NO_COMPETITION);
  const ctaLabel = text(block.data, "ctaLabel");
  const ctaHref = href(block.data, "ctaHref", null);
  const scheduleHref = href(block.data, "scheduleHref", null);
  const multi = snapshot.competition.overallEnabled || snapshot.modalities.length > 1;
  const hasScorers = topScorers(snapshot).length > 0;

  return (
    <div className="flex flex-col gap-10">
      <HeroSection
        snapshot={snapshot}
        title={text(block.data, "title") || snapshot.competition.name}
        subtitle={text(block.data, "subtitle") || snapshot.competition.description || ""}
        cta={ctaLabel && ctaHref ? { label: ctaLabel, href: ctaHref } : null}
        showLogo={bool(block.data, "showLogo", true)}
      />
      <LiveNowSection snapshot={snapshot} title="Ao vivo agora" />
      <UpcomingSection snapshot={snapshot} title="Próximos jogos" limit={6} scheduleHref={scheduleHref} />
      <ResultsSection snapshot={snapshot} title="Últimos resultados" limit={3} />
      {snapshot.competition.overallEnabled ? <OverallSection snapshot={snapshot} title="Quadro geral" limit={10} /> : <MainStandings snapshot={snapshot} />}
      <VoteCtaSection snapshot={snapshot} title="Votação da torcida" subtitle="" />
      {hasScorers && <AthletesRankingSection snapshot={snapshot} kind="scorers" modality={null} limit={5} />}
      {multi && <ModalitiesSection snapshot={snapshot} title="Modalidades" />}
      {snapshot.participants.length > 0 && <ParticipantsSection snapshot={snapshot} title="Equipes" showRecord />}
    </div>
  );
}
