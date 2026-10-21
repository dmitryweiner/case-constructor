// Cutters: every opening of the case is a 2D shape pushed along an axis —
// a prism from s0 to s1 along `ez`, its section a rounded rectangle or a
// circle in the (ex, ey) plane. Pure descriptions; the worker turns them into
// solids (cut.ts) and subtracts them from both parts at once.
//
// Three makers: a port on a board edge becomes a channel from the
// connector's face outwards along the edge normal (ports.ts); an element on
// the board's top becomes a column from just above it up through the
// ceiling (ports.ts); a user cut goes through the wall of a chosen face
// (`extraCutters`, here).

import type { Dims, Face } from './face';
import { FACES, faceFrame, isFace } from './face';
import type { ShapeKind, ShapeState } from './shape';
import { clampNum, plateOf } from './shape';
import type { Vec3 } from './surface';
import { applyAffine } from './surface';

export type CutShape = 'rect' | 'round';

export interface CutterSpec {
  /** a point on the axis at s = 0, case frame */
  origin: Vec3;
  /** section axes and the push axis, unit vectors, right-handed */
  ex: Vec3;
  ey: Vec3;
  ez: Vec3;
  s0: number;
  s1: number;
  shape: CutShape;
  /** section size along ex and ey; a round cutter uses w as the diameter */
  w: number;
  h: number;
  /** corner radius of a rectangle */
  r: number;
  /** what made it, for warnings */
  source: { kind: 'port'; board: number; port: string } | { kind: 'extra'; index: number };
}

/** A user-defined opening on a face. */
export interface ExtraCut {
  face: Face;
  shape: CutShape;
  /** centre in face coordinates (u, v), mm from the face's lower-left corner seen from outside */
  x: number;
  y: number;
  w: number;
  h: number;
  /** corner radius (rect) */
  r: number;
}

export const MAX_EXTRA_CUTS = 12;

export function defaultExtraCut(face: Face = 'front'): ExtraCut {
  return { face, shape: 'rect', x: 20, y: 10, w: 10, h: 6, r: 1 };
}

export function sanitizeExtraCuts(raw: unknown, kind: ShapeKind): ExtraCut[] {
  if (!Array.isArray(raw)) return [];
  const faces = cutFaces(kind);
  return raw.slice(0, MAX_EXTRA_CUTS).map((item) => {
    const r = typeof item === 'object' && item !== null ? item : {};
    const d = defaultExtraCut(faces[0]);
    const face: unknown = Reflect.get(r, 'face');
    const shape: unknown = Reflect.get(r, 'shape');
    const w = clampNum(Reflect.get(r, 'w'), 1, 200, d.w);
    const h = clampNum(Reflect.get(r, 'h'), 1, 200, d.h);
    return {
      face: isFace(face) && faces.includes(face) ? face : faces[0],
      shape: shape === 'round' ? 'round' : 'rect',
      x: clampNum(Reflect.get(r, 'x'), 0, 400, d.x),
      y: clampNum(Reflect.get(r, 'y'), 0, 400, d.y),
      w,
      h,
      r: clampNum(Reflect.get(r, 'r'), 0, Math.min(w, h) / 2, d.r),
    };
  });
}

/** Faces a user cut may go on: every face of every shape (the console's top is its slope). */
export function cutFaces(_kind: ShapeKind): Face[] {
  return [...FACES];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/** Axes of a prism pushed horizontally along (dx, dy): ex horizontal, ey up. */
export function horizontalAxes(dx: number, dy: number): { ex: Vec3; ey: Vec3; ez: Vec3 } {
  const ez: Vec3 = [dx, dy, 0];
  const ey: Vec3 = [0, 0, 1];
  return { ex: cross(ey, ez), ey, ez };
}

/** Axes of a vertical column: ex = x, ey = y, ez = up. */
export const VERTICAL_AXES: { ex: Vec3; ey: Vec3; ez: Vec3 } = { ex: [1, 0, 0], ey: [0, 1, 0], ez: [0, 0, 1] };

/**
 * User cuts: each pushed through the wall of its face along the face normal,
 * from just outside to just past the inner surface. On a cylinder's side the
 * wall is curved, so the push reaches as deep as the curve does across the
 * cut; on the console's slope (its top) a cut is a vertical column through
 * the slope.
 */
export function extraCutters(cuts: readonly ExtraCut[], shape: ShapeState, dims: Dims, slopeTop: (x: number, y: number) => number): CutterSpec[] {
  return cuts.map((cut, index): CutterSpec => {
    const plate = plateOf(shape, cut.face);
    const frame = faceFrame(cut.face, dims);
    const common = { shape: cut.shape, w: cut.w, h: cut.shape === 'round' ? cut.w : cut.h, r: cut.r, source: { kind: 'extra' as const, index } };
    if (shape.kind === 'console' && cut.face === 'top') {
      const [x, y] = [cut.x, cut.y];
      const top = slopeTop(x, y);
      return { origin: [x, y, 0], ...VERTICAL_AXES, s0: top - plate * 2 - 1, s1: dims.h + 1, ...common };
    }
    let depth = plate + 0.5;
    if (shape.kind === 'cylinder' && cut.face !== 'top' && cut.face !== 'bottom') {
      const radius = dims.w / 2;
      const inner = radius - shape.wall;
      const du = Math.min(inner, Math.max(Math.abs(cut.x - cut.w / 2 - radius), Math.abs(cut.x + cut.w / 2 - radius)));
      depth = radius - Math.sqrt(Math.max(0, inner * inner - du * du)) + 0.5;
    }
    const m = frame.fromFace;
    const axis = (col: number): Vec3 => [m[col], m[4 + col], m[8 + col]];
    return {
      origin: applyAffine(m, [cut.x, cut.y, 0]),
      ex: axis(0),
      ey: axis(1),
      ez: axis(2),
      s0: -depth,
      s1: 1,
      ...common,
    };
  });
}

/** Whether a point lies inside a cutter's prism, grown by `margin` across it. */
export function cutterContains(cutter: CutterSpec, p: Vec3, margin = 0): boolean {
  const d: Vec3 = [p[0] - cutter.origin[0], p[1] - cutter.origin[1], p[2] - cutter.origin[2]];
  const dot = (v: Vec3): number => d[0] * v[0] + d[1] * v[1] + d[2] * v[2];
  const s = dot(cutter.ez);
  if (s < cutter.s0 - margin || s > cutter.s1 + margin) return false;
  const a = dot(cutter.ex);
  const b = dot(cutter.ey);
  if (cutter.shape === 'round') return Math.hypot(a, b) <= cutter.w / 2 + margin;
  return Math.abs(a) <= cutter.w / 2 + margin && Math.abs(b) <= cutter.h / 2 + margin;
}
