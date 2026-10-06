"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button, cn } from "@venore/plugin-sdk/ui";
import { AthletePhoto } from "../../../components/crest";
import { castVoteAction, requestTicketAction } from "./actions";
import { TurnstileWidget } from "./turnstile-widget";

export type BallotOption = { id: string; name: string; imageUrl: string | null; caption: string | null; color: string | null };
export type BallotSection = { key: string; title: string; color: string | null; options: BallotOption[] };

type Phase = "idle" | "ticket" | "waiting" | "submitting";

// Quanto esperar o Turnstile terminar a verificação depois que a espera do voto acabou.
const TOKEN_TIMEOUT_MS = 60_000;
// Ticket recusado (expirou/outra rede): pede outro no máximo estas vezes antes de desistir.
const MAX_TICKETS = 3;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Barra da espera do voto. Só exibe — quem conta de verdade é o servidor (validAfter do ticket).
function WaitProgress({ startedAt, endsAt }: { startedAt: number; endsAt: number }) {
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const total = Math.max(1, endsAt - startedAt);
  const done = Math.min(1, Math.max(0, (now - startedAt) / total));
  const secondsLeft = Math.max(0, Math.ceil((endsAt - now) / 1000));
  return (
    <div className="space-y-1.5" aria-live="polite">
      <p className="text-sm font-semibold text-foreground">Validando seu voto… {secondsLeft > 0 ? `${secondsLeft}s` : "quase lá"}</p>
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(done * 100)}>
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(done * 100)}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">Votos da mesma rede (wi-fi da escola, por exemplo) esperam mais a cada voto.</p>
    </div>
  );
}

