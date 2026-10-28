// The hinge of a hinged case: where its axis is and how the upper half
// turns about it. Pure: the main thread poses the halves with it, the worker
// builds the knuckles along it.
//
// Each half is a box in its own case frame. The hinge runs along x: on the
// lower half's back edge (y = d) and on the upper half's front edge (y = 0),
// so that laid open flat the upper half lies behind the lower one, both
// inner faces (their tops) up and both frames pointing the same way. Closed,
// the upper half lies on the lower one upside down, its inner face `gap`
// above the lower one's. The axis lies in that gap, behind the hinge walls by
// the barrel's radius and a clearance: the other half's edge then clears a
// barrel all the way round. (plans/PLAN-HINGED.md, "How it folds".)
//
// The knuckles (H3): along the edge in blocks, each a barrel tied to its
// half's hinge wall by a web, a pin through each block.

import type { Affine } from './surface';
import { composeAffine, translation } from './surface';
import { clampNum } from './shape';
import { NUT_CLEARANCE, SCREWS, THROUGH_CLEARANCE } from './fasteners';

/** What the hinge is: knuckles printed with the halves. */
export const HINGE_KINDS = ['knuckles'] as const;
export type HingeKind = (typeof HINGE_KINDS)[number];
/**
 * What the knuckles turn on: a pin through them (a filament, a rod, a nail),
 * a screw with its head and its nut sunk in the block's end knuckles —
 * tightened, it holds the angle — or nothing bought: a snap, the lower
 * half's knuckles joined by a printed bar on the axis and the upper half's
 * knuckles split rings that click onto it.
 */
export const AXLES = ['pin', 'screw', 'snap'] as const;
export type Axle = (typeof AXLES)[number];
export const HINGE_SCREWS = ['M2', 'M2.5', 'M3'] as const;
export type HingeScrew = (typeof HINGE_SCREWS)[number];
/** Two blocks of knuckles near the ends, or one along the whole edge. */
export const HINGE_LAYOUTS = ['ends', 'full'] as const;
export type HingeLayout = (typeof HINGE_LAYOUTS)[number];
/** Knuckles per block: odd, so a block starts and ends on the lower half. */
export const KNUCKLE_COUNTS = [3, 5, 7] as const;

export interface HingeSpec {
  kind: HingeKind;
  axle: Axle;
  layout: HingeLayout;
  /** the knuckles' outer diameter, mm */
  barrelD: number;
  /** knuckles per block */
  knuckles: number;
  /** one knuckle's length along the hinge, mm (two blocks; one block fills the edge) */
  length: number;
  /** between neighbouring knuckles, and between a barrel and the other half's wall, mm */
  clearance: number;
  /** the pin's diameter (a 1.75 mm filament by default) and what its hole adds to it, mm */
  pinD: number;
  pinFit: number;
  /** the screw of a screw axle */
  screw: HingeScrew;
}

export const BARREL_D_MIN = 5;
export const BARREL_D_MAX = 16;
export const KNUCKLE_LENGTH_MIN = 4;
export const KNUCKLE_LENGTH_MAX = 40;
export const PIN_D_MIN = 1;
export const PIN_D_MAX = 5;
/** The view's angle by default: a laptop's screen, open. */
export const ANGLE_DEFAULT = 110;
/** The knuckles stay this far inside the straight part of the hinge edge, mm. */
export const KNUCKLE_EDGE = 1;
/** Two blocks closer than this become one, mm. */
export const BLOCKS_APART = 10;
/** A knuckle's web keeps this far off the wall where the lid is: the lid lifts past it, mm. */
export const KNUCKLE_LID_GAP = 0.2;
/** The web stops this far short of the parting plane, mm. */
export const KNUCKLE_PART_GAP = 0.5;
/** How deep the web sinks into its wall, mm. */
export const KNUCKLE_SINK = 0.6;
/** The barrel's wall around the pin's hole, at least, mm. */
export const BARREL_WALL = 1.2;
/** The barrel's wall around a screw's head seat and nut pocket, at least, mm. */
export const SCREW_BARREL_WALL = 1;
/** A screw's head seat: its diameter plus this, and its depth plus this, mm. */
export const HEAD_SEAT_FIT = 0.4;
/** A snap: the split ring's wall, mm — thin enough to spring open over the bar. */
export const SNAP_RING = 1.4;
/** A snap: between the bar and its ring, mm. */
export const SNAP_FIT = 0.2;
/** A snap: how much narrower than the bar the ring's slit is, a share of the bar's diameter. */
export const SNAP_GRIP = 0.15;
/** A snap: the thinnest bar, radius, mm. */
export const SNAP_BAR_MIN = 1.2;

