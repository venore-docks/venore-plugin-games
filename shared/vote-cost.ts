// Custo de cada voto da torcida — puro. Diferença central para o plugin antigo: a espera é
// ACUMULADA por rede. Cada ticket emitido reserva o próximo horário livre daquela rede naquela
// votação; pedir 30 tickets de uma vez não faz as esperas correrem em paralelo — o 30º só vale
// depois da soma de todas.

export type VoteCostPolicy = {
  baseSeconds: number;
  stepSeconds: number;
  maxSeconds: number;
  // Teto de votos (tickets emitidos) por rede em cada votação. 0 = sem teto.
  maxPerNetwork: number;
};

export const DEFAULT_VOTE_COST_POLICY: VoteCostPolicy = { baseSeconds: 5, stepSeconds: 5, maxSeconds: 60, maxPerNetwork: 30 };

export function waitSecondsFor(priorIssued: number, policy: VoteCostPolicy): number {
  const prior = Math.max(0, Math.floor(priorIssued));
  const ceiling = Math.max(policy.baseSeconds, policy.maxSeconds);
  return Math.min(policy.baseSeconds + policy.stepSeconds * prior, ceiling);
}

export type SlotReservation =
  | { ok: true; validAfterMs: number; nextSlotAtMs: number; issued: number }
  | { ok: false; reason: "cap" };

// `issued` = tickets já emitidos para esta rede nesta votação; `nextSlotAtMs` = horário a partir do
// qual o próximo voto da rede pode começar a contar (o último reservado). Retorna o horário em que
// ESTE ticket passa a valer e o novo estado a gravar (na mesma transação, sob lock da rede).
export function reserveVoteSlot(state: { issued: number; nextSlotAtMs: number | null }, policy: VoteCostPolicy, nowMs: number): SlotReservation {
  if (policy.maxPerNetwork > 0 && state.issued >= policy.maxPerNetwork) return { ok: false, reason: "cap" };
  const start = Math.max(nowMs, state.nextSlotAtMs ?? 0);
  const validAfterMs = start + waitSecondsFor(state.issued, policy) * 1000;
  return { ok: true, validAfterMs, nextSlotAtMs: validAfterMs, issued: state.issued + 1 };
}

export function clampPolicyValue(raw: unknown, fallback: number, max = 600): number {
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(0, Math.round(value)));
}
