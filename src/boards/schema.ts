// Boards are data, not code: every catalog entry is a JSON file checked by
// this type and its sanitizer; adding a board touches no .ts file except the
// catalog index. A custom board from the editor travels in the state and
// goes through the same sanitizer.
//
// Board frame (plans/PLAN.md §0.4): origin at the lower-left corner of the vendor's
// top view, x to the right, y up (away from the viewer). Edges: front
// (y = 0), back (y = d), left (x = 0), right (x = w).

import type { BatterySpec } from './battery';
import type { ScrewSize } from '../geo/fasteners';
import { isScrewSize } from '../geo/fasteners';

export const EDGES = ['front', 'back', 'left', 'right'] as const;
export type Edge = (typeof EDGES)[number];

export const PORT_SHAPES = ['rect', 'round'] as const;
export type PortShape = (typeof PORT_SHAPES)[number];

export interface PortType {
  /** width along the edge (edge ports) or along x (top elements); the diameter of a round one */
  w: number;
  /** height above its base */
  h: number;
  /** how deep the body reaches into the board (edge ports) or its size along y (top elements) */
  d: number;
  /** extra opening around the body, per side — enough for a common plug */
  clearance: number;
  shape: PortShape;
  /** cut an opening by default */
  cut: boolean;
  /** an element on the board's top face rather than on an edge */
  top: boolean;
  /** an opening lower than the part: only its bottom this high (a terminal's wire entries) */
  cutH?: number;
}

/** Defaults per port type; a board entry may override any of them. */
export const PORT_TYPES = {
  'usb-a': { w: 13.1, h: 5.7, d: 14, clearance: 1, shape: 'rect', cut: true, top: false },
  'usb-c': { w: 8.9, h: 3.2, d: 7.3, clearance: 1.8, shape: 'rect', cut: true, top: false },
  'micro-usb': { w: 7.5, h: 2.6, d: 5, clearance: 1.8, shape: 'rect', cut: true, top: false },
  'mini-usb': { w: 7.7, h: 4, d: 9, clearance: 1.6, shape: 'rect', cut: true, top: false },
  'usb-b': { w: 12, h: 11, d: 16, clearance: 0.8, shape: 'rect', cut: true, top: false },
  'hdmi': { w: 15, h: 5.6, d: 11, clearance: 1.5, shape: 'rect', cut: true, top: false },
  'mini-hdmi': { w: 10.5, h: 3.2, d: 7.5, clearance: 1.8, shape: 'rect', cut: true, top: false },
  'micro-hdmi': { w: 6.5, h: 3, d: 7.5, clearance: 2, shape: 'rect', cut: true, top: false },
  'rj45': { w: 16, h: 13.5, d: 21, clearance: 0.5, shape: 'rect', cut: true, top: false },
  'audio-3.5': { w: 6, h: 6, d: 12, clearance: 1, shape: 'round', cut: true, top: false },
  'dc-jack-5.5': { w: 9, h: 11, d: 14, clearance: 0.6, shape: 'rect', cut: true, top: false },
  'microsd': { w: 12, h: 1.5, d: 15, clearance: 1, shape: 'rect', cut: true, top: false },
  'sd': { w: 24, h: 2.5, d: 30, clearance: 1, shape: 'rect', cut: true, top: false },
  'sma': { w: 6.5, h: 6.5, d: 8, clearance: 0.3, shape: 'round', cut: true, top: false },
  'switch': { w: 8, h: 3, d: 4, clearance: 0.6, shape: 'rect', cut: true, top: false },
  // 5.08 mm screw terminal, two poles; the wires leave through a slot at the entries
  'terminal': { w: 10.16, h: 10, d: 8, clearance: 0.5, shape: 'rect', cut: true, top: false, cutH: 5.5 },
  // JST PH / SH (Qwiic, STEMMA QT) battery, speaker and I2C sockets
  'jst': { w: 6, h: 4.5, d: 5, clearance: 0.5, shape: 'rect', cut: false, top: false },
  'sim': { w: 12.5, h: 1.5, d: 14, clearance: 1, shape: 'rect', cut: true, top: false },
  'header-2x20': { w: 51, h: 8.5, d: 5, clearance: 0.6, shape: 'rect', cut: true, top: true },
  'header-1xN': { w: 25.4, h: 8.5, d: 2.5, clearance: 0.6, shape: 'rect', cut: false, top: true },
  // a 2-row header other than the Pi's GPIO: PoE 2x2, UEXT 2x5, 2x3
  'header-2xN': { w: 12.7, h: 8.5, d: 5.08, clearance: 0.6, shape: 'rect', cut: false, top: true },
  'display': { w: 30, h: 3, d: 15, clearance: 0.3, shape: 'rect', cut: true, top: true },
  'button': { w: 3.5, h: 1.5, d: 3.5, clearance: 0.6, shape: 'round', cut: true, top: true },
  'led': { w: 1.6, h: 0.8, d: 1.6, clearance: 0.5, shape: 'round', cut: true, top: true },
  'fpc': { w: 22, h: 3, d: 3, clearance: 1, shape: 'rect', cut: true, top: true },
  'antenna': { w: 3, h: 1.3, d: 3, clearance: 0.5, shape: 'rect', cut: false, top: true },
  'generic': { w: 5, h: 3, d: 5, clearance: 0.5, shape: 'rect', cut: false, top: true },
  // a battery holder's wire leads where they leave it: room for the bend, no opening
  'wires': { w: 4, h: 3, d: 2, clearance: 0.5, shape: 'rect', cut: false, top: false },
} as const satisfies Record<string, PortType>;

