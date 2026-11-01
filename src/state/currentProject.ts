// The project being edited, kept in localStorage on every change: a closed
// tab or a crash does not lose the work, and the next visit opens it again.
// Storage is a parameter (tests fake it); every access is guarded — it may be
// blocked (private mode), full, or hold garbage from another version.

import type { AppState } from './schema';
import { sanitizeState } from './schema';

export const CURRENT_PROJECT_KEY = 'caseconstructor_current_v1';
const VERSION = 1;

export interface CurrentProject {
  /** The name shown on the presets button and suggested when saving. */
  name: string;
  /** Which preset is open: 'b:<id>', 'u:<name>' or empty. */
  ref: string;
  state: AppState;
}

type ProjectStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function loadCurrentProject(storage: () => ProjectStorage = () => localStorage): CurrentProject | null {
  try {
    const raw = storage().getItem(CURRENT_PROJECT_KEY);
    return raw ? parseCurrentProject(raw) : null;
  } catch {
    return null;
  }
}

/** null for anything but a saved project of this version: then the app opens its first preset. */
export function parseCurrentProject(raw: string): CurrentProject | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  if (Reflect.get(parsed, 'version') !== VERSION) return null;
  const state: unknown = Reflect.get(parsed, 'state');
  if (typeof state !== 'object' || state === null || Array.isArray(state)) return null;
  const name: unknown = Reflect.get(parsed, 'name');
  const ref: unknown = Reflect.get(parsed, 'ref');
  return {
    name: typeof name === 'string' ? name : '',
    ref: typeof ref === 'string' && /^[bu]:./.test(ref) ? ref : '',
    state: sanitizeState(state),
  };
}

export function saveCurrentProject(project: CurrentProject, storage: () => ProjectStorage = () => localStorage): boolean {
  try {
    storage().setItem(CURRENT_PROJECT_KEY, JSON.stringify({ version: VERSION, ...project }));
    return true;
  } catch {
    return false;
  }
}
