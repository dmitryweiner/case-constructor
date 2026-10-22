// Extras: ventilation, a fan seat, wall mounting, a label on the lid.
// Parameters, sanitizers and the pure geometry — every opening here is an
// ExtraCut on a face, so it goes through `extraCutters` like a user cut
// (curved walls, the console's slope and all). Ears, the pads of closed
// keyholes and the label's relief are additive and built by the worker
// (extrasSolids.ts).

import type { CutShape, CutterSpec, ExtraCut } from './cutters';
import { cutterContains, extraCutters } from './cutters';
import type { Dims, Face } from './face';
import { FACES, faceFrame, isFace } from './face';
import type { CaseLayout } from './layout';
import { standoffColumns } from './layout';
import type { LidState } from './lidSpec';
import type { Message } from './message';
import type { ShapeKind, ShapeState } from './shape';
import { clampNum, plateOf } from './shape';
import type { Vec3 } from './surface';
import { applyAffine } from './surface';

export const VENT_PATTERNS = ['slots', 'hex', 'round'] as const;
export type VentPattern = (typeof VENT_PATTERNS)[number];

export interface VentState {
  on: boolean;
  faces: Face[];
  pattern: VentPattern;
  /** slot width or hole size (across flats for hex), mm */
  size: number;
  /** centre-to-centre spacing across the pattern, mm */
  pitch: number;
  /** keep-out from the face's rounded edges, mm */
  margin: number;
  /** slots: their long side along the face's horizontal (x) or vertical (y) */
  along: 'x' | 'y';
}

export const FAN_SIZES = [25, 30, 40, 50, 60] as const;
export type FanSize = (typeof FAN_SIZES)[number];
/** Screw square of standard fans, mm. */
export const FAN_SCREWS: Readonly<Record<FanSize, number>> = { 25: 20, 30: 24, 40: 32, 50: 40, 60: 50 };

export interface FanState {
  on: boolean;
  face: Face;
  size: FanSize;
  /** offset of the fan's centre from the face's centre, mm */
  x: number;
  y: number;
  screwD: number;
}

export const MOUNT_KINDS = ['none', 'keyholes', 'ears'] as const;
export type WallMountKind = (typeof MOUNT_KINDS)[number];

/** through the floor into the case, or closed: a blind pocket in a pad that stands out of the floor */
export const KEYHOLE_STYLES = ['through', 'closed'] as const;
export type KeyholeStyle = (typeof KEYHOLE_STYLES)[number];

/** Ears: on the left and right walls, the front and back ones, or all on one wall. */
export const EAR_WALLS = ['leftRight', 'frontBack', 'one'] as const;
export type EarWalls = (typeof EAR_WALLS)[number];
/** Along a wall: centred, `spacing` apart — or spread from one end of its flat part to the other. */
export const EAR_ALONG = ['centre', 'ends'] as const;
export type EarAlong = (typeof EAR_ALONG)[number];
export const EAR_SIDES = ['front', 'back', 'left', 'right'] as const;
export type EarSide = (typeof EAR_SIDES)[number];
export const EAR_COUNT_MAX = 4;

export interface EarsState {
  count: number;
  walls: EarWalls;
  /** the wall when `walls` is 'one' */
  wall: EarSide;
  along: EarAlong;
}

export interface WallMountState {
  kind: WallMountKind;
  keyhole: KeyholeStyle;
  ears: EarsState;
  /** keyholes, and ears centred on a wall: distance between them, mm */
  spacing: number;
  /** wall screw shank, mm */
  screwD: number;
}

export const LABEL_FONTS = ['rubik', 'oswald'] as const;
export type LabelFont = (typeof LABEL_FONTS)[number];

export interface LabelState {
  on: boolean;
  text: string;
  font: LabelFont;
  /** height of a capital letter, mm */
  sizeMm: number;
  depth: number;
  /** raised (embossed) or engraved */
  raised: boolean;
  /** offset of the text's centre from the lid face's centre, mm */
  x: number;
  y: number;
  angle: number;
}

export const LABEL_MAX_CHARS = 40;

export function defaultVents(): VentState {
  return { on: false, faces: ['left', 'right'], pattern: 'slots', size: 2, pitch: 4, margin: 4, along: 'y' };
}

export function defaultFan(): FanState {
  return { on: false, face: 'back', size: 40, x: 0, y: 0, screwD: 3.2 };
}

