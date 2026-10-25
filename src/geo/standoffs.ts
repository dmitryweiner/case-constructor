// Board supports: standoffs with one of three hole kinds for boards with
// holes, two grooved rails for boards without. Worker only.
//
// A support is returned as material plus holes, kept apart: the material is
// unioned with whichever part owns the floor under it, the holes are
// subtracted afterwards (they reach into the floor, and a hole subtracted
// before the union would be filled again).

import type { Manifold } from 'manifold-3d';
import type { CsgApi, CsgScope } from './csg';
import { extrude, transformSolid } from './csg';
import { NUT_CLEARANCE, SCREWS, THROUGH_CLEARANCE, bossDiameter } from './fasteners';
import type { PlacedBoard } from './layout';
import {
  PIN_SLOT, PIN_SPACER, PIN_TIP_GAP, RAIL_GAP, RAIL_GRIP, RAIL_LIP, RAIL_SHORTEN, RAIL_THICK, pinEdges, railEdges, railReach,
} from './layout';
import { applyAffine } from './surface';

export interface Support {
  /** a point inside the floor under it, case frame — the part that owns it gets the support */
  base: [number, number, number];
  material: Manifold;
  holes: Manifold | null;
}

/** Skin left under every hole, so the floor stays closed. */
export const HOLE_SKIN = 0.8;
/** A nut pocket sits this far above the inner floor: room for the screw tip. */
export const NUT_LIFT = 2;
/** How far supports reach down into the floor, so the union never meets on a coplanar face. */
const SINK = 0.5;
const EPS = 0.05;

function cylinder(csg: CsgApi, scope: CsgScope, x: number, y: number, z0: number, z1: number, r: number, segments: number, r1 = r): Manifold {
  const solid = scope.keep(csg.Manifold.cylinder(z1 - z0, r, r1, segments));
  return scope.keep(solid.translate([x, y, z0]));
}

