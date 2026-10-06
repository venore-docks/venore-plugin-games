import { getSetting } from "@venore/plugin-sdk/settings";
import { GAMES_SETTINGS, clampInt, sanitizeHexColor, type GamesSettingField } from "../../../shared/settings";

// Leitura das settings do plugin pras telas do admin (sempre sem cache: o admin acabou de gravar).
export async function readSettingValue(field: GamesSettingField): Promise<unknown> {
  const result = await getSetting({ key: GAMES_SETTINGS[field].key, skipCache: true });
  return result.success && result.data ? result.data.value : undefined;
}

export async function readGeneralSettings(): Promise<{ accentColor: string; youtubeChannelId: string; goalFlashSeconds: number }> {
  const [accent, channel, flash] = await Promise.all([readSettingValue("accentColor"), readSettingValue("youtubeChannelId"), readSettingValue("goalFlashSeconds")]);
  return {
    accentColor: sanitizeHexColor(accent) ?? GAMES_SETTINGS.accentColor.defaultValue,
    youtubeChannelId: typeof channel === "string" ? channel : GAMES_SETTINGS.youtubeChannelId.defaultValue,
    goalFlashSeconds: clampInt(flash, 2, 30, GAMES_SETTINGS.goalFlashSeconds.defaultValue),
  };
}

export type VoteSettingsValues = {
  voteWaitBaseSeconds: number;
  voteWaitStepSeconds: number;
  voteWaitMaxSeconds: number;
  voteMaxPerNetwork: number;
  fanVoteWindowHours: number;
};

export const VOTE_SETTING_LIMITS: Record<keyof VoteSettingsValues, { min: number; max: number }> = {
  voteWaitBaseSeconds: { min: 0, max: 600 },
  voteWaitStepSeconds: { min: 0, max: 600 },
  voteWaitMaxSeconds: { min: 0, max: 600 },
  voteMaxPerNetwork: { min: 0, max: 10_000 },
  fanVoteWindowHours: { min: 1, max: 720 },
};

export async function readVoteSettings(): Promise<VoteSettingsValues> {
  const fields = Object.keys(VOTE_SETTING_LIMITS) as (keyof VoteSettingsValues)[];
  const values = await Promise.all(fields.map((field) => readSettingValue(field)));
  return Object.fromEntries(
    fields.map((field, index) => [field, clampInt(values[index], VOTE_SETTING_LIMITS[field].min, VOTE_SETTING_LIMITS[field].max, GAMES_SETTINGS[field].defaultValue)]),
  ) as VoteSettingsValues;
}
