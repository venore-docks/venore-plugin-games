import { planKnockout } from "../../../shared/bracket";
import { distributeIntoGroups, generateRoundRobin, groupNameForIndex } from "../../../shared/round-robin";
import { describeSlotSource, type SlotSource, type StageDefinition } from "../../../shared/tournament";

// Prévia da estrutura ANTES de aplicar um formato: mesma regra de runtime/modalities.ts
// (applyModalityStructure) — só a primeira fase de pontos corridos recebe os inscritos, grupos em
// serpentina, mata-mata pelos cabeças de chave com chaves J1..Jn contínuas na modalidade.

export type PreviewGroup = { name: string; members: string[]; matches: number; rounds: number };
export type PreviewBracketMatch = { key: string; home: string; away: string; isThirdPlace: boolean };
export type PreviewBracketRound = { label: string; matches: PreviewBracketMatch[] };

export type PreviewStage =
  | { type: "round_robin"; name: string; doubleRound: boolean; groups: PreviewGroup[]; matches: number }
  | { type: "knockout"; name: string; size: number; rounds: PreviewBracketRound[]; byes: number; matches: number }
  | { type: "single_event"; name: string; participants: number; matches: 0 };

export type StructurePreview = { stages: PreviewStage[]; totalMatches: number; warnings: string[] };

export function previewStructure(definitions: StageDefinition[], entryIds: string[], names: Record<string, string>): StructurePreview {
  const nameOf = (id: string) => names[id] ?? "Equipe";
  const stages: PreviewStage[] = [];
  const warnings: string[] = [];
  let knockoutCounter = 0;

  definitions.forEach((definition, index) => {
    if (definition.type === "round_robin") {
      const ids = index === 0 ? entryIds : [];
      const grouped = distributeIntoGroups(ids, definition.groupCount);
      const groups = grouped.map((members, groupIndex) => {
        const pairings = generateRoundRobin(members, definition.doubleRound);
        return {
          name: groupNameForIndex(groupIndex),
          members: members.map(nameOf),
          matches: pairings.length,
          rounds: pairings.reduce((max, pairing) => Math.max(max, pairing.round), 0),
        };
      });
      if (index === 0 && ids.length > 0 && groups.some((group) => group.members.length < 2)) warnings.push(`${definition.name}: há grupo com menos de 2 equipes.`);
      if (index > 0) warnings.push(`${definition.name}: começa vazia — monte os grupos na aba Fases depois de aplicar.`);
      stages.push({ type: "round_robin", name: definition.name, doubleRound: definition.doubleRound, groups, matches: groups.reduce((sum, group) => sum + group.matches, 0) });
      return;
    }

    if (definition.type === "knockout") {
      const seeds: SlotSource[] =
        definition.seeds.length > 0
          ? definition.seeds.slice(0, definition.size)
          : entryIds.slice(0, definition.size).map((participantId) => ({ type: "participant", participantId }));
      if (definition.seeds.length === 0 && entryIds.length < definition.size) {
        warnings.push(`${definition.name}: ${definition.size} vagas mas só ${entryIds.length} inscrita(s) — o chaveamento usa as ${seeds.length} primeiras.`);
      }
      const plans = planKnockout(seeds, { thirdPlace: definition.thirdPlace, keyPrefix: "J" });
      const keyMap = new Map(plans.map((plan) => [plan.key, `J${++knockoutCounter}`]));
      const labels = Object.fromEntries([...keyMap.values()].map((key) => [key, key]));
      const describe = (source: SlotSource): string => {
        if (source.type === "participant") return nameOf(source.participantId);
        if (source.type === "winner" || source.type === "loser") return describeSlotSource({ ...source, matchKey: keyMap.get(source.matchKey) ?? source.matchKey }, labels);
        return describeSlotSource(source, labels);
      };
      const rounds: PreviewBracketRound[] = [];
      for (const plan of plans) {
        const label = plan.roundLabel;
        let round = rounds.find((candidate) => candidate.label === label);
        if (!round) {
          round = { label, matches: [] };
          rounds.push(round);
        }
        round.matches.push({ key: keyMap.get(plan.key) ?? plan.key, home: describe(plan.home), away: describe(plan.away), isThirdPlace: plan.isThirdPlace });
      }
      const size = seeds.length;
      let bracket = 1;
      while (bracket < size) bracket *= 2;
      stages.push({ type: "knockout", name: definition.name, size, rounds, byes: size >= 2 ? bracket - size : 0, matches: plans.length });
      return;
    }

    stages.push({ type: "single_event", name: definition.name, participants: entryIds.length, matches: 0 });
  });

  if (entryIds.length < 2) warnings.push("Inscreva ao menos 2 equipes antes de aplicar o formato.");
  return { stages, totalMatches: stages.reduce((sum, stage) => sum + stage.matches, 0), warnings };
}
