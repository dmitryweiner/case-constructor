// A board placed in the case: which board, where, how high, how it is held,
// which of its ports get an opening. Positions are in the layout frame: the
// lower-left corner of the board's rotated outline, relative to the other
// boards — the layout as a whole is centred in the cavity (plans/PLAN.md §0.4).

import type { FastenerSpec } from '../geo/fasteners';
import { sanitizeFastener } from '../geo/fasteners';
import type { BoardDef, Edge } from './schema';
import { EDGES, bottomPartsH, resolveVariant, sanitizeBoard } from './schema';
import { CATALOG, catalogBoard } from './catalog';
import type { BatterySpec } from './battery';
import { batteryDef, defaultBattery, sanitizeBattery } from './battery';

export const ROTATIONS = [0, 90, 180, 270] as const;
export type Rotation = (typeof ROTATIONS)[number];

export interface BoardPlacement {
  /** catalog id, or 'custom' */
  board: string;
  /** only when board === 'custom' */
  custom?: BoardDef;
  /** only when board === 'battery' */
  battery?: BatterySpec;
  x: number;
  y: number;
  /** PCB underside above the inner floor = standoff height */
  z: number;
  rot: Rotation;
  /** standoff fastener for a board with holes; rails ignore it */
  mount: FastenerSpec;
  /** port id → cut an opening; a missing id takes the port type's default */
  cuts: Record<string, boolean>;
  /** boards with header rows only: the pins are soldered pointing down */
  pins?: boolean;
  /** entries with variants only: which model */
  variant?: string;
  /** the case walls the board stands against (case frame): its connectors on those sides end at the outer surface */
  walls?: Edge[];
  /** with walls: the connector faces beyond the outer surface, mm (negative: recessed) */
  wallOffset?: number;
  /**
   * Where it is held: on standoffs from the floor (missing), or hung from the
   * ceiling, its top still up and `z` the gap from its front to the ceiling.
   */
  on?: Side;
}

export const SIDES = ['floor', 'ceiling'] as const;
export type Side = (typeof SIDES)[number];

export const MAX_BOARDS = 8;
export const POSITION_MAX = 300;
export const Z_MAX = 60;
/** How far a board's connectors may stand out of (or sit back in) the wall it stands against, mm. */
export const WALL_OFFSET_MIN = -10;
export const WALL_OFFSET_MAX = 3;
/** Gap between a new board and the ones already placed, mm. */
export const NEW_BOARD_GAP = 5;
/**
 * A hung board's gap to the ceiling by default, mm: the drawings' and the
 * print's tolerance, so a glass thicker than drawn is not pressed against
 * the plate. Less is allowed, with a warning.
 */
export const CEILING_GAP = 0.3;

/** The entry behind a placement, its variants unresolved: the catalog entry or the custom board. */
export function entryOf(placement: Pick<BoardPlacement, 'board' | 'custom' | 'battery'>): BoardDef {
  if (placement.board === 'custom' && placement.custom) return placement.custom;
  if (placement.board === 'battery') return batteryDef(placement.battery ?? defaultBattery());
  return catalogBoard(placement.board) ?? CATALOG[0];
}

/** The board a placement builds: its entry with the chosen variant applied. */
export function boardOf(placement: Pick<BoardPlacement, 'board' | 'custom' | 'battery' | 'variant'>): BoardDef {
  return resolveVariant(entryOf(placement), placement.variant);
}

/** Whether the placed board has its pins soldered pointing down. */
export function pinsDown(def: BoardDef, placement: Pick<BoardPlacement, 'pins'>): boolean {
  return def.pins !== undefined && (placement.pins ?? def.pins.soldered);
}

/** The tallest thing under the PCB: its parts (bottom ports too), or its pins when they are soldered. */
export function undersideOf(def: BoardDef, pins: boolean): number {
  const parts = Math.max(def.bottomHeight, bottomPartsH(def.ports));
  return pins && def.pins ? Math.max(parts, def.pins.below) : parts;
}

/** Lowest the board may sit: its underside plus a millimetre. */
export function minBoardZ(def: BoardDef, pins = false): number {
  return undersideOf(def, pins) + 1;
}

/** Lowest a placed board may sit, its pins as the placement has them; a hung board's gap may be 0. */
export function placementMinZ(placement: BoardPlacement): number {
  if (placement.on === 'ceiling') return 0;
  const def = boardOf(placement);
  return minBoardZ(def, pinsDown(def, placement));
}

/** A display, or a board with a display on top, hangs from the ceiling when added (its screen at the window). */
export function hangsByDefault(def: BoardDef): boolean {
  return !def.battery && (def.kind === 'display' || def.ports.some((port) => port.type === 'display' && port.edge === 'top'));
}

/** The height a board stands at on the floor by default: a battery low in its cradles, a board on 4 mm standoffs or higher. */
export function floorZ(def: BoardDef, pins: boolean): number {
  return def.battery ? minBoardZ(def, pins) : Math.max(4, minBoardZ(def, pins));
}

