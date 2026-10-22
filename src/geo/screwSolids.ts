// Printed screws and their threads as solids. Worker only; sizes and the
// thread's section come from thread.ts.

import type { Manifold } from 'manifold-3d';
import type { CsgApi, CsgScope } from './csg';
import type { ScrewShape, ThreadSize } from './thread';
import { THREADS, minorRadius, threadSection } from './thread';

/**
 * A threaded rod (or, grown by the fit, the core of a threaded hole) from z0
 * to z1 along z: the thread's section extruded with a twist of 360° per
 * pitch, a slice per point of the section and turn, so its vertices run
 * along the helix.
 */
export function threadSolid(csg: CsgApi, scope: CsgScope, size: ThreadSize, grow: number, z0: number, z1: number, n: number): Manifold {
  const { pitch } = THREADS[size];
  const turns = (z1 - z0) / pitch;
  const section = scope.keep(new csg.CrossSection([threadSection(size, grow, n)], 'Positive'));
  const rod = scope.keep(section.extrude(z1 - z0, Math.max(1, Math.round(turns * n)), 360 * turns));
  return scope.keep(rod.translate([0, 0, z0]));
}

/**
 * A printed screw in its own frame: the head from z = −headH to 0, the
 * shank from 0 to `shank`. The head is knurled for the fingers and slotted
 * for a screwdriver (the slot is at its outer end, on the bed when it
 * prints standing on its head); the tip is chamfered at 45° to find the
 * thread.
 */
export function screwSolid(csg: CsgApi, scope: CsgScope, shape: ScrewShape, n: number): Manifold {
  const R = THREADS[shape.size].d / 2;
  const r = minorRadius(shape.size);
  const headR = shape.headD / 2;
  // knurls: half-round grooves around the rim, about 2.5 mm apart
  const knurls = Math.max(8, Math.round((Math.PI * shape.headD) / 2.5));
  const disc = scope.keep(csg.CrossSection.circle(headR, Math.max(n, knurls * 4)));
  const grooves = Array.from({ length: knurls }, (_, i) => {
    const a = (2 * Math.PI * i) / knurls;
    return scope.keep(scope.keep(csg.CrossSection.circle(0.6, 12)).translate([headR * Math.cos(a), headR * Math.sin(a)]));
  });
  const knurled = scope.keep(disc.subtract(scope.keep(csg.CrossSection.union(grooves))));
  const headSolid = scope.keep(scope.keep(knurled.extrude(shape.headH)).translate([0, 0, -shape.headH]));
  const slot = scope.keep(scope.keep(csg.Manifold.cube([shape.headD + 2, shape.slotW, shape.slotDepth + 1], true))
    .translate([0, 0, -shape.headH + (shape.slotDepth - 1) / 2]));
  const head = scope.keep(headSolid.subtract(slot));

  // the thread starts inside the head, so the two never meet on a plane
  const thread = threadSolid(csg, scope, shape.size, 0, -0.5, shape.shank, n);
  const chamfer = R - r + 1;
  const outline = scope.keep(new csg.CrossSection([[
    [0, -1], [R + 0.5, -1], [R + 0.5, shape.shank - chamfer], [r - 0.5, shape.shank], [0, shape.shank],
  ]], 'Positive'));
  const mask = scope.keep(outline.revolve(n));
  const shank = scope.keep(thread.intersect(mask));
  return scope.keep(head.add(shank));
}
