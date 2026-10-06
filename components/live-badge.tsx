import { cn } from "@venore/plugin-sdk/ui";

// "AO VIVO" com pulso discreto (o anel some com prefers-reduced-motion via motion-safe).
export function LiveBadge({ className, label = "Ao vivo" }: { className?: string; label?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-destructive/12 px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wider text-destructive", className)}>
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full rounded-full bg-destructive opacity-60 motion-safe:animate-ping" />
        <span className="relative inline-flex size-2 rounded-full bg-destructive" />
      </span>
      {label}
    </span>
  );
}
