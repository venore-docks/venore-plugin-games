import { NextResponse } from "next/server";
import { isPluginActive } from "@venore/plugin-sdk";
import { buildLiveState, readChannel } from "../../runtime/live-state";
import { resolveActiveCompetitionId } from "../../runtime/snapshot";

export const dynamic = "force-dynamic";

// Snapshot JSON do canal ao vivo — fallback do SSE e fonte das páginas públicas (placar ao vivo no
// site). Cache curto na CDN: com centenas de visitantes, a função roda ~1x/s, não 1x por visita.
export async function GET(request: Request): Promise<Response> {
  if (!(await isPluginActive("games"))) return NextResponse.json({ error: "Plugin desativado." }, { status: 404 });
  const competitionId = await resolveActiveCompetitionId();
  const channel = competitionId ? await readChannel(competitionId, new URL(request.url).searchParams.get("canal")) : null;
  if (!competitionId || !channel) return NextResponse.json({ error: "Canal não encontrado." }, { status: 404 });
  const state = await buildLiveState(competitionId, channel);
  return NextResponse.json(
    { ...state, serverNow: Date.now() },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=1, stale-while-revalidate=4" } },
  );
}