export function defaultWallMount(): WallMountState {
  return { kind: 'none', keyhole: 'through', ears: { count: 2, walls: 'leftRight', wall: 'back', along: 'centre' }, spacing: 40, screwD: 4 };
}

export function defaultLabel(): LabelState {
  return { on: false, text: '', font: 'rubik', sizeMm: 6, depth: 0.6, raised: false, x: 0, y: 0, angle: 0 };
}

function rec(x: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof x === 'object' && x !== null && !Array.isArray(x)) for (const [k, v] of Object.entries(x)) out[k] = v;
  return out;
}

const bool = (x: unknown, fallback: boolean): boolean => (typeof x === 'boolean' ? x : fallback);

export function sanitizeVents(raw: unknown): VentState {
  const d = defaultVents();
  const r = rec(raw);
  const listed: unknown[] = Array.isArray(r.faces) ? r.faces : [];
  const faces = Array.isArray(r.faces) ? FACES.filter((face) => listed.includes(face)) : d.faces;
  const pattern = VENT_PATTERNS.find((p) => p === r.pattern) ?? d.pattern;
  const size = clampNum(r.size, 1, 10, d.size);
  return {
    on: bool(r.on, d.on),
    faces,
    pattern,
    size,
    pitch: clampNum(r.pitch, size + 0.8, 30, Math.max(d.pitch, size + 0.8)),
    margin: clampNum(r.margin, 1, 40, d.margin),
    along: r.along === 'x' ? 'x' : 'y',
  };
}

export function sanitizeFan(raw: unknown): FanState {
  const d = defaultFan();
  const r = rec(raw);
  return {
    on: bool(r.on, d.on),
    face: isFace(r.face) ? r.face : d.face,
    size: FAN_SIZES.find((s) => s === r.size) ?? d.size,
    x: clampNum(r.x, -200, 200, d.x),
    y: clampNum(r.y, -200, 200, d.y),
    screwD: clampNum(r.screwD, 2, 5, d.screwD),
  };
}

export function sanitizeWallMount(raw: unknown): WallMountState {
  const d = defaultWallMount();
  const r = rec(raw);
  return {
    kind: MOUNT_KINDS.find((k) => k === r.kind) ?? d.kind,
    keyhole: KEYHOLE_STYLES.find((k) => k === r.keyhole) ?? d.keyhole,
    ears: sanitizeEars(r.ears, d.ears),
    spacing: clampNum(r.spacing, 10, 300, d.spacing),
    screwD: clampNum(r.screwD, 2.5, 6, d.screwD),
  };
}

function sanitizeEars(raw: unknown, d: EarsState): EarsState {
  const r = rec(raw);
  return {
    count: Math.round(clampNum(r.count, 1, EAR_COUNT_MAX, d.count)),
    walls: EAR_WALLS.find((w) => w === r.walls) ?? d.walls,
    wall: EAR_SIDES.find((w) => w === r.wall) ?? d.wall,
    along: EAR_ALONG.find((a) => a === r.along) ?? d.along,
  };
}

export function sanitizeLabel(raw: unknown): LabelState {
  const d = defaultLabel();
  const r = rec(raw);
  // one line, no control characters, at most LABEL_MAX_CHARS characters (not UTF-16 units)
  const text = typeof r.text === 'string'
    ? [...r.text].filter((ch) => ch.charCodeAt(0) >= 32).slice(0, LABEL_MAX_CHARS).join('')
    : d.text;
  return {
    on: bool(r.on, d.on),
    text,
    font: LABEL_FONTS.find((f) => f === r.font) ?? d.font,
    sizeMm: clampNum(r.sizeMm, 3, 30, d.sizeMm),
    depth: clampNum(r.depth, 0.4, 1.5, d.depth),
    raised: bool(r.raised, d.raised),
    x: clampNum(r.x, -200, 200, d.x),
    y: clampNum(r.y, -200, 200, d.y),
    angle: clampNum(r.angle, -180, 180, d.angle),
  };
}

