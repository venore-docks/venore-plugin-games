import { NextResponse } from "next/server";
import { isPluginActive } from "@venore/plugin-sdk";
import { getActiveSnapshot } from "../../runtime/snapshot";
import { resolveRequestOrigin } from "../../runtime/request-origin";
import { findMatch, matchCalendarEvent } from "../../components/lib/calendar-events";
import { toIcs } from "../../shared/calendar";
import { isUuid } from "../../shared/ids";

// GET /api/games/jogos/:id/agenda — arquivo .ics de UM jogo ("Adicionar à agenda" → iPhone/Outlook).
// O Google Agenda usa o link direto (shared/calendar.ts googleCalendarUrl). Id malformado, jogo de
// outra competição ou sem data → 404.
export async function GET(_request: Request, context: { params: Promise<Record<string, string>> }): Promise<Response> {
  if (!(await isPluginActive("games"))) return NextResponse.json({ error: "Rota não encontrada." }, { status: 404 });
  const { id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ error: "Jogo não encontrado." }, { status: 404 });

  const snapshot = await getActiveSnapshot();
  const match = snapshot ? findMatch(snapshot, id) : null;
  if (!snapshot || !match || match.status === "cancelled") return NextResponse.json({ error: "Jogo não encontrado." }, { status: 404 });

  const event = matchCalendarEvent(snapshot, match, await resolveRequestOrigin());
  if (!event) return NextResponse.json({ error: "Jogo ainda sem data." }, { status: 404 });

  return new Response(toIcs([event]), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="jogo-${id.slice(0, 8)}.ics"`,
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
