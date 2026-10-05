import { permanentRedirect } from "next/navigation";
import { PATHS } from "../../shared/paths";
import { isUuid } from "../../shared/ids";

// Links antigos do plugin Erasto League (compartilhados no WhatsApp, QR impresso, descrição de
// vídeo do YouTube). A migração (runtime/migrate-erasto.ts) preserva ids de jogos e slugs de
// times/jogadores, então o redirecionamento é direto.
type Props = { params: Promise<Record<string, string>> };

export async function LegacyMatchRedirect({ params }: Props): Promise<null> {
  const { id } = await params;
  permanentRedirect(isUuid(id) ? PATHS.match(id) : "/");
  return null;
}

export async function LegacyParticipantRedirect({ params }: Props): Promise<null> {
  permanentRedirect(PATHS.participant(encodeURIComponent((await params).slug)));
  return null;
}

export async function LegacyAthleteRedirect({ params }: Props): Promise<null> {
  permanentRedirect(PATHS.athlete(encodeURIComponent((await params).slug)));
  return null;
}

export async function LegacyVoteRedirect(): Promise<null> {
  permanentRedirect(PATHS.vote());
  return null;
}

export async function LegacyVoteMatchRedirect({ params }: Props): Promise<null> {
  const { id } = await params;
  permanentRedirect(isUuid(id) ? PATHS.voteMatch(id) : PATHS.vote());
  return null;
}
