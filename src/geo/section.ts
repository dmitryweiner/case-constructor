// Cross-sections of a loft by a plane parallel to a face, computed exactly
// from the loft formula rather than by slicing a mesh. The lid's skirt has to
// pass through the opening at the parting plane, and with a flat lid that
// plane is exactly the ceiling — a mesh slice there would hit a coplanar face,
// while the formula simply returns the top section.

import type { FaceFrame } from './face';
import type { LoftSpec } from './loft';
import { effectiveRadii, loftLevels, ringPoints, sectionAt } from './loft';
import type { Plane } from './shape';
import { applyAffine } from './surface';

export type Vec2 = [number, number];

/** Signed area; positive for a counter-clockwise polygon. */
export function polygonArea(poly: readonly Vec2[]): number {
  let twice = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    twice += x0 * y1 - x1 * y0;
  }
  return twice / 2;
}

/** The same polygon, counter-clockwise. */
export function ccw(poly: Vec2[]): Vec2[] {
  return polygonArea(poly) < 0 ? [...poly].reverse() : poly;
}

/** Sutherland–Hodgman against one half-plane `a·u + b·v + c ≥ 0`. */
export function clipHalfPlane(poly: readonly Vec2[], a: number, b: number, c: number): Vec2[] {
  const out: Vec2[] = [];
  const side = (p: Vec2): number => a * p[0] + b * p[1] + c;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const sp = side(p);
    const sq = side(q);
    if (sp >= 0) out.push(p);
    if ((sp >= 0) !== (sq >= 0)) {
      const t = sp / (sp - sq);
      out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
    }
  }
  return out;
}

/**
 * Half-extent of a rounded rectangle (half-sizes ha along the cut axis, hb
 * across it, corner radius r) along the b axis at distance q from its centre
 * along a. Negative when the line misses it.
 */
function chordHalf(ha: number, hb: number, r: number, q: number): number {
  if (q > ha) return -1;
  if (q <= ha - r) return hb;
  const dq = q - (ha - r);
  return hb - r + Math.sqrt(Math.max(0, r * r - dq * dq));
}

/**
 * Section of the loft (optionally trimmed by a plane) by the plane at depth
 * `zp` of the face frame, as a counter-clockwise polygon in face (u, v).
 * Empty when the plane misses the solid.
 */
export function loftSlice(spec: LoftSpec, cut: Plane | null, frame: FaceFrame, zp: number, segments: number): Vec2[] {
  // the slicing plane in case coordinates: a point on it and the face axes
  const origin = applyAffine(frame.fromFace, [0, 0, zp]);
  let poly: Vec2[] = [];
  const toUV = (x: number, y: number, z: number): Vec2 => {
    const p = applyAffine(frame.toFace, [x, y, z]);
    return [p[0], p[1]];
  };

  if (frame.face === 'top' || frame.face === 'bottom') {
    const z = origin[2];
    if (z < spec.z0 - 1e-9 || z > spec.z1 + 1e-9) return [];
    const section = sectionAt(spec, Math.min(spec.z1, Math.max(spec.z0, z)));
    if (section.hw <= 0 || section.hd <= 0) return [];
    poly = ringPoints(spec.cx, spec.cy, section, z, segments).map(([x, y]) => toUV(x, y, z));
  } else {
    const alongX = frame.face === 'left' || frame.face === 'right';
    const a = alongX ? origin[0] : origin[1];
    const q = Math.abs(a - (alongX ? spec.cx : spec.cy));
    const levels = denseLevels(spec, segments);
    const right: [number, number][] = [];
    for (const z of levels) {
      const s = sectionAt(spec, z);
      const half = alongX ? chordHalf(s.hw, s.hd, s.r, q) : chordHalf(s.hd, s.hw, s.r, q);
      if (half >= 0) right.push([half, z]);
    }
    if (right.length < 2) return [];
    const cb = alongX ? spec.cy : spec.cx;
    const point = (b: number, z: number): Vec2 => (alongX ? toUV(a, b, z) : toUV(b, a, z));
    for (const [half, z] of right) poly.push(point(cb + half, z));
    for (let i = right.length - 1; i >= 0; i--) poly.push(point(cb - right[i][0], right[i][1]));
  }

  if (cut) {
    // dot(fromFace(u, v, zp), n) ≥ offset is affine in (u, v)
    const m = frame.fromFace;
    const [nx, ny, nz] = cut.n;
    const au = m[0] * nx + m[4] * ny + m[8] * nz;
    const av = m[1] * nx + m[5] * ny + m[9] * nz;
    const c0 = (m[2] * zp + m[3]) * nx + (m[6] * zp + m[7]) * ny + (m[10] * zp + m[11]) * nz - cut.offset;
    poly = clipHalfPlane(poly, au, av, c0);
  }
  if (poly.length < 3 || Math.abs(polygonArea(poly)) < 1e-6) return [];
  return ccw(poly);
}

/** Loft levels plus extra ones inside the fillets, so a side cut follows the arc. */
function denseLevels(spec: LoftSpec, segments: number): number[] {
  const { edgeR } = effectiveRadii(spec);
  const levels = loftLevels(spec, Math.max(segments, edgeR > 0 ? 8 : 1));
  return levels;
}