export type PortTypeId = keyof typeof PORT_TYPES;
export const PORT_TYPE_IDS = Object.keys(PORT_TYPES).filter(isPortType);

export function isPortType(value: unknown): value is PortTypeId {
  return typeof value === 'string' && Object.hasOwn(PORT_TYPES, value);
}

interface PortCommon {
  id: string;
  type: PortTypeId;
  w: number;
  h: number;
  d: number;
  clearance: number;
  shape: PortShape;
  cut: boolean;
  /** the opening covers only the part's bottom this high */
  cutH?: number;
}

/** A connector on an edge, its face at the board edge plus `protrude`. */
export interface EdgePort extends PortCommon {
  edge: Edge;
  /** centre along the edge, measured from the board origin's end of it */
  along: number;
  /** bottom above the PCB top; negative = below the board (a microSD slot) */
  z: number;
  /** how far the body sticks out beyond the edge */
  protrude: number;
}

/**
 * An element on a face of the PCB: a rectangle (or circle) centred at
 * (x, y), h above the top face — or, on the underside, h below the PCB.
 */
export interface TopPort extends PortCommon {
  edge: 'top' | 'bottom';
  x: number;
  y: number;
}

/** A part on the top or the underside rather than on an edge. */
export function onFace(port: PortDef): port is TopPort {
  return port.edge === 'top' || port.edge === 'bottom';
}

/** The tallest part under the PCB that the entry lists as a port. */
export function bottomPartsH(ports: readonly PortDef[]): number {
  return Math.max(0, ...ports.filter((port) => port.edge === 'bottom').map((port) => port.h));
}

export type PortDef = EdgePort | TopPort;

export const MOUNT_KINDS = ['holes', 'rails'] as const;
export type MountKind = (typeof MOUNT_KINDS)[number];

export interface Hole {
  x: number;
  y: number;
  d: number;
}

/**
 * Through-hole header rows whose pins may be soldered pointing down. The
 * entry describes the bare board (`bottomHeight` without them); the
 * placement says whether they are there.
 */
export interface BoardPins {
  /** how far the pins reach below the PCB underside, plastic included */
  below: number;
  /** the edges the rows run along */
  edges: Edge[];
  /** the row centre's distance from its edge */
  inset: number;
  /** how the board ships: the placement's default */
  soldered: boolean;
}

/** Fields a variant may change on a port of its entry. */
export const OVERRIDE_NUMBERS = ['x', 'y', 'along', 'z', 'w', 'h', 'd', 'protrude', 'clearance', 'cutH'] as const;
export type PortOverride = Partial<Record<(typeof OVERRIDE_NUMBERS)[number], number>> & {
  cut?: boolean;
  edge?: PortDef['edge'];
  shape?: PortShape;
};

