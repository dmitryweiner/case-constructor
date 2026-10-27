// Cutters → solids, and the one subtraction that opens every hole. Worker
// only. Cutters are unioned first and subtracted once per part: thirty small
// differences cost far more than one big one.

import type { CrossSection, Manifold } from 'manifold-3d';
import type { CsgApi, CsgScope } from './csg';
import { extrude, transformSolid, unionAll } from './csg';
import type { CutterSpec } from './cutters';
import { flareAt } from './cutters';
import type { Affine } from './surface';

export function cutterSolid(csg: CsgApi, scope: CsgScope, cutter: CutterSpec, segments: number): Manifold {
  const grownBy = (g: number): CrossSection => sectionOf(csg, scope, { ...cutter, w: cutter.w + 2 * g, h: cutter.h + 2 * g, r: cutter.r + g }, segments);
  let prism: Manifold;
  if (cutter.flare && cutter.flare.from < cutter.s1) {
    // a chamfered window: the straight part and the wider far end, hulled
    // (every section is convex, so the hull is exactly the flared prism)
    const from = Math.max(cutter.s0 + FLARE_SLICE, cutter.flare.from);
    const straight = extrude(csg, scope, grownBy(flareAt(cutter, cutter.s0)), cutter.s0, from);
    const end = extrude(csg, scope, grownBy(flareAt(cutter, cutter.s1)), cutter.s1 - FLARE_SLICE, cutter.s1);
    prism = scope.keep(csg.Manifold.hull([straight, end]));
  } else {
    prism = extrude(csg, scope, sectionOf(csg, scope, cutter, segments), cutter.s0, cutter.s1);
  }
  const { origin: o, ex, ey, ez } = cutter;
  const place: Affine = [ex[0], ey[0], ez[0], o[0], ex[1], ey[1], ez[1], o[1], ex[2], ey[2], ez[2], o[2]];
  return transformSolid(scope, prism, place);
}

/** The thin slices a flared cutter's hull is taken over, mm. */
const FLARE_SLICE = 0.01;

/** A cutter's section in its (ex, ey) plane. */
function sectionOf(csg: CsgApi, scope: CsgScope, cutter: Pick<CutterSpec, 'shape' | 'w' | 'h' | 'r'>, segments: number): CrossSection {
  const circular = Math.max(16, segments * 4);
  let section: CrossSection;
  if (cutter.shape === 'round') {
    section = scope.keep(csg.CrossSection.circle(cutter.w / 2, circular));
  } else if (cutter.shape === 'hex') {
    // w across the flats: circumradius w / √3
    section = scope.keep(csg.CrossSection.circle(cutter.w / Math.sqrt(3), 6));
  } else if (cutter.r >= Math.min(cutter.w, cutter.h) / 2 - 0.05) {
    // fully rounded ends: a stadium, the hull of two circles — a rounded
    // rectangle would keep a hair-thin straight piece there, and slivers
    const radius = Math.min(cutter.w, cutter.h) / 2;
    const half = Math.max(cutter.w, cutter.h) / 2 - radius;
    const alongW = cutter.w >= cutter.h;
    const circle = (c: number): CrossSection => scope.keep(scope.keep(csg.CrossSection.circle(radius, circular))
      .translate(alongW ? [c, 0] : [0, c]));
    section = scope.keep(csg.CrossSection.hull([circle(-half), circle(half)]));
  } else {
    const r = Math.max(0, Math.min(cutter.r, cutter.w / 2 - 0.01, cutter.h / 2 - 0.01));
    const core = scope.keep(csg.CrossSection.square([cutter.w - 2 * r, cutter.h - 2 * r], true));
    section = r > 0 ? scope.keep(scope.keep(core.offset(r, 'Round', 2, circular)).simplify(1e-3)) : core;
  }
  return section;
}

/**
 * A few microns more per cutter, different for each: neighbouring cutters
 * often share a plane (a row of headers, a grid of vents), and a union of
 * prisms with coplanar faces leaves slivers. Nobody prints 0.01 mm.
 */
const JITTER_MM = 0.002;

/** All cutters as one solid, or null when there are none. */
export function cuttersSolid(csg: CsgApi, scope: CsgScope, cutters: readonly CutterSpec[], segments: number): Manifold | null {
  if (cutters.length === 0) return null;
  return unionAll(csg, scope, cutters.map((cutter, index) => {
    const grow = JITTER_MM * ((index % 5) + 1);
    return cutterSolid(csg, scope, { ...cutter, w: cutter.w + grow, h: cutter.h + grow, s1: cutter.s1 + grow }, segments);
  }));
}
