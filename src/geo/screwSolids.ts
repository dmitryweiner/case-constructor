// Printed screws as solids. Worker only; sizes come from thread.ts, the
// threaded rod and hole from maker-kit's csg/thread.

import type { Manifold } from 'manifold-3d';
import type { CsgApi, CsgScope } from 'maker-kit/csg/manifold';
import { threadRod } from 'maker-kit/csg/thread';
import type { ScrewShape } from './thread';
import { minorRadius, perPoint } from './thread';

/**
 * A printed screw in its own frame: the head from z = −headH to 0, the
 * shank from 0 to `shank`. The head is knurled for the fingers and slotted
 * for a screwdriver (the slot is at its outer end, on the bed when it
 * prints standing on its head); the tip is chamfered at 45° to find the
 * thread.
 */
export function screwSolid(csg: CsgApi, scope: CsgScope, shape: ScrewShape, n: number): Manifold {
  const R = shape.form.d / 2;
  const r = minorRadius(shape.form);
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
  const slot = scope.keep(
    scope
      .keep(csg.Manifold.cube([shape.headD + 2, shape.slotW, shape.slotDepth + 1], true))
      .translate([0, 0, -shape.headH + (shape.slotDepth - 1) / 2]),
  );
  const head = scope.keep(headSolid.subtract(slot));

  // the thread starts inside the head, so the two never meet on a plane
  const thread = threadRod(csg, scope, shape.form, 0, -0.5, shape.shank, perPoint(n));
  const chamfer = R - r + 1;
  const outline = scope.keep(
    new csg.CrossSection(
      [
        [
          [0, -1],
          [R + 0.5, -1],
          [R + 0.5, shape.shank - chamfer],
          [r - 0.5, shape.shank],
          [0, shape.shank],
        ],
      ],
      'Positive',
    ),
  );
  const mask = scope.keep(outline.revolve(n));
  const shank = scope.keep(thread.intersect(mask));
  return scope.keep(head.add(shank));
}