/**
 * A model of a family that shares one outline (XIAO, Feather): what differs
 * from the entry. The placement picks one; `resolveVariant` applies it.
 */
export interface BoardVariant {
  id: string;
  /** proper noun, never translated */
  name: string;
  /** port id → the fields that differ */
  ports: Record<string, PortOverride>;
  /** ports only this variant has */
  add: PortDef[];
  /** ports this variant lacks */
  remove: string[];
  topHeight?: number;
  bottomHeight?: number;
}

export interface BoardDef {
  id: string;
  /** proper noun, never translated; aliases after a slash */
  name: string;
  vendor: string;
  /** a battery holder is screwed down like a board; a battery is placed by its spec (boards/battery.ts) */
  kind: 'sbc' | 'mcu' | 'holder' | 'battery';
  size: { w: number; d: number; t: number };
  /** the PCB's real outline when it is not the rectangle: a simple polygon inside `size`, counter-clockwise */
  outline?: [number, number][];
  mount: {
    kind: MountKind;
    holes: Hole[];
    /** default screw for the standoffs */
    screw: ScrewSize;
    /** rails only: along the long or the short edges */
    rails: 'long' | 'short';
  };
  /** tallest part above the PCB — sizes the case height */
  topHeight: number;
  /** tallest part below the PCB, pins left out — the lowest the bare board may sit (bottom ports count too) */
  bottomHeight: number;
  /** header rows that may carry pins below the board */
  pins?: BoardPins;
  ports: PortDef[];
  /** models of the family, the first is the default */
  variants?: BoardVariant[];
  source: string;
  /** dimensions checked against the official drawing */
  verified: boolean;
  /** a battery placed like a board (boards/battery.ts): never in the catalog */
  battery?: BatterySpec;
}

export const BOARD_MAX_MM = 300;
export const MAX_PORTS = 40;
export const MAX_HOLES = 8;
export const MAX_VARIANTS = 16;
export const MAX_OUTLINE = 64;

function rec(x: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof x === 'object' && x !== null && !Array.isArray(x)) for (const [k, v] of Object.entries(x)) out[k] = v;
  return out;
}

function num(x: unknown, min: number, max: number, fallback: number): number {
  const value = typeof x === 'number' && Number.isFinite(x) ? x : fallback;
  // + 0 turns -0 into 0: JSON would, and the sanitizer must be idempotent through a file
  return Math.min(max, Math.max(min, value)) + 0;
}

function str(x: unknown, fallback: string, max = 80): string {
  return typeof x === 'string' && x.trim() ? x.trim().slice(0, max) : fallback;
}

function isEdge(value: unknown): value is Edge {
  return typeof value === 'string' && EDGES.some((edge) => edge === value);
}

/** A port: defaults from its type, clamped to the board. Null when it cannot be a port at all. */
export function sanitizePort(raw: unknown, size: { w: number; d: number }, index: number): PortDef | null {
  const r = rec(raw);
  const type = isPortType(r.type) ? r.type : 'generic';
  const base: PortType = PORT_TYPES[type];
  const shape: PortShape = r.shape === 'rect' || r.shape === 'round' ? r.shape : base.shape;
  // a round element may give its diameter as `d` alone (an LED: "d": 1.5)
  const round = shape === 'round';
  const w = num(r.w ?? (round ? r.d : undefined), 0.5, BOARD_MAX_MM, base.w);
  const h = num(r.h ?? (round ? w : undefined), 0.2, 100, round ? w : base.h);
  const cutH = typeof r.cutH === 'number' ? r.cutH : base.cutH;
  const common = {
    id: str(r.id, `${type}-${index}`, 40),
    type,
    w,
    h,
    d: num(round ? w : r.d, 0.2, BOARD_MAX_MM, round ? w : base.d),
    clearance: num(r.clearance, 0, 10, base.clearance),
    shape,
    cut: typeof r.cut === 'boolean' ? r.cut : base.cut,
    ...(cutH !== undefined ? { cutH: num(cutH, 0.2, h, h) } : {}),
  };
  const edge = r.edge;
  if (isEdge(edge)) {
    const length = edge === 'front' || edge === 'back' ? size.w : size.d;
    return {
      ...common,
      edge,
      along: num(r.along, 0, length, length / 2),
      z: num(r.z, -50, 100, 0),
      protrude: num(r.protrude, -20, 30, 0),
    };
  }
  if (edge === 'top' || edge === 'bottom' || (edge === undefined && base.top)) {
    return {
      ...common,
      edge: edge === 'bottom' ? 'bottom' : 'top',
      x: num(r.x, 0, size.w, size.w / 2),
      y: num(r.y, 0, size.d, size.d / 2),
    };
  }
  return null;
}