export function defaultPlacement(entry: BoardDef, x = 0, y = 0): BoardPlacement {
  const variant = entry.variants?.[0].id;
  const def = resolveVariant(entry, variant);
  const pins = def.pins?.soldered ?? false;
  return {
    board: def.id,
    ...(def.battery ? { battery: def.battery } : {}),
    x,
    y,
    z: hangsByDefault(def) ? CEILING_GAP : floorZ(def, pins),
    rot: 0,
    mount: { size: def.mount.screw, hole: 'tap', head: 'none' },
    cuts: {},
    ...(def.pins ? { pins } : {}),
    ...(variant !== undefined ? { variant } : {}),
    ...(hangsByDefault(def) ? { on: 'ceiling' as const } : {}),
  };
}

function num(x: unknown, min: number, max: number, fallback: number): number {
  const value = typeof x === 'number' && Number.isFinite(x) ? x : fallback;
  // + 0 turns -0 into 0: JSON would, and the sanitizer must be idempotent through a file
  return Math.min(max, Math.max(min, value)) + 0;
}

export function sanitizePlacement(raw: unknown): BoardPlacement {
  const r = typeof raw === 'object' && raw !== null ? raw : {};
  const id: unknown = Reflect.get(r, 'board');
  const custom = id === 'custom' ? sanitizeBoard(Reflect.get(r, 'custom'), 'custom') : undefined;
  const battery = id === 'battery' ? sanitizeBattery(Reflect.get(r, 'battery')) : undefined;
  const entry = custom ?? (battery ? batteryDef(battery) : undefined) ?? (typeof id === 'string' ? catalogBoard(id) : undefined) ?? CATALOG[0];
  const variantRaw: unknown = Reflect.get(r, 'variant');
  const variant = entry.variants?.find((item) => item.id === variantRaw)?.id ?? entry.variants?.[0].id;
  const def = resolveVariant(entry, variant);
  const base = defaultPlacement(entry);
  const cutsRaw: unknown = Reflect.get(r, 'cuts');
  const cuts: Record<string, boolean> = {};
  if (typeof cutsRaw === 'object' && cutsRaw !== null) {
    for (const port of def.ports) {
      const value: unknown = Reflect.get(cutsRaw, port.id);
      if (typeof value === 'boolean' && value !== port.cut) cuts[port.id] = value;
    }
  }
  const rot: unknown = Reflect.get(r, 'rot');
  const pinsRaw: unknown = Reflect.get(r, 'pins');
  const pins = def.pins ? (typeof pinsRaw === 'boolean' ? pinsRaw : def.pins.soldered) : false;
  const wallsRaw: unknown = Reflect.get(r, 'walls');
  const walls = Array.isArray(wallsRaw) ? EDGES.filter((edge) => wallsRaw.includes(edge)) : [];
  // a file without the field stands on the floor, at the height it always had
  const ceiling = Reflect.get(r, 'on') === 'ceiling' && !def.battery;
  const zRaw: unknown = Reflect.get(r, 'z');
  const z = ceiling
    ? num(zRaw, 0, Z_MAX, CEILING_GAP)
    : num(zRaw, minBoardZ(def, pins), Z_MAX, Math.max(floorZ(def, def.pins?.soldered ?? false), minBoardZ(def, pins)));
  return {
    board: custom ? 'custom' : def.id,
    ...(custom ? { custom: { ...custom, id: 'custom' } } : {}),
    ...(battery ? { battery } : {}),
    x: num(Reflect.get(r, 'x'), 0, POSITION_MAX, base.x),
    y: num(Reflect.get(r, 'y'), 0, POSITION_MAX, base.y),
    z,
    rot: ROTATIONS.find((value) => value === rot) ?? base.rot,
    mount: { ...sanitizeFastener(Reflect.get(r, 'mount'), base.mount), head: 'none' },
    cuts,
    ...(def.pins ? { pins } : {}),
    ...(variant !== undefined ? { variant } : {}),
    ...(walls.length > 0 ? { walls, wallOffset: num(Reflect.get(r, 'wallOffset'), WALL_OFFSET_MIN, WALL_OFFSET_MAX, 0) } : {}),
    ...(ceiling ? { on: 'ceiling' as const } : {}),
  };
}

export function sanitizePlacements(raw: unknown): BoardPlacement[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_BOARDS).map(sanitizePlacement);
}

/** Whether a port gets an opening: the placement's toggle, else the port's default. */
export function portCut(placement: BoardPlacement, portId: string, fallback: boolean): boolean {
  return placement.cuts[portId] ?? fallback;
}

/** The placement with a port's opening on or off; the entry's own default is not stored. */
export function withPortCut(placement: BoardPlacement, port: { id: string; cut: boolean }, value: boolean): BoardPlacement {
  const cuts = { ...placement.cuts };
  if (value === port.cut) delete cuts[port.id];
  else cuts[port.id] = value;
  return { ...placement, cuts };
}

/** The placement on the floor or hung from the ceiling; the floor is stored as no field at all. */
export function withSide(placement: BoardPlacement, side: Side): BoardPlacement {
  const out: BoardPlacement = { ...placement };
  if (side === 'ceiling') out.on = 'ceiling';
  else delete out.on;
  return out;
}
