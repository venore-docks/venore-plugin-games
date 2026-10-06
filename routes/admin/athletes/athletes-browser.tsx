"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Badge, Input } from "@venore/plugin-sdk/ui";
import { PATHS } from "../../../shared/paths";
import { Avatar, nativeSelectClass } from "../_shared/ui";

export type AthleteListItem = {
  id: string;
  name: string;
  number: number | null;
  position: string | null;
  isCaptain: boolean;
  photoUrl: string | null;
  participantId: string;
  participantName: string;
};

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Busca no cliente: a lista inteira já veio do snapshot (centenas de linhas, no máximo).
export function AthletesBrowser({ athletes, participants, initialParticipantId }: { athletes: AthleteListItem[]; participants: { id: string; name: string }[]; initialParticipantId: string }) {
  const [query, setQuery] = useState("");
  const [participantId, setParticipantId] = useState(initialParticipantId);

  const filtered = useMemo(() => {
    const needle = normalize(query.trim());
    return athletes.filter(
      (athlete) =>
        (!participantId || athlete.participantId === participantId) &&
        (!needle || normalize(athlete.name).includes(needle) || (athlete.number !== null && String(athlete.number) === needle)),
    );
  }, [athletes, participantId, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome ou número" className="ps-8" aria-label="Buscar atleta" />
        </div>
        <select className={`${nativeSelectClass} sm:max-w-xs`} value={participantId} onChange={(event) => setParticipantId(event.target.value)} aria-label="Filtrar por equipe">
          <option value="">Todas as equipes</option>
          {participants.map((participant) => (
            <option key={participant.id} value={participant.id}>
              {participant.name}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} de {athletes.length} atleta{athletes.length === 1 ? "" : "s"}
      </p>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Nenhum atleta encontrado.</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-panel border border-border bg-card">
          {filtered.map((athlete) => (
            <li key={athlete.id}>
              <Link href={PATHS.admin.athlete(athlete.id)} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted">
                <Avatar name={athlete.name} url={athlete.photoUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{athlete.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {athlete.participantName}
                    {athlete.position ? ` · ${athlete.position}` : ""}
                  </p>
                </div>
                {athlete.isCaptain && <Badge variant="secondary">C</Badge>}
                {athlete.number !== null && <span className="w-10 text-right text-sm font-semibold tabular-nums text-muted-foreground">#{athlete.number}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