function withPins(pins: BoardPins | undefined): { pins?: BoardPins } {
  return pins ? { pins } : {};
}

/** Header rows of an entry; none without a valid edge. */
export function sanitizePins(raw: unknown): BoardPins | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const r = rec(raw);
  const edges = EDGES.filter((edge) => Array.isArray(r.edges) && r.edges.includes(edge));
  if (edges.length === 0) return undefined;
  return {
    below: num(r.below, 0.5, 30, 8.5),
    edges,
    inset: num(r.inset, 0.8, 10, 1.27),
    soldered: r.soldered === true,
  };
}

function isPortEdge(value: unknown): value is PortDef['edge'] {
  return value === 'top' || value === 'bottom' || isEdge(value);
}

/** The fields of one override that exist and have the right type. */
function sanitizeOverride(raw: unknown): PortOverride {
  const r = rec(raw);
  const out: PortOverride = {};
  for (const key of OVERRIDE_NUMBERS) {
    const value = r[key];
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
  }
  if (typeof r.cut === 'boolean') out.cut = r.cut;
  if (isPortEdge(r.edge)) out.edge = r.edge;
  if (r.shape === 'rect' || r.shape === 'round') out.shape = r.shape;
  return out;
}

/** A port list with unique ids: the per-port cut toggles are keyed by them. */
function uniquePorts(items: readonly unknown[], size: { w: number; d: number }, taken: ReadonlySet<string> = new Set()): PortDef[] {
  const ports: PortDef[] = [];
  const ids = new Set(taken);
  for (const [index, item] of items.slice(0, MAX_PORTS).entries()) {
    const port = sanitizePort(item, size, index);
    if (!port) continue;
    let id = port.id;
    for (let n = 2; ids.has(id); n++) id = `${port.id}-${n}`;
    ids.add(id);
    ports.push({ ...port, id });
  }
  return ports;
}

/** Variants of an entry: overrides only for its ports, unique ids; none when the list is empty. */
export function sanitizeVariants(raw: unknown, size: { w: number; d: number }, ports: readonly PortDef[]): BoardVariant[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const portIds = new Set(ports.map((port) => port.id));
  const out: BoardVariant[] = [];
  const ids = new Set<string>();
  for (const [index, item] of raw.slice(0, MAX_VARIANTS).entries()) {
    const r = rec(item);
    let id = str(r.id, `variant-${index + 1}`, 40);
    for (let n = 2; ids.has(id); n++) id = `${str(r.id, `variant-${index + 1}`, 40)}-${n}`;
    ids.add(id);
    const overrides: Record<string, PortOverride> = {};
    for (const [portId, value] of Object.entries(rec(r.ports))) {
      if (portIds.has(portId)) overrides[portId] = sanitizeOverride(value);
    }
    out.push({
      id,
      name: str(r.name, id),
      ports: overrides,
      add: uniquePorts(Array.isArray(r.add) ? r.add : [], size, portIds),
      remove: Array.isArray(r.remove) ? [...portIds].filter((portId) => Array.isArray(r.remove) && r.remove.includes(portId)) : [],
      ...(typeof r.topHeight === 'number' ? { topHeight: num(r.topHeight, 0, 100, 10) } : {}),
      ...(typeof r.bottomHeight === 'number' ? { bottomHeight: num(r.bottomHeight, 0, 30, 2) } : {}),
    });
  }
  return out.length > 0 ? out : undefined;
}

/**
 * The entry as one variant of it is built: its overrides applied to the
 * ports, its ports added and removed, its heights. Without variants, or for
 * an unknown id, the first variant (or the entry itself).
 */
