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
import type { HoleKind, MagnetSize } from './fasteners';
import { BOSS_WALL, HOLE_KINDS, MAGNETS, MAGNET_SIZES, NUT_CLEARANCE, SCREWS, THROUGH_CLEARANCE, bossDiameter } from './fasteners';
import type { CutterSpec } from './cutters';
import { extraCutters } from './cutters';
import type { Dims } from './face';
import type { ShapeState } from './shape';

/**
 * What the hinge is: knuckles printed with the halves, or a separate printed
 * hinge — two leaves with the knuckles between them — screwed onto the
 * hinge walls (any lid on any side; replaceable).
 */
export const HINGE_KINDS = ['knuckles', 'leaves'] as const;
export type HingeKind = (typeof HINGE_KINDS)[number];
/**
 * What the knuckles turn on: a pin through them (a filament, a rod, a nail),
 * a screw with its head and its nut sunk in the block's end knuckles —
 * tightened, it holds the angle — or nothing bought: a snap, the lower
 * half's knuckles joined by a printed bar on the axis and the upper half's
 * knuckles split rings that click onto it.
 */
export const AXLES = ['pin', 'screw', 'snap', 'cones'] as const;
export type Axle = (typeof AXLES)[number];

/**
 * Where the knuckles are: along the back edge, or as pivots on the side
 * walls at the back corners (the axis along the back edge either way; the
 * back wall stays free).
 */
export const HINGE_PLACES = ['back', 'sides'] as const;
export type HingePlace = (typeof HINGE_PLACES)[number];

/**
 * The axles a hinge takes: cones only print in place, the leaves together,
 * and only on the back — a side pivot's cheeks lie one over the other.
 */
export function axlesFor(kind: HingeKind, place: HingePlace = 'back'): readonly Axle[] {
  return kind === 'leaves' && place === 'back' ? AXLES : ['pin', 'screw', 'snap'];
}
export const HINGE_SCREWS = ['M2', 'M2.5', 'M3'] as const;
export type HingeScrew = (typeof HINGE_SCREWS)[number];
/** Two blocks of knuckles near the ends, or one along the whole edge. */
export const HINGE_LAYOUTS = ['ends', 'full'] as const;
export type HingeLayout = (typeof HINGE_LAYOUTS)[number];
/** Knuckles per block: odd, so a block starts and ends on the lower half. */
export const KNUCKLE_COUNTS = [3, 5, 7] as const;

/** A cable from one half to the other: flat (an FFC, an IDC ribbon) or round (a bundle, a USB cable). */
export const CABLE_KINDS = ['flat', 'round'] as const;
export type CableKind = (typeof CABLE_KINDS)[number];
/** Where a cable leaves each half: through its hinge wall, or through its inner face next to the hinge edge. */
export const CABLE_THROUGH = ['wall', 'face'] as const;
export type CableThrough = (typeof CABLE_THROUGH)[number];

export interface Cable {
  /** its middle along the hinge, x in either half's frame */
  x: number;
  kind: CableKind;
  through: CableThrough;
  /** a flat cable's width and thickness; a round one's diameter is `w` */
  w: number;
  t: number;
  /** a plug that has to pass through the slot, 0 = none */
  plugW: number;
  plugH: number;
}

export const MAX_CABLES = 4;
export const CABLE_W_MAX = 60;
export const PLUG_MAX = 40;
/** A cable's slot: the cable plus this on every side, mm. */
export const CABLE_FIT = 0.5;
/** The slot's top this far under the inner face's plate, mm. */
export const CABLE_TOP_GAP = 0.5;
/** The knuckles keep this far off a cable's slot, mm. */
export const CABLE_KEEP = 1;

export function defaultCable(x = 50): Cable {
  return { x, kind: 'flat', through: 'wall', w: 16, t: 0.3, plugW: 0, plugH: 0 };
}

