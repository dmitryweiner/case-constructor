// Rails on screws (plans/PLAN-IMPROVEMENTS-2026-10-29.md, N2): the rail
// printed apart, an ear at each end, and the posts of the case under the
// ears. Worker only; where things go is `rails.ts`.
//
// The posts are supports like standoffs (the part that owns the floor gets
// them, their holes are drilled after the union); the rail rides along in
// `Support.loose`, as screwed down and in its own frame, so a hung board's
// rail turns with its posts and still prints the one way.

import type { Manifold } from 'manifold-3d';
import type { CsgApi, CsgScope } from './csg';
import { hullOf, transformSolid, unionAll } from './csg';
import { SCREWS, THROUGH_CLEARANCE } from './fasteners';
import type { PlacedBoard } from './layout';
import { railEdges } from './layout';
import { RAIL_SEAT, earCentres, earLevels, earOutline, railEarR, railKeepOut, railScrewSpec } from './rails';
import type { Support } from './standoffs';
import { SINK, box, cylinder, postHole, railLocal, railToBoard, roundSegments } from './standoffs';
import type { Affine, Vec3 } from './surface';
import { applyAffine, composeAffine } from './surface';

/** Half a turn about the rail's length: its top, ears and all, goes on the bed. */
const TOP_DOWN: Affine = [1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, 0];
/** Room between two rails on the bed, mm. */
const BED_GAP = 4;

/** The rails of one board, printed apart: each a support (its two posts) carrying its rail. */
export function screwedRails(csg: CsgApi, scope: CsgScope, board: PlacedBoard, floor: number, segments: number): Support[] {
  const { w, d, t } = board.def.size;
  const height = board.z0 - floor;
  const spec = railScrewSpec(board.placement.mount);
  const r = railEarR(board.placement.mount);
  const ears = board.placement.railEars ?? 'out';
  const level = earLevels(t);
  const through = (SCREWS[spec.size].d + THROUGH_CLEARANCE) / 2;
  const n = roundSegments(segments);
  const centre = applyAffine(board.toCase, [w / 2, d / 2, 0]);
  return railEdges(board.def).map((edge): Support => {
    const { local: bar, length } = railLocal(csg, scope, board, edge, -height + RAIL_SEAT);
    const spots = earCentres(ears, length, r);
    const toCase = composeAffine(board.toCase, railToBoard(edge, w, d));
    let earSolids = unionAll(csg, scope, spots.map((spot) => {
      const outline = earOutline(ears, spot, length, r, n);
      return hullOf(csg, scope, outline.flatMap(([u, s]): Vec3[] => [[u, s, level.bottom], [u, s, level.top]]));
    }));
    if (ears === 'along') {
      // nothing over the board's ends: the ear meets the rail outside the board's edge
      const keep = railKeepOut(length);
      earSolids = scope.keep(earSolids.subtract(box(csg, scope, keep.u0, -50, level.bottom - 1, keep.u1, keep.s1, level.top + 1)));
    }
    const earHoles = spots.map(([u, s]) => cylinder(csg, scope, u, s, level.bottom - 1, level.top + 1, through, n));
    const local = scope.keep(scope.keep(bar.add(earSolids)).subtract(unionAll(csg, scope, earHoles)));
    // a post under each ear, a seat's room under it, the screw's hole down it
    const top = board.z0 + level.bottom - RAIL_SEAT;
    const posts: Manifold[] = [];
    const holes: Manifold[] = [];
    for (const [u, s] of spots) {
      const [x, y] = applyAffine(toCase, [u, s, 0]);
      posts.push(cylinder(csg, scope, x, y, floor - SINK, top, r, n));
      holes.push(postHole(csg, scope, spec, x, y, floor, top, [centre[0], centre[1]], n));
    }
    return {
      base: [centre[0], centre[1], floor / 2],
      material: unionAll(csg, scope, posts),
      holes: unionAll(csg, scope, holes),
      loose: { solid: transformSolid(scope, local, toCase), local },
    };
  });
}

/** Rails as they print: each top down (its ears on the bed), one behind the other from the origin. */
export function railsForPrint(csg: CsgApi, scope: CsgScope, locals: readonly Manifold[]): Manifold | null {
  if (locals.length === 0) return null;
  let y0 = 0;
  const placed = locals.map((local) => {
    const turned = transformSolid(scope, local, TOP_DOWN);
    const { min, max } = turned.boundingBox();
    const moved = scope.keep(turned.translate([-min[0], y0 - min[1], -min[2]]));
    y0 += max[1] - min[1] + BED_GAP;
    return moved;
  });
  return unionAll(csg, scope, placed);
}