function box(csg: CsgApi, scope: CsgScope, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Manifold {
  const solid = scope.keep(csg.Manifold.cube([x1 - x0, y1 - y0, z1 - z0]));
  return scope.keep(solid.translate([x0, y0, z0]));
}

/** Segments around a small round feature at a given arc resolution. */
function roundSegments(segments: number): number {
  return Math.max(12, Math.round(segments * 2));
}

/** Standoffs of one board with holes. */
export function standoffs(csg: CsgApi, scope: CsgScope, board: PlacedBoard, floor: number, segments: number): Support[] {
  const spec = board.placement.mount;
  const dims = SCREWS[spec.size];
  const r = bossDiameter(spec) / 2;
  const top = board.z0;
  const n = roundSegments(segments);
  const centre = applyAffine(board.toCase, [board.def.size.w / 2, board.def.size.d / 2, 0]);
  return board.def.mount.holes.map((hole) => {
    const [x, y] = applyAffine(board.toCase, [hole.x, hole.y, 0]);
    const material = cylinder(csg, scope, x, y, floor - SINK, top, r, n);
    const bottom = HOLE_SKIN;
    let holes: Manifold;
    if (spec.hole === 'insert') {
      const depth = Math.min(dims.insertLen, top - bottom);
      const ri = dims.insert / 2;
      holes = scope.keep(csg.Manifold.union([
        cylinder(csg, scope, x, y, top - depth, top + EPS, ri, n),
        // a 0.5 mm chamfer guides the insert in
        cylinder(csg, scope, x, y, top - 0.5, top + EPS, ri, n, ri + 0.5 + EPS),
        cylinder(csg, scope, x, y, bottom, top - depth + EPS, dims.tap / 2, n),
      ]));
    } else if (spec.hole === 'nut') {
      const af = dims.nutAF + NUT_CLEARANCE;
      const pocketH = dims.nutH + NUT_CLEARANCE;
      const z0 = Math.max(bottom, Math.min(floor + NUT_LIFT, top - pocketH - HOLE_SKIN));
      const hex = scope.keep(csg.Manifold.cylinder(pocketH, af / Math.sqrt(3), af / Math.sqrt(3), 6));
      // The nut slides in through a slot pointing towards the board's centre:
      // there is room there before the board goes on, while a slot pointing
      // outwards would cut the wall next to a corner standoff.
      const angle = Math.atan2(centre[1] - y, centre[0] - x);
      const slot = box(csg, scope, 0, -af / 2, 0, r + 1, af / 2, pocketH);
      const pocket = scope.keep(scope.keep(hex.add(slot)).rotate([0, 0, (angle * 180) / Math.PI]));
      holes = scope.keep(csg.Manifold.union([
        scope.keep(pocket.translate([x, y, z0])),
        cylinder(csg, scope, x, y, bottom, top + EPS, (dims.d + THROUGH_CLEARANCE) / 2, n),
      ]));
    } else {
      holes = cylinder(csg, scope, x, y, bottom, top + EPS, dims.tap / 2, n);
    }
    return { base: [x, y, floor / 2], material, holes };
  });
}

/**
 * The pin bed's profile across the edge, (s outward, z up from the PCB
 * underside): the outer column and the upper lip as on a plain rail, no
 * lower lip; under it a shelf for the header's plastic, reaching inwards
 * past it, with a slot along the pin row down to just below the pin tips.
 */
function pinBedProfile(t: number, height: number, below: number, inset: number): [number, number][] {
  const s0 = RAIL_GAP - RAIL_GRIP;
  const slotIn = -inset - PIN_SLOT / 2;
  const slotOut = -inset + PIN_SLOT / 2;
  const sIn = -railReach({ inset });
  const shelf = -PIN_SPACER - RAIL_GAP;
  const tips = -below - PIN_TIP_GAP;
  const bottom = -height - SINK;
  return [
    [sIn, bottom], [s0 + RAIL_THICK, bottom], [s0 + RAIL_THICK, t + RAIL_LIP], [s0, t + RAIL_LIP],
    [s0, t + RAIL_GAP], [RAIL_GAP, t + RAIL_GAP], [RAIL_GAP, shelf], [slotOut, shelf],
    [slotOut, tips], [slotIn, tips], [slotIn, shelf], [sIn, shelf],
  ];
}

/**
 * Rails of one board without holes: a bar along each of two edges, from the
 * floor to `RAIL_LIP` above the PCB, with a groove `t + 2·gap` wide that
 * grips the edge `RAIL_GRIP` deep. Open at both ends and shorter than the
 * edge, so the board goes in diagonally and clicks into both grooves. An
 * edge with soldered pins gets the pin bed instead (`pinBedProfile`).
 */
export function rails(csg: CsgApi, scope: CsgScope, board: PlacedBoard, floor: number): Support[] {
  const { w, d, t } = board.def.size;
  const height = board.z0 - floor;
  const pinned = pinEdges(board);
  const pins = board.def.pins;
  return railEdges(board.def).map((edge) => {
    // build along +x in a local frame: s across the edge (outward +), z up from the PCB underside
    const length = (edge === 'front' || edge === 'back' ? w : d) - 2 * RAIL_SHORTEN;
    const s0 = RAIL_GAP - RAIL_GRIP;
    let local: Manifold;
    if (pins && pinned.includes(edge)) {
      // the profile in (s, z) extruded along u: (a, b, c) → (u, s, z) = (c, a, b)
      const prism = extrude(csg, scope, [pinBedProfile(t, height, pins.below, pins.inset)], 0, length);
      local = transformSolid(scope, prism, [0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0]);
    } else {
      const bar = box(csg, scope, 0, s0, -height - SINK, length, s0 + RAIL_THICK, t + RAIL_LIP);
      const groove = box(csg, scope, -EPS, s0 - EPS, -RAIL_GAP, length + EPS, RAIL_GAP, t + RAIL_GAP);
      local = scope.keep(bar.subtract(groove));
    }
    // local (u along the edge, s outward) → board frame
    // x = ux·u + sx·s + ox, y = uy·u + sy·s + oy; u runs so that (u, s, z) stays right-handed
    const place: Record<typeof edge, [number, number, number, number, number, number]> = {
      front: [-1, 0, w - RAIL_SHORTEN, 0, -1, 0],
      back: [1, 0, RAIL_SHORTEN, 0, 1, d],
      left: [0, -1, 0, 1, 0, RAIL_SHORTEN],
      right: [0, 1, w, -1, 0, d - RAIL_SHORTEN],
    };
    const [ux, sx, ox, uy, sy, oy] = place[edge];
    const toBoard: [number, number, number, number, number, number, number, number, number, number, number, number] =
      [ux, sx, 0, ox, uy, sy, 0, oy, 0, 0, 1, 0];
    const inBoard = transformSolid(scope, local, toBoard);
    const material = transformSolid(scope, inBoard, board.toCase);
    const mid = applyAffine(board.toCase, [w / 2, d / 2, 0]);
    return { base: [mid[0], mid[1], floor / 2], material, holes: null };
  });
}
