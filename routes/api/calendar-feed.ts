import { NextResponse } from "next/server";
import { isPluginActive } from "@venore/plugin-sdk";
import { getActiveSnapshot } from "../../runtime/snapshot";
import { resolveRequestOrigin } from "../../runtime/request-origin";
import { scheduledCalendarEvents } from "../../components/lib/calendar-events";
import { toIcs } from "../../shared/calendar";

// GET /api/games/agenda — feed de assinatura com TODOS os jogos agendados com data (webcal:// no
// iPhone/Outlook, "adicionar por URL" no Google). Os apps rebuscam sozinhos (REFRESH-INTERVAL de 6h
// no .ics): jogo remarcado ou novo aparece na agenda de quem assinou. Lê só o snapshot; cache curto
// na CDN — uma geração por janela, não por app de agenda.
export async function GET(): Promise<Response> {
  if (!(await isPluginActive("games"))) return NextResponse.json({ error: "Rota não encontrada." }, { status: 404 });
  const snapshot = await getActiveSnapshot();
  if (!snapshot) return NextResponse.json({ error: "Nenhuma competição ativa." }, { status: 404 });

  const origin = await resolveRequestOrigin();
  const body = toIcs(scheduledCalendarEvents(snapshot, origin), { feedName: snapshot.competition.name });
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${snapshot.competition.slug || "jogos"}.ics"`,
      "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=3600",
    },
  });
}
