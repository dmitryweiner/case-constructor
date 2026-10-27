// A clamped panel's posts and bars (plans/PLAN-DISPLAYS.md D5). Worker only;
// the numbers are in clamp.ts.

import type { Manifold } from 'manifold-3d';
import type { CsgApi, CsgScope } from './csg';
import { transformSolid, unionAll } from './csg';
import { SCREWS, THROUGH_CLEARANCE, bossDiameter } from './fasteners';
import type { PlacedBoard } from './layout';
import type { Support } from './standoffs';
import { SINK, box, cylinder, postHole, roundSegments } from './standoffs';
import { applyAffine } from './surface';
import { CLAMP_BAR_T, CLAMP_BAR_W, clampHold } from './clamp';

/** A post's or a hole's (x, y) in the board frame: `side` along the bars, `at` the bar's place. */
function spot(across: 'x' | 'y', side: number, at: number): [number, number] {
  return across === 'x' ? [side, at] : [at, side];
}

/**
 * The posts of a clamped panel, for the panel as `upsideDown` gives it (its
 * plate the floor): from the plate to the bars' face, with the standoffs'
 * hole kinds, the nut slots pointing at the panel.
 */
export function clampPosts(csg: CsgApi, scope: CsgScope, board: PlacedBoard, floor: number, segments: number): Support[] {
  const hold = clampHold(board.def, board.placement);
  const spec = board.placement.mount;
  const r = bossDiameter(spec) / 2;
  const n = roundSegments(segments);
  // turned upside down, a height above the panel's back is measured down from its front
  const top = board.z0 + board.def.size.t - hold.face;
  const centre = applyAffine(board.toCase, [board.def.size.w / 2, board.def.size.d / 2, 0]);
  return hold.bars.flatMap((bar) => hold.posts.map((side): Support => {
    const [x, y] = applyAffine(board.toCase, [...spot(hold.across, side, bar.at), 0]);
    return {
      base: [x, y, floor / 2],
      material: cylinder(csg, scope, x, y, floor - SINK, top, r, n),
      holes: postHole(csg, scope, spec, x, y, floor, top, [centre[0], centre[1]], n),
    };
  }));
}

/**
 * The bars of a clamped panel, case frame, as screwed down: across its back
 * from post to post, a through hole over each post and over each of the
 * panel's own back holes.
 */
export function clampBars(csg: CsgApi, scope: CsgScope, board: PlacedBoard, segments: number): Manifold {
  const hold = clampHold(board.def, board.placement);
  const spec = board.placement.mount;
  const n = roundSegments(segments);
  const r = bossDiameter(spec) / 2;
  const post = (SCREWS[spec.size].d + THROUGH_CLEARANCE) / 2;
  const panel = (SCREWS[board.def.mount.screw].d + THROUGH_CLEARANCE) / 2;
  const z0 = hold.face - CLAMP_BAR_T;
  const bars = hold.bars.map((bar) => {
    const [a0, b0] = spot(hold.across, hold.posts[0] - r, bar.at - CLAMP_BAR_W / 2);
    const [a1, b1] = spot(hold.across, hold.posts[1] + r, bar.at + CLAMP_BAR_W / 2);
    const solid = box(csg, scope, a0, b0, z0, a1, b1, hold.face);
    const holes = [
      ...hold.posts.map((side) => cylinder(csg, scope, ...spot(hold.across, side, bar.at), z0 - 1, hold.face + 1, post, n)),
      ...bar.holes.map((side) => cylinder(csg, scope, ...spot(hold.across, side, bar.at), z0 - 1, hold.face + 1, panel, n)),
    ];
    return scope.keep(solid.subtract(unionAll(csg, scope, holes)));
  });
  return transformSolid(scope, unionAll(csg, scope, bars), board.toCase);
}