/** The part of a face clear of rounded edges and the margin, in face (u, v). */
export function flatRegion(shape: ShapeState, dims: Dims, face: Face, margin: number): { u0: number; v0: number; u1: number; v1: number } {
  const extent = faceFrame(face, dims).extent;
  const edge = shape.kind === 'console' ? 0 : Math.min(shape.edgeR, dims.h / 2);
  const corner = Math.min(shape.cornerR, dims.w / 2, dims.d / 2);
  if (face === 'top' || face === 'bottom') {
    if (shape.kind === 'cylinder') {
      // the square inside the flat disc
      const half = (dims.w / 2 - edge - margin) / Math.SQRT2;
      return { u0: dims.w / 2 - half, v0: dims.d / 2 - half, u1: dims.w / 2 + half, v1: dims.d / 2 + half };
    }
    return { u0: edge + margin, v0: edge + margin, u1: extent.w - edge - margin, v1: extent.h - edge - margin };
  }
  if (shape.kind === 'cylinder') {
    // the part of the round wall that faces this side reasonably square-on
    const half = dims.w / 2 * 0.55 - margin;
    return { u0: extent.w / 2 - half, v0: edge + margin, u1: extent.w / 2 + half, v1: extent.h - edge - margin };
  }
  return { u0: corner + margin, v0: edge + margin, u1: extent.w - corner - margin, v1: extent.h - edge - margin };
}

/** Vent holes as user-style cuts on every chosen face. */
export function ventCuts(vents: VentState, shape: ShapeState, dims: Dims, lidFace: Face): ExtraCut[] {
  if (!vents.on) return [];
  const cuts: ExtraCut[] = [];
  for (const face of vents.faces) {
    // the cylinder has no side faces of its own: its round wall is seen from four sides
    if (shape.kind === 'console' && face === 'top' && lidFace === 'top') continue;
    const region = flatRegion(shape, dims, face, vents.margin);
    if (region.u1 <= region.u0 || region.v1 <= region.v0) continue;
    const w = region.u1 - region.u0;
    const h = region.v1 - region.v0;
    if (vents.pattern === 'slots') {
      const long = 4 * vents.size;
      const alongU = vents.along === 'x';
      const [stepLong, stepShort] = [long + vents.pitch - vents.size, vents.pitch];
      const nLong = Math.floor(((alongU ? w : h) - long) / stepLong) + 1;
      const nShort = Math.floor(((alongU ? h : w) - vents.size) / stepShort) + 1;
      if (nLong < 1 || nShort < 1) continue;
      const spanLong = (nLong - 1) * stepLong;
      const spanShort = (nShort - 1) * stepShort;
      for (let i = 0; i < nLong; i++) {
        for (let j = 0; j < nShort; j++) {
          const a = -spanLong / 2 + i * stepLong;
          const b = -spanShort / 2 + j * stepShort;
          const [x, y] = alongU ? [a, b] : [b, a];
          cuts.push({
            face, shape: 'rect',
            x: (region.u0 + region.u1) / 2 + x, y: (region.v0 + region.v1) / 2 + y,
            w: alongU ? long : vents.size, h: alongU ? vents.size : long, r: vents.size / 2,
          });
        }
      }
    } else {
      // staggered grid of round or hexagonal holes
      const shapeOf: CutShape = vents.pattern === 'hex' ? 'hex' : 'round';
      const dv = vents.pitch * Math.sqrt(3) / 2;
      const rows = Math.floor((h - vents.size) / dv) + 1;
      for (let j = 0; j < rows; j++) {
        const v = region.v0 + vents.size / 2 + j * dv + (h - vents.size - (rows - 1) * dv) / 2;
        const shift = j % 2 === 1 ? vents.pitch / 2 : 0;
        const cols = Math.floor((w - vents.size - shift) / vents.pitch) + 1;
        const span = (cols - 1) * vents.pitch;
        for (let i = 0; i < cols; i++) {
          cuts.push({
            face, shape: shapeOf,
            x: (region.u0 + region.u1) / 2 - span / 2 + i * vents.pitch + shift / 2, y: v,
            w: vents.size, h: vents.size, r: 0,
          });
        }
      }
    }
  }
  return cuts;
}

/** A fan seat: the round opening and its four screw holes. */
export function fanCuts(fan: FanState, dims: Dims): ExtraCut[] {
  if (!fan.on) return [];
  const extent = faceFrame(fan.face, dims).extent;
  const cx = extent.w / 2 + fan.x;
  const cy = extent.h / 2 + fan.y;
  const half = FAN_SCREWS[fan.size] / 2;
  const hole = (x: number, y: number): ExtraCut => ({ face: fan.face, shape: 'round', x, y, w: fan.screwD, h: fan.screwD, r: 0 });
  return [
    { face: fan.face, shape: 'round', x: cx, y: cy, w: fan.size - 2, h: fan.size - 2, r: 0 },
    hole(cx - half, cy - half), hole(cx + half, cy - half), hole(cx - half, cy + half), hole(cx + half, cy + half),
  ];
}