export function defaultHingeSpec(): HingeSpec {
  return { kind: 'knuckles', axle: 'pin', layout: 'ends', barrelD: 8, knuckles: 3, length: 10, clearance: 0.4, pinD: 1.75, pinFit: 0.15, screw: 'M2.5' };
}

function oneOf<T extends string | number>(list: readonly T[], value: unknown, fallback: T): T {
  return list.find((item) => item === value) ?? fallback;
}

/** The holes an axle needs along a block: through every knuckle, and for a screw its head's seat and its nut's pocket. */
export interface AxleHoles {
  /** the hole through every knuckle */
  r: number;
  /** a screw's head seat in the block's first knuckle, and its nut's pocket (across flats) in the last */
  screw: { headR: number; headDepth: number; nutAF: number; nutDepth: number } | null;
  /**
   * a snap: the lower half's bar on the axis between its knuckles, the upper
   * half's ring around it, and the ring's slit, outwards from its wall
   */
  snap: { barR: number; ringR: number; slit: number } | null;
}

export function axleHoles(spec: Pick<HingeSpec, 'axle' | 'pinD' | 'pinFit' | 'screw' | 'barrelD'>): AxleHoles {
  if (spec.axle === 'pin') return { r: spec.pinD / 2 + spec.pinFit, screw: null, snap: null };
  if (spec.axle === 'snap') {
    const barR = Math.max(SNAP_BAR_MIN, spec.barrelD / 2 - SNAP_RING - SNAP_FIT);
    return { r: 0, screw: null, snap: { barR, ringR: barR + SNAP_FIT, slit: 2 * barR * (1 - SNAP_GRIP) } };
  }
  const dims = SCREWS[spec.screw];
  return {
    r: (dims.d + THROUGH_CLEARANCE) / 2,
    screw: {
      headR: (dims.headD + HEAD_SEAT_FIT) / 2,
      headDepth: dims.headH + HEAD_SEAT_FIT,
      nutAF: dims.nutAF + NUT_CLEARANCE,
      nutDepth: dims.nutH + NUT_CLEARANCE,
    },
    snap: null,
  };
}

/** The thinnest barrel that holds the axle's holes with a wall around them. */
export function barrelMin(spec: Pick<HingeSpec, 'axle' | 'pinD' | 'pinFit' | 'screw'>): number {
  if (spec.axle === 'snap') return 2 * (SNAP_BAR_MIN + SNAP_FIT + SNAP_RING);
  const holes = axleHoles({ ...spec, barrelD: 0 });
  if (!holes.screw) return 2 * holes.r + 2 * BARREL_WALL;
  // a hex nut's corners are its flats over cos 30°
  return Math.max(2 * holes.screw.headR, holes.screw.nutAF / Math.cos(Math.PI / 6)) + 2 * SCREW_BARREL_WALL;
}

