"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@venore/plugin-sdk/ui";

export type PillTab = { key: string; label: string; badge?: string | null; content: ReactNode };

// Abas em "pílulas" roláveis na horizontal (agenda por dia/rodada). O conteúdo de todas as abas vem
// pronto do servidor (só esconde/mostra) — trocar de aba não busca nada. Alvos de 44px pro toque e
// teclado com setas (padrão WAI-ARIA de tabs).
export function PillTabs({ tabs, defaultKey, label }: { tabs: PillTab[]; defaultKey: string | null; label: string }) {
  const [active, setActive] = useState(defaultKey ?? tabs[0]?.key ?? "");
  const baseId = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + tabs.length) % tabs.length;
    setActive(tabs[next].key);
    buttons.current[next]?.focus();
  }

  if (tabs.length === 0) return null;
  return (
    <div className="space-y-3">
      <div role="tablist" aria-label={label} className="-mx-1 flex gap-2 overflow-x-auto overscroll-x-contain px-1 pb-1 [scrollbar-width:thin]">
        {tabs.map((tab, index) => {
          const selected = tab.key === active;
          return (
            <button
              key={tab.key}
              ref={(element) => {
                buttons.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${index}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${index}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(tab.key)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold whitespace-nowrap ui-motion-base",
                selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              {tab.label}
              {tab.badge && <span className={cn("rounded-full px-1.5 text-[0.65rem] font-bold", selected ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground")}>{tab.badge}</span>}
            </button>
          );
        })}
      </div>
      {tabs.map((tab, index) => (
        <div key={tab.key} role="tabpanel" id={`${baseId}-panel-${index}`} aria-labelledby={`${baseId}-tab-${index}`} hidden={tab.key !== active}>
          {tab.content}
        </div>
      ))}
    </div>
  );
}
