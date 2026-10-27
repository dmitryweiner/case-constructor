// A hung display's glass seat as solids (plans/PLAN-DISPLAYS.md D3). Worker
// only; the numbers are in rim.ts.

import type { CrossSection, Manifold } from 'manifold-3d';
import type { Glass } from '../boards/schema';
import { onFace } from '../boards/schema';
import type { CsgApi, CsgScope } from './csg';
import { extrude, transformSolid, unionAll } from './csg';
import type { PlacedBoard } from './layout';
import { RIM_FIT, RIM_PART_GAP, RIM_W, rimsOf } from './rim';
import type { Support } from './standoffs';
import { SINK, box, roundSegments } from './standoffs';
import { applyAffine } from './surface';

/** A glass's outline grown by `grow`, board frame. */
function glassSection(csg: CsgApi, scope: CsgScope, glass: Glass, grow: number, n: number): CrossSection {
  if (glass.shape === 'round') return scope.keep(scope.keep(csg.CrossSection.circle(glass.w / 2 + grow, n)).translate([glass.x, glass.y]));
  const r = Math.min(glass.r, glass.w / 2 - 0.01, glass.d / 2 - 0.01);
  const core = scope.keep(scope.keep(csg.CrossSection.square([glass.w - 2 * r, glass.d - 2 * r], true)).translate([glass.x, glass.y]));
  const round = r + grow;
  // clipper leaves near-duplicate arc vertices: simplify (CLAUDE.md)
  return round > 0 ? scope.keep(scope.keep(core.offset(round, 'Round', 2, n)).simplify(1e-3)) : core;
}

/**
 * The rims of a hung board, case frame, as supports: they go to the part
 * that owns the top plate, as the board's standoffs do. Each steps aside for
 * the board's other parts on top that reach its height.
 */
export function rimSolids(csg: CsgApi, scope: CsgScope, board: PlacedBoard, plate: number, segments: number): Support[] {
  const n = roundSegments(segments) * 2;
  const { t } = board.def.size;
  return rimsOf(board).map((rim) => {
    const ring = scope.keep(glassSection(csg, scope, rim.glass, RIM_FIT + RIM_W, n).subtract(glassSection(csg, scope, rim.glass, RIM_FIT, n)));
    let solid = extrude(csg, scope, ring, rim.z0, rim.z1 + SINK);
    const parts = board.def.ports.flatMap((port) => {
      if (!onFace(port) || port.edge !== 'top' || port.id === rim.port || t + port.h + RIM_PART_GAP <= rim.z0) return [];
      const hw = port.w / 2 + RIM_PART_GAP;
      const hd = (port.shape === 'round' ? port.w : port.d) / 2 + RIM_PART_GAP;
      return [box(csg, scope, port.x - hw, port.y - hd, t - 0.1, port.x + hw, port.y + hd, t + port.h + RIM_PART_GAP)];
    });
    if (parts.length > 0) solid = scope.keep(solid.subtract(unionAll(csg, scope, parts)));
    const base = applyAffine(board.toCase, [rim.glass.x, rim.glass.y, rim.z1 + plate / 2]);
    return { base, material: transformSolid(scope, solid, board.toCase), holes: null };
  });
}

/**
 * Where a hung board's own supports must not go: its glass grown by the
 * rim's fit, from its PCB up to the plate, case frame; null without a glass.
 */
export function glassKeepOut(csg: CsgApi, scope: CsgScope, board: PlacedBoard, segments: number): Manifold | null {
  const n = roundSegments(segments) * 2;
  const solids = rimsOf(board).map((rim) => extrude(csg, scope, glassSection(csg, scope, rim.glass, RIM_FIT, n), board.def.size.t - 0.1, rim.z1));
  if (solids.length === 0) return null;
  return transformSolid(scope, unionAll(csg, scope, solids), board.toCase);
}