/** The spec's fields of a raw object, sane; the barrel always holds its axle's holes with a wall around them. */
export function sanitizeHingeSpec(raw: unknown): HingeSpec {
  const d = defaultHingeSpec();
  const r = typeof raw === 'object' && raw !== null ? raw : {};
  const axle = {
    axle: oneOf(AXLES, Reflect.get(r, 'axle'), d.axle),
    pinD: clampNum(Reflect.get(r, 'pinD'), PIN_D_MIN, PIN_D_MAX, d.pinD),
    pinFit: clampNum(Reflect.get(r, 'pinFit'), 0, 0.5, d.pinFit),
    screw: oneOf(HINGE_SCREWS, Reflect.get(r, 'screw'), d.screw),
  };
  const barrelD = clampNum(Reflect.get(r, 'barrelD'), BARREL_D_MIN, BARREL_D_MAX, d.barrelD);
  return {
    kind: oneOf(HINGE_KINDS, Reflect.get(r, 'kind'), d.kind),
    layout: oneOf(HINGE_LAYOUTS, Reflect.get(r, 'layout'), d.layout),
    // + 0: never -0 (JSON would make it 0, and the sanitizer must be idempotent through a file)
    barrelD: Math.min(BARREL_D_MAX, Math.max(barrelD, Math.ceil(barrelMin(axle) * 2) / 2)) + 0,
    knuckles: oneOf(KNUCKLE_COUNTS, Reflect.get(r, 'knuckles'), 3),
    length: clampNum(Reflect.get(r, 'length'), KNUCKLE_LENGTH_MIN, KNUCKLE_LENGTH_MAX, d.length),
    clearance: clampNum(Reflect.get(r, 'clearance'), 0.2, 1, d.clearance),
    ...axle,
  };
}

/** A screw axle's screws: one per block, as long as the block less its head's seat (the nearest shorter will do). */
export function hingeScrews(spec: HingeSpec, blocks: readonly { x0: number; x1: number }[]): { count: number; length: number } | null {
  const holes = axleHoles(spec);
  if (!holes.screw || blocks.length === 0) return null;
  const length = Math.min(...blocks.map((block) => block.x1 - block.x0)) - holes.screw.headDepth;
  return { count: blocks.length, length: Math.floor(length) };
}

export interface Fold {
  /** the axis in the lower half's frame (parallel to x) */
  y: number;
  z: number;
  /** the axis in the upper half's frame */
  yB: number;
  zB: number;
}

/** How far the axis lies behind the hinge walls: the barrel and a clearance. */
export function axisOffset(spec: Pick<HingeSpec, 'barrelD' | 'clearance'>): number {
  return spec.barrelD / 2 + spec.clearance;
}

/**
 * The axis's height over the lower half's inner face (the rest of the gap
 * is the upper half's side). A half whose lid is on its bottom prints on its
 * inner face (its body opening up), so its barrels must not stand out of
 * that face: the axis goes a radius under it, and the other half's barrels
 * take the whole gap and both radii. Both lids on the bottom leave no way to
 * print knuckles with the halves (`printable` false; split in the middle).
 */
export function axisSplit(
  spec: Pick<HingeSpec, 'barrelD'>, gap: number, lidA: string, lidB: string,
): { zA: number; printable: boolean } {
  const r = spec.barrelD / 2;
  if (lidA === 'bottom' && lidB === 'bottom') return { zA: gap / 2, printable: false };
  if (lidA === 'bottom') return { zA: -r, printable: true };
  if (lidB === 'bottom') return { zA: gap + r, printable: true };
  return { zA: gap / 2, printable: true };
}

/**
 * The axis of two halves of depth `d`, heights `hA` and `hB`, closed with
 * `gap` between their inner faces, the axis `zA` over the lower one's.
 */
export function foldOf(spec: Pick<HingeSpec, 'barrelD' | 'clearance'>, d: number, hA: number, hB: number, gap: number, zA = gap / 2): Fold {
  const e = axisOffset(spec);
  return { y: d + e, z: hA + zA, yB: -e, zB: hB + gap - zA };
}

/** One knuckle along the hinge: x in either half's frame (they share it), and whose it is. */
export interface KnuckleRun {
  x0: number;
  x1: number;
  half: 'a' | 'b';
}

