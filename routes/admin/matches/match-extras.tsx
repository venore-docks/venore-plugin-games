"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Download, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";
import { Button, Input, MediaPickerField, type PickableMedia } from "@venore/plugin-sdk/ui";
import type { MatchBoostView, MatchSide, PollOpenMode, PowerBoostView } from "../../../contracts/types";
import { PATHS } from "../../../shared/paths";
import { ConfirmAction } from "../_shared/confirm-action";
import { Field, nativeSelectClass, Notice } from "../_shared/ui";
import { useAction } from "../_shared/use-action";
import { setPollOpenModeAction } from "../votes/actions";
import {
  addMatchBoostAction,
  deleteMatchBoostAction,
  regenerateShareImagesAction,
  setMatchMvpAction,
  setMatchPhotoAction,
  setMatchYoutubeUrlAction,
} from "./actions";
import type { SideInfo } from "./events-editor";

// ---- Power plays usados no jogo ----

export function MatchBoostsPanel({
  matchId,
  boosts,
  catalog,
  home,
  away,
}: {
  matchId: string;
  boosts: MatchBoostView[];
  catalog: PowerBoostView[];
  home: SideInfo;
  away: SideInfo;
}) {
  const [side, setSide] = useState<MatchSide>("home");
  const [boostId, setBoostId] = useState(catalog[0]?.id ?? "");
  const { pending, run } = useAction();

  if (!home || !away) return <Notice>Defina as duas equipes primeiro.</Notice>;
  const names = { home: home.name, away: away.name };

  return (
    <div className="space-y-3">
      {boosts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum power play usado.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {boosts.map((boost) => (
            <li key={boost.id} className="flex items-center gap-3 px-3 py-2">
              <span className="text-lg leading-none" aria-hidden>
                {boost.emoji}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {boost.label} <span className="text-muted-foreground">· {names[boost.side]}</span>
              </span>
              <ConfirmAction
                trigger={
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Remover power play">
                    <Trash2 aria-hidden />
                  </Button>
                }
                title="Remover este power play do jogo?"
                description={`${boost.emoji} ${boost.label} — ${names[boost.side]}`}
                confirmLabel="Remover"
                successMessage="Power play removido."
                onConfirm={() => deleteMatchBoostAction(matchId, boost.id)}
              />
            </li>
          ))}
        </ul>
      )}
      {catalog.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Sem power plays no catálogo — cadastre em{" "}
          <Link href={PATHS.admin.competition()} className="text-primary underline-offset-4 hover:underline">
            Competição
          </Link>
          .
        </p>
      ) : (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            run(() => addMatchBoostAction(matchId, side, boostId), "Power play registrado.");
          }}
        >
          <select className={nativeSelectClass} value={side} onChange={(event) => setSide(event.target.value as MatchSide)} aria-label="Equipe">
            <option value="home">{home.name}</option>
            <option value="away">{away.name}</option>
          </select>
          <select className={nativeSelectClass} value={boostId} onChange={(event) => setBoostId(event.target.value)} aria-label="Power play">
            {catalog.map((boost) => (
              <option key={boost.id} value={boost.id}>
                {boost.emoji} {boost.label}
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline" disabled={pending || !boostId}>
            Registrar
          </Button>
        </form>
      )}
    </div>
  );
}

// ---- Craque do jogo ----

