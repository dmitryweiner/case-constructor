// Boards are data, not code: every catalog entry is a JSON file checked by
// this type and its sanitizer; adding a board touches no .ts file except the
// catalog index. A custom board from the editor travels in the state and
// goes through the same sanitizer.
//
// Board frame (PLAN.md §0.4): origin at the lower-left corner of the vendor's
// top view, x to the right, y up (away from the viewer). Edges: front
// (y = 0), back (y = d), left (x = 0), right (x = w).

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
  'header-2x20': { w: 51, h: 8.5, d: 5, clearance: 0.6, shape: 'rect', cut: true, top: true },
  'header-1xN': { w: 25.4, h: 8.5, d: 2.5, clearance: 0.6, shape: 'rect', cut: false, top: true },
  'display': { w: 30, h: 3, d: 15, clearance: 0.3, shape: 'rect', cut: true, top: true },
  'button': { w: 3.5, h: 1.5, d: 3.5, clearance: 0.6, shape: 'round', cut: true, top: true },
  'led': { w: 1.6, h: 0.8, d: 1.6, clearance: 0.5, shape: 'round', cut: true, top: true },
  'fpc': { w: 22, h: 3, d: 3, clearance: 1, shape: 'rect', cut: true, top: true },
  'antenna': { w: 3, h: 1.3, d: 3, clearance: 0.5, shape: 'rect', cut: false, top: true },
  'generic': { w: 5, h: 3, d: 5, clearance: 0.5, shape: 'rect', cut: false, top: true },
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

/** An element on the top face: a rectangle (or circle) centred at (x, y), h above the PCB. */
export interface TopPort extends PortCommon {
  edge: 'top';
  x: number;
  y: number;
}

export type PortDef = EdgePort | TopPort;

export const MOUNT_KINDS = ['holes', 'rails'] as const;
export type MountKind = (typeof MOUNT_KINDS)[number];

export interface Hole {
  x: number;
  y: number;
  d: number;
}

export interface BoardDef {
  id: string;
  /** proper noun, never translated; aliases after a slash */
  name: string;
  vendor: string;
  kind: 'sbc' | 'mcu';
  size: { w: number; d: number; t: number };
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
  /** tallest part below the PCB — the lowest the board may sit */
  bottomHeight: number;
  ports: PortDef[];
  source: string;
  /** dimensions checked against the official drawing */
  verified: boolean;
}

export const BOARD_MAX_MM = 300;
export const MAX_PORTS = 40;
export const MAX_HOLES = 8;

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
  const common = {
    id: str(r.id, `${type}-${index}`, 40),
    type,
    w,
    h: num(r.h ?? (round ? w : undefined), 0.2, 100, round ? w : base.h),
    d: num(round ? w : r.d, 0.2, BOARD_MAX_MM, round ? w : base.d),
    clearance: num(r.clearance, 0, 10, base.clearance),
    shape,
    cut: typeof r.cut === 'boolean' ? r.cut : base.cut,
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
  if (edge === 'top' || (edge === undefined && base.top)) {
    return {
      ...common,
      edge: 'top',
      x: num(r.x, 0, size.w, size.w / 2),
      y: num(r.y, 0, size.d, size.d / 2),
    };
  }
  return null;
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
  const ports: PortDef[] = [];
  const ids = new Set<string>();
  for (const [index, item] of (Array.isArray(r.ports) ? r.ports.slice(0, MAX_PORTS) : []).entries()) {
    const port = sanitizePort(item, { w, d }, index);
    if (!port) continue;
    // ids are keys of the per-port cut toggles: they must be unique
    let id = port.id;
    for (let n = 2; ids.has(id); n++) id = `${port.id}-${n}`;
    ids.add(id);
    ports.push({ ...port, id });
  }
  return {
    id: str(r.id, fallbackId, 60),
    name: str(r.name, 'Custom board'),
    vendor: str(r.vendor, ''),
    kind: r.kind === 'sbc' ? 'sbc' : 'mcu',
    size: { w, d, t: num(size.t, 0.4, 5, 1.6) },
    mount: {
      kind,
      holes: kind === 'holes' ? holes : [],
      screw: isScrewSize(mount.screw) ? mount.screw : 'M2.5',
      rails: mount.rails === 'short' ? 'short' : 'long',
    },
    topHeight: num(r.topHeight, 0, 100, 10),
    bottomHeight: num(r.bottomHeight, 0, 30, 2),
    ports,
    source: typeof r.source === 'string' ? r.source.slice(0, 300) : '',
    verified: r.verified === true,
  };
}