/** The face wall-mount keyholes go on: the floor, or the back wall when the floor is the lid. */
export function keyholeFace(lid: LidState): Face {
  return lid.face === 'bottom' ? 'back' : 'bottom';
}

/** How far the shank slides from the head hole to the end of the slot, mm. */
const KEYHOLE_SLIDE = 6;

/** The head hole, the slot the shank slides along, the pocket the head travels in. */
function keyholeSizes(screwD: number): { head: number; slot: number; pocket: number } {
  // a pan head is about 0.6 d high; half a millimetre to spare
  return { head: 2 * screwD + 1, slot: screwD + 0.6, pocket: 0.6 * screwD + 1.1 };
}

/**
 * Two keyholes `spacing` apart through the floor (or the back wall): a hole
 * for the screw head, then a slot the shank slides along.
 */
export function keyholeCuts(mount: WallMountState, dims: Dims, lid: LidState): ExtraCut[] {
  if (mount.kind !== 'keyholes') return [];
  const face = keyholeFace(lid);
  const extent = faceFrame(face, dims).extent;
  const { head, slot } = keyholeSizes(mount.screwD);
  const length = KEYHOLE_SLIDE;
  const cuts: ExtraCut[] = [];
  for (const sign of [-1, 1]) {
    const x = extent.w / 2 + (sign * mount.spacing) / 2;
    const y = extent.h / 2 - length / 2;
    cuts.push({ face, shape: 'round', x, y, w: head, h: head, r: 0 });
    // the slot runs up from the head hole (for the back wall: up when hanging)
    cuts.push({ face, shape: 'rect', x, y: y + length / 2, w: slot, h: length, r: slot / 2 });
  }
  return cuts;
}

/** Closed keyholes: material over the slot, left towards the cavity, around the pocket; mm. */
const KEYHOLE_LIP = 2;
const KEYHOLE_SKIN = 1;
const PAD_WALL = 3;
/** Corner radius of a pad or a foot, mm. */
export const PAD_R = 3;
/** A pad stands at least this far out of the face, mm. */
const PAD_MIN = 1;

/** A pad around a closed keyhole, or a foot of the same height; face (u, v), seen from outside. */
export interface KeyholePad {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  /** a keyhole in it (a foot has none) */
  keyhole: boolean;
}

export interface ClosedKeyholes {
  face: Face;
  /** how far pads and feet stand out of the face, mm */
  height: number;
  pads: KeyholePad[];
  /** the pockets, case frame: cut after the pads are added */
  cutters: CutterSpec[];
}

/**
 * Closed keyholes: the floor is too thin for a pocket the screw head slides
 * in, so each keyhole sits in a pad standing out of the face — the head hole
 * and the slot from outside, behind the slot a channel for the head, and
 * `KEYHOLE_SKIN` of the plate left towards the cavity. On the bottom the
 * pads go to its far end and two feet of the same height to the near end,
 * mirrored, so the case stands level; where they would meet they make one
 * strip. On the back wall (the floor is the lid) there are no feet. A
 * cylinder's round wall has no flat place for a pad: null, and the keyholes
 * go through (the panel says so).
 */
