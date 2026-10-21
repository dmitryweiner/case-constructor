// Extras: ventilation, a fan seat, wall mounting, a label on the lid.
// Parameters, sanitizers and the pure geometry — every opening here is an
// ExtraCut on a face, so it goes through `extraCutters` like a user cut
// (curved walls, the console's slope and all). Ears and the label's relief
// are additive and built by the worker (extrasSolids.ts).

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

export interface WallMountState {
  kind: WallMountKind;
  /** keyholes: distance between them, mm */
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
  return { kind: 'none', spacing: 40, screwD: 4 };
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
    spacing: clampNum(r.spacing, 10, 300, d.spacing),
    screwD: clampNum(r.screwD, 2.5, 6, d.screwD),
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

/**
 * Two keyholes `spacing` apart through the floor (or the back wall): a hole
 * for the screw head, then a slot the shank slides along.
 */
export function keyholeCuts(mount: WallMountState, dims: Dims, lid: LidState): ExtraCut[] {
  if (mount.kind !== 'keyholes') return [];
  const face = keyholeFace(lid);
  const extent = faceFrame(face, dims).extent;
  const head = 2 * mount.screwD + 1;
  const slot = mount.screwD + 0.6;
  const length = 6;
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

export interface EarSpec {
  /** the tab in the case xy: a rectangle from the wall outwards */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** a hole through it */
  hx: number;
  hy: number;
  d: number;
}

export const EAR_LENGTH = 8;
export const EAR_WIDTH = 10;

/** Two tabs at floor level on the left and right, with a screw hole each. */
export function earSpecs(mount: WallMountState, dims: Dims): EarSpec[] {
  if (mount.kind !== 'ears') return [];
  const cy = dims.d / 2;
  const d = mount.screwD + 0.4;
  // each tab reaches 2 mm into the wall, so it fuses with it (also on a cylinder)
  return [
    { x0: -EAR_LENGTH, y0: cy - EAR_WIDTH / 2, x1: 2, y1: cy + EAR_WIDTH / 2, hx: -EAR_LENGTH / 2, hy: cy, d },
    { x0: dims.w - 2, y0: cy - EAR_WIDTH / 2, x1: dims.w + EAR_LENGTH, y1: cy + EAR_WIDTH / 2, hx: dims.w + EAR_LENGTH / 2, hy: cy, d },
  ];
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
  const fan = extraCutters(fanCuts(state.fan, dims), shape, dims, slopeTop);
  const keyholes = extraCutters(keyholeCuts(state.wallMount, dims, lid), shape, dims, slopeTop);
  return [...kept, ...fan, ...keyholes];
}

/** Warnings: a fan that does not fit its face, keyholes next to a standoff. */
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
    const cutters = extraCutters(keyholeCuts(state.wallMount, dims, lid), shape, dims, () => dims.h);
    const supports = layout.boards.flatMap((board) => standoffColumns(board));
    const near = cutters.some((cutter) => supports.some((c) => Math.hypot(cutter.origin[0] - c.x, cutter.origin[1] - c.y) < c.r + cutter.w / 2 + 1));
    if (near) out.push({ code: 'warn.keyholeNearStandoff' });
  }
  return out;
}

/** Faces vents may go on for a shape: all of them (the console's top is its slope). */
export function ventFaces(_kind: ShapeKind): Face[] {
  return [...FACES];
}
