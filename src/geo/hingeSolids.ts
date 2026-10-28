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
): { material: Manifold; holes: Manifold | null } | null {
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
  // along the axis: a cylinder (or a hex prism) along z turned onto it (z → x)
  const turn: Affine = [0, 0, 1, 0, 0, 1, 0, back ? dims.d + e : -e, -1, 0, 0, zAxis];
  const along = (solid: Manifold): Manifold => transformSolid(scope, solid, turn);
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
  // a snap: the lower half's bar on the axis between its neighbouring knuckles
  const { snap } = hinge.holes;
  const bars = snap && back ? hinge.blocks.flatMap((block) => {
    const own = hinge.runs.filter((run) => run.x0 >= block.x0 - 1e-6 && run.x1 <= block.x1 + 1e-6);
    return own.slice(1).map((run, i) => along(cylinder(csg, scope, 0, 0, own[i].x1 - 1, run.x0 + 1, snap.barR, n)));
  }) : [];
  const material = scope.keep(unionAll(csg, scope, [...knuckles, ...bars]).subtract(off));
  const { holes: axle } = hinge;
  // a snap: the upper half's knuckles are rings around the bar, split outwards from their wall
  if (snap) {
    if (back) return { material, holes: null };
    const rings = hinge.runs.flatMap((run) => {
      const ring = along(cylinder(csg, scope, 0, 0, run.x0 - 1, run.x1 + 1, snap.ringR, n));
      const slit = box(csg, scope, run.x0 - 1, -e - r - 1, zAxis - snap.slit / 2, run.x1 + 1, -e, zAxis + snap.slit / 2);
      return [ring, slit];
    });
    return { material, holes: unionAll(csg, scope, rings) };
  }
  const holes = unionAll(csg, scope, hinge.blocks.flatMap((block) => {
    const through = along(cylinder(csg, scope, 0, 0, block.x0 - 1, block.x1 + 1, axle.r, n));
    if (!axle.screw) return [through];
    const { headR, headDepth, nutAF, nutDepth } = axle.screw;
    // the head sunk into the block's first knuckle, the nut into its last; a corner of the hex
    // up (along −x before the turn), so the pocket's roof prints as a 60° peak
    const head = along(cylinder(csg, scope, 0, 0, block.x0 - 1, block.x0 + headDepth, headR, n));
    const nut = along(cylinder(csg, scope, 0, 0, block.x1 - nutDepth, block.x1 + 1, nutAF / Math.sqrt(3), 6));
    return [through, head, nut];
  }));
  return { material, holes };
}
