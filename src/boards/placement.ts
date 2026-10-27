// A board placed in the case: which board, where, how high, how it is held,
// which of its ports get an opening. Positions are in the layout frame: the
// lower-left corner of the board's rotated outline, relative to the other
// boards — the layout as a whole is centred in the cavity (plans/PLAN.md §0.4).

import type { FastenerSpec } from '../geo/fasteners';
import { sanitizeFastener } from '../geo/fasteners';
import type { BoardDef, Edge, PortDef } from './schema';
import { EDGES, bottomPartsH, onFace, resolveVariant, sanitizeBoard } from './schema';
import { CATALOG, catalogBoard } from './catalog';
import type { BatterySpec } from './battery';
import { PRESS_MAX, PRESS_MIN, batteryDef, defaultBattery, sanitizeBattery } from './battery';
import { defaultPress } from '../geo/clamp';
import { attachTurns } from '../geo/attach';

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
  /** a hung display's window without its chamfer (missing: chamfered) */
  bevel?: false;
  /** a clamped panel only: how far its bars press into its back, mm (negative leaves room for foam tape) */
  press?: number;
  /** a display with a back pattern only: the board screwed to its back */
  back?: BackPlacement;
}

/**
 * A board on a display's back: a catalog board whose holes fit the pattern,
 * the turn that puts them there, the display's standoffs' length, its model
 * and its port toggles (a part on its faces is closed by default: turned
 * over, or under the display, its column would cut the case's other side).
 */
export interface BackPlacement {
  board: string;
  rot: Rotation;
  standoff: number;
  variant?: string;
  cuts: Record<string, boolean>;
}

export const BACK_STANDOFF_MIN = 3;
export const BACK_STANDOFF_MAX = 30;

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
    // a clamped panel lies against the plate; anything else hangs the gap below it
    z: hangsByDefault(def) ? (def.mount.kind === 'clamp' ? 0 : CEILING_GAP) : floorZ(def, pins),
    rot: 0,
    mount: { size: def.mount.screw, hole: 'tap', head: 'none' },
    cuts: {},
    ...(def.pins ? { pins } : {}),
    ...(variant !== undefined ? { variant } : {}),
    ...(hangsByDefault(def) ? { on: 'ceiling' as const } : {}),
    ...(def.mount.kind === 'clamp' ? { press: defaultPress(def) } : {}),
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
  // a clamped panel has nothing to stand on: it always hangs
  const ceiling = (Reflect.get(r, 'on') === 'ceiling' || def.mount.kind === 'clamp') && !def.battery;
  const zRaw: unknown = Reflect.get(r, 'z');
  const z = ceiling
    ? num(zRaw, 0, Z_MAX, def.mount.kind === 'clamp' ? 0 : CEILING_GAP)
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
    ...(Reflect.get(r, 'bevel') === false ? { bevel: false as const } : {}),
    ...(def.mount.kind === 'clamp' ? { press: num(Reflect.get(r, 'press'), PRESS_MIN, PRESS_MAX, defaultPress(def)) } : {}),
    ...withBackBoard(def, Reflect.get(r, 'back')),
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

/** A port of the board on a display's back: its faces' parts closed by default. */
export function backPortDefault(port: PortDef): boolean {
  return port.cut && !onFace(port);
}

/** The lowest standoff a back board allows: a HAT sits on its GPIO header. */
export function backStandoffMin(parent: BoardDef, child: BoardDef): number {
  if (parent.back?.facing !== 'top') return BACK_STANDOFF_MIN;
  const header = child.ports.find((port) => port.type === 'header-2x20' && port.edge === 'top');
  return Math.max(BACK_STANDOFF_MIN, header?.h ?? 0);
}

/** The board on a display's back as built: a catalog board that fits, or none. */
function withBackBoard(parent: BoardDef, raw: unknown): { back?: BackPlacement } {
  if (!parent.back || typeof raw !== 'object' || raw === null) return {};
  const id: unknown = Reflect.get(raw, 'board');
  const entry = typeof id === 'string' ? catalogBoard(id) : undefined;
  if (!entry || entry.battery) return {};
  const variantRaw: unknown = Reflect.get(raw, 'variant');
  const variant = entry.variants?.find((item) => item.id === variantRaw)?.id ?? entry.variants?.[0].id;
  const child = resolveVariant(entry, variant);
  const turns = attachTurns(parent, child);
  if (turns.length === 0) return {};
  const rot: unknown = Reflect.get(raw, 'rot');
  const cutsRaw: unknown = Reflect.get(raw, 'cuts');
  const cuts: Record<string, boolean> = {};
  if (typeof cutsRaw === 'object' && cutsRaw !== null) {
    for (const port of child.ports) {
      const value: unknown = Reflect.get(cutsRaw, port.id);
      if (typeof value === 'boolean' && value !== backPortDefault(port)) cuts[port.id] = value;
    }
  }
  return {
    back: {
      board: entry.id,
      rot: turns.find((turn) => turn === rot) ?? turns[0],
      standoff: num(Reflect.get(raw, 'standoff'), backStandoffMin(parent, child), BACK_STANDOFF_MAX, Math.max(parent.back.standoff, backStandoffMin(parent, child))),
      ...(variant !== undefined ? { variant } : {}),
      cuts,
    },
  };
}

/** The back board's toggles with a port's opening on or off; its default is not stored. */
export function withBackCut(back: BackPlacement, port: PortDef, value: boolean): Record<string, boolean> {
  const cuts = { ...back.cuts };
  if (value === backPortDefault(port)) delete cuts[port.id];
  else cuts[port.id] = value;
  return cuts;
}
