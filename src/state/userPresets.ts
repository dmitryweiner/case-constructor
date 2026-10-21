// User presets in localStorage. Every read is guarded: storage may be
// unavailable (private mode) or hold garbage from older versions — the app
// must open regardless.

import type { AppState } from './schema';
import { sanitizeState } from './schema';

export const USER_PRESETS_KEY = 'caseconstructor_user_presets_v1';

export interface UserPreset {
  name: string;
  state: AppState;
}

export function loadUserPresets(): UserPreset[] {
  try {
    const raw = localStorage.getItem(USER_PRESETS_KEY);
    if (!raw) return [];
    return parseUserPresets(raw);
  } catch {
    return [];
  }
}

export function parseUserPresets(raw: string): UserPreset[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const presets: UserPreset[] = [];
  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) continue;
    const name: unknown = Reflect.get(item, 'name');
    if (typeof name !== 'string' || name.length === 0) continue;
    presets.push({ name, state: sanitizeState(Reflect.get(item, 'state')) });
  }
  return presets;
}

export function saveUserPresets(presets: UserPreset[]): boolean {
  try {
    localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(presets));
    return true;
  } catch {
    return false;
  }
}

/**
 * Next free number for the auto-name "<prefix> N". There is one prefix per
 * language: after a language switch the numbering would otherwise restart
 * from one and muddle the list.
 */
export function nextPresetNumber(presets: UserPreset[], prefixes: readonly string[]): number {
  let highest = 0;
  for (const preset of presets) {
    for (const prefix of prefixes) {
      if (!preset.name.startsWith(`${prefix} `)) continue;
      const tail = preset.name.slice(prefix.length + 1);
      if (/^\d+$/.test(tail)) highest = Math.max(highest, Number(tail));
    }
  }
  return highest + 1;
}
