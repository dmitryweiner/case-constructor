// The serialisable application state and the single gate through which
// numbers from outside reach the core: the UI, localStorage presets, a JSON
// file, a worker message. Everything from outside passes sanitizeState; the
// core may assume its parameters are valid. Sanitizers never throw and are
// idempotent (tests check both).

import type { ShapeState } from '../geo/shape';
import { defaultShape, sanitizeShape } from '../geo/shape';
import type { LidState } from '../geo/lidSpec';
import { defaultLid, sanitizeLid } from '../geo/lidSpec';

export const STATE_VERSION = 1;

/** What goes into the STL: the body, the lid, or both in one file laid out for printing. */
export const EXPORT_MODES = ['body', 'lid', 'both'] as const;
export type ExportMode = (typeof EXPORT_MODES)[number];

export interface AppState {
  version: number;
  shape: ShapeState;
  lid: LidState;
  exportMode: ExportMode;
  /** segments per quarter arc for the export build */
  resolution: number;
}

export const RESOLUTIONS = [12, 24, 48, 64];

export function defaultState(): AppState {
  return {
    version: STATE_VERSION,
    shape: defaultShape(),
    lid: defaultLid(),
    exportMode: 'both',
    resolution: 24,
  };
}

function isExportMode(value: unknown): value is ExportMode {
  return typeof value === 'string' && EXPORT_MODES.some((mode) => mode === value);
}

export function sanitizeState(raw: unknown): AppState {
  const d = defaultState();
  const r = typeof raw === 'object' && raw !== null ? raw : {};
  const shape = sanitizeShape(Reflect.get(r, 'shape'));
  const exportMode: unknown = Reflect.get(r, 'exportMode');
  const resolution: unknown = Reflect.get(r, 'resolution');
  return {
    version: STATE_VERSION,
    shape,
    lid: sanitizeLid(Reflect.get(r, 'lid'), shape.kind),
    exportMode: isExportMode(exportMode) ? exportMode : d.exportMode,
    resolution: typeof resolution === 'number' && RESOLUTIONS.includes(resolution) ? resolution : d.resolution,
  };
}
