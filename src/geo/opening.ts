// The opening of the body at the parting plane, as the lid sees it: the
// intersection of the cavity sections at the plane and `lip.h` below it.
// The cavity is convex, so this polygon fits every section in between — the
// skirt follows it, the snaps sit on it, the screw posts hug its corners.
// Pure, so the main thread can check posts against boards without WASM.

import type { FaceFrame } from './face';
import type { ShapeSpec } from './shape';
import type { Vec2 } from './section';
import { ccw, clipHalfPlane, loftSlice, polygonArea } from './section';

/** Intersection of two convex polygons (both counter-clockwise). */
export function convexIntersect(a: readonly Vec2[], b: readonly Vec2[]): Vec2[] {
  let out: Vec2[] = [...a];
  for (let i = 0; i < b.length && out.length > 0; i++) {
    const p = b[i];
    const q = b[(i + 1) % b.length];
    // keep the left side of p→q
    const ea = -(q[1] - p[1]);
    const eb = q[0] - p[0];
    out = clipHalfPlane(out, ea, eb, -(ea * p[0] + eb * p[1]));
  }
  return out.length >= 3 && Math.abs(polygonArea(out)) > 1e-6 ? ccw(out) : [];
}

export function openingPolygon(spec: ShapeSpec, frame: FaceFrame, zp: number, lipH: number, segments: number): Vec2[] {
  const top = loftSlice(spec.inner, spec.innerCut, frame, zp, segments);
  const bottom = loftSlice(spec.inner, spec.innerCut, frame, zp - lipH, segments);
  if (top.length < 3 || bottom.length < 3) return [];
  return convexIntersect(top, bottom);
}

export interface Bounds2 {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

export function bounds2(poly: readonly Vec2[]): Bounds2 {
  return {
    u0: Math.min(...poly.map((p) => p[0])),
    v0: Math.min(...poly.map((p) => p[1])),
    u1: Math.max(...poly.map((p) => p[0])),
    v1: Math.max(...poly.map((p) => p[1])),
  };
}

/**
 * Where a line through `at` along `axis` (0 = a vertical line u = at, 1 = a
 * horizontal one v = at) leaves the polygon on its high (dir = +1) or low
 * side: the crossing point and the polygon edge's unit tangent there.
 */
export function boundaryHit(poly: readonly Vec2[], axis: 0 | 1, at: number, dir: 1 | -1): { point: Vec2; tangent: Vec2 } | null {
  let best: { point: Vec2; tangent: Vec2 } | null = null;
  const along = axis === 0 ? 1 : 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const lo = Math.min(p[axis], q[axis]);
    const hi = Math.max(p[axis], q[axis]);
    if (at < lo || at > hi || hi - lo < 1e-9) continue;
    const t = (at - p[axis]) / (q[axis] - p[axis]);
    const value = p[along] + t * (q[along] - p[along]);
    if (best && (value - best.point[along]) * dir <= 0) continue;
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const point: Vec2 = axis === 0 ? [at, value] : [value, at];
    best = { point, tangent: [(q[0] - p[0]) / len, (q[1] - p[1]) / len] };
  }
  return best;
}
