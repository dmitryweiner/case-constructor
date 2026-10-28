// The knuckles of a hinged case (plans/PLAN-HINGED.md, H3). Worker only:
// the layout is pure (`hinge.ts`), this turns it into solids.
//
// A knuckle is the convex hull of its barrel and a strip of its half's hinge
// wall, sunk a little into the wall: a barrel on a web, whose underside leans
// at 45° at most so the body prints opening up without supports. Where the
// lid is, the web keeps `KNUCKLE_LID_GAP` off the wall, so the lid lifts past
// it.

import type { Manifold } from 'manifold-3d';
import type { CsgApi, CsgScope } from './csg';
import { hullOf, transformSolid, unionAll } from './csg';
import type { Dims } from './face';
import type { HalfHinge } from './hinge';
import { KNUCKLE_LID_GAP, KNUCKLE_SINK, knuckleStrip } from './hinge';
import { box, cylinder, roundSegments } from './standoffs';
import type { Affine, Vec3 } from './surface';

export function knuckleSolids(
  csg: CsgApi, scope: CsgScope, hinge: HalfHinge, dims: Dims, edgeR: number, body: readonly [number, number], segments: number,
): { material: Manifold; holes: Manifold } | null {
  const { r, e, zAxis } = hinge;
  const strip = knuckleStrip({ h: dims.h, edgeR, zAxis, r, e, body });
  if (!strip || hinge.runs.length === 0) return null;
  // u outward from the hinge wall's outer face
  const back = hinge.wall === 'back';
  const at = (x: number, u: number, z: number): Vec3 => [x, back ? dims.d + u : -u, z];
  const n = roundSegments(segments);
  const knuckles = hinge.runs.map((run) => {
    const points: Vec3[] = [];
    for (const x of [run.x0, run.x1]) {
      for (let i = 0; i < n; i++) {
        const a = (2 * Math.PI * i) / n;
        points.push(at(x, e + r * Math.cos(a), zAxis + r * Math.sin(a)));
      }
      for (const z of strip) points.push(at(x, -KNUCKLE_SINK, z));
    }
    return hullOf(csg, scope, points);
  });
  // beyond the strip the web keeps off the wall: there is the lid, or the fillet
  const x0 = Math.min(...hinge.runs.map((run) => run.x0)) - 1;
  const x1 = Math.max(...hinge.runs.map((run) => run.x1)) + 1;
  const reach = e + r + 1;
  const keepOff = (z0: number, z1: number): Manifold => {
    const [ua, ub] = [-KNUCKLE_SINK - 1, KNUCKLE_LID_GAP];
    const [ya, yb] = back ? [dims.d + ua, dims.d + ub] : [-ub, -ua];
    return box(csg, scope, x0, ya, z0, x1, yb, z1);
  };
  const off = unionAll(csg, scope, [keepOff(zAxis - reach - 1, strip[0]), keepOff(strip[1], zAxis + reach + 1)]);
  const material = scope.keep(unionAll(csg, scope, knuckles).subtract(off));
  // a pin's hole through each block, along x: a cylinder along z turned onto the axis
  const holes = unionAll(csg, scope, hinge.blocks.map((block) => {
    const turn: Affine = [0, 0, 1, 0, 0, 1, 0, back ? dims.d + e : -e, -1, 0, 0, zAxis];
    return transformSolid(scope, cylinder(csg, scope, 0, 0, block.x0 - 1, block.x1 + 1, hinge.holeR, n), turn);
  }));
  return { material, holes };
}
