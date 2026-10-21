// The one parametric mesher of the case: a loft of rounded-rectangle
// sections. A ring of points per z-level, the same count on every ring; the
// worker turns the cloud into a solid by its convex hull (every shell here is
// convex, so the hull IS the loft, and it is watertight by construction —
// no degenerate quads where a radius collapses to zero).
//
// A section at height z has half-sizes `(hw − inset, hd − inset)` and corner
// radius `max(cornerR − inset, 0)`, where the inset follows a quarter circle
// of radius `edgeR` within `edgeR` of a filleted end and is 0 elsewhere. With
// `edgeR = 0` the loft degenerates to a plain extrusion; a cylinder is the
// same loft with `hw = hd = cornerR = R`.

import type { Vec3 } from './surface';

export interface LoftSpec {
  /** centre of the sections */
  cx: number;
  cy: number;
  /** half width (x) and half depth (y) */
  hw: number;
  hd: number;
  /** radius of the vertical edges; clamped to min(hw, hd) */
  cornerR: number;
  z0: number;
  z1: number;
  /** fillet of the horizontal edges; clamped to the corner radius and half the height */
  edgeR: number;
  /** which ends are filleted (an open end of a cut shell is not) */
  filletBottom: boolean;
  filletTop: boolean;
}

export interface Section {
  hw: number;
  hd: number;
  r: number;
}

/** Corner radius and fillet the spec can actually have. */
export function effectiveRadii(spec: LoftSpec): { cornerR: number; edgeR: number } {
  const cornerR = Math.max(0, Math.min(spec.cornerR, spec.hw, spec.hd));
  const ends = (spec.filletBottom ? 1 : 0) + (spec.filletTop ? 1 : 0);
  const height = spec.z1 - spec.z0;
  const edgeR = ends === 0 ? 0 : Math.max(0, Math.min(spec.edgeR, cornerR, height / ends));
  return { cornerR, edgeR };
}

/**
 * Inset of the section at height z: a quarter circle of radius e on each
 * filleted end, 0 in between.
 */
export function insetAt(spec: LoftSpec, z: number): number {
  const { edgeR: e } = effectiveRadii(spec);
  if (e <= 0) return 0;
  let dz = Infinity;
  if (spec.filletBottom) dz = Math.min(dz, z - spec.z0);
  if (spec.filletTop) dz = Math.min(dz, spec.z1 - z);
  if (dz >= e) return 0;
  const t = e - Math.max(0, dz);
  return e - Math.sqrt(Math.max(0, e * e - t * t));
}

export function sectionAt(spec: LoftSpec, z: number): Section {
  const { cornerR } = effectiveRadii(spec);
  const inset = insetAt(spec, z);
  return {
    hw: Math.max(0, spec.hw - inset),
    hd: Math.max(0, spec.hd - inset),
    r: Math.max(0, cornerR - inset),
  };
}

/**
 * Points of one rounded-rectangle ring, counter-clockwise from the +x side:
 * four quarter arcs of `segments` steps each.
 */
export function ringPoints(cx: number, cy: number, section: Section, z: number, segments: number): Vec3[] {
  const points: Vec3[] = [];
  const { hw, hd, r } = section;
  const corners: [number, number][] = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  for (let k = 0; k < 4; k++) {
    const [sx, sy] = corners[k];
    const ox = cx + sx * (hw - r);
    const oy = cy + sy * (hd - r);
    for (let i = 0; i <= segments; i++) {
      const angle = ((k + i / segments) * Math.PI) / 2;
      points.push([ox + r * Math.cos(angle), oy + r * Math.sin(angle), z]);
    }
  }
  return points;
}

/** z-levels of the loft: the fillet arcs get `segments` steps each, the straight part none. */
export function loftLevels(spec: LoftSpec, segments: number): number[] {
  const { edgeR: e } = effectiveRadii(spec);
  const levels = [spec.z0, spec.z1];
  // uniform in angle along the arc: dz = e·(1 − cos φ)
  for (let i = 1; e > 0 && i <= segments; i++) {
    const dz = e * (1 - Math.cos((i / segments) * (Math.PI / 2)));
    if (spec.filletBottom) levels.push(spec.z0 + dz);
    if (spec.filletTop) levels.push(spec.z1 - dz);
  }
  const unique: number[] = [];
  for (const z of levels.sort((a, b) => a - b)) {
    if (unique.length === 0 || z - unique[unique.length - 1] > 1e-6) unique.push(z);
  }
  return unique;
}

/** The point cloud of the whole loft; its convex hull is the solid. */
export function loftPoints(spec: LoftSpec, segments: number): Vec3[] {
  const points: Vec3[] = [];
  for (const z of loftLevels(spec, segments)) {
    points.push(...ringPoints(spec.cx, spec.cy, sectionAt(spec, z), z, segments));
  }
  return points;
}

/**
 * The same loft shrunk by `delta` on every side: an inward offset, exact for
 * this family as long as no radius hits zero (then it is the usual
 * rounded-box approximation). Used for skirts and printing clearances.
 */
export function offsetLoft(spec: LoftSpec, delta: number): LoftSpec {
  return {
    ...spec,
    hw: spec.hw - delta,
    hd: spec.hd - delta,
    cornerR: Math.max(0, spec.cornerR - delta),
    edgeR: Math.max(0, spec.edgeR - delta),
    z0: spec.z0 + delta,
    z1: spec.z1 - delta,
  };
}
