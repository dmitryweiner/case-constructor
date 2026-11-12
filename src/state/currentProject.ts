// The project being edited, kept in localStorage on every change: a closed
// tab or a crash does not lose the work, and the next visit opens it again.
// A maker-kit storage record: every access is guarded — storage may be
// blocked (private mode), full, or hold garbage from another version.

import type { StoredRecord } from 'maker-kit/core/storage';
import type { PresetRef, UserPreset } from 'maker-kit/core/presets';
import { isPresetRef } from 'maker-kit/core/presets';
import type { AppState } from './schema';
import { sanitizeState } from './schema';

export const CURRENT_PROJECT_KEY = 'caseconstructor_current_v1';

export interface CurrentProject {
  /** The name shown on the presets button and suggested when saving. */
  name: string;
  /** Which preset is open. */
  ref: PresetRef;
  state: AppState;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Version 2 points at a user preset by its id; version 1 (before maker-kit)
 * did by its name, which the user presets as read now turn into the id.
 */
export function currentProjectRecord(userPresets: readonly UserPreset<AppState>[]): StoredRecord<CurrentProject> {
  return {
    key: CURRENT_PROJECT_KEY,
    version: 2,
    write: ({ name, ref, state }) => ({ name, ref, state }),
    read(data, version) {
      if (version < 1 || !isRecord(data) || !isRecord(data.state)) return null;
      const ref = isPresetRef(data.ref) ? data.ref : '';
      return {
        name: typeof data.name === 'string' ? data.name : '',
        ref: version === 1 && ref.startsWith('u:') ? byName(ref.slice(2), userPresets) : ref,
        state: sanitizeState(data.state),
      };
    },
  };
}

function byName(name: string, userPresets: readonly UserPreset<AppState>[]): PresetRef {
  const preset = userPresets.find((item) => item.name === name);
  return preset ? `u:${preset.id}` : '';
}
