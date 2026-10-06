import Link from "next/link";
import type { ReactNode } from "react";
import { AdminAccessDenied, AdminPageHeader, Button, EmptyState, cn } from "@venore/plugin-sdk/ui";
import { Trophy } from "lucide-react";
import { PATHS } from "../../../shared/paths";

// Barra de seções do admin do plugin — mesma em toda página, rola na horizontal no celular.

export type AdminSection = "home" | "competition" | "modalities" | "participants" | "athletes" | "matches" | "votes" | "import";

const SECTIONS: { key: AdminSection; label: string; href: string }[] = [
  { key: "home", label: "Visão geral", href: PATHS.admin.home() },
  { key: "competition", label: "Competição", href: PATHS.admin.competition() },
  { key: "modalities", label: "Modalidades", href: PATHS.admin.modalities() },
  { key: "participants", label: "Equipes", href: PATHS.admin.participants() },
  { key: "athletes", label: "Atletas", href: PATHS.admin.athletes() },
  { key: "matches", label: "Jogos", href: PATHS.admin.matches() },
  { key: "votes", label: "Votação", href: PATHS.admin.votes() },
  { key: "import", label: "Importar", href: PATHS.admin.import() },
];

export function AdminNav({ active, competitionName }: { active: AdminSection; competitionName?: string | null }) {
  return (
    <div className="space-y-2">
      {competitionName && (
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-caps text-muted-foreground">
          <Trophy className="size-3.5" aria-hidden /> {competitionName}
        </p>
      )}
      <nav aria-label="Seções de Competições" className="-mx-1 overflow-x-auto pb-1">
        <ul className="flex w-max gap-1 px-1">
          {SECTIONS.map((section) => {
            const isActive = section.key === active;
            return (
              <li key={section.key}>
                <Link
                  href={section.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {section.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

// Moldura padrão das páginas: nav + cabeçalho + conteúdo.
export function AdminFrame({
  active,
  competitionName,
  title,
  description,
  actions,
  children,
}: {
  active: AdminSection;
  competitionName?: string | null;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <AdminNav active={active} competitionName={competitionName} />
      <AdminPageHeader title={title} description={description} actions={actions} />
      {children}
    </div>
  );
}

export function AdminDenied({ message }: { message: string }) {
  return <AdminAccessDenied message={message} />;
}

// Seções que dependem de uma competição criada.
export function NoCompetition({ active }: { active: AdminSection }) {
  return (
    <div className="space-y-6">
      <AdminNav active={active} />
      <EmptyState
        icon={<Trophy className="size-8" strokeWidth={1.5} />}
        title="Nenhuma competição ainda"
        description="Crie a primeira competição na visão geral para começar o cadastro."
        action={
          <Button asChild size="sm">
            <Link href={PATHS.admin.home()}>Criar competição</Link>
          </Button>
        }
      />
    </div>
  );
}