export function closedKeyholes(mount: WallMountState, shape: ShapeState, dims: Dims, lid: LidState): ClosedKeyholes | null {
  if (mount.kind !== 'keyholes' || mount.keyhole !== 'closed') return null;
  const face = keyholeFace(lid);
  if (shape.kind === 'cylinder' && face !== 'bottom') return null;
  const frame = faceFrame(face, dims);
  const { extent } = frame;
  const { head, slot, pocket } = keyholeSizes(mount.screwD);
  const height = Math.max(PAD_MIN, KEYHOLE_LIP + pocket + KEYHOLE_SKIN - plateOf(shape, face));
  const padW = head + 2 * PAD_WALL;
  const padL = KEYHOLE_SLIDE + head + 2 * PAD_WALL;
  const flat = flatRegion(shape, dims, face, 0);
  let keyAt = extent.h / 2;
  let spans: { v0: number; v1: number; keyhole: boolean }[] = [{ v0: keyAt - padL / 2, v1: keyAt + padL / 2, keyhole: true }];
  if (face === 'bottom') {
    keyAt = Math.max(extent.h / 2, flat.v1 - padL / 2 - 1);
    const footAt = extent.h - keyAt;
    spans = keyAt - footAt >= padL + 2
      ? [{ v0: keyAt - padL / 2, v1: keyAt + padL / 2, keyhole: true }, { v0: footAt - padL / 2, v1: footAt + padL / 2, keyhole: false }]
      : [{ v0: footAt - padL / 2, v1: keyAt + padL / 2, keyhole: true }];
  }
  const us = [-1, 1].map((sign) => extent.w / 2 + (sign * mount.spacing) / 2);
  const pads: KeyholePad[] = spans.flatMap((span) => us.map((u) => ({ u0: u - padW / 2, u1: u + padW / 2, ...span })));
  pads.sort((a, b) => Number(b.keyhole) - Number(a.keyhole));

  const m = frame.fromFace;
  const axis = (col: number): Vec3 => [m[col], m[4 + col], m[8 + col]];
  const [ex, ey, ez] = [axis(0), axis(1), axis(2)];
  const vHead = keyAt - KEYHOLE_SLIDE / 2;
  const floorOf = height - KEYHOLE_LIP - pocket;
  const cutters = us.flatMap((u, index): CutterSpec[] => {
    const at = (v: number): Vec3 => applyAffine(m, [u, v, 0]);
    const common = { ex, ey, ez, source: { kind: 'extra' as const, index } };
    return [
      // the head goes in a little deeper than the channel: no coplanar bottoms
      { ...common, origin: at(vHead), shape: 'round', w: head, h: head, r: 0, s0: floorOf - 0.2, s1: height + 1 },
      { ...common, origin: at(vHead + KEYHOLE_SLIDE / 2), shape: 'rect', w: slot, h: KEYHOLE_SLIDE, r: slot / 2, s0: height - KEYHOLE_LIP - 0.1, s1: height + 1 },
      {
        ...common, origin: at(vHead + KEYHOLE_SLIDE / 2), shape: 'rect', w: head, h: KEYHOLE_SLIDE + head, r: head / 2,
        s0: floorOf, s1: height - KEYHOLE_LIP,
      },
    ];
  });
  return { face, height, pads, cutters };
}

export interface EarSpec {
  /** the tab in the case xy: a rectangle from inside the wall outwards, counter-clockwise */
  outline: [number, number][];
  /** a hole through it */
  hx: number;
  hy: number;
  d: number;
}

export const EAR_LENGTH = 8;
export const EAR_WIDTH = 10;

/** Outward direction of a side wall in the case xy. */
const SIDE_DIRECTION: Readonly<Record<EarSide, [number, number]>> = { left: [-1, 0], right: [1, 0], front: [0, -1], back: [0, 1] };

/** A tab standing out of the wall at `origin` along `out`: from 2 mm inside the wall to EAR_LENGTH out. */
function earAt(origin: [number, number], out: [number, number], d: number): EarSpec {
  const side: [number, number] = [-out[1], out[0]];
  const at = (z: number, s: number): [number, number] => [origin[0] + out[0] * z + side[0] * s, origin[1] + out[1] * z + side[1] * s];
  const w = EAR_WIDTH / 2;
  // inside the wall first, then out: counter-clockwise for any direction
  const outline = [at(-2, -w), at(EAR_LENGTH, -w), at(EAR_LENGTH, w), at(-2, w)];
  const [hx, hy] = at(EAR_LENGTH / 2, 0);
  return { outline, hx, hy, d };
}

/** Positions of k ears along a wall `length` long, clear of its rounded corners. */
function alongWall(k: number, length: number, corner: number, mount: WallMountState): number[] {
  const lo = Math.min(length / 2, corner + 1 + EAR_WIDTH / 2);
  const hi = Math.max(length / 2, length - corner - 1 - EAR_WIDTH / 2);
  if (k === 1) return [length / 2];
  if (mount.ears.along === 'ends') return Array.from({ length: k }, (_, i) => lo + ((hi - lo) * i) / (k - 1));
  // centred, `spacing` apart (never closer than a tab), squeezed into the flat part
  const step = Math.min(Math.max(mount.spacing, EAR_WIDTH + 2), (hi - lo) / (k - 1));
  return Array.from({ length: k }, (_, i) => length / 2 + (i - (k - 1) / 2) * step);
}

