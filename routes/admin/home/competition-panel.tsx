"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Plus } from "lucide-react";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Switch,
  Textarea,
} from "@venore/plugin-sdk/ui";
import { Field } from "../_shared/ui";
import { useAction } from "../_shared/use-action";
import { createCompetitionAction, setActiveCompetitionAction } from "./actions";

export type CompetitionListItem = { id: string; name: string; createdAt: string; isActive: boolean };

export function CreateCompetitionButton({ variant = "default", label = "Nova competição" }: { variant?: "default" | "outline"; label?: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [overallEnabled, setOverallEnabled] = useState(false);
  const { pending, run } = useAction();

  function submit(event: FormEvent) {
    event.preventDefault();
    run(() => createCompetitionAction({ name, description, overallEnabled }), "Competição criada.", () => {
      setOpen(false);
      setName("");
      setDescription("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size="sm">
          <Plus aria-hidden /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Nova competição</DialogTitle>
            <DialogDescription>Uma edição: &ldquo;Erasto League 2026&rdquo;, &ldquo;Erasto Games 2026&rdquo;. As anteriores continuam guardadas.</DialogDescription>
          </DialogHeader>
          <Field label="Nome" htmlFor="competition-name">
            <Input id="competition-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required autoFocus />
          </Field>
          <Field label="Descrição (opcional)" htmlFor="competition-description">
            <Textarea id="competition-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={2000} />
          </Field>
          <label className="flex items-start gap-3 rounded-lg border border-border p-3">
            <Switch checked={overallEnabled} onCheckedChange={setOverallEnabled} className="mt-0.5" />
            <span className="text-sm">
              <span className="block font-medium text-foreground">Quadro geral (olimpíada)</span>
              <span className="block text-xs text-muted-foreground">Várias modalidades somando pontos por colocação. Deixe desligado para um campeonato simples.</span>
            </span>
          </label>
          <DialogFooter>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? "Criando…" : "Criar competição"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CompetitionList({ items }: { items: CompetitionListItem[] }) {
  const { pending, run } = useAction();

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
      {items.map((item) => (
        <li key={item.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
            <p className="text-xs text-muted-foreground">Criada em {new Date(item.createdAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
          </div>
          {item.isActive ? (
            <Badge className="gap-1">
              <CheckCircle2 aria-hidden /> No site e em edição
            </Badge>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => run(() => setActiveCompetitionAction(item.id), "Competição ativada.")}
            >
              Tornar ativa
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
