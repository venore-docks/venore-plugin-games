import { getSetting } from "@venore/plugin-sdk/settings";
import { GAMES_SETTINGS, clampInt, sanitizeHexColor } from "../../shared/settings";
import { readableTextOn } from "../../shared/image-layout";

// Settings das telas fora do tema (controle, overlay, TVs) — lidas no servidor e passadas por prop
// pros componentes de cliente (que não podem importar o SDK).
export type LiveSettings = { accentColor: string; accentInk: string; goalFlashMs: number };

export async function readLiveSettings(): Promise<LiveSettings> {
  const [accent, flash] = await Promise.all([
    getSetting({ key: GAMES_SETTINGS.accentColor.key }),
    getSetting({ key: GAMES_SETTINGS.goalFlashSeconds.key }),
  ]);
  const accentColor = sanitizeHexColor(accent.success && accent.data ? accent.data.value : null) ?? GAMES_SETTINGS.accentColor.defaultValue;
  const seconds = clampInt(flash.success && flash.data ? flash.data.value : undefined, 1, 60, GAMES_SETTINGS.goalFlashSeconds.defaultValue);
  // Texto sobre a cor de destaque: escuro ou branco conforme a cor que o admin escolheu.
  return { accentColor, accentInk: readableTextOn(accentColor), goalFlashMs: seconds * 1000 };
}
