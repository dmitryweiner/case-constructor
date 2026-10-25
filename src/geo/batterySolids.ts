// Batteries held in the case: cradles under cells (corner stops around a
// pack) and the clamp's posts on the floor, and the printed clamp bars that
// go across the battery onto the posts. Worker only; every number comes from
// boards/battery.ts.

import type { Manifold } from 'manifold-3d';
import type { CsgApi, CsgScope } from './csg';
import { transformSolid, unionAll } from './csg';
import { THROUGH_CLEARANCE, SCREWS, bossDiameter } from './fasteners';
import type { PlacedBoard } from './layout';
import type { Support } from './standoffs';
import { SINK, box, cylinder, postHole, roundSegments } from './standoffs';
import { applyAffine } from './surface';
import type { BatterySpec } from '../boards/battery';
import {
  CLAMP_W, SADDLE_W, SADDLE_WRAP, SEAT_CLEARANCE, STOP_H, STOP_LEG, STOP_T, batteryHold, batterySize, cellCentres,
} from '../boards/battery';

/** A cylinder along x from x0 to x1 around (y, z), battery frame. */
function rod(csg: CsgApi, scope: CsgScope, x0: number, x1: number, y: number, z: number, r: number, n: number): Manifold {
  const along = scope.keep(scope.keep(csg.Manifold.cylinder(x1 - x0, r, r, n)).rotate([0, 90, 0]));
  return scope.keep(along.translate([x0, y, z]));
}

/** Cradles or corner stops, battery frame: from just into the floor (zf) up. */
function cradles(csg: CsgApi, scope: CsgScope, spec: BatterySpec, zf: number, n: number): Manifold[] {
  const size = batterySize(spec);
  if (spec.kind !== 'pack') {
    const r = size.h / 2;
    return batteryHold(spec).saddles.map((x) => {
      const x0 = x - SADDLE_W / 2;
      const x1 = x + SADDLE_W / 2;
      const block = box(csg, scope, x0, 0, zf - SINK, x1, size.d, SADDLE_WRAP * size.h);
      const seats = cellCentres(spec).map((y) => rod(csg, scope, x0 - 1, x1 + 1, y, r, r + SEAT_CLEARANCE, n));
      return scope.keep(block.subtract(unionAll(csg, scope, seats)));
    });
  }
  // a pack: an L-shaped stop outside each corner, and a pad under it when the pack is raised
  const top = Math.min(STOP_H, 0.6 * size.h);
  const sorted = (a: number, b: number): [number, number] => [Math.min(a, b), Math.max(a, b)];
  return ([[0, 0, -1, -1], [size.w, 0, 1, -1], [size.w, size.d, 1, 1], [0, size.d, -1, 1]] as const).flatMap(([cx, cy, sx, sy]) => {
    const [ax0, ax1] = sorted(cx + sx * STOP_T, cx - sx * STOP_LEG);
    const [ay0, ay1] = sorted(cy + sy * STOP_T, cy);
    const [bx0, bx1] = sorted(cx + sx * STOP_T, cx);
    const [by0, by1] = sorted(cy + sy * STOP_T, cy - sy * STOP_LEG);
    const legs = [box(csg, scope, ax0, ay0, zf - SINK, ax1, ay1, top), box(csg, scope, bx0, by0, zf - SINK, bx1, by1, top)];
    if (zf >= -1e-6) return legs;
    const [px0, px1] = sorted(cx, cx - sx * STOP_LEG);
    const [py0, py1] = sorted(cy, cy - sy * STOP_LEG);
    return [...legs, box(csg, scope, px0, py0, zf - SINK, px1, py1, 0)];
  });
}

/**
 * The supports of one battery, case frame: its cradles (or stops) and the
 * clamp posts, the posts' holes as for a board's standoffs (the nut slots
 * pointing at the battery).
 */
export function batterySupports(csg: CsgApi, scope: CsgScope, board: PlacedBoard, spec: BatterySpec, floor: number, segments: number): Support[] {
  const n = roundSegments(segments);
  const hold = batteryHold(spec);
  const size = batterySize(spec);
  const zf = floor - board.z0;
  const material: Manifold[] = cradles(csg, scope, spec, zf, n).map((solid) => transformSolid(scope, solid, board.toCase));
  const holes: Manifold[] = [];
  const mount = board.placement.mount;
  const r = bossDiameter(mount) / 2;
  const centre = applyAffine(board.toCase, [size.w / 2, size.d / 2, 0]);
  const top = board.z0 + hold.postTop;
  for (const x of hold.clamps) {
    for (const y of hold.posts) {
      const [px, py] = applyAffine(board.toCase, [x, y, 0]);
      material.push(cylinder(csg, scope, px, py, floor - SINK, top, r, n));
      holes.push(postHole(csg, scope, mount, px, py, floor, top, [centre[0], centre[1]], n));
    }
  }
  return [{ base: [centre[0], centre[1], floor / 2], material: unionAll(csg, scope, material), holes: unionAll(csg, scope, holes) }];
}

/**
 * The clamp bars of one battery, case frame, as they sit when screwed down:
 * across the battery onto its posts, seats under the cells `press` lower
 * than the cells, a through hole over each post.
 */
export function batteryClamps(csg: CsgApi, scope: CsgScope, board: PlacedBoard, spec: BatterySpec, segments: number): Manifold {
  const n = roundSegments(segments);
  const hold = batteryHold(spec);
  const size = batterySize(spec);
  const rb = bossDiameter(board.placement.mount) / 2;
  const through = (SCREWS[board.placement.mount.size].d + THROUGH_CLEARANCE) / 2;
  const r = size.h / 2;
  const bars = hold.clamps.map((x) => {
    const x0 = x - CLAMP_W / 2;
    const x1 = x + CLAMP_W / 2;
    let bar = box(csg, scope, x0, hold.posts[0] - rb, hold.postTop, x1, hold.posts[1] + rb, hold.barTop);
    const cells = cellCentres(spec).map((y) => rod(csg, scope, x0 - 1, x1 + 1, y, r - spec.press, r, n));
    const holes = hold.posts.map((y) => cylinder(csg, scope, x, y, hold.postTop - 1, hold.barTop + 1, through, n));
    bar = scope.keep(bar.subtract(unionAll(csg, scope, [...cells, ...holes])));
    return bar;
  });
  return transformSolid(scope, unionAll(csg, scope, bars), board.toCase);
}
