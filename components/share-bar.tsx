"use client";

import { useEffect, useState } from "react";
import { Download, Image as ImageIcon, Link2, MessageCircle, Share2 } from "lucide-react";
import { Button } from "@venore/plugin-sdk/ui";

type StoryState =
  | { status: "idle" }
  | { status: "preparing" }
  | { status: "ready"; file: File; objectUrl: string; canShareFile: boolean }
  | { status: "error" };

const PILL =
  "inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold text-foreground ui-motion-base hover:bg-muted disabled:opacity-60";

// Barra "Compartilhar" das páginas públicas (jogo, atleta, votação):
// - WhatsApp: wa.me com texto + URL — o preview com a capa vem da og:image da página (arquivo pronto).
// - Story: baixa o ARQUIVO PRONTO (1080×1920, gerado no admin/ao encerrar) e abre o menu de
//   compartilhar do celular (Web Share com arquivo); sem suporte, vira download. Em dois toques de
//   propósito: o menu só abre dentro do toque que o pediu e o download pode demorar ("expira").
//   Sem story pronto, o botão não aparece — nada de gerar imagem numa rota pública.
// - Copiar link.
export function ShareBar({ url, text, storyImageUrl, storyFileName = "story" }: { url: string; text: string; storyImageUrl: string | null; storyFileName?: string }) {
  const [copied, setCopied] = useState(false);
  const [story, setStory] = useState<StoryState>({ status: "idle" });
  const [shareError, setShareError] = useState<string | null>(null);

  const objectUrl = story.status === "ready" ? story.objectUrl : null;
  useEffect(
    () => () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    },
    [objectUrl],
  );

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 3000);
    } catch {
      window.prompt("Copie o link:", url);
    }
  }

  async function prepareStory() {
    if (!storyImageUrl || story.status === "preparing") return;
    setShareError(null);
    setStory({ status: "preparing" });
    try {
      const response = await fetch(storyImageUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const extension = blob.type === "image/png" ? "png" : "jpg";
      const file = new File([blob], `${storyFileName}.${extension}`, { type: blob.type || "image/jpeg" });
      const canShareFile = typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
      setStory({ status: "ready", file, objectUrl: URL.createObjectURL(blob), canShareFile });
    } catch {
      setStory({ status: "error" });
    }
  }

  function shareStory(file: File) {
    setShareError(null);
    // Link copiado no mesmo toque: vai no sticker de link do story.
    navigator.clipboard?.writeText(url).catch(() => {});
    navigator.share({ files: [file] }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareError("Não deu pra abrir o compartilhamento. Baixe a imagem e poste pelo app.");
    });
  }

  async function nativeShare() {
    try {
      await navigator.share({ title: text, text, url });
    } catch {
      /* cancelado pela pessoa */
    }
  }

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
  const [canNativeShare, setCanNativeShare] = useState(false);
  useEffect(() => {
    // Só no cliente (o servidor não sabe se o navegador tem Web Share): evita divergência de hidratação.
    const id = window.setTimeout(() => setCanNativeShare(typeof navigator.share === "function"), 0);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="me-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Compartilhar</span>
        <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={PILL}>
          <MessageCircle aria-hidden="true" className="size-4" />
          WhatsApp
        </a>
        {storyImageUrl && (
          <button type="button" onClick={prepareStory} aria-expanded={story.status !== "idle"} className={PILL} disabled={story.status === "preparing"}>
            <ImageIcon aria-hidden="true" className="size-4" />
            Story
          </button>
        )}
        <button type="button" onClick={copyLink} className={PILL} aria-live="polite">
          <Link2 aria-hidden="true" className="size-4" />
          {copied ? "Link copiado!" : "Copiar link"}
        </button>
        {canNativeShare && (
          <button type="button" onClick={nativeShare} className={PILL}>
            <Share2 aria-hidden="true" className="size-4" />
            Mais
          </button>
        )}
      </div>

      {story.status !== "idle" && (
        <div className="flex gap-4 rounded-panel border border-border bg-card p-3">
          {story.status === "ready" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={story.objectUrl} alt="Prévia do story" width={90} height={160} className="h-40 w-[5.625rem] shrink-0 rounded-md border border-border object-cover" />
          ) : (
            <div className="h-40 w-[5.625rem] shrink-0 rounded-md bg-muted motion-safe:animate-pulse" aria-hidden="true" />
          )}
          <div className="min-w-0 flex-1 space-y-3 text-sm">
            {story.status === "preparing" && <p className="text-muted-foreground">Baixando a imagem do story…</p>}
            {story.status === "error" && (
              <div className="space-y-2">
                <p className="text-muted-foreground">Não deu pra preparar o compartilhamento aqui. Abra a imagem e salve no aparelho.</p>
                <div className="flex flex-wrap gap-2">
                  {storyImageUrl && (
                    <Button asChild size="sm">
                      <a href={storyImageUrl} target="_blank" rel="noopener noreferrer" download>
                        <Download aria-hidden="true" className="size-4" />
                        Abrir imagem
                      </a>
                    </Button>
                  )}
                  <Button type="button" size="sm" variant="outline" onClick={prepareStory}>
                    Tentar de novo
                  </Button>
                </div>
              </div>
            )}
            {story.status === "ready" && (
              <>
                <p className="font-semibold text-foreground">Story pronto!</p>
                <div className="flex flex-wrap gap-2">
                  {story.canShareFile && (
                    <Button type="button" size="sm" onClick={() => shareStory(story.file)}>
                      <Share2 aria-hidden="true" className="size-4" />
                      Compartilhar
                    </Button>
                  )}
                  <Button asChild size="sm" variant={story.canShareFile ? "outline" : "default"}>
                    <a href={story.objectUrl} download={story.file.name}>
                      <Download aria-hidden="true" className="size-4" />
                      Baixar imagem
                    </a>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">No story, use o sticker de link e cole o endereço da página.</p>
                {shareError && <p className="text-destructive">{shareError}</p>}
              </>
            )}
            <button type="button" onClick={() => setStory({ status: "idle" })} className="min-h-11 text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline">
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
