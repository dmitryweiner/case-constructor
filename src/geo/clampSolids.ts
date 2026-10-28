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
import { CLAMP_BAR_T, CLAMP_BAR_W, PAD_FIT, PAD_IN, PAD_LIP, PAD_W, clampHold, clampPads } from './clamp';

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
  const posts = hold.bars.flatMap((bar) => bar.posts.map((side): Support => {
    const [x, y] = applyAffine(board.toCase, [...spot(hold.across, side, bar.at), 0]);
    return {
      base: [x, y, floor / 2],
      material: cylinder(csg, scope, x, y, floor - SINK, top, r, n),
      holes: postHole(csg, scope, spec, x, y, floor, top, [centre[0], centre[1]], n),
    };
  }));
  return [...posts, ...clampPadSolids(csg, scope, board, floor)];
}

/**
 * The pads between a clamped board's front and the plate, for the board as
 * `upsideDown` gives it: from the plate to its front, and a lip beyond its
 * edge down past its thickness. Box corners in the board frame, turned into
 * the case like the posts.
 */
/** Below this gap the board lies on the plate itself, mm. */
const PAD_GAP_MIN = 0.05;

function clampPadSolids(csg: CsgApi, scope: CsgScope, board: PlacedBoard, floor: number): Support[] {
  const hold = clampHold(board.def, board.placement);
  const { w, d, t } = board.def.size;
  const width = hold.across === 'x' ? w : d;
  // turned upside down, the board's front faces the plate at z0, its back at z0 + t
  const front = board.z0;
  return clampPads(board.def, board.placement).map((pad): Support => {
    const [c0, c1] = pad.side === 0 ? [-PAD_FIT - PAD_LIP, PAD_IN] : [width - PAD_IN, width + PAD_FIT + PAD_LIP];
    const [l0, l1] = pad.side === 0 ? [-PAD_FIT - PAD_LIP, -PAD_FIT] : [width + PAD_FIT, width + PAD_FIT + PAD_LIP];
    const block = (a0: number, a1: number, z1: number): Manifold => {
      const [x0, y0] = spot(hold.across, a0, pad.at - PAD_W / 2);
      const [x1, y1] = spot(hold.across, a1, pad.at + PAD_W / 2);
      return box(csg, scope, x0, y0, floor - SINK - front, x1, y1, z1 - front);
    };
    // in the board frame, then into the case: z measured from its PCB underside there, which is the front turned over
    // with no gap the plate is the pad: only the lip
    const gap = front - floor;
    const local = gap > PAD_GAP_MIN ? unionAll(csg, scope, [block(c0, c1, front), block(l0, l1, front + t)]) : block(l0, l1, front + t);
    const material = transformSolid(scope, local, board.toCase);
    const [bx, by] = applyAffine(board.toCase, [...spot(hold.across, (c0 + c1) / 2, pad.at), 0]);
    return { base: [bx, by, floor / 2], material, holes: null };
  });
}

/**
 * The bars of a clamped panel, case frame, as screwed down: across its back
 * from post to post (or a tab from a post to a back hole), a through hole
 * over each post and over each of the panel's own back holes.
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
    // from its posts to its holes, a boss's radius beyond each end
    const ends = [...bar.posts, ...bar.holes];
    const [a0, b0] = spot(hold.across, Math.min(...ends) - r, bar.at - CLAMP_BAR_W / 2);
    const [a1, b1] = spot(hold.across, Math.max(...ends) + r, bar.at + CLAMP_BAR_W / 2);
    const solid = box(csg, scope, a0, b0, z0, a1, b1, hold.face);
    const holes = [
      ...bar.posts.map((side) => cylinder(csg, scope, ...spot(hold.across, side, bar.at), z0 - 1, hold.face + 1, post, n)),
      ...bar.holes.map((side) => cylinder(csg, scope, ...spot(hold.across, side, bar.at), z0 - 1, hold.face + 1, panel, n)),
    ];
    return scope.keep(solid.subtract(unionAll(csg, scope, holes)));
  });
  return transformSolid(scope, unionAll(csg, scope, bars), board.toCase);
}
