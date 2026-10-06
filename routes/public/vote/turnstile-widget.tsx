"use client";

import { useEffect, useRef } from "react";

// Widget do Cloudflare Turnstile (anti-robô opcional da votação — ver runtime/turnstile.ts).
// Renderização explícita (não o auto-render por classe .cf-turnstile) porque o componente pode
// montar/desmontar e precisa de reset depois de cada tentativa (o token é de uso único).

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

type TurnstileWindow = Window & { turnstile?: TurnstileApi; __gamesTurnstileLoading?: Promise<void> };

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadTurnstile(): Promise<void> {
  const w = window as TurnstileWindow;
  if (w.turnstile) return Promise.resolve();
  if (!w.__gamesTurnstileLoading) {
    w.__gamesTurnstileLoading = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("turnstile"));
      document.head.appendChild(script);
    });
  }
  return w.__gamesTurnstileLoading;
}

// resetSignal: qualquer mudança (ex: contador de tentativas) reseta o widget e limpa o token.
export function TurnstileWidget({
  siteKey,
  onToken,
  resetSignal,
}: {
  siteKey: string;
  onToken: (token: string | null) => void;
  resetSignal: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    let cancelled = false;
    loadTurnstile()
      .then(() => {
        const api = (window as TurnstileWindow).turnstile;
        if (cancelled || !api || !containerRef.current || widgetIdRef.current) return;
        widgetIdRef.current = api.render(containerRef.current, {
          sitekey: siteKey,
          language: "pt-br",
          callback: (token: string) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => onTokenRef.current(null),
        });
      })
      .catch(() => onTokenRef.current(null));

    return () => {
      cancelled = true;
      const api = (window as TurnstileWindow).turnstile;
      if (api && widgetIdRef.current) api.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetSignal === 0) return;
    const api = (window as TurnstileWindow).turnstile;
    if (api && widgetIdRef.current) api.reset(widgetIdRef.current);
    onTokenRef.current(null);
  }, [resetSignal]);

  return <div ref={containerRef} className="min-h-[65px]" />;
}
