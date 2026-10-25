// A board placed in the case: which board, where, how high, how it is held,
// which of its ports get an opening. Positions are in the layout frame: the
// lower-left corner of the board's rotated outline, relative to the other
// boards — the layout as a whole is centred in the cavity (PLAN.md §0.4).

import type { FastenerSpec } from '../geo/fasteners';
import { sanitizeFastener } from '../geo/fasteners';
import type { BoardDef } from './schema';
import { bottomPartsH, resolveVariant, sanitizeBoard } from './schema';
import { CATALOG, catalogBoard } from './catalog';

export const ROTATIONS = [0, 90, 180, 270] as const;
export type Rotation = (typeof ROTATIONS)[number];

export interface BoardPlacement {
  /** catalog id, or 'custom' */
  board: string;
  /** only when board === 'custom' */
  custom?: BoardDef;
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
}

export const MAX_BOARDS = 8;
export const POSITION_MAX = 300;
export const Z_MAX = 60;
/** Gap between a new board and the ones already placed, mm. */
export const NEW_BOARD_GAP = 5;

/** The entry behind a placement, its variants unresolved: the catalog entry or the custom board. */
export function entryOf(placement: Pick<BoardPlacement, 'board' | 'custom'>): BoardDef {
  if (placement.board === 'custom' && placement.custom) return placement.custom;
  return catalogBoard(placement.board) ?? CATALOG[0];
}

/** The board a placement builds: its entry with the chosen variant applied. */
export function boardOf(placement: Pick<BoardPlacement, 'board' | 'custom' | 'variant'>): BoardDef {
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

/** Lowest a placed board may sit, its pins as the placement has them. */
export function placementMinZ(placement: BoardPlacement): number {
  const def = boardOf(placement);
  return minBoardZ(def, pinsDown(def, placement));
}

export function defaultPlacement(entry: BoardDef, x = 0, y = 0): BoardPlacement {
  const variant = entry.variants?.[0].id;
  const def = resolveVariant(entry, variant);
  const pins = def.pins?.soldered ?? false;
  return {
    board: def.id,
    x,
    y,
    z: Math.max(4, minBoardZ(def, pins)),
    rot: 0,
    mount: { size: def.mount.screw, hole: 'tap', head: 'none' },
    cuts: {},
    ...(def.pins ? { pins } : {}),
    ...(variant !== undefined ? { variant } : {}),
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
  const entry = custom ?? (typeof id === 'string' ? catalogBoard(id) : undefined) ?? CATALOG[0];
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
  return {
    board: custom ? 'custom' : def.id,
    ...(custom ? { custom: { ...custom, id: 'custom' } } : {}),
    x: num(Reflect.get(r, 'x'), 0, POSITION_MAX, base.x),
    y: num(Reflect.get(r, 'y'), 0, POSITION_MAX, base.y),
    z: num(Reflect.get(r, 'z'), minBoardZ(def, pins), Z_MAX, Math.max(base.z, minBoardZ(def, pins))),
    rot: ROTATIONS.find((value) => value === rot) ?? base.rot,
    mount: { ...sanitizeFastener(Reflect.get(r, 'mount'), base.mount), head: 'none' },
    cuts,
    ...(def.pins ? { pins } : {}),
    ...(variant !== undefined ? { variant } : {}),
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