/**
 * The knuckles along an edge `w` long whose straight part starts `cornerR`
 * in from each end: blocks of `knuckles` alternating lower, upper, lower…,
 * two near the ends (or one in the middle when two do not fit apart), or one
 * filling the edge. Each block has its own pin.
 */
export function knuckleRuns(spec: HingeSpec, w: number, cornerR: number): { blocks: { x0: number; x1: number }[]; runs: KnuckleRun[] } {
  const lo = cornerR + KNUCKLE_EDGE;
  const hi = w - cornerR - KNUCKLE_EDGE;
  const n = spec.knuckles;
  const g = spec.clearance;
  const span = hi - lo;
  const fill = (span - (n - 1) * g) / n;
  if (fill <= 0) return { blocks: [], runs: [] };
  let length = Math.min(spec.length, fill);
  let starts: number[];
  const blockLen = (one: number): number => n * one + (n - 1) * g;
  if (spec.layout === 'full') {
    length = fill;
    starts = [lo];
  } else if (2 * blockLen(length) + BLOCKS_APART <= span) {
    starts = [lo, hi - blockLen(length)];
  } else {
    starts = [(lo + hi - blockLen(length)) / 2];
  }
  const blocks = starts.map((x0) => ({ x0, x1: x0 + blockLen(length) }));
  const runs = starts.flatMap((x0) => Array.from({ length: n }, (_, i): KnuckleRun => ({
    x0: x0 + i * (length + g),
    x1: x0 + i * (length + g) + length,
    half: i % 2 === 0 ? 'a' : 'b',
  })));
  return { blocks, runs };
}

/**
 * Where a knuckle's web holds on to its half's hinge wall, the half's z:
 * on the flat of the wall (clear of the edge fillets), on the body's side of
 * the parting plane, and low enough under the barrel that its underside
 * leans at 45° at most (the body prints opening up). Null when the body has
 * no wall there to hold on to.
 */
export function knuckleStrip(input: {
  h: number; edgeR: number; zAxis: number; r: number; e: number; body: readonly [number, number];
}): [number, number] | null {
  const { h, edgeR, zAxis, r, e, body } = input;
  const z0 = Math.max(body[0] + KNUCKLE_PART_GAP, edgeR, zAxis - e - Math.SQRT2 * r);
  const z1 = Math.min(body[1] - KNUCKLE_PART_GAP, h - edgeR, zAxis + r);
  return z1 - z0 > 1 ? [z0, z1] : null;
}

/** Rotation by `deg` about the line parallel to x through (y, z). */
function turnAboutX(y: number, z: number, deg: number): Affine {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const turn: Affine = [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0];
  return composeAffine(translation(0, y, z), composeAffine(turn, translation(0, -y, -z)));
}

/**
 * The upper half's frame → the lower half's, open by `angle`: 180° lies open
 * flat behind the lower half, 0° is closed on top of it.
 */
export function upperPose(fold: Fold, angle: number): Affine {
  const flat = translation(0, fold.y - fold.yB, fold.z - fold.zB);
  return composeAffine(turnAboutX(fold.y, fold.z, 180 - angle), flat);
}

/** What a half's build adds for the hinge (`state/hinged.ts`, `halfHinge`), in the half's frame. */
export interface HalfHinge {
  /** the hinge wall: the lower half's back, the upper half's front */
  wall: 'back' | 'front';
  /** the barrel's radius, and how far the axis lies behind the wall */
  r: number;
  e: number;
  /** the axis's height */
  zAxis: number;
  /** this half's knuckles */
  runs: { x0: number; x1: number }[];
  /** every block, for its axle's holes */
  blocks: { x0: number; x1: number }[];
  holes: AxleHoles;
}

/**
 * The z range of a half's hinge wall that belongs to its body: under a top
 * lid's parting plane, or over a bottom lid's (`plate + depth` from that
 * face, the lid's effective depth).
 */
export function bodyRange(h: number, lidFace: string, plate: number, depth: number): [number, number] {
  return lidFace === 'top' ? [0, h - plate - depth] : [plate + depth, h];
}

