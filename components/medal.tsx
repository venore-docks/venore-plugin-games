import { cn } from "@venore/plugin-sdk/ui";

// Posição com destaque de pódio (1º/2º/3º) em tokens do tema (primário, acento, secundário): não há
// ouro/prata/bronze no vocabulário shadcn e cor crua é proibida.
export function MedalBadge({ position, className }: { position: number; className?: string }) {
  const tone =
    position === 1
      ? "bg-primary text-primary-foreground"
      : position === 2
        ? "bg-accent text-accent-foreground"
        : position === 3
          ? "bg-secondary text-secondary-foreground ring-1 ring-ring"
          : "bg-muted text-muted-foreground";
  return (
    <span className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-full font-display text-sm font-extrabold tabular-nums", tone, className)}>
      {position}
      <span className="sr-only">º lugar</span>
    </span>
  );
}