export function sanitizeCables(raw: unknown): Cable[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_CABLES).map((item): Cable => {
    const r = typeof item === 'object' && item !== null ? item : {};
    const d = defaultCable();
    return {
      x: clampNum(Reflect.get(r, 'x'), 0, 400, d.x),
      kind: oneOf(CABLE_KINDS, Reflect.get(r, 'kind'), d.kind),
      through: oneOf(CABLE_THROUGH, Reflect.get(r, 'through'), d.through),
      w: clampNum(Reflect.get(r, 'w'), 1, CABLE_W_MAX, d.w),
      t: clampNum(Reflect.get(r, 't'), 0.1, 5, d.t),
      plugW: clampNum(Reflect.get(r, 'plugW'), 0, PLUG_MAX, d.plugW),
      plugH: clampNum(Reflect.get(r, 'plugH'), 0, PLUG_MAX, d.plugH),
    };
  });
}

/** A cable's slot through a hinge wall: the cable (or its plug, whichever is larger) and the fit, mm. */
export function cableSlot(cable: Cable): { w: number; h: number } {
  const w = cable.w + 2 * CABLE_FIT;
  const h = (cable.kind === 'round' ? cable.w : cable.t) + 2 * CABLE_FIT;
  return { w: Math.max(w, cable.plugW + 2 * CABLE_FIT), h: Math.max(h, cable.plugH > 0 ? cable.plugH + 2 * CABLE_FIT : 0) };
}

export interface HingeSpec {
  kind: HingeKind;
  place: HingePlace;
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
  cables: Cable[];
  /** a printed hinge's leaves: the screws through them and what they screw into inside the wall */
  leafScrew: HingeScrew;
  leafHole: HoleKind;
  /** the gap between the halves from what stands out of their inner faces, or `gap` as set */
  gapAuto: boolean;
  /** magnets at the front edge, inside: a pair facing each other through the inner faces */
  magnets: boolean;
  magnet: MagnetSize;
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
/** Cones printed in place: between a cone and its socket, square to their faces, mm. */
export const CONE_FIT = 0.35;
/** Cones: how far into the next knuckle a cone reaches past the gap, mm. */
export const CONE_REACH = 1.2;
/** A printed hinge's leaf: its thickness, mm. */
export const LEAF_T = 2.4;
/** A leaf's plate: at least this tall under its knuckles, mm (more for a wide head). */
export const LEAF_PLATE_MIN = 8;
/** A leaf's screws stay this far from the block's ends, at least, mm. */
export const LEAF_SCREW_INSET = 4;

export function defaultHingeSpec(): HingeSpec {
  return {
    kind: 'knuckles', place: 'back', axle: 'pin', layout: 'ends', barrelD: 8, knuckles: 3, length: 10, clearance: 0.4, pinD: 1.75, pinFit: 0.15, screw: 'M2.5', cables: [],
    leafScrew: 'M2.5', leafHole: 'insert', gapAuto: true, magnets: false, magnet: '6x3',
  };
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
  /**
   * cones printed in place: the upper half's knuckles carry a cone (45°) on
   * each end, its base `r` on the knuckle's face, cut `reach` past it; the
   * lower half's knuckles a socket, the same cone grown by `CONE_FIT`
   */
  cones: { r: number; reach: number } | null;
}

export function axleHoles(spec: Pick<HingeSpec, 'axle' | 'pinD' | 'pinFit' | 'screw' | 'barrelD'>): AxleHoles {
  const none = { screw: null, snap: null, cones: null };
  if (spec.axle === 'pin') return { ...none, r: spec.pinD / 2 + spec.pinFit };
  if (spec.axle === 'snap') {
    const barR = Math.max(SNAP_BAR_MIN, spec.barrelD / 2 - SNAP_RING - SNAP_FIT);
    return { ...none, r: 0, snap: { barR, ringR: barR + SNAP_FIT, slit: 2 * barR * (1 - SNAP_GRIP) } };
  }
  if (spec.axle === 'cones') return { ...none, r: 0, cones: { r: spec.barrelD / 2 - BARREL_WALL, reach: CONE_REACH } };
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
    cones: null,
  };
}

/** The thinnest barrel that holds the axle's holes with a wall around them. */
export function barrelMin(spec: Pick<HingeSpec, 'axle' | 'pinD' | 'pinFit' | 'screw'>): number {
  if (spec.axle === 'snap') return 2 * (SNAP_BAR_MIN + SNAP_FIT + SNAP_RING);
  // a cone reaching past the gap, and the socket's wall around it
  if (spec.axle === 'cones') return 2 * (CONE_REACH + 1 + CONE_FIT + BARREL_WALL);
  const holes = axleHoles({ ...spec, barrelD: 0 });
  if (!holes.screw) return 2 * holes.r + 2 * BARREL_WALL;
  // a hex nut's corners are its flats over cos 30°
  return Math.max(2 * holes.screw.headR, holes.screw.nutAF / Math.cos(Math.PI / 6)) + 2 * SCREW_BARREL_WALL;
}

