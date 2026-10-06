import { CalendarPlus } from "lucide-react";
import { cn } from "@venore/plugin-sdk/ui";
import type { MatchCalendarLinks } from "./lib/calendar-events";

const MENU_ALIGN = {
  left: "left-0",
  right: "right-0",
  // Cabeçalho de seção: no celular o cabeçalho quebra e o botão fica à esquerda; a partir de sm, à direita.
  header: "left-0 sm:left-auto sm:right-0",
} as const;

// Menu "Adicionar à agenda" — <details> nativo: abre/fecha sem JavaScript, serve igual em server e
// client component. Duas saídas porque nenhuma funciona em todo celular: o Google Agenda abre pelo
// link preenchido; iPhone/Outlook importam o .ics (Android não abre .ics sozinho).
function CalendarMenu({
  label,
  items,
  align,
  compact,
}: {
  label: string;
  items: { href: string; label: string; external?: boolean }[];
  align: keyof typeof MENU_ALIGN;
  compact?: boolean;
}) {
  return (
    <details className="relative inline-block text-left">
      <summary
        className={cn(
          "inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-full font-semibold text-primary ui-motion-base hover:bg-primary/10 [&::-webkit-details-marker]:hidden",
          compact ? "px-2 text-xs" : "px-3 text-sm",
        )}
      >
        <CalendarPlus aria-hidden="true" className="size-4 shrink-0" />
        {label}
      </summary>
      <div className={cn("absolute top-full z-30 mt-1 w-64 rounded-panel border border-border bg-popover p-1 text-popover-foreground shadow-float", MENU_ALIGN[align])}>
        {items.map((item) => (
          <a
            key={item.href}
            href={item.href}
            {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="flex min-h-11 items-center rounded-md px-3 text-sm text-foreground ui-motion-base hover:bg-muted"
          >
            {item.label}
          </a>
        ))}
      </div>
    </details>
  );
}

export function AddToCalendar({
  links,
  label = "Adicionar à agenda",
  align = "left",
  compact,
}: {
  links: MatchCalendarLinks;
  label?: string;
  align?: keyof typeof MENU_ALIGN;
  compact?: boolean;
}) {
  return (
    <CalendarMenu
      label={label}
      align={align}
      compact={compact}
      items={[
        { href: links.google, label: "Google Agenda", external: true },
        { href: links.ics, label: "iPhone, Outlook e outros (.ics)" },
      ]}
    />
  );
}

// Todos os jogos de uma vez, por assinatura: jogo remarcado ou novo aparece sozinho na agenda.
export function SubscribeCalendar({ urls, label = "Assinar agenda", align = "header" }: { urls: { webcal: string; google: string }; label?: string; align?: keyof typeof MENU_ALIGN }) {
  return (
    <CalendarMenu
      label={label}
      align={align}
      items={[
        { href: urls.google, label: "Assinar no Google Agenda", external: true },
        { href: urls.webcal, label: "Assinar no iPhone, Outlook e outros" },
      ]}
    />
  );
}
