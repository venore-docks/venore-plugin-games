import type { ReactNode } from "react";
import { Badge, cn } from "@venore/plugin-sdk/ui";
import type { MatchStatus, ModalityStatus } from "../../../contracts/types";

// Peças visuais do admin sem estado (servem tanto RSC quanto client components).

export function Field({ label, hint, htmlFor, children, className }: { label: string; hint?: ReactNode; htmlFor?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Section({
  title,
  description,
  actions,
  icon,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-panel border border-border bg-card p-4 sm:p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {icon && <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>}
            {title}
          </h2>
          {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Brasão (ou iniciais na cor da equipe — a cor vem do banco, por isso inline).
export function Crest({ name, url, color, size = "md" }: { name: string; url: string | null; color?: string | null; size?: "sm" | "md" | "lg" }) {
  const box = size === "sm" ? "size-6 text-[10px]" : size === "lg" ? "size-14 text-base" : "size-9 text-xs";
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={cn("shrink-0 rounded-full bg-muted object-contain", box)} />;
  }
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-muted font-bold text-foreground", box)}
      style={color ? { boxShadow: `inset 0 0 0 2px ${color}` } : undefined}
    >
      {initials(name)}
    </span>
  );
}

export function Avatar({ name, url, size = "md" }: { name: string; url: string | null; size?: "sm" | "md" | "lg" }) {
  const box = size === "sm" ? "size-6 text-[10px]" : size === "lg" ? "size-16 text-base" : "size-9 text-xs";
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={cn("shrink-0 rounded-full bg-muted object-cover", box)} />;
  }
  return <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground", box)}>{initials(name)}</span>;
}

const MATCH_STATUS_LABEL: Record<MatchStatus, string> = {
  scheduled: "Agendado",
  live: "Ao vivo",
  finished: "Encerrado",
  cancelled: "Cancelado",
};

export function MatchStatusBadge({ status }: { status: MatchStatus }) {
  if (status === "live") {
    return (
      <Badge variant="destructive" className="gap-1">
        <span className="size-1.5 animate-pulse rounded-full bg-destructive" aria-hidden /> {MATCH_STATUS_LABEL.live}
      </Badge>
    );
  }
  if (status === "finished") return <Badge variant="secondary">{MATCH_STATUS_LABEL.finished}</Badge>;
  if (status === "cancelled") return <Badge variant="outline" className="text-muted-foreground">{MATCH_STATUS_LABEL.cancelled}</Badge>;
  return <Badge variant="outline">{MATCH_STATUS_LABEL.scheduled}</Badge>;
}

export const MODALITY_STATUS_LABEL: Record<ModalityStatus, string> = {
  setup: "Montando",
  in_progress: "Em andamento",
  finished: "Finalizada",
};

export function ModalityStatusBadge({ status }: { status: ModalityStatus }) {
  if (status === "finished") return <Badge>{MODALITY_STATUS_LABEL.finished}</Badge>;
  if (status === "in_progress") return <Badge variant="secondary">{MODALITY_STATUS_LABEL.in_progress}</Badge>;
  return <Badge variant="outline">{MODALITY_STATUS_LABEL.setup}</Badge>;
}

export function Notice({ tone = "info", children, className }: { tone?: "info" | "warning" | "danger"; children: ReactNode; className?: string }) {
  const toneClass =
    tone === "warning"
      ? "border-warning-border bg-warning-soft text-warning"
      : tone === "danger"
        ? "border-destructive/40 bg-destructive/10 text-destructive"
        : "border-border bg-muted text-muted-foreground";
  return <div className={cn("rounded-lg border px-3 py-2 text-sm", toneClass, className)}>{children}</div>;
}

// Select nativo com a cara do Input do shadcn — usado em formulário denso (súmula, filtros) onde
// o Select do radix pesaria (dezenas de selects por página) e o nativo é melhor no celular.
export const nativeSelectClass =
  "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30";

export const checkboxClass = "size-4 shrink-0 rounded-sm border-border accent-primary";