/** The spec's fields of a raw object, sane; the barrel always holds its axle's holes with a wall around them. */
export function sanitizeHingeSpec(raw: unknown): HingeSpec {
  const d = defaultHingeSpec();
  const r = typeof raw === 'object' && raw !== null ? raw : {};
  const kind = oneOf(HINGE_KINDS, Reflect.get(r, 'kind'), d.kind);
  const place = oneOf(HINGE_PLACES, Reflect.get(r, 'place'), d.place);
  const axle = {
    axle: oneOf(axlesFor(kind, place), Reflect.get(r, 'axle'), d.axle),
    pinD: clampNum(Reflect.get(r, 'pinD'), PIN_D_MIN, PIN_D_MAX, d.pinD),
    pinFit: clampNum(Reflect.get(r, 'pinFit'), 0, 0.5, d.pinFit),
    screw: oneOf(HINGE_SCREWS, Reflect.get(r, 'screw'), d.screw),
  };
  const barrelD = clampNum(Reflect.get(r, 'barrelD'), BARREL_D_MIN, BARREL_D_MAX, d.barrelD);
  return {
    kind,
    place,
    layout: oneOf(HINGE_LAYOUTS, Reflect.get(r, 'layout'), d.layout),
    // + 0: never -0 (JSON would make it 0, and the sanitizer must be idempotent through a file)
    barrelD: Math.min(BARREL_D_MAX, Math.max(barrelD, Math.ceil(barrelMin(axle) * 2) / 2)) + 0,
    knuckles: oneOf(KNUCKLE_COUNTS, Reflect.get(r, 'knuckles'), 3),
    length: clampNum(Reflect.get(r, 'length'), KNUCKLE_LENGTH_MIN, KNUCKLE_LENGTH_MAX, d.length),
    clearance: clampNum(Reflect.get(r, 'clearance'), 0.2, 1, d.clearance),
    ...axle,
    cables: sanitizeCables(Reflect.get(r, 'cables')),
    leafScrew: oneOf(HINGE_SCREWS, Reflect.get(r, 'leafScrew'), d.leafScrew),
    leafHole: oneOf(HOLE_KINDS, Reflect.get(r, 'leafHole'), d.leafHole),
    gapAuto: typeof Reflect.get(r, 'gapAuto') === 'boolean' ? Reflect.get(r, 'gapAuto') === true : d.gapAuto,
    magnets: Reflect.get(r, 'magnets') === true,
    magnet: oneOf(MAGNET_SIZES, Reflect.get(r, 'magnet'), d.magnet),
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

/**
 * How far the axis lies behind the hinge walls: the barrel and a clearance —
 * just the clearance with side pivots, nothing of the hinge is behind the walls.
 */
export function axisOffset(spec: Pick<HingeSpec, 'barrelD' | 'clearance'> & { place?: HingePlace }): number {
  return spec.place === 'sides' ? spec.clearance : spec.barrelD / 2 + spec.clearance;
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
  spec: Pick<HingeSpec, 'barrelD' | 'kind'>, gap: number, lidA: string, lidB: string,
): { zA: number; printable: boolean } {
  const r = spec.barrelD / 2;
  // a printed hinge prints on its own: the axis in the gap's middle
  if (spec.kind === 'leaves') return { zA: gap / 2, printable: true };
  if (lidA === 'bottom' && lidB === 'bottom') return { zA: gap / 2, printable: false };
  if (lidA === 'bottom') return { zA: -r, printable: true };
  if (lidB === 'bottom') return { zA: gap + r, printable: true };
  return { zA: gap / 2, printable: true };
}

/**
 * The axis of two halves of depth `d`, heights `hA` and `hB`, closed with
 * `gap` between their inner faces, the axis `zA` over the lower one's.
 */
export function foldOf(spec: Pick<HingeSpec, 'barrelD' | 'clearance'> & { place?: HingePlace }, d: number, hA: number, hB: number, gap: number, zA = gap / 2): Fold {
  const e = axisOffset(spec);
  return { y: d + e, z: hA + zA, yB: -e, zB: hB + gap - zA };
}

/** One knuckle along the hinge: x in either half's frame (they share it), and whose it is. */
export interface KnuckleRun {
  x0: number;
  x1: number;
  half: 'a' | 'b';
}

/** What is left of [lo, hi] once the intervals `out` are taken away, in order. */
function freeSpans(lo: number, hi: number, out: readonly { x0: number; x1: number }[]): { x0: number; x1: number }[] {
  let spans = [{ x0: lo, x1: hi }];
  for (const cut of out) {
    spans = spans.flatMap((span) => [
      ...(cut.x0 > span.x0 ? [{ x0: span.x0, x1: Math.min(span.x1, cut.x0) }] : []),
      ...(cut.x1 < span.x1 ? [{ x0: Math.max(span.x0, cut.x1), x1: span.x1 }] : []),
    ]).filter((span) => span.x1 - span.x0 > 1e-6);
  }
  return spans;
}

/**
 * The knuckles along an edge `w` long whose straight part starts `cornerR`
 * in from each end, clear of the cables' slots (`keepOut`): blocks of
 * `knuckles` alternating lower, upper, lower…, two near the ends (one in the
 * middle when two do not fit apart), or one filling each stretch between the
 * cables. Each block has its own axle.
 */
export function knuckleRuns(
  spec: HingeSpec, w: number, cornerR: number, keepOut: readonly { x0: number; x1: number }[] = [],
): { blocks: { x0: number; x1: number }[]; runs: KnuckleRun[] } {
  const n = spec.knuckles;
  const g = spec.clearance;
  const spans = freeSpans(cornerR + KNUCKLE_EDGE, w - cornerR - KNUCKLE_EDGE, keepOut);
  const blockLen = (one: number): number => n * one + (n - 1) * g;
  const fill = (span: { x0: number; x1: number }): number => (span.x1 - span.x0 - (n - 1) * g) / n;
  let length = spec.length;
  let starts: number[];
  if (spec.layout === 'full') {
    // one block per stretch, its knuckles as long as the stretch allows
    const blocks = spans.filter((span) => fill(span) >= KNUCKLE_LENGTH_MIN / 2);
    const runs = blocks.flatMap((span) => blockRuns(span.x0, fill(span), n, g));
    return { blocks: blocks.map((span) => ({ x0: span.x0, x1: span.x1 })), runs };
  }
  const widest = Math.max(0, ...spans.map(fill));
  if (widest < KNUCKLE_LENGTH_MIN / 2) return { blocks: [], runs: [] };
  length = Math.min(length, widest);
  const fits = spans.filter((span) => span.x1 - span.x0 >= blockLen(length) - 1e-9);
  const first = fits[0];
  const last = fits[fits.length - 1];
  if (first !== last) starts = [first.x0, last.x1 - blockLen(length)];
  else if (2 * blockLen(length) + BLOCKS_APART <= first.x1 - first.x0) starts = [first.x0, first.x1 - blockLen(length)];
  else starts = [(first.x0 + first.x1 - blockLen(length)) / 2];
  return {
    blocks: starts.map((x0) => ({ x0, x1: x0 + blockLen(length) })),
    runs: starts.flatMap((x0) => blockRuns(x0, length, n, g)),
  };
}

function blockRuns(x0: number, length: number, n: number, g: number): KnuckleRun[] {
  return Array.from({ length: n }, (_, i): KnuckleRun => ({
    x0: x0 + i * (length + g),
    x1: x0 + i * (length + g) + length,
    half: i % 2 === 0 ? 'a' : 'b',
  }));
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
  /** this half's knuckles, and the other half's (the cones' sockets face them) */
  runs: { x0: number; x1: number }[];
  others: { x0: number; x1: number }[];
  /** between neighbouring knuckles */
  clearance: number;
  /** every block, for its axle's holes */
  blocks: { x0: number; x1: number }[];
  holes: AxleHoles;
  /** the cables' slots: middle along x, size, and the middle of their outer mouth (on the hinge wall or the inner face) */
  slots: CableSlot[];
  kind: HingeKind;
  /** a printed hinge: this half's leaf (null for knuckles) */
  leaf: LeafLayout | null;
  /** magnets inside, at the edge away from the hinge; null without */
  magnets: MagnetBosses | null;
  place: HingePlace;
  /** side pivots: this half's cheeks (null on the back) */
  pivot: PivotLayout | null;
  /** a printed hinge's screws into the walls */
  leafScrew: { size: HingeScrew; hole: HoleKind };
}

/** A side pivot's cheek: thickness, mm (more when a screw's head or nut sinks in it). */
export const PIVOT_T = 3.5;
/** A cheek's strip on its side wall: how long along y, mm (plus the barrel). */
export const PIVOT_STRIP = 6;

/**
 * A half's cheeks of side pivots, in the half's frame, the same on both
 * sides: q is the distance out from a side wall's outer face. The lower
 * half's cheek lies on its wall (`q0`…`q1`), the upper half's one layer
 * further out on a spacer from its own wall (`spacer`). A cheek is the hull
 * of its disc on the axis and its strip on the wall (y `y0`…`y1`, z `z0`…`z1`,
 * the body's part of the wall's flat); a printed hinge's cheek takes its
 * screws there (`screws`, at `screwY`).
 */
export interface PivotLayout {
  q0: number;
  q1: number;
  spacer: { q0: number; q1: number } | null;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
  screws: { z: number }[];
  screwY: number;
  /** the y range of the strip the cheek itself holds on to (an upper printed cheek's screws are past it, in the spacer) */
  cheekY: [number, number];
  /** both cheeks of a pivot, from the lower one's inner face to the upper one's outer face */
  span: [number, number];
  /** where pads inside the side wall may go (a printed hinge) */
  padZ: [number, number];
}

/**
 * The cheeks of a half (`upper`: the outer layer on a spacer). The upper
 * half's strip keeps the barrel and a clearance off the axis (it turns past
 * the lower half's disc); a printed hinge's cheeks sit on the wall (q from
 * 0), integral ones a hair off it beyond the strip, sunk into it on it.
 */
export function pivotLayout(input: {
  upper: boolean; leaves: boolean; t: number; gap: number; r: number; c: number; e: number; zAxis: number; d: number; cornerR: number;
  body: readonly [number, number]; flat: readonly [number, number]; pads: readonly [number, number]; head: number; padR: number;
}): PivotLayout | null {
  const { upper, leaves, t, gap, r, c, e, zAxis, d, cornerR, head, padR } = input;
  const base = leaves ? 0 : KNUCKLE_LID_GAP;
  const [q0, q1] = upper ? [base + t + gap, base + 2 * t + gap] : [base, base + t];
  // along y in the half's frame: the lower half's hinge edge is its back (y = d), the upper half's its front (y = 0)
  // the upper half's spacer stands in the lower cheek's layer: past the axis's clearance, and past the
  // lower cheek's own strip (closed, that cheek reaches up past the faces to its disc)
  const clear = r + c + 0.5 - e;
  const near = Math.max(cornerR, upper ? Math.max(clear, cornerR + PIVOT_STRIP + 1) : 0);
  const length = PIVOT_STRIP + (leaves && upper ? head + 3 : 0);
  const [y0, y1] = upper ? [near, near + length] : [d - near - length, d - near];
  const z0 = Math.max(input.body[0] + KNUCKLE_PART_GAP, input.flat[0]);
  const z1 = Math.min(input.body[1] - KNUCKLE_PART_GAP, input.flat[1], zAxis + r);
  if (z1 - z0 < (leaves ? head + 2 : 2) || y1 > d - cornerR || y0 < cornerR) return null;
  // a printed hinge's screws: their heads on the cheek, their pads inside clear of the lid's skirt
  const lo = Math.max(z0 + head / 2 + 1, input.pads[0] + padR);
  const hi = Math.min(z1 - head / 2 - 1, input.pads[1] - padR);
  const screws = hi - lo >= head + 2 ? [{ z: lo }, { z: hi }] : hi >= lo ? [{ z: (lo + hi) / 2 }] : [];
  if (leaves && screws.length === 0) return null;
  // an upper cheek's screws go through its spacer only, past the cheek's own strip
  const screwY = upper ? y1 - head / 2 - 1 : (y0 + y1) / 2;
  const cheekY: [number, number] = upper ? [y0, y0 + PIVOT_STRIP] : [y0, y1];
  return {
    q0, q1, spacer: upper ? { q0: leaves ? 0 : -KNUCKLE_SINK, q1: q0 + 0.1 } : null, y0, y1, z0, z1, screws, screwY, cheekY,
    span: [base, base + 2 * t + gap], padZ: [input.pads[0], input.pads[1]],
  };
}

/**
 * A printed hinge's leaf on a half's hinge wall, in the half's frame: a
 * plate `t` thick on the wall's outer face under the knuckles (`z0`…`z1`,
 * the half's side of the axis), each knuckle on a pedestal up to `pedestal`
 * — the axis: past it, turning, it would run into the other half's wall — and the
 * screws through plate and wall at `z`, into a pad inside the wall.
 */
export interface LeafLayout {
  t: number;
  z0: number;
  z1: number;
  pedestal: number;
  screws: { x: number }[];
  z: number;
  screw: HingeScrew;
  hole: HoleKind;
  /** where the pads inside the wall may go: the body's part of it less the lid's skirt */
  padZ: [number, number];
}

/**
 * The leaf of a half whose axis is at `zAxis` (`e` behind the wall): its plate as tall as the screw's head needs, under the
 * barrels and their clearance; two screws per block near its ends (one in
 * the middle of a short block). Null when the plate does not fit the body's
 * part of the wall's flat (`body`, `flat`).
 */
export function leafLayout(input: {
  zAxis: number; e: number; blocks: readonly { x0: number; x1: number }[]; screw: HingeScrew; hole: HoleKind;
  body: readonly [number, number]; flat: readonly [number, number]; pads: readonly [number, number];
}): LeafLayout | null {
  const { zAxis, e, blocks, screw, hole } = input;
  const head = SCREWS[screw].headD;
  const z1 = zAxis - e;
  // the screws go into the body's part of the wall's flat, their heads on the plate, their pads clear of the skirt;
  // as near the knuckles as that allows, and the plate reaches down past their heads
  const padR = bossDiameter({ size: screw, hole, head: 'none' }) / 2;
  const lo = Math.max(Math.max(input.body[0], input.flat[0]) + head / 2 + 0.5, input.pads[0] + padR);
  const hi = Math.min(Math.min(input.body[1], input.flat[1], z1) - head / 2 - 0.5, input.pads[1] - padR);
  if (hi < lo) return null;
  const z = Math.max(lo, Math.min(hi, z1 - LEAF_PLATE_MIN / 2));
  const z0 = Math.min(z1 - LEAF_PLATE_MIN, z - head / 2 - 1.5);
  const inset = Math.max(LEAF_SCREW_INSET, head / 2 + 1);
  const screws = blocks.flatMap((block) => (block.x1 - block.x0 >= 2 * inset + head + 2
    ? [{ x: block.x0 + inset }, { x: block.x1 - inset }] : [{ x: (block.x0 + block.x1) / 2 }]));
  return { t: LEAF_T, z0, z1, pedestal: zAxis, screws, z, screw, hole, padZ: [input.pads[0], input.pads[1]] };
}

/**
 * The z range of a half's hinge wall that belongs to its body: under a top
 * lid's parting plane, or over a bottom lid's (`plate + depth` from that
 * face, the lid's effective depth).
 */
export function bodyRange(h: number, lidFace: string, plate: number, depth: number): [number, number] {
  return lidFace === 'top' ? [0, h - plate - depth] : [plate + depth, h];
}

/**
 * A cable's slot in a half: through the hinge wall (`h` across the wall, at
 * height `z`) or through the inner face's plate next to the hinge edge (`h`
 * along y, its middle at `y`); `mouth` is the middle of its outer opening.
 */
export interface CableSlot {
  x: number;
  w: number;
  h: number;
  through: CableThrough;
  z: number;
  y: number;
  mouth: [number, number, number];
}

/** The cables' slots of a half as openings through its hinge wall (the face's u runs right to left on the back) or its top. */
export function cableCutters(hinge: HalfHinge, shape: ShapeState, dims: Dims, slopeTop: (x: number, y: number) => number): CutterSpec[] {
  const face = hinge.wall;
  const cuts = hinge.slots.map((slot) => (slot.through === 'face'
    ? { face: 'top' as const, shape: 'rect' as const, x: slot.x, y: slot.y, w: slot.w, h: slot.h, r: Math.min(slot.w, slot.h) / 2 }
    : { face, shape: 'rect' as const, x: face === 'back' ? dims.w - slot.x : slot.x, y: slot.z, w: slot.w, h: slot.h, r: Math.min(slot.w, slot.h) / 2 }));
  return extraCutters(cuts, shape, dims, slopeTop).map((cutter, index): CutterSpec => ({ ...cutter, source: { kind: 'cable', index } }));
}

/** How deep a leaf screw's pad reaches in from the wall, mm: what its hole kind needs. */
export function padLength(leaf: Pick<LeafLayout, 'screw' | 'hole'>): number {
  const dims = SCREWS[leaf.screw];
  if (leaf.hole === 'insert') return dims.insertLen + 1;
  if (leaf.hole === 'nut') return dims.nutH + NUT_CLEARANCE + 2;
  return 2.5 * dims.d;
}

/** A printed hinge's screws: how many, and how long — through the leaf and the wall into the pad, the nearest shorter. */
export function leafScrews(
  leaves: readonly Pick<LeafLayout, 't' | 'screw' | 'hole' | 'screws'>[], wall: number,
): { count: number; length: number } | null {
  if (leaves.length === 0) return null;
  // one length for all: the shortest any leaf takes (the nearest shorter will do)
  const length = Math.min(...leaves.map((leaf) => Math.floor(leaf.t + wall + padLength(leaf) - 0.5)));
  return { count: leaves.reduce((sum, one) => sum + one.screws.length, 0), length };
}

/** The gap's spare over what stands out of both inner faces, and the gap when nothing does, mm. */
export const GAP_SPARE = 0.5;
export const GAP_DEFAULT = 1;

/** The gap that clears what stands out of both inner faces (they may face each other), to 0.1 mm up. */
export function gapFor(proudA: number, proudB: number): number {
  const need = proudA + proudB;
  return need > 0 ? Math.ceil((need + GAP_SPARE) * 10) / 10 : GAP_DEFAULT;
}

/** Between a magnet and the outside of its inner face, mm: enough to print, thin enough to pull through. */
export const MAGNET_SKIN = 0.6;
/** A magnet's pocket: its diameter plus this, mm. */
export const MAGNET_POCKET_FIT = 0.2;

/** The magnets' bosses of a half, in its frame: centres, the pocket and the boss. */
export interface MagnetBosses {
  spots: { x: number; y: number }[];
  /** the pocket's radius and its top (the skin's underside), its bottom open into the cavity */
  pocketR: number;
  top: number;
  bottom: number;
  bossR: number;
}

/**
 * A half's two magnets at its front edge (the lower half's front, the upper
 * half's far edge: closed, they meet), a quarter in from each side, clear of
 * the skirt along the wall: each in a boss under the inner face's plate, its
 * pocket open into the cavity, `MAGNET_SKIN` of plate left outside.
 */
export function magnetBosses(
  size: MagnetSize, w: number, d: number, h: number, wall: number, side: 'front' | 'back', clear: number,
): MagnetBosses {
  const magnet = MAGNETS[size];
  const pocketR = (magnet.d + MAGNET_POCKET_FIT) / 2;
  const bossR = pocketR + BOSS_WALL;
  const inset = wall + clear + bossR;
  const y = side === 'front' ? inset : d - inset;
  const top = h - MAGNET_SKIN;
  return { spots: [{ x: w / 4, y }, { x: (3 * w) / 4, y }], pocketR, top, bottom: top - magnet.h - 0.2, bossR };
}

/** A side pivot's cheek thickness: enough for a screw axle's head seat and nut pocket. */
export function pivotThickness(spec: Pick<HingeSpec, 'axle' | 'pinD' | 'pinFit' | 'screw' | 'barrelD'>): number {
  const holes = axleHoles(spec);
  return holes.screw ? Math.max(PIVOT_T, holes.screw.headDepth + 1, holes.screw.nutDepth + 1) : PIVOT_T;
}