/**
 * Tabs at floor level with a screw hole each: 1…4, on the left and right
 * walls, the front and back ones (3 = two on the first wall and one on the
 * second) or all on one wall; along a wall centred `spacing` apart or spread
 * between the ends of its flat part. A cylinder has no walls to choose: its
 * ears go evenly around, the first towards the first wall asked for.
 */
export function earSpecs(mount: WallMountState, shape: ShapeState, dims: Dims): EarSpec[] {
  if (mount.kind !== 'ears') return [];
  const d = mount.screwD + 0.4;
  const { count, walls, wall } = mount.ears;
  const sides: EarSide[] = walls === 'leftRight' ? ['left', 'right'] : walls === 'frontBack' ? ['front', 'back'] : [wall];
  if (shape.kind === 'cylinder') {
    const radius = dims.w / 2;
    const [fx, fy] = SIDE_DIRECTION[sides[0]];
    const start = Math.atan2(fy, fx);
    return Array.from({ length: count }, (_, i) => {
      const a = start + (2 * Math.PI * i) / count;
      const out: [number, number] = [Math.cos(a), Math.sin(a)];
      return earAt([dims.w / 2 + out[0] * radius, dims.d / 2 + out[1] * radius], out, d);
    });
  }
  // ears per wall: the first wall takes the odd one
  const perWall = sides.length === 1 ? [count] : [Math.ceil(count / 2), Math.floor(count / 2)];
  const corner = Math.min(shape.cornerR, dims.w / 2, dims.d / 2);
  return sides.flatMap((side, index) => {
    const [ox, oy] = SIDE_DIRECTION[side];
    const length = ox !== 0 ? dims.d : dims.w;
    return alongWall(perWall[index], length, corner, mount).map((t) => {
      const origin: [number, number] = ox !== 0 ? [ox < 0 ? 0 : dims.w, t] : [t, oy < 0 ? 0 : dims.d];
      return earAt(origin, [ox, oy], d);
    });
  });
}

/**
 * Every opening of the extras as cutters, with the vents thinned out: none
 * through the lid skirt band, none under a standoff or a rail (they stand on
 * the floor and a vent there would open them), none in a port opening.
 */
export function extrasCutters(
  state: { vents: VentState; fan: FanState; wallMount: WallMountState },
  shape: ShapeState, layout: CaseLayout, lid: LidState, slopeTop: (x: number, y: number) => number, portCutters: readonly CutterSpec[],
): CutterSpec[] {
  const { dims } = layout;
  const vents = extraCutters(ventCuts(state.vents, shape, dims, lid.face), shape, dims, slopeTop);
  const frame = faceFrame(lid.face, dims);
  const zp = -(plateOf(shape, lid.face) + lid.depth);
  const supports = layout.boards.flatMap((board) => standoffColumns(board));
  const rails = layout.boards.filter((board) => board.def.mount.kind === 'rails').map((board) => board.footprint);
  const kept = vents.filter((cutter) => {
    const centre = cutter.origin;
    const reach = Math.max(cutter.w, cutter.h) / 2;
    // the skirt band (vents on the lid plate itself are fine)
    const zs = [cutter.s0, cutter.s1].flatMap((s) => [-1, 1].flatMap((a) => [-1, 1].map((b) => {
      const p = [0, 1, 2].map((k) => centre[k] + cutter.ez[k] * s + cutter.ex[k] * a * cutter.w / 2 + cutter.ey[k] * b * cutter.h / 2);
      return applyAffine(frame.toFace, [p[0], p[1], p[2]])[2];
    })));
    const lo = Math.min(...zs);
    const hi = Math.max(...zs);
    if (hi > zp - lid.lip.h - 1 && lo < zp + 0.5 && !(lo > zp - 0.01)) return false;
    // supports on the floor
    if (Math.abs(cutter.ez[2]) > 0.9) {
      for (const column of supports) {
        if (Math.hypot(centre[0] - column.x, centre[1] - column.y) < column.r + reach + 1) return false;
      }
      for (const r of rails) {
        if (centre[0] > r.x0 - reach - 1 && centre[0] < r.x1 + reach + 1 && centre[1] > r.y0 - reach - 1 && centre[1] < r.y1 + reach + 1) return false;
      }
    }
    return !portCutters.some((port) => cutterContains(port, centre, reach));
  });
  // no vent under a pad or a foot of closed keyholes: it would open into the pad
  const closed = closedKeyholes(state.wallMount, shape, dims, lid);
  const free = closed ? kept.filter((cutter) => !underPad(cutter, closed, dims)) : kept;
  const fan = extraCutters(fanCuts(state.fan, dims), shape, dims, slopeTop);
  // closed keyholes are cut by the worker after their pads are added
  const keyholes = closed ? [] : extraCutters(keyholeCuts(state.wallMount, dims, lid), shape, dims, slopeTop);
  return [...free, ...fan, ...keyholes];
}