export function MvpForm({ matchId, athleteId, note, home, away }: { matchId: string; athleteId: string | null; note: string | null; home: SideInfo; away: SideInfo }) {
  const [selected, setSelected] = useState(athleteId ?? "");
  const [text, setText] = useState(note ?? "");
  const { pending, run } = useAction();

  if (!home || !away) return <Notice>Defina as duas equipes primeiro.</Notice>;

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        run(() => setMatchMvpAction(matchId, selected || null, text), selected ? "Craque do jogo salvo." : "Craque removido.");
      }}
    >
      <select className={nativeSelectClass} value={selected} onChange={(event) => setSelected(event.target.value)} aria-label="Craque do jogo">
        <option value="">Nenhum</option>
        {[home, away].map((side) => (
          <optgroup key={side.id} label={side.name}>
            {side.roster.map((athlete) => (
              <option key={athlete.id} value={athlete.id}>
                {athlete.number !== null ? `${athlete.number} · ` : ""}
                {athlete.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {selected && <Input value={text} onChange={(event) => setText(event.target.value)} maxLength={140} placeholder="Por quê? (opcional)" aria-label="Comentário do craque" />}
      <Button type="submit" size="sm" disabled={pending}>
        Salvar craque
      </Button>
    </form>
  );
}

// ---- Transmissão ----

export function YoutubeForm({ matchId, url }: { matchId: string; url: string | null }) {
  const [value, setValue] = useState(url ?? "");
  const { pending, run } = useAction();
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault();
        run(() => setMatchYoutubeUrlAction(matchId, value), value.trim() ? "Link salvo." : "Link removido.");
      }}
    >
      <Input type="url" value={value} onChange={(event) => setValue(event.target.value)} placeholder="https://youtube.com/live/…" aria-label="Link do YouTube" />
      <Button type="submit" variant="outline" disabled={pending}>
        Salvar
      </Button>
    </form>
  );
}

// ---- Foto e imagens de compartilhamento ----

export function PhotoPanel({
  matchId,
  photo,
  coverImageUrl,
  storyImageUrl,
  canGenerate,
}: {
  matchId: string;
  photo: PickableMedia | null;
  coverImageUrl: string | null;
  storyImageUrl: string | null;
  canGenerate: boolean;
}) {
  const [mediaId, setMediaId] = useState<string | null>(photo?.id ?? null);
  const { pending, run } = useAction();
  const dirty = mediaId !== (photo?.id ?? null);

  return (
    <div className="space-y-4">
      <MediaPickerField name="coverPhotoMediaId" label="Foto do jogo" initialMedia={photo} onSelect={(media) => setMediaId(media?.id ?? null)} />
      {dirty && (
        <Button type="button" size="sm" disabled={pending} onClick={() => run(() => setMatchPhotoAction(matchId, mediaId), null)}>
          {pending ? "Salvando…" : "Salvar foto e gerar imagens"}
        </Button>
      )}

      {coverImageUrl || storyImageUrl ? (
        <div className="grid grid-cols-[minmax(0,16fr)_minmax(0,5fr)] items-start gap-3">
          {coverImageUrl && (
            <figure className="space-y-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverImageUrl} alt="Capa 16:9" className="aspect-video w-full rounded-md border border-border object-cover" />
              <Button asChild variant="outline" size="xs">
                <a href={coverImageUrl} download target="_blank" rel="noreferrer">
                  <Download aria-hidden /> Baixar capa (YouTube)
                </a>
              </Button>
            </figure>
          )}
          {storyImageUrl && (
            <figure className="space-y-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={storyImageUrl} alt="Story 9:16" className="aspect-[9/16] w-full rounded-md border border-border object-cover" />
              <Button asChild variant="outline" size="xs">
                <a href={storyImageUrl} download target="_blank" rel="noreferrer">
                  <Download aria-hidden /> Baixar story
                </a>
              </Button>
            </figure>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {photo ? "As imagens aparecem aqui assim que forem geradas (atualize a página)." : "Com uma foto, o sistema gera a capa 16:9 (YouTube/WhatsApp) e o story 9:16 do jogo."}
        </p>
      )}

      {canGenerate && (
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => run(() => regenerateShareImagesAction(matchId), null)}>
          <RefreshCw aria-hidden className={pending ? "animate-spin" : undefined} /> {pending ? "Gerando…" : "Gerar de novo"}
        </Button>
      )}
    </div>
  );
}

// ---- Votação do craque da torcida ----

export function PollModeSelect({ pollId, mode }: { pollId: string; mode: PollOpenMode }) {
  const { pending, run } = useAction();
  return (
    <Field label="Situação" htmlFor={`poll-mode-${pollId}`}>
      <select
        id={`poll-mode-${pollId}`}
        className={nativeSelectClass}
        value={mode}
        disabled={pending}
        onChange={(event) => run(() => setPollOpenModeAction(pollId, event.target.value), "Votação atualizada.")}
      >
        <option value="auto">Automática (abre no jogo, fecha depois do prazo)</option>
        <option value="open">Aberta (forçar)</option>
        <option value="closed">Fechada</option>
      </select>
    </Field>
  );
}

export function AuditLink({ pollId }: { pollId: string }) {
  return (
    <Button asChild variant="ghost" size="sm">
      <Link href={`${PATHS.admin.votes()}?votacao=${pollId}`}>
        <ShieldAlert aria-hidden /> Auditoria de votos
      </Link>
    </Button>
  );
}
