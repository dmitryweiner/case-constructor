// User presets in localStorage, a maker-kit storage record. Every read is
// guarded: storage may be unavailable (private mode) or hold garbage from
// older versions — the app must open regardless.

import type { StoredRecord } from 'maker-kit/core/storage';
import type { UserPreset } from 'maker-kit/core/presets';
import { addUserPreset, readUserPresets } from 'maker-kit/core/presets';
import type { AppState } from './schema';
import { sanitizeState } from './schema';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export const USER_PRESETS_KEY = 'caseconstructor_user_presets_v1';

/** Version 1 is `{ presets }` with ids; before maker-kit the key held a bare list by name (version 0), which gets ids. */
export const userPresetsRecord: StoredRecord<UserPreset<AppState>[]> = {
  key: USER_PRESETS_KEY,
  version: 1,
  write: (presets) => ({ presets }),
  read: (data, version) => readUserPresets(version === 0 ? data : isRecord(data) ? data.presets : null, sanitizeState),
};

/** 💾 under a name: one already saved by that name gets the state and keeps its id and place; another is added. */
export function storePreset(
  list: readonly UserPreset<AppState>[],
  name: string,
  state: AppState,
): { list: UserPreset<AppState>[]; id: string } {
  const same = list.find((preset) => preset.name === name);
  if (!same) return addUserPreset(list, name, state);
  return { list: list.map((preset) => (preset === same ? { ...preset, state } : preset)), id: same.id };
}
