import { isPluginActive } from "@venore/plugin-sdk";
import { getPollTallies, pollWindowFromSnapshot, readVoteWindowHours } from "../../runtime/votes";
import { getActiveSnapshot } from "../../runtime/snapshot";
import { resolveRequestOrigin } from "../../runtime/request-origin";
import { buildQrSvg, type QrSvg } from "../../shared/qr";
import { PATHS } from "../../shared/paths";
import { buildVoteBoard, pickFavoritePoll, pickMatchPollForBoard, resolveVoteCallout, type VoteBoard, type VoteCallout, type WindowOf } from "./vote-board";

// Leitura da votação pras telas de transmissão — snapshot + parciais agregadas (vote_tallies, com
// cache curto no runtime), nunca COUNT(*) por visita. Só leitura: usado por páginas e actions
// públicas.

async function voteContext() {
  if (!(await isPluginActive("games"))) return null;
  const snapshot = await getActiveSnapshot();
  if (!snapshot) return null;
  const windowHours = await readVoteWindowHours();
  const now = Date.now();
  const windowOf: WindowOf = (poll) => pollWindowFromSnapshot(snapshot, poll, windowHours, now);
  return { snapshot, windowOf };
}

export async function loadVoteCallout(): Promise<VoteCallout> {
  const context = await voteContext();
  return context ? resolveVoteCallout(context.snapshot, context.windowOf) : null;
}

export async function loadVoteBoard(): Promise<VoteBoard | null> {
  const context = await voteContext();
  if (!context) return null;
  const { snapshot, windowOf } = context;
  const polls = { match: pickMatchPollForBoard(snapshot, windowOf), favorite: pickFavoritePoll(snapshot) };
  const list = [polls.match, polls.favorite].filter((poll): poll is NonNullable<typeof poll> => poll !== null);
  const closed = new Set(list.filter((poll) => windowOf(poll).closedForGood).map((poll) => poll.id));
  const tallies = list.length > 0 ? await getPollTallies(list.map((poll) => poll.id), closed) : new Map();
  return buildVoteBoard(snapshot, polls, windowOf, tallies);
}

// QR do hub de votação com a URL absoluta do site (e a versão curta pra escrever na tela).
export async function voteHubQr(): Promise<{ qr: QrSvg; displayUrl: string }> {
  const origin = await resolveRequestOrigin();
  return { qr: buildQrSvg(`${origin}${PATHS.vote()}`), displayUrl: `${new URL(origin).host}${PATHS.vote()}` };
}
