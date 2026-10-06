"use client";

import { Plus, X } from "lucide-react";
import { Button, Input } from "@venore/plugin-sdk/ui";

// Tabela de pontos por colocação (1º, 2º, 3º…) editável como lista — mais legível que "100, 80, 65"
// num campo de texto e impossível de digitar fora de ordem.
export function PointsTableEditor({ value, onChange, disabled }: { value: number[]; onChange: (next: number[]) => void; disabled?: boolean }) {
  function update(index: number, raw: string) {
    const parsed = Number(raw.replace(",", "."));
    const next = [...value];
    next[index] = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {value.map((points, index) => (
          <li key={index} className="flex items-center gap-1.5">
            <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums text-muted-foreground">{index + 1}º</span>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={Number.isFinite(points) ? points : 0}
              onChange={(event) => update(index, event.target.value)}
              disabled={disabled}
              aria-label={`Pontos do ${index + 1}º lugar`}
              className="h-8 tabular-nums"
            />
            {index === value.length - 1 && (
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(value.slice(0, -1))} disabled={disabled} aria-label="Remover última posição">
                <X aria-hidden />
              </Button>
            )}
          </li>
        ))}
      </ol>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || value.length >= 64}
        onClick={() => onChange([...value, Math.max(0, (value[value.length - 1] ?? 10) - 5)])}
      >
        <Plus aria-hidden /> Adicionar {value.length + 1}º lugar
      </Button>
    </div>
  );
}
