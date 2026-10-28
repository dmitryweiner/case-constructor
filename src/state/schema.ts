// The serialisable application state and the single gate through which
// numbers from outside reach the core: the UI, localStorage presets, a JSON
// file, a worker message. Everything from outside passes sanitizeState; the
// core may assume its parameters are valid. Sanitizers never throw and are
// idempotent (tests check both).

import type { ShapeKind, ShapeState } from '../geo/shape';
import { defaultShape, sanitizeShape } from '../geo/shape';
import type { BoardPlacement } from '../boards/placement';
import { defaultPlacement, sanitizePlacements } from '../boards/placement';
import { catalogBoard, CATALOG } from '../boards/catalog';
import type { ExtraCut } from '../geo/cutters';
import { sanitizeExtraCuts } from '../geo/cutters';
import type { FanState, LabelState, VentState, WallMountState } from '../geo/extras';
import {
  defaultFan, defaultLabel, defaultVents, defaultWallMount, sanitizeFan, sanitizeLabel, sanitizeVents, sanitizeWallMount,
} from '../geo/extras';
import type { LidState } from '../geo/lidSpec';
import { defaultLid, lidForKind, sanitizeLid } from '../geo/lidSpec';
import type { PrintArrange } from '../geo/print';
import { defaultPrint, sanitizePrint } from '../geo/print';
import type { HingeState } from './hinged';
import { defaultHinge, sanitizeHinge } from './hinged';

export const STATE_VERSION = 1;

/** What goes into the STL: the body, the lid, or both in one file laid out for printing. */
export const EXPORT_MODES = ['body', 'lid', 'both'] as const;
export type ExportMode = (typeof EXPORT_MODES)[number];

export interface AppState {
  version: number;
  shape: ShapeState;
  boards: BoardPlacement[];
  lid: LidState;
  /** user-defined openings on any face */
  extraCuts: ExtraCut[];
  vents: VentState;
  fan: FanState;
  wallMount: WallMountState;
  label: LabelState;
  exportMode: ExportMode;
  /** where the lid goes next to the body in the Both STL */
  print: PrintArrange;
  /** segments per quarter arc for the export build */
  resolution: number;
  /** a hinged case: the upper half and the hinge (the lower half is the fields above); kept for later on any other shape */
  hinge: HingeState;
}

export const RESOLUTIONS = [12, 24, 48, 64];

export function defaultState(): AppState {
  return {
    version: STATE_VERSION,
    shape: defaultShape(),
    boards: [defaultPlacement(catalogBoard('raspberry-pi-4b') ?? CATALOG[0])],
    lid: defaultLid(),
    extraCuts: [],
    vents: defaultVents(),
    fan: defaultFan(),
    wallMount: defaultWallMount(),
    label: defaultLabel(),
    exportMode: 'both',
    print: defaultPrint(),
    resolution: 24,
    hinge: defaultHinge(),
  };
}

function isExportMode(value: unknown): value is ExportMode {
  return typeof value === 'string' && EXPORT_MODES.some((mode) => mode === value);
}

/** The state with another shape; the lid goes back to the face the user chose when the shape allows it. */
export function withShapeKind(state: AppState, kind: ShapeKind): AppState {
  return { ...state, shape: { ...state.shape, kind }, lid: lidForKind(state.lid, kind) };
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
    boards: sanitizePlacements(Reflect.get(r, 'boards')),
    lid: sanitizeLid(Reflect.get(r, 'lid'), shape.kind),
    extraCuts: sanitizeExtraCuts(Reflect.get(r, 'extraCuts'), shape.kind),
    vents: sanitizeVents(Reflect.get(r, 'vents')),
    fan: sanitizeFan(Reflect.get(r, 'fan')),
    wallMount: sanitizeWallMount(Reflect.get(r, 'wallMount')),
    label: sanitizeLabel(Reflect.get(r, 'label')),
    exportMode: isExportMode(exportMode) ? exportMode : d.exportMode,
    print: sanitizePrint(Reflect.get(r, 'print')),
    resolution: typeof resolution === 'number' && RESOLUTIONS.includes(resolution) ? resolution : d.resolution,
    hinge: sanitizeHinge(Reflect.get(r, 'hinge')),
  };
}
