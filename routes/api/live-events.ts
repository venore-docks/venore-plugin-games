import { NextResponse } from "next/server";
import { isPluginActive } from "@venore/plugin-sdk";
import type { LiveMatchState } from "../../contracts/types";
import { subscribeLive } from "../../runtime/live-feed";
import { buildLiveState, readChannel } from "../../runtime/live-state";
import { resolveActiveCompetitionId } from "../../runtime/snapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Ping com evento nomeado (não só comentário SSE): o cliente usa como prova de vida.
const HEARTBEAT_MS = 5_000;
// Fecha antes do teto da Vercel (300s); o EventSource reconecta pelo retry. O cliente não marca
// "sem sinal" num fechamento assim (shared/use-live-state.ts tolera alguns segundos).
const SOFT_CLOSE_MS = 270_000;

// SSE do estado ao vivo de um canal (?canal=principal). Público e somente leitura (overlay do OBS
// sem cookie); a escrita fica nas Server Actions do controle.
export async function GET(request: Request): Promise<Response> {
  if (!(await isPluginActive("games"))) return NextResponse.json({ error: "Plugin desativado." }, { status: 404 });
  const competitionId = await resolveActiveCompetitionId();
  const channelKey = new URL(request.url).searchParams.get("canal");
  const channel = competitionId ? await readChannel(competitionId, channelKey) : null;
  if (!competitionId || !channel) return NextResponse.json({ error: "Canal não encontrado." }, { status: 404 });

  const encoder = new TextEncoder();
  let closed = false;
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let softClose: ReturnType<typeof setTimeout> | null = null;
  let lastVersion = -1;

  const cleanup = () => {
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    if (softClose) clearTimeout(softClose);
    unsubscribe?.();
    unsubscribe = null;
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (state: LiveMatchState) => {
        if (closed || state.version === lastVersion) return;
        lastVersion = state.version;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ ...state, serverNow: Date.now() })}\n\n`));
        } catch {
          cleanup();
        }
      };
      controller.enqueue(encoder.encode("retry: 1500\n\n"));
      try {
        send(await buildLiveState(competitionId, channel));
      } catch {
        // o cliente reconecta pelo retry
      }
      unsubscribe = subscribeLive(competitionId, channel.key, send);
      heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode("event: ping\ndata: 1\n\n"));
        } catch {
          cleanup();
        }
      }, HEARTBEAT_MS);
      softClose = setTimeout(() => {
        cleanup();
        try {
          controller.close();
        } catch {
          /* já fechado */
        }
      }, SOFT_CLOSE_MS);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
