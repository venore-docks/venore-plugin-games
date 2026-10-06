"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { PATHS } from "../../../shared/paths";
import { nativeSelectClass } from "../_shared/ui";

// Filtros na URL (?modalidade=&status=&fase=): link compartilhável e o servidor já filtra.
export function MatchFilters({
  modalities,
  stages,
  current,
}: {
  modalities: { id: string; name: string }[];
  stages: { id: string; name: string }[];
  current: { modalidade: string; status: string; fase: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function update(patch: Partial<typeof current>) {
    const next = { ...current, ...patch };
    if (patch.modalidade !== undefined) next.fase = "";
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) if (value) params.set(key, value);
    startTransition(() => router.replace(`${PATHS.admin.matches()}${params.size ? `?${params}` : ""}`));
  }

  return (
    <div className="grid *:min-w-0 grid-cols-2 gap-2 sm:grid-cols-3" aria-busy={pending}>
      <select className={`${nativeSelectClass} col-span-2 sm:col-span-1`} value={current.modalidade} onChange={(event) => update({ modalidade: event.target.value })} aria-label="Modalidade">
        <option value="">Todas as modalidades</option>
        {modalities.map((modality) => (
          <option key={modality.id} value={modality.id}>
            {modality.name}
          </option>
        ))}
      </select>
      <select className={nativeSelectClass} value={current.status} onChange={(event) => update({ status: event.target.value })} aria-label="Situação">
        <option value="">Todas as situações</option>
        <option value="scheduled">Agendados</option>
        <option value="live">Ao vivo</option>
        <option value="finished">Encerrados</option>
        <option value="cancelled">Cancelados</option>
      </select>
      <select className={nativeSelectClass} value={current.fase} onChange={(event) => update({ fase: event.target.value })} disabled={stages.length === 0} aria-label="Fase">
        <option value="">Todas as fases</option>
        {stages.map((stage) => (
          <option key={stage.id} value={stage.id}>
            {stage.name}
          </option>
        ))}
      </select>
    </div>
  );
}
