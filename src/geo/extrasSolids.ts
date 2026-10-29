// The additive extras, built by the worker: ear tabs for wall mounting, the
// pads and feet of closed keyholes, and the labels' reliefs.
// Worker only.

import type { CrossSection, Manifold } from 'manifold-3d';
import type { CsgApi, CsgScope } from './csg';
import { extrude, transformSolid, unionAll } from './csg';
import { cuttersSolid } from './cut';
import type { ClosedKeyholes, EarSpec, LabelState } from './extras';
import { PAD_R } from './extras';
import type { FaceFrame } from './face';
import type { LabelRaster } from './label';
import type { Affine } from './surface';
import { rasterRuns } from './label';

/**
 * Ear tabs in the plate of the face against the wall, flush with it:
 * material and holes, case frame, the lid's and the body's apart.
 */
export function earSolids(
  csg: CsgApi, scope: CsgScope, ears: readonly EarSpec[], frame: FaceFrame, plate: number, segments: number,
): { onLid: boolean; material: Manifold; holes: Manifold }[] {
  const n = Math.max(16, segments * 4);
  return [false, true].flatMap((onLid) => {
    const mine = ears.filter((ear) => ear.onLid === onLid);
    if (mine.length === 0) return [];
    const material: Manifold[] = [];
    const holes: Manifold[] = [];
    for (const ear of mine) {
      const outline = scope.keep(new csg.CrossSection([ear.outline], 'Positive'));
      // rounded corners: shrink, then grow back
      const rounded = scope.keep(scope.keep(scope.keep(outline.offset(-3, 'Round', 2, n)).offset(3, 'Round', 2, n)).simplify(1e-3));
      material.push(transformSolid(scope, extrude(csg, scope, rounded, -plate, 0), frame.fromFace));
      const hole = scope.keep(csg.Manifold.cylinder(plate + 2, ear.d / 2, ear.d / 2, n));
      holes.push(transformSolid(scope, scope.keep(hole.translate([ear.hu, ear.hv, -plate - 1])), frame.fromFace));
    }
    return [{ onLid, material: unionAll(csg, scope, material), holes: unionAll(csg, scope, holes) }];
  });
}

/** How far a pad reaches into its plate, so the union never meets on a coplanar face, mm. */
const PAD_SINK = 0.5;

/**
 * Pads and feet of closed keyholes, case frame: rounded rectangles on the
 * face, from just inside the plate to `height` out of it; and the pockets,
 * to be cut once the pads are on.
 */
export function keyholePadSolids(
  csg: CsgApi, scope: CsgScope, closed: ClosedKeyholes, frame: FaceFrame, segments: number,
): { material: Manifold; holes: Manifold | null } {
  const n = Math.max(16, segments * 4);
  const material = closed.pads.map((pad) => {
    const r = Math.min(PAD_R, (pad.u1 - pad.u0) / 2 - 0.01, (pad.v1 - pad.v0) / 2 - 0.01);
    const core = scope.keep(csg.CrossSection.square([pad.u1 - pad.u0 - 2 * r, pad.v1 - pad.v0 - 2 * r], true));
    const rounded = scope.keep(scope.keep(scope.keep(core.offset(r, 'Round', 2, n)).simplify(1e-3))
      .translate([(pad.u0 + pad.u1) / 2, (pad.v0 + pad.v1) / 2]));
    return transformSolid(scope, extrude(csg, scope, rounded, -PAD_SINK, closed.height), frame.fromFace);
  });
  return { material: unionAll(csg, scope, material), holes: cuttersSolid(csg, scope, closed.cutters, segments) };
}

/**
 * A label's relief on its face, case frame: raised from just inside the
 * plate to `depth` above it, or engraved from `depth` below the surface to
 * above it. The ink is the union of the raster's row runs.
 */
export function labelSolid(
  csg: CsgApi, scope: CsgScope, label: LabelState, raster: LabelRaster, fromFace: Affine,
  centre: { u: number; v: number }, depth: number,
): Manifold | null {
  const runs = rasterRuns(raster);
  if (runs.length === 0) return null;
  let ink: CrossSection = scope.keep(csg.CrossSection.union(runs.map((run) => scope.keep(new csg.CrossSection([run], 'Positive')))));
  ink = scope.keep(ink.simplify(raster.mmPerPx / 4));
  ink = scope.keep(scope.keep(ink.rotate(label.angle)).translate([centre.u, centre.v]));
  const relief = label.raised ? extrude(csg, scope, ink, -0.05, depth) : extrude(csg, scope, ink, -depth, 1);
  return transformSolid(scope, relief, fromFace);
}
