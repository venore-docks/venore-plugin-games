"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, Input } from "@venore/plugin-sdk/ui";
import { PATHS } from "../../../shared/paths";
import { SPORT_PROFILE_KEYS, SPORT_PROFILES, type SportProfileKey } from "../../../shared/sport-profiles";
import { Field, nativeSelectClass } from "../_shared/ui";
import { useAction } from "../_shared/use-action";
import { createModalityAction } from "./actions";

const PROFILE_EMOJI: Partial<Record<SportProfileKey, string>> = {
  futsal: "⚽",
  futebol: "⚽",
  volei: "🏐",
  basquete: "🏀",
  handebol: "🤾",
  esports: "🎮",
  nota: "💃",
  medida: "📏",
  colocacao: "🏅",
};

export function CreateModalityButton({ label = "Nova modalidade" }: { label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [profile, setProfile] = useState<SportProfileKey>("futsal");
  const [emoji, setEmoji] = useState(PROFILE_EMOJI.futsal ?? "");
  const { pending, run } = useAction();

  function submit(event: FormEvent) {
    event.preventDefault();
    run(() => createModalityAction({ name, sportProfile: profile, emoji }), "Modalidade criada.", (result) => {
      setOpen(false);
      if (result.id) router.push(PATHS.admin.modality(result.id));
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus aria-hidden /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Nova modalidade</DialogTitle>
            <DialogDescription>O tipo define placar, lances e relógio. Regras e formato você ajusta depois.</DialogDescription>
          </DialogHeader>
          <Field label="Tipo" htmlFor="modality-profile">
            <select
              id="modality-profile"
              className={nativeSelectClass}
              value={profile}
              onChange={(event) => {
                const next = event.target.value as SportProfileKey;
                setProfile(next);
                if (!emoji || Object.values(PROFILE_EMOJI).includes(emoji)) setEmoji(PROFILE_EMOJI[next] ?? "");
                if (!name.trim() || SPORT_PROFILE_KEYS.some((key) => SPORT_PROFILES[key].label === name)) setName(SPORT_PROFILES[next].shape === "match" ? SPORT_PROFILES[next].label : "");
              }}
            >
              {SPORT_PROFILE_KEYS.map((key) => (
                <option key={key} value={key}>
                  {SPORT_PROFILES[key].label}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid *:min-w-0 grid-cols-[4.5rem_1fr] gap-3">
            <Field label="Emoji" htmlFor="modality-emoji">
              <Input id="modality-emoji" value={emoji} onChange={(event) => setEmoji(event.target.value)} maxLength={8} className="text-center text-lg" />
            </Field>
            <Field label="Nome" htmlFor="modality-name">
              <Input id="modality-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} required placeholder="Ex.: Futsal masculino" />
            </Field>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? "Criando…" : "Criar modalidade"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
