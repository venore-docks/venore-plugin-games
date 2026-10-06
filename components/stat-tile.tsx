import { cn } from "@venore/plugin-sdk/ui";

// Número grande + rótulo (recorde da equipe, números do atleta).
export function StatTile({ label, value, hint, className }: { label: string; value: string | number; hint?: string; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card px-3 py-2.5", className)}>
      <p className="font-display text-2xl font-extrabold leading-none tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {hint && <p className="text-[0.68rem] text-muted-foreground">{hint}</p>}
    </div>
  );
}