// Cédula da votação da torcida: escolhe (toque) e confirma (botão) — dois passos de propósito, um
// toque só registraria voto errado com o dedo escorregando na lista. Fluxo: ticket → espera (barra) →
// Turnstile (se ligado) → voto; "espere mais" reenvia com o mesmo ticket; ticket recusado pede outro.
export function Ballot({
  pollId,
  kind,
  sections,
  currentChoiceId,
  allowChange,
  turnstileSiteKey,
}: {
  pollId: string;
  kind: "match" | "favorite";
  sections: BallotSection[];
  // Escolha já registrada deste aparelho (lida do cookie no servidor, sem criar cookie).
  currentChoiceId: string | null;
  // Equipe favorita: pode trocar o voto; craque da torcida: voto único.
  allowChange: boolean;
  turnstileSiteKey: string | null;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [wait, setWait] = useState<{ startedAt: number; endsAt: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmedId, setConfirmedId] = useState<string | null>(currentChoiceId);
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [turnstileResets, setTurnstileResets] = useState(0);
  const tokenRef = useRef<string | null>(null);
  const busy = phase !== "idle";

  const options = sections.flatMap((section) => section.options);
  const nameOf = (id: string | null) => options.find((option) => option.id === id)?.name ?? null;
  const selectedName = nameOf(selectedId);
  const showBallot = confirmedId === null || changing;

  async function waitForToken(): Promise<string | null> {
    if (!turnstileSiteKey) return null;
    const deadline = Date.now() + TOKEN_TIMEOUT_MS;
    while (!tokenRef.current && Date.now() < deadline) await sleep(200);
    return tokenRef.current;
  }

  // Token do Turnstile é de uso único: depois de qualquer tentativa que chegou à verificação, reseta.
  function spendToken() {
    tokenRef.current = null;
    setTurnstileResets((value) => value + 1);
  }

  async function waitFor(seconds: number) {
    const startedAt = Date.now();
    const ms = Math.max(0, seconds) * 1000;
    setWait({ startedAt, endsAt: startedAt + ms });
    setPhase("waiting");
    await sleep(ms);
  }

  async function vote() {
    if (!selectedId || busy) return;
    setError(null);
    setSuccess(null);
    try {
      for (let attempt = 0; attempt < MAX_TICKETS; attempt += 1) {
        setPhase("ticket");
        const issued = await requestTicketAction(pollId);
        if (!issued.ok) {
          if (issued.status === "already_voted") {
            setConfirmedId(issued.choiceId);
            setChanging(false);
          }
          setError(issued.message);
          return;
        }
        let waitSeconds = issued.waitSeconds;
        for (;;) {
          await waitFor(waitSeconds);
          const token = await waitForToken();
          if (turnstileSiteKey && !token) {
            setError("A verificação anti-robô não terminou — tente de novo.");
            return;
          }
          setPhase("submitting");
          const result = await castVoteAction({ pollId, choiceId: selectedId, ticket: issued.ticket, turnstileToken: token });
          if (result.status === "wait") {
            // A espera cresceu (outra aba da mesma rede votou no meio): mesmo ticket, espera de novo.
            waitSeconds = result.retryAfterSeconds;
            continue;
          }
          spendToken();
          if (result.status === "voted") {
            setConfirmedId(result.choiceId);
            setChanging(false);
            setSelectedId(null);
            setSuccess(result.message);
            router.refresh();
            return;
          }
          if (result.status === "already_voted") {
            setConfirmedId(result.choiceId);
            setChanging(false);
            setError(result.message);
            return;
          }
          if (result.status === "invalid_ticket") break;
          setError(result.message);
          return;
        }
      }
      setError("Não deu pra validar seu voto agora. Tente de novo em instantes.");
    } catch {
      setError("Não deu pra registrar o voto — confira a internet e tente de novo.");
    } finally {
      setPhase("idle");
      setWait(null);
    }
  }

  if (!showBallot) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-panel border border-primary bg-primary/8 p-4">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0 space-y-0.5">
            {success && <p className="text-sm font-bold text-foreground">{success}</p>}
            <p className="text-sm text-foreground">
              {kind === "match" ? "Seu voto neste jogo: " : "Sua equipe favorita: "}
              <span className="font-bold">{nameOf(confirmedId) ?? "registrado"}</span>
            </p>
            {kind === "match" && <p className="text-xs text-muted-foreground">Cada aparelho vota uma vez por jogo.</p>}
            {error && !success && <p className="text-xs text-muted-foreground">{error}</p>}
          </div>
        </div>
        {allowChange && (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => {
              setChanging(true);
              setSelectedId(null);
              setSuccess(null);
              setError(null);
            }}
          >
            Trocar voto
          </Button>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void vote();
      }}
      className="space-y-5"
    >
      {sections.map((section) => (
        <fieldset key={section.key} className="space-y-2">
          <legend className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            {section.color && <span className="size-2.5 rounded-full" style={{ background: section.color }} aria-hidden="true" />}
            {section.title}
          </legend>
          {section.options.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum atleta cadastrado nesta equipe.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {section.options.map((option) => {
                const selected = option.id === selectedId;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={selected}
                    disabled={busy}
                    onClick={() => setSelectedId(option.id)}
                    className={cn(
                      "flex min-h-11 flex-col items-center gap-2 rounded-panel border p-3 text-center ui-motion-base disabled:opacity-60",
                      selected ? "border-primary bg-primary/10 ring-2 ring-primary" : "border-border bg-card hover:bg-muted/50",
                      confirmedId === option.id && !selected && "border-ring",
                    )}
                  >
                    <AthletePhoto name={option.name} photoUrl={option.imageUrl} color={option.color} size="lg" />
                    <span className="w-full truncate text-sm font-bold text-foreground">{option.name}</span>
                    {option.caption && <span className="w-full truncate text-xs text-muted-foreground">{option.caption}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>
      ))}

      <div className="sticky bottom-0 z-10 -mx-4 space-y-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-panel sm:border">
        {!busy && error && <p className="text-sm font-semibold text-destructive">{error}</p>}
        {phase === "waiting" && wait && <WaitProgress key={wait.startedAt} startedAt={wait.startedAt} endsAt={wait.endsAt} />}
        {/* Fica montado durante a espera: a verificação roda em paralelo e o token fica pronto quando a barra termina. */}
        {turnstileSiteKey && (
          <TurnstileWidget
            siteKey={turnstileSiteKey}
            onToken={(token) => {
              tokenRef.current = token;
            }}
            resetSignal={turnstileResets}
          />
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button type="submit" size="lg" className="min-h-12 w-full sm:w-auto" disabled={!selectedId || busy}>
            {phase === "ticket"
              ? "Preparando…"
              : phase === "waiting"
                ? "Validando…"
                : phase === "submitting"
                  ? "Registrando…"
                  : selectedName
                    ? `Votar em ${selectedName}`
                    : kind === "match"
                      ? "Escolha um atleta"
                      : "Escolha uma equipe"}
          </Button>
          {allowChange && changing && (
            <Button type="button" variant="ghost" className="min-h-11" disabled={busy} onClick={() => setChanging(false)}>
              Manter meu voto
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
