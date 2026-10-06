"use client";

import { useMemo, useState, type FormEvent } from "react";
import { BookmarkPlus, Trash2, Wand2 } from "lucide-react";
import { Badge, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, Input, Switch, cn } from "@venore/plugin-sdk/ui";
import { BUILTIN_TEMPLATES, buildTemplateStages, DEFAULT_TEMPLATE_PARAMS, type BuiltinTemplateKey, type TemplateParams } from "../../../shared/templates";
import type { StageDefinition } from "../../../shared/tournament";
import { ConfirmAction } from "../_shared/confirm-action";
import { Field, Notice } from "../_shared/ui";
import { useAction } from "../_shared/use-action";
import { applyBuiltinTemplateAction, applySavedTemplateAction, deleteSavedTemplateAction, saveTemplateAction } from "./actions";
import { previewStructure, type StructurePreview } from "./format-preview";

export type SavedTemplateItem = { id: string; name: string; description: string | null; shape: "match" | "event"; stages: StageDefinition[] };

type Choice = { kind: "builtin"; key: BuiltinTemplateKey } | { kind: "saved"; id: string };

export function FormatEditor({
  modalityId,
  shape,
  entryIds,
  names,
  savedTemplates,
  hasPlayed,
  hasStructure,
}: {
  modalityId: string;
  shape: "match" | "event";
  entryIds: string[];
  names: Record<string, string>;
  savedTemplates: SavedTemplateItem[];
  hasPlayed: boolean;
  hasStructure: boolean;
}) {
  const builtins = BUILTIN_TEMPLATES.filter((template) => template.shape === shape);
  const saved = savedTemplates.filter((template) => template.shape === shape);
  const [choice, setChoice] = useState<Choice>({ kind: "builtin", key: builtins[0]?.key ?? "single_event" });
  const [params, setParams] = useState<TemplateParams>({ ...DEFAULT_TEMPLATE_PARAMS, participantCount: Math.max(2, entryIds.length) });
  const setParam = <K extends keyof TemplateParams>(key: K, value: TemplateParams[K]) => setParams((current) => ({ ...current, [key]: value }));

  const definitions = useMemo<StageDefinition[]>(() => {
    if (choice.kind === "builtin") return buildTemplateStages(choice.key, params);
    return saved.find((template) => template.id === choice.id)?.stages ?? [];
  }, [choice, params, saved]);
  const preview = useMemo(() => previewStructure(definitions, entryIds, names), [definitions, entryIds, names]);

  if (hasPlayed) {
    return (
      <Notice tone="warning">
        A modalidade já tem jogos disputados — o formato não pode ser recriado (apagaria resultados). Ajuste grupos na aba Fases e jogos individualmente em Jogos.
      </Notice>
    );
  }

  const intField = (key: "groupCount" | "advancePerGroup" | "knockoutSize" | "participantCount", label: string, min: number, max: number, hint?: string) => (
    <Field label={label} hint={hint}>
      <Input
        type="number"
        min={min}
        max={max}
        value={params[key]}
        onChange={(event) => setParam(key, Math.min(max, Math.max(min, Math.round(Number(event.target.value) || min))))}
        className="tabular-nums"
      />
    </Field>
  );

  return (
    <div className="space-y-5">
      {hasStructure && <Notice>Esta modalidade já tem um formato. Aplicar outro apaga as fases e os jogos agendados atuais e gera tudo de novo a partir das inscrições.</Notice>}

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Formatos prontos</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {builtins.map((template) => {
            const active = choice.kind === "builtin" && choice.key === template.key;
            return (
              <button
                key={template.key}
                type="button"
                onClick={() => setChoice({ kind: "builtin", key: template.key })}
                aria-pressed={active}
                className={cn(
                  "rounded-lg border p-3 text-start outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active ? "border-primary bg-accent/14" : "border-border hover:border-ring",
                )}
              >
                <span className="block text-sm font-semibold text-foreground">{template.name}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{template.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      {saved.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Templates salvos</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {saved.map((template) => {
              const active = choice.kind === "saved" && choice.id === template.id;
              return (
                <li key={template.id} className={cn("flex items-start gap-2 rounded-lg border p-3", active ? "border-primary bg-accent/14" : "border-border")}>
                  <button type="button" className="min-w-0 flex-1 text-start outline-none" onClick={() => setChoice({ kind: "saved", id: template.id })} aria-pressed={active}>
                    <span className="block text-sm font-semibold text-foreground">{template.name}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{template.description || template.stages.map((stage) => stage.name).join(" → ")}</span>
                  </button>
                  <ConfirmAction
                    trigger={
                      <Button type="button" variant="ghost" size="icon-xs" aria-label={`Excluir template ${template.name}`}>
                        <Trash2 aria-hidden />
                      </Button>
                    }
                    title={`Excluir o template “${template.name}”?`}
                    description="Modalidades que já usaram este template não mudam."
                    confirmLabel="Excluir"
                    successMessage="Template excluído."
                    onConfirm={() => deleteSavedTemplateAction(template.id)}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {choice.kind === "builtin" && choice.key !== "single_event" && (
        <div className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2 lg:grid-cols-4">
          {choice.key === "groups_knockout" && (
            <>
              {intField("groupCount", "Grupos", 1, 26)}
              {intField("advancePerGroup", "Passam por grupo", 1, 16)}
              {intField("knockoutSize", "Vagas no mata-mata", 2, 64, "Aceita 6, 12… (melhores folgam)")}
            </>
          )}
          {choice.key === "knockout" && intField("participantCount", "Equipes no mata-mata", 2, 64, `Inscritas: ${entryIds.length}`)}
          {choice.key !== "knockout" && (
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-foreground">
              <Switch checked={params.doubleRound} onCheckedChange={(checked) => setParam("doubleRound", checked)} /> Ida e volta
            </label>
          )}
          {choice.key !== "league" && (
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-foreground">
              <Switch checked={params.thirdPlace} onCheckedChange={(checked) => setParam("thirdPlace", checked)} /> Disputa de 3º
            </label>
          )}
        </div>
      )}

      <PreviewPanel preview={preview} />

      <div className="flex flex-wrap gap-2">
        <ConfirmAction
          trigger={
            <Button type="button" disabled={definitions.length === 0 || entryIds.length < 2}>
              <Wand2 aria-hidden /> Aplicar formato
            </Button>
          }
          title="Aplicar este formato?"
          description={
            <>
              <p>
                Serão criadas {preview.stages.length} fase(s) e {preview.totalMatches} jogo(s) a partir das {entryIds.length} equipes inscritas, na ordem de cabeça de chave.
              </p>
              {hasStructure && <p>As fases, grupos e jogos agendados atuais desta modalidade serão apagados.</p>}
            </>
          }
          confirmLabel="Aplicar"
          destructive={hasStructure}
          successMessage="Formato aplicado."
          onConfirm={() => (choice.kind === "builtin" ? applyBuiltinTemplateAction(modalityId, choice.key, params) : applySavedTemplateAction(modalityId, choice.id))}
        />
        {hasStructure && <SaveTemplateButton modalityId={modalityId} />}
      </div>
    </div>
  );
}

function PreviewPanel({ preview }: { preview: StructurePreview }) {
  return (
    <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-foreground">Prévia</p>
        <Badge variant="secondary">{preview.totalMatches} jogo(s)</Badge>
      </div>
      {preview.warnings.map((warning) => (
        <Notice key={warning} tone="warning">
          {warning}
        </Notice>
      ))}
      <ol className="space-y-3">
        {preview.stages.map((stage, index) => (
          <li key={index} className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              {index + 1}. {stage.name}
              <span className="ms-2 text-xs font-normal text-muted-foreground">
                {stage.type === "round_robin" && `${stage.groups.length} grupo(s)${stage.doubleRound ? ", ida e volta" : ""} · ${stage.matches} jogo(s)`}
                {stage.type === "knockout" && `${stage.size} equipe(s)${stage.byes > 0 ? ` · ${stage.byes} folga(s) na 1ª rodada` : ""} · ${stage.matches} jogo(s)`}
                {stage.type === "single_event" && `${stage.participants} equipe(s), resultado por equipe`}
              </span>
            </p>
            {stage.type === "round_robin" && (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {stage.groups.map((group) => (
                  <div key={group.name} className="rounded-md bg-muted p-2">
                    <p className="text-xs font-semibold text-foreground">
                      Grupo {group.name} <span className="font-normal text-muted-foreground">· {group.matches} jogos em {group.rounds} rodada(s)</span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{group.members.length > 0 ? group.members.join(", ") : "Vazio"}</p>
                  </div>
                ))}
              </div>
            )}
            {stage.type === "knockout" && (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {stage.rounds.map((round) => (
                  <div key={round.label} className="min-w-44 space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-caps text-muted-foreground">{round.label}</p>
                    {round.matches.map((match) => (
                      <div key={match.key} className="rounded-md bg-muted px-2 py-1.5 text-xs">
                        <p className="font-semibold text-muted-foreground">{match.key}</p>
                        <p className="truncate text-foreground">{match.home}</p>
                        <p className="truncate text-foreground">{match.away}</p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function SaveTemplateButton({ modalityId }: { modalityId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const { pending, run } = useAction();

  function submit(event: FormEvent) {
    event.preventDefault();
    run(() => saveTemplateAction(modalityId, name, description), "Template salvo.", () => {
      setOpen(false);
      setName("");
      setDescription("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <BookmarkPlus aria-hidden /> Salvar formato como template
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Salvar como template</DialogTitle>
            <DialogDescription>Guarda as fases atuais desta modalidade (sem as equipes) pra reaplicar em outra.</DialogDescription>
          </DialogHeader>
          <Field label="Nome" htmlFor="template-name">
            <Input id="template-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} required />
          </Field>
          <Field label="Descrição (opcional)" htmlFor="template-description">
            <Input id="template-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={300} />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? "Salvando…" : "Salvar template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
