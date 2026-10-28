// A board placed in the case: which board, where, how high, how it is held,
// which of its ports get an opening. Positions are in the layout frame: the
// lower-left corner of the board's rotated outline, relative to the other
// boards — the layout as a whole is centred in the cavity (plans/PLAN.md §0.4).

import type { FastenerSpec } from '../geo/fasteners';
import { bossDiameter, sanitizeFastener } from '../geo/fasteners';
import type { BoardDef, Edge, KeysOpen, MountKind, PortDef } from './schema';
import { EDGES, KEYS_OPEN, autoPortId, bottomPartsH, isAutoPortId, keyFields, keysOf, onFace, resolveVariant, sanitizeBoard } from './schema';
import { CATALOG, catalogBoard } from './catalog';
import type { BatterySpec } from './battery';
import { PRESS_MAX, PRESS_MIN, batteryDef, defaultBattery, sanitizeBattery } from './battery';
import { defaultPress } from '../geo/clamp';
import { attachTurns } from '../geo/attach';
import { SIZE_MIN, defaultShape } from '../geo/shape';
import type { CapShape } from '../geo/capSize';
import { CAP_FIT, CAP_FLANGE_T, CAP_R_DEFAULT, CAP_R_MAX, CAP_R_MIN } from '../geo/capSize';

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
  /** a board on the floor only: the HAT display it carries (D6 the other way round) */
  top?: BackPlacement;
  /** a keyboard only: how the lid opens over its keys, when not the entry's default */
  keys?: KeysOpen;
  /** a keyboard only: the room around its window or each key's hole, when not the field's clearance, mm */
  keyFit?: number;
  /** a keyboard with printed caps only: square stems with rounded corners (missing: round) */
  capShape?: 'square';
  /** a square cap's corner radius, when not the default, mm */
  capR?: number;
  /** a keyboard with printed caps only: the stems' width (a round one's diameter), when not the default; kept within `capSizeRange` when built, mm */
  capSize?: number;
  /** a keyboard that hangs: held another way than its entry's (`holdChoices`) — rails, or clamp bars across its back */
  hold?: MountKind;
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
export function boardOf(placement: Pick<BoardPlacement, 'board' | 'custom' | 'battery' | 'variant' | 'hold'>): BoardDef {
  return withHold(resolveVariant(entryOf(placement), placement.variant), placement.hold);
}

/**
 * How a board may be held: its entry's way, and for a keyboard that hangs
 * also rails, or clamp bars across its back — a keyboard with a connector
 * standing up beside its keys (the CardKBs' Grove) does not tilt into rails
 * under a lid, while it lies face down in the lid for bars.
 */
export function holdChoices(entry: BoardDef): MountKind[] {
  if (entry.battery || entry.mount.kind === 'clamp' || keyFields(entry).length === 0 || !hangsByDefault(entry)) return [entry.mount.kind];
  return entry.mount.kind === 'holes' ? ['holes', 'rails', 'clamp'] : ['rails', 'clamp'];
}

