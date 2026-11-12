// The full state as a readable JSON file: kept next to the STL, mailed,
// opened on another machine — maker-kit's project file. The file comes from
// outside, so reading goes through sanitizeState and never throws.

import type { DecodedProjectFile } from 'maker-kit/core/projectFile';
import { decodeProjectFile, encodeProjectFile, fileSlug } from 'maker-kit/core/projectFile';
import type { AppState } from './schema';
import { sanitizeState } from './schema';

export const PRESET_FILE_APP = 'case-constructor';
export const PRESET_FILE_VERSION = 1;

export function encodePresetFile(name: string, state: AppState, savedAt = new Date()): string {
  return encodeProjectFile({ app: PRESET_FILE_APP, version: PRESET_FILE_VERSION, name, state, savedAt });
}

/**
 * The wrapper `{ app, version, name, savedAt, state }`, or a bare state (the
 * files before the wrapper). Anything else is refused with its reason, never
 * read as the default state: a random JSON would silently wipe the work.
 */
export function decodePresetFile(text: string): DecodedProjectFile<AppState> {
  return decodeProjectFile(text, { app: PRESET_FILE_APP, version: PRESET_FILE_VERSION, sanitize: sanitizeState, legacy: bareState });
}

function bareState(data: unknown): AppState | null {
  const shape: unknown = typeof data === 'object' && data !== null ? Reflect.get(data, 'shape') : null;
  return typeof shape === 'object' && shape !== null && 'kind' in shape ? sanitizeState(data) : null;
}

/** File name `case-constructor-<name>.json`, safe in every OS's paths. */
export function presetFileName(name: string): string {
  return `case-constructor-${fileSlug(name, 'preset')}.json`;
}
