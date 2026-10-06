"use client";

import { useState, type FormEvent } from "react";
import { Button, Input } from "@venore/plugin-sdk/ui";
import { Field } from "../_shared/ui";
import { useAction } from "../_shared/use-action";
import { saveGeneralSettingsAction } from "./actions";

export function GeneralSettingsForm({ initial }: { initial: { accentColor: string; youtubeChannelId: string; goalFlashSeconds: number } }) {
  const [accentColor, setAccentColor] = useState(initial.accentColor);
  const [youtubeChannelId, setYoutubeChannelId] = useState(initial.youtubeChannelId);
  const [goalFlashSeconds, setGoalFlashSeconds] = useState(String(initial.goalFlashSeconds));
  const { pending, run } = useAction();

  function submit(event: FormEvent) {
    event.preventDefault();
    run(() => saveGeneralSettingsAction({ accentColor, youtubeChannelId, goalFlashSeconds }), "Configurações salvas.");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid *:min-w-0 gap-4 sm:grid-cols-3">
        <Field label="Cor de destaque" hint="Placar do OBS, TV e controle (fora do tema do site)." htmlFor="settings-accent">
          <div className="flex items-center gap-2">
            <input
              id="settings-accent"
              type="color"
              value={accentColor}
              onChange={(event) => setAccentColor(event.target.value)}
              className="h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-border bg-card"
            />
            <Input value={accentColor} onChange={(event) => setAccentColor(event.target.value)} maxLength={7} className="font-mono" aria-label="Cor em hexadecimal" />
          </div>
        </Field>
        <Field label="Canal do YouTube" hint="Id do canal (UC…), pro botão de transmissões." htmlFor="settings-youtube">
          <Input id="settings-youtube" value={youtubeChannelId} onChange={(event) => setYoutubeChannelId(event.target.value)} maxLength={64} placeholder="UCxxxxxxxxxxxx" />
        </Field>
        <Field label="Destaque de ponto (s)" hint="Quanto tempo o overlay mostra quem marcou." htmlFor="settings-flash">
          <Input id="settings-flash" type="number" min={2} max={30} value={goalFlashSeconds} onChange={(event) => setGoalFlashSeconds(event.target.value)} />
        </Field>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Salvando…" : "Salvar configurações"}
      </Button>
    </form>
  );
}
