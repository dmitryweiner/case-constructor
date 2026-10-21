// Cutters → solids, and the one subtraction that opens every hole. Worker
// only. Cutters are unioned first and subtracted once per part: thirty small
// differences cost far more than one big one.

import type { Manifold } from 'manifold-3d';
import type { CsgApi, CsgScope } from './csg';
import { extrude, transformSolid, unionAll } from './csg';
import type { CutterSpec } from './cutters';
import type { Affine } from './surface';

export function cutterSolid(csg: CsgApi, scope: CsgScope, cutter: CutterSpec, segments: number): Manifold {
  const circular = Math.max(16, segments * 4);
  let section;
  if (cutter.shape === 'round') {
    section = scope.keep(csg.CrossSection.circle(cutter.w / 2, circular));
  } else {
    const r = Math.max(0, Math.min(cutter.r, cutter.w / 2 - 0.01, cutter.h / 2 - 0.01));
    const core = scope.keep(csg.CrossSection.square([cutter.w - 2 * r, cutter.h - 2 * r], true));
    section = r > 0 ? scope.keep(scope.keep(core.offset(r, 'Round', 2, circular)).simplify(1e-3)) : core;
  }
  const prism = extrude(csg, scope, section, cutter.s0, cutter.s1);
  const { origin: o, ex, ey, ez } = cutter;
  const place: Affine = [ex[0], ey[0], ez[0], o[0], ex[1], ey[1], ez[1], o[1], ex[2], ey[2], ez[2], o[2]];
  return transformSolid(scope, prism, place);
}

/** All cutters as one solid, or null when there are none. */
export function cuttersSolid(csg: CsgApi, scope: CsgScope, cutters: readonly CutterSpec[], segments: number): Manifold | null {
  if (cutters.length === 0) return null;
  return unionAll(csg, scope, cutters.map((cutter) => cutterSolid(csg, scope, cutter, segments)));
}