/** Whether a cutter on the keyholes' face lands on a pad or a foot. */
function underPad(cutter: CutterSpec, closed: ClosedKeyholes, dims: Dims): boolean {
  const frame = faceFrame(closed.face, dims);
  const n = frame.n;
  if (cutter.ez[0] * n[0] + cutter.ez[1] * n[1] + cutter.ez[2] * n[2] < 0.99) return false;
  const [u, v] = applyAffine(frame.toFace, cutter.origin);
  const reach = Math.max(cutter.w, cutter.h) / 2 + 1;
  return closed.pads.some((pad) => u > pad.u0 - reach && u < pad.u1 + reach && v > pad.v0 - reach && v < pad.v1 + reach);
}

/**
 * Warnings: a fan that does not fit its face, keyholes next to a standoff
 * (its hole reaches into the floor: through a keyhole, or into a closed
 * pocket), pads off the flat part of the face, pads under a floor that
 * prints on the bed, closed keyholes asked for on a round wall.
 */
export function extrasWarnings(
  state: { fan: FanState; wallMount: WallMountState }, shape: ShapeState, layout: CaseLayout, lid: LidState,
): Message[] {
  const out: Message[] = [];
  const { dims } = layout;
  if (state.fan.on) {
    const region = flatRegion(shape, dims, state.fan.face, 0);
    const extent = faceFrame(state.fan.face, dims).extent;
    const cx = extent.w / 2 + state.fan.x;
    const cy = extent.h / 2 + state.fan.y;
    const half = state.fan.size / 2;
    if (cx - half < region.u0 || cx + half > region.u1 || cy - half < region.v0 || cy + half > region.v1) {
      out.push({ code: 'warn.fanTooBig', params: { size: state.fan.size } });
    }
  }
  if (state.wallMount.kind === 'keyholes') {
    const closed = closedKeyholes(state.wallMount, shape, dims, lid);
    if (state.wallMount.keyhole === 'closed' && !closed) out.push({ code: 'warn.keyholeClosedRound' });
    const cutters = closed ? closed.cutters : extraCutters(keyholeCuts(state.wallMount, dims, lid), shape, dims, () => dims.h);
    const supports = layout.boards.flatMap((board) => standoffColumns(board));
    // how far a standoff's centre is from a cutter's section, across the cutter
    const gap = (cutter: CutterSpec, x: number, y: number): number => {
      const d = [x - cutter.origin[0], y - cutter.origin[1], 0];
      const a = d[0] * cutter.ex[0] + d[1] * cutter.ex[1];
      const b = d[0] * cutter.ey[0] + d[1] * cutter.ey[1];
      return Math.hypot(Math.max(0, Math.abs(a) - cutter.w / 2), Math.max(0, Math.abs(b) - cutter.h / 2));
    };
    const near = cutters.some((cutter) => supports.some((c) => gap(cutter, c.x, c.y) < c.r + 1));
    if (near) out.push({ code: 'warn.keyholeNearStandoff' });
    if (closed) {
      // the body prints standing on the face opposite the lid: with the lid
      // on top the pads are under the floor, and the floor between them hangs
      if (closed.face === 'bottom' && lid.face === 'top') out.push({ code: 'warn.keyholePadsOnBed' });
      const flat = flatRegion(shape, dims, closed.face, 0);
      const eps = 1e-6;
      if (closed.pads.some((pad) => pad.u0 < flat.u0 - eps || pad.u1 > flat.u1 + eps || pad.v0 < flat.v0 - eps || pad.v1 > flat.v1 + eps)) {
        out.push({ code: 'warn.keyholeOffFlat' });
      }
    }
  }
  return out;
}

/** Faces vents may go on for a shape: all of them (the console's top is its slope). */
export function ventFaces(_kind: ShapeKind): Face[] {
  return [...FACES];
}
