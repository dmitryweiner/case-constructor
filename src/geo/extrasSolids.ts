// The additive extras, built by the worker: ear tabs for wall mounting and
// the label's relief on the lid. Worker only.

import type { CrossSection, Manifold } from 'manifold-3d';
import type { CsgApi, CsgScope } from './csg';
import { extrude, transformSolid, unionAll } from './csg';
import type { EarSpec, LabelState } from './extras';
import type { FaceFrame } from './face';
import type { LabelRaster } from './label';
import { rasterRuns } from './label';

/** Ear tabs at floor level: material and holes, case frame. */
export function earSolids(csg: CsgApi, scope: CsgScope, ears: readonly EarSpec[], floor: number, segments: number): { material: Manifold; holes: Manifold } | null {
  if (ears.length === 0) return null;
  const n = Math.max(16, segments * 4);
  const material: Manifold[] = [];
  const holes: Manifold[] = [];
  for (const ear of ears) {
    const rect = scope.keep(new csg.CrossSection([[[ear.x0, ear.y0], [ear.x1, ear.y0], [ear.x1, ear.y1], [ear.x0, ear.y1]]], 'Positive'));
    // rounded corners: shrink, then grow back
    const rounded = scope.keep(scope.keep(scope.keep(rect.offset(-3, 'Round', 2, n)).offset(3, 'Round', 2, n)).simplify(1e-3));
    material.push(extrude(csg, scope, rounded, 0, floor));
    const hole = scope.keep(csg.Manifold.cylinder(floor + 2, ear.d / 2, ear.d / 2, n));
    holes.push(scope.keep(hole.translate([ear.hx, ear.hy, -1])));
  }
  return { material: unionAll(csg, scope, material), holes: unionAll(csg, scope, holes) };
}

/**
 * The label's relief on the lid's outer face, case frame: raised from just
 * inside the plate to `depth` above it, or engraved from `depth` below the
 * surface to above it. The ink is the union of the raster's row runs.
 */
export function labelSolid(
  csg: CsgApi, scope: CsgScope, label: LabelState, raster: LabelRaster, frame: FaceFrame,
  centre: { u: number; v: number }, depth: number,
): Manifold | null {
  const runs = rasterRuns(raster);
  if (runs.length === 0) return null;
  let ink: CrossSection = scope.keep(csg.CrossSection.union(runs.map((run) => scope.keep(new csg.CrossSection([run], 'Positive')))));
  ink = scope.keep(ink.simplify(raster.mmPerPx / 4));
  ink = scope.keep(scope.keep(ink.rotate(label.angle)).translate([centre.u, centre.v]));
  const relief = label.raised ? extrude(csg, scope, ink, -0.05, depth) : extrude(csg, scope, ink, -depth, 1);
  return transformSolid(scope, relief, frame.fromFace);
}
