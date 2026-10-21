// Outer solid, inner solid, shell = outer − inner. The shell is deliberately
// a boolean rather than a hand-built hollow mesh: the boolean is cheap and
// provably watertight. Worker only (imports csg.ts).

import type { Manifold } from 'manifold-3d';
import type { CsgApi, CsgScope } from './csg';
import { hullOf, trimByPlane } from './csg';
import type { LoftSpec } from './loft';
import { loftPoints, offsetLoft } from './loft';
import type { Plane, ShapeSpec } from './shape';

function loftSolid(csg: CsgApi, scope: CsgScope, spec: LoftSpec, cut: Plane | null, segments: number): Manifold {
  const hull = hullOf(csg, scope, loftPoints(spec, segments));
  return cut ? trimByPlane(scope, hull, cut.n, cut.offset) : hull;
}

export function outerSolid(csg: CsgApi, scope: CsgScope, spec: ShapeSpec, segments: number): Manifold {
  return loftSolid(csg, scope, spec.outer, spec.outerCut, segments);
}

/** The closed cavity, shrunk by `delta` on every side (0 = the cavity itself). */
export function innerSolid(csg: CsgApi, scope: CsgScope, spec: ShapeSpec, segments: number, delta = 0): Manifold {
  const cut = spec.innerCut ? { n: spec.innerCut.n, offset: spec.innerCut.offset + delta } : null;
  return loftSolid(csg, scope, offsetLoft(spec.inner, delta), cut, segments);
}

export function shellSolid(csg: CsgApi, scope: CsgScope, spec: ShapeSpec, segments: number): Manifold {
  const outer = outerSolid(csg, scope, spec, segments);
  const inner = innerSolid(csg, scope, spec, segments);
  return scope.keep(outer.subtract(inner));
}
