// Built-in presets. Each is a partial state laid over the default and passed
// through sanitizeState, so an entry only says what makes it different.
//
// A preset is known by its `id`; the name and the note live in the UI
// dictionaries (`preset.<id>`, `preset.<id>.note`).

import type { AppState } from './schema';
import { defaultState, sanitizeState } from './schema';

export interface Preset {
  id: string;
  build(): AppState;
}

function make(id: string, extra: (base: AppState) => Record<string, unknown>): Preset {
  return {
    id,
    build: () => {
      const base = defaultState();
      return sanitizeState({ ...base, ...extra(base) });
    },
  };
}

export const PRESETS: Preset[] = [
  make('plain-box', () => ({})),
];

export function presetById(id: string): Preset | undefined {
  return PRESETS.find((preset) => preset.id === id);
}
