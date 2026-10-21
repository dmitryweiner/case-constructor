// A board placed in the case: which board, where, how high, how it is held,
// which of its ports get an opening. Positions are in the layout frame: the
// lower-left corner of the board's rotated outline, relative to the other
// boards — the layout as a whole is centred in the cavity (PLAN.md §0.4).

import type { FastenerSpec } from '../geo/fasteners';
import { sanitizeFastener } from '../geo/fasteners';
import type { BoardDef } from './schema';
import { sanitizeBoard } from './schema';
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
}

export const MAX_BOARDS = 8;
export const POSITION_MAX = 300;
export const Z_MAX = 60;
/** Gap between a new board and the ones already placed, mm. */
export const NEW_BOARD_GAP = 5;

/** The definition behind a placement: the catalog entry or the custom board. */
export function boardOf(placement: Pick<BoardPlacement, 'board' | 'custom'>): BoardDef {
  if (placement.board === 'custom' && placement.custom) return placement.custom;
  return catalogBoard(placement.board) ?? CATALOG[0];
}

/** Lowest the board may sit: its underside parts plus a millimetre. */
export function minBoardZ(def: BoardDef): number {
  return def.bottomHeight + 1;
}

export function defaultPlacement(def: BoardDef, x = 0, y = 0): BoardPlacement {
  return {
    board: def.id,
    x,
    y,
    z: Math.max(4, minBoardZ(def)),
    rot: 0,
    mount: { size: def.mount.screw, hole: 'tap', head: 'none' },
    cuts: {},
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
  const def = custom ?? (typeof id === 'string' ? catalogBoard(id) : undefined) ?? CATALOG[0];
  const base = defaultPlacement(def);
  const cutsRaw: unknown = Reflect.get(r, 'cuts');
  const cuts: Record<string, boolean> = {};
  if (typeof cutsRaw === 'object' && cutsRaw !== null) {
    for (const port of def.ports) {
      const value: unknown = Reflect.get(cutsRaw, port.id);
      if (typeof value === 'boolean' && value !== port.cut) cuts[port.id] = value;
    }
  }
  const rot: unknown = Reflect.get(r, 'rot');
  return {
    board: custom ? 'custom' : def.id,
    ...(custom ? { custom: { ...custom, id: 'custom' } } : {}),
    x: num(Reflect.get(r, 'x'), 0, POSITION_MAX, base.x),
    y: num(Reflect.get(r, 'y'), 0, POSITION_MAX, base.y),
    z: num(Reflect.get(r, 'z'), minBoardZ(def), Z_MAX, base.z),
    rot: ROTATIONS.find((value) => value === rot) ?? base.rot,
    mount: { ...sanitizeFastener(Reflect.get(r, 'mount'), base.mount), head: 'none' },
    cuts,
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