export function resolveVariant(def: BoardDef, variantId: string | undefined): BoardDef {
  const variant = def.variants?.find((item) => item.id === variantId) ?? def.variants?.[0];
  if (!variant) return def;
  const ports = def.ports.filter((port) => !variant.remove.includes(port.id)).map((port) => {
    const override = variant.ports[port.id];
    if (!override) return port;
    const merged = sanitizePort({ ...port, ...override }, def.size, 0);
    return merged ? { ...merged, id: port.id } : port;
  });
  return {
    ...def,
    topHeight: variant.topHeight ?? def.topHeight,
    bottomHeight: variant.bottomHeight ?? def.bottomHeight,
    ports: [...ports, ...variant.add],
  };
}

/** Twice the signed area of a polygon: positive when counter-clockwise. */
export function signedArea2(points: readonly (readonly [number, number])[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    sum += x0 * y1 - x1 * y0;
  }
  return sum;
}

function segmentsCross(a: readonly [number, number], b: readonly [number, number], c: readonly [number, number], d: readonly [number, number]): boolean {
  const side = (p: readonly [number, number], q: readonly [number, number], r: readonly [number, number]): number =>
    Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}

/** Whether a point is inside a polygon (even-odd). */
export function insidePolygon(points: readonly (readonly [number, number])[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Whether two edges of a polygon cross (neighbours share a vertex and do not count). */
export function selfCrossing(points: readonly (readonly [number, number])[]): boolean {
  const n = points.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segmentsCross(points[i], points[(i + 1) % n], points[j], points[(j + 1) % n])) return true;
    }
  }
  return false;
}

/**
 * An outline clamped into the rectangle, counter-clockwise; none when it is
 * not a polygon at all or its edges cross (the ghost would not triangulate).
 */
export function sanitizeOutline(raw: unknown, size: { w: number; d: number }): [number, number][] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const points: [number, number][] = [];
  for (const item of raw.slice(0, MAX_OUTLINE)) {
    if (!Array.isArray(item) || typeof item[0] !== 'number' || typeof item[1] !== 'number') continue;
    points.push([num(item[0], 0, size.w, 0), num(item[1], 0, size.d, 0)]);
  }
  if (points.length < 3 || selfCrossing(points)) return undefined;
  const area = signedArea2(points);
  if (Math.abs(area) < 1e-6) return undefined;
  return area > 0 ? points : points.reverse();
}

export function sanitizeBoard(raw: unknown, fallbackId = 'custom'): BoardDef {
  const r = rec(raw);
  const size = rec(r.size);
  const mount = rec(r.mount);
  const w = num(size.w, 5, BOARD_MAX_MM, 50);
  const d = num(size.d, 5, BOARD_MAX_MM, 30);
  const holes: Hole[] = [];
  for (const item of Array.isArray(mount.holes) ? mount.holes.slice(0, MAX_HOLES) : []) {
    const hole = rec(item);
    holes.push({ x: num(hole.x, 0, w, w / 2), y: num(hole.y, 0, d, d / 2), d: num(hole.d, 1, 8, 2.7) });
  }
  const kind: MountKind = mount.kind === 'rails' || holes.length === 0 ? 'rails' : 'holes';
  const ports = uniquePorts(Array.isArray(r.ports) ? r.ports : [], { w, d });
  const outline = sanitizeOutline(r.outline, { w, d });
  const variants = sanitizeVariants(r.variants, { w, d }, ports);
  return {
    id: str(r.id, fallbackId, 60),
    name: str(r.name, 'Custom board'),
    vendor: str(r.vendor, ''),
    kind: r.kind === 'sbc' || r.kind === 'holder' ? r.kind : 'mcu',
    size: { w, d, t: num(size.t, 0.4, 5, 1.6) },
    ...(outline ? { outline } : {}),
    mount: {
      kind,
      holes: kind === 'holes' ? holes : [],
      screw: isScrewSize(mount.screw) ? mount.screw : 'M2.5',
      rails: mount.rails === 'short' ? 'short' : 'long',
    },
    topHeight: num(r.topHeight, 0, 100, 10),
    bottomHeight: num(r.bottomHeight, 0, 30, 2),
    ...withPins(sanitizePins(r.pins)),
    ports,
    ...(variants ? { variants } : {}),
    source: typeof r.source === 'string' ? r.source.slice(0, 300) : '',
    verified: r.verified === true,
  };
}