/** The board held another way: rails along its long edges, or pressing clamp bars (no holes on its back to screw them to). */
export function withHold(def: BoardDef, hold: MountKind | undefined): BoardDef {
  if (!hold || hold === def.mount.kind || hold === 'holes') return def;
  return { ...def, mount: { ...def.mount, kind: hold, holes: [], rails: 'long' } };
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

/**
 * A display, a board with a display on top, or a keyboard, hangs from the
 * ceiling when added (its screen at the window, its keys through the lid) —
 * except a keyboard whose holes are among its keys: supports from the lid
 * would run into them (the MacroPad stands on its own standoffs).
 */
export function hangsByDefault(def: BoardDef): boolean {
  if (def.battery) return false;
  const keys = def.kind === 'keyboard' || keyFields(def).length > 0;
  if (keys && holesAmongKeys(def)) return false;
  return keys || def.kind === 'display' || def.ports.some((port) => port.type === 'display' && port.edge === 'top');
}

/** Whether a support at one of the board's holes (its own screw, tapped) would reach a key — or a field without rows. */
export function holesAmongKeys(def: BoardDef): boolean {
  if (def.mount.kind !== 'holes') return false;
  const r = bossDiameter({ size: def.mount.screw, hole: 'tap', head: 'none' }) / 2;
  // a field without rows is keys all over
  const keys = keyFields(def).flatMap((field) => (field.rows ? keysOf(field) : [{ x: field.x, y: field.y, w: field.w, d: field.d }]));
  return def.mount.holes.some((hole) => keys.some((key) => {
    const dx = Math.max(key.x - key.w / 2 - hole.x, 0, hole.x - key.x - key.w / 2);
    const dy = Math.max(key.y - key.d / 2 - hole.y, 0, hole.y - key.y - key.d / 2);
    return Math.hypot(dx, dy) < r;
  }));
}

/** Whether the plate presses on the board by design: a clamped panel's back bars, a keypad's flange. */
export function pressedOn(def: BoardDef): boolean {
  return def.mount.kind === 'clamp' || keyFields(def).some((field) => field.glass !== undefined);
}

/** The most room a key's hole or a key window may get around it, mm. */
export const KEY_FIT_MAX = 3;

/** How the lid opens over a board's keys: the placement's choice, else its first field's default; holes and caps only with rows. */
export function keysOpen(def: BoardDef, placement: Pick<BoardPlacement, 'keys'>): KeysOpen {
  const fields = keyFields(def);
  const rows = fields.some((field) => field.rows !== undefined);
  const wanted = placement.keys ?? fields[0]?.open ?? 'window';
  return wanted !== 'window' && rows ? wanted : 'window';
}

/** How the placement's printed caps are shaped: round, or square with this corner radius. */
export function capStyle(placement: Pick<BoardPlacement, 'capShape' | 'capR'>): { shape: CapShape; r: number } {
  return { shape: placement.capShape ?? 'round', r: placement.capR ?? CAP_R_DEFAULT };
}

/** The room around a key's hole or window: the placement's, else a cap's own fit or the field's clearance. */
export function keyFit(def: BoardDef, placement: Pick<BoardPlacement, 'keys' | 'keyFit'>, field: { clearance: number }): number {
  return placement.keyFit ?? (keysOpen(def, placement) === 'caps' ? CAP_FIT : field.clearance);
}

/**
 * How high the board's parts stand under the plate, above the PCB: its
 * `topHeight`, or a key field's base where the lid has a hole per key (the
 * plate lies between the keys; over a window the field rises into it), or
 * the key tops of a field left closed.
 */
export function frontHeight(def: BoardDef, placement: Pick<BoardPlacement, 'keys'> & Partial<Pick<BoardPlacement, 'cuts'>>): number {
  const open = keysOpen(def, placement);
  return Math.max(def.topHeight, ...keyFields(def).map((field) => {
    if (!(placement.cuts?.[field.id] ?? field.cut)) return field.h;
    // a cap's flange lies on its key, the plate the gap above it
    if (open === 'caps' && field.rows) return field.h + CAP_FLANGE_T;
    // a keypad's flange lies under the plate whatever opens over it
    return open === 'holes' || field.glass ? field.base ?? field.h : 0;
  }));
}

/**
 * The height a board stands at on the floor by default: a battery low in its
 * cradles, a board on 4 mm standoffs or higher; a keyboard as high as puts
 * its front the gap under the ceiling of the least case (under a hole per
 * key its holes then hold the switches at their plate line; over a window
 * its keys come up into it).
 */
export function floorZ(def: BoardDef, pins: boolean): number {
  if (def.battery) return minBoardZ(def, pins);
  const lowest = Math.max(4, minBoardZ(def, pins));
  if (keyFields(def).length === 0) return lowest;
  const { floor } = defaultShape();
  return Math.max(lowest, +(SIZE_MIN - 2 * floor - CEILING_GAP - def.size.t - frontHeight(def, {})).toFixed(2));
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
    // a clamped panel, or a keypad's flange, lies against the plate; anything else hangs the gap below it
    z: hangsByDefault(def) ? (pressedOn(def) ? 0 : CEILING_GAP) : floorZ(def, pins),
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

/**
 * A custom board's ports renamed from the ids the editor once gave every
 * port (`usb-c-<n>`, whatever its type) to their type's own: the old id →
 * the new one.
 */
function legacyPortIds(def: BoardDef): Map<string, string> {
  const taken = new Set(def.ports.map((port) => port.id));
  const renamed = new Map<string, string>();
  for (const port of def.ports) {
    if (port.type === 'usb-c' || !isAutoPortId(port.id, 'usb-c')) continue;
    const next = autoPortId(port.type, taken);
    taken.add(next);
    renamed.set(port.id, next);
  }
  return renamed;
}

export function sanitizePlacement(raw: unknown): BoardPlacement {
  const r = typeof raw === 'object' && raw !== null ? raw : {};
  const id: unknown = Reflect.get(r, 'board');
  const loaded = id === 'custom' ? sanitizeBoard(Reflect.get(r, 'custom'), 'custom') : undefined;
  const renamed = loaded ? legacyPortIds(loaded) : new Map<string, string>();
  const custom = loaded && renamed.size > 0
    ? { ...loaded, ports: loaded.ports.map((port) => ({ ...port, id: renamed.get(port.id) ?? port.id })) } : loaded;
  const oldId = new Map([...renamed].map(([from, to]) => [to, from]));
  const battery = id === 'battery' ? sanitizeBattery(Reflect.get(r, 'battery')) : undefined;
  const entry = custom ?? (battery ? batteryDef(battery) : undefined) ?? (typeof id === 'string' ? catalogBoard(id) : undefined) ?? CATALOG[0];
  const variantRaw: unknown = Reflect.get(r, 'variant');
  const variant = entry.variants?.find((item) => item.id === variantRaw)?.id ?? entry.variants?.[0].id;
  const plain = resolveVariant(entry, variant);
  const holdRaw: unknown = Reflect.get(r, 'hold');
  const hold = holdChoices(plain).find((kind) => kind === holdRaw && kind !== plain.mount.kind);
  const def = withHold(plain, hold);
  const base = defaultPlacement(entry);
  // a clamped panel has nothing to stand on: it always hangs; a floor board may carry a display on top
  const ceiling = (Reflect.get(r, 'on') === 'ceiling' || def.mount.kind === 'clamp') && !def.battery;
  const carried = ceiling || def.battery ? {} : withTopDisplay(def, Reflect.get(r, 'top'));
  const cutsRaw: unknown = Reflect.get(r, 'cuts');
  const cuts: Record<string, boolean> = {};
  if (typeof cutsRaw === 'object' && cutsRaw !== null) {
    for (const port of def.ports) {
      const value: unknown = Reflect.get(cutsRaw, oldId.get(port.id) ?? port.id);
      if (typeof value === 'boolean' && value !== ownPortDefault(carried, port)) cuts[port.id] = value;
    }
  }
  const rot: unknown = Reflect.get(r, 'rot');
  const pinsRaw: unknown = Reflect.get(r, 'pins');
  const pins = def.pins ? (typeof pinsRaw === 'boolean' ? pinsRaw : def.pins.soldered) : false;
  const wallsRaw: unknown = Reflect.get(r, 'walls');
  const walls = Array.isArray(wallsRaw) ? EDGES.filter((edge) => wallsRaw.includes(edge)) : [];
  // a file without the field stands on the floor, at the height it always had
  const zRaw: unknown = Reflect.get(r, 'z');
  const z = ceiling
    ? num(zRaw, 0, Z_MAX, pressedOn(def) ? 0 : CEILING_GAP)
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
    ...carried,
    ...withKeys(def, r),
    ...(hold ? { hold } : {}),
  };
}

/** A keyboard's opening choice and fit, kept only when they differ from the entry's. */
function withKeys(def: BoardDef, r: object): Pick<BoardPlacement, 'keys' | 'keyFit' | 'capShape' | 'capR' | 'capSize'> {
  const fields = keyFields(def);
  if (fields.length === 0) return {};
  const raw: unknown = Reflect.get(r, 'keys');
  const chosen = keysOpen(def, { keys: KEYS_OPEN.find((open) => open === raw) });
  const fit: unknown = Reflect.get(r, 'keyFit');
  return {
    ...(chosen !== keysOpen(def, {}) ? { keys: chosen } : {}),
    ...(typeof fit === 'number' && Number.isFinite(fit) ? { keyFit: num(fit, 0, KEY_FIT_MAX, fields[0].clearance) } : {}),
    ...(Reflect.get(r, 'capShape') === 'square' ? { capShape: 'square' as const } : {}),
    ...(typeof Reflect.get(r, 'capR') === 'number' ? { capR: num(Reflect.get(r, 'capR'), CAP_R_MIN, CAP_R_MAX, CAP_R_DEFAULT) } : {}),
    ...(typeof Reflect.get(r, 'capSize') === 'number' ? { capSize: num(Reflect.get(r, 'capSize'), 0.5, 30, 4) } : {}),
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

/**
 * A custom board's port turned into another type: its sizes go (the type
 * brings its own), an automatic id follows the type, and the opening toggle
 * follows the id.
 */
export function withPortType(placement: BoardPlacement, index: number, type: PortDef['type']): BoardPlacement {
  const custom = placement.custom;
  const port = custom?.ports[index];
  if (!custom || !port) return placement;
  const id = isAutoPortId(port.id, port.type) && port.type !== type
    ? autoPortId(type, new Set(custom.ports.map((item) => item.id))) : port.id;
  const along = onFace(port) ? undefined : port.along;
  const z = onFace(port) ? undefined : port.z;
  const x = onFace(port) ? port.x : undefined;
  const y = onFace(port) ? port.y : undefined;
  const ports = custom.ports.map((item, i) => (i === index ? { id, type, edge: port.edge, along, z, x, y } : item));
  const cuts = { ...placement.cuts };
  if (id !== port.id && port.id in cuts) {
    cuts[id] = cuts[port.id];
    delete cuts[port.id];
  }
  return sanitizePlacement({ ...placement, custom: { ...custom, ports }, cuts });
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

/**
 * The HAT display a floor board carries: a catalog display whose back
 * pattern faces up and fits the board's holes, or none. Its turn, standoff
 * and toggles mean what they mean on a display's back (`withBackBoard`) —
 * the same pattern, read the other way round.
 */
function withTopDisplay(board: BoardDef, raw: unknown): { top?: BackPlacement } {
  if (typeof raw !== 'object' || raw === null) return {};
  const id: unknown = Reflect.get(raw, 'board');
  const entry = typeof id === 'string' ? catalogBoard(id) : undefined;
  if (!entry || entry.back?.facing !== 'top') return {};
  const variantRaw: unknown = Reflect.get(raw, 'variant');
  const variant = entry.variants?.find((item) => item.id === variantRaw)?.id ?? entry.variants?.[0].id;
  const display = resolveVariant(entry, variant);
  const turns = attachTurns(display, board);
  if (turns.length === 0 || !display.back) return {};
  const rot: unknown = Reflect.get(raw, 'rot');
  const cutsRaw: unknown = Reflect.get(raw, 'cuts');
  const cuts: Record<string, boolean> = {};
  if (typeof cutsRaw === 'object' && cutsRaw !== null) {
    for (const port of display.ports) {
      const value: unknown = Reflect.get(cutsRaw, port.id);
      if (typeof value === 'boolean' && value !== port.cut) cuts[port.id] = value;
    }
  }
  const min = backStandoffMin(display, board);
  return {
    top: {
      board: entry.id,
      rot: turns.find((turn) => turn === rot) ?? turns[0],
      standoff: num(Reflect.get(raw, 'standoff'), min, BACK_STANDOFF_MAX, Math.max(display.back.standoff, min)),
      ...(variant !== undefined ? { variant } : {}),
      cuts,
    },
  };
}

/** The toggles of a carried display with a port's opening on or off; its default is not stored. */
export function withTopCut(top: BackPlacement, port: PortDef, value: boolean): Record<string, boolean> {
  const cuts = { ...top.cuts };
  if (value === port.cut) delete cuts[port.id];
  else cuts[port.id] = value;
  return cuts;
}

/**
 * A port's default on a placed board: its own, except that a board carrying
 * a display on top keeps its top parts closed — their columns would open
 * the case right under the display.
 */
export function ownPortDefault(placement: Pick<BoardPlacement, 'top'>, port: PortDef): boolean {
  return port.cut && !(placement.top && onFace(port) && port.edge === 'top');
}
