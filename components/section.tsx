import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@venore/plugin-sdk/ui";

// Moldura comum de bloco/seção: container query (o bloco não sabe a largura da coluna em que o
// admin o colocou — @container decide o layout pela largura real), título forte e ação à direita.

export function BlockFrame({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn("@container w-full min-w-0", className)}>
      {children}
    </section>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
  extra,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: { href: string; label: string } | null;
  // Ação que não é link simples (menu "Assinar agenda").
  extra?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-3 flex flex-wrap items-end justify-between gap-x-3 gap-y-1", className)}>
      <div className="min-w-0">
        <h2 className="font-display text-xl font-bold tracking-tight text-foreground @md:text-2xl">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {(action || extra) && (
        <div className="flex flex-wrap items-center gap-1">
          {extra}
          {action && (
            <Link
              href={action.href}
              className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold text-primary ui-motion-base hover:bg-primary/10"
            >
              {action.label}
              <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      )}
    </header>
  );
}

// Placeholder do modo "edit" do page-builder: explica o que o bloco mostraria e por que está vazio.
export function EditPlaceholder({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-panel border border-dashed border-ring bg-muted/40 p-4 text-sm">
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-muted-foreground">{message}</p>
    </div>
  );
}

export function EmptyNote({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("rounded-panel border border-dashed border-border bg-card/60 px-4 py-6 text-center text-sm text-muted-foreground", className)}>{children}</p>;
}

// Rolagem horizontal pra conteúdo largo (tabelas, chaveamento) no celular, sem estourar a página.
export function HScroll({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <div role="region" aria-label={label} tabIndex={label ? 0 : undefined} className={cn("-mx-1 overflow-x-auto overscroll-x-contain px-1 pb-1", className)}>
      {children}
    </div>
  );
}
