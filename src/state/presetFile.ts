// The full state as a readable JSON file: kept next to the STL, mailed,
// opened on another machine. The file comes from outside, so reading goes
// through sanitizeState and never throws.

import type { AppState } from './schema';
import { sanitizeState } from './schema';

export const PRESET_FILE_APP = 'case-constructor';
export const PRESET_FILE_VERSION = 1;

export function encodePresetFile(name: string, state: AppState, savedAt = new Date()): string {
  return JSON.stringify({
    app: PRESET_FILE_APP,
    version: PRESET_FILE_VERSION,
    name,
    savedAt: savedAt.toISOString(),
    state,
  }, null, 2);
}

/**
 * The wrapper `{ app, version, name, savedAt, state }`, or a bare state.
 * Anything else is someone else's file: null rather than the default state,
 * or a random JSON would silently wipe the work.
 */
export function decodePresetFile(text: string): { name: string; state: AppState } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;

  if (Reflect.get(parsed, 'app') === PRESET_FILE_APP) {
    const state: unknown = Reflect.get(parsed, 'state');
    if (typeof state !== 'object' || state === null) return null;
    const name: unknown = Reflect.get(parsed, 'name');
    return { name: typeof name === 'string' ? name.trim() : '', state: sanitizeState(state) };
  }
  const shape: unknown = Reflect.get(parsed, 'shape');
  if (typeof shape === 'object' && shape !== null && 'kind' in shape) {
    return { name: '', state: sanitizeState(parsed) };
  }
  return null;
}

/** File name `case-constructor-<name>.json`, without characters forbidden in paths. */
export function presetFileName(name: string): string {
  const slug = name.trim().replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '');
  return `case-constructor-${slug || 'preset'}.json`;
}
