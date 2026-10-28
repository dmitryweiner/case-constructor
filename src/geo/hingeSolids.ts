// The hinge of a hinged case (plans/PLAN-HINGED.md, H3–H7). Worker only:
// the layout is pure (`hinge.ts`), this turns it into solids.
//
// Integral knuckles (H3): a knuckle is the convex hull of its barrel and a
// strip of its half's hinge wall, sunk a little into the wall: a barrel on a
// web, whose underside leans at 45° at most so the body prints opening up
// without supports. Where the lid is, the web keeps `KNUCKLE_LID_GAP` off
// the wall, so the lid lifts past it.
//
// A printed hinge (H7): each half's leaf is a plate on its hinge wall's
// outer face with its knuckles on pedestals, a separate part; screws go
// through the plate and the wall into a pad inside the wall. Printed as one
// piece in the closed pose, both plates on the bed.
//
// The axle (H3–H5, H7) is the same for both: a pin's or a screw's holes, a
// snap's bars and split rings, or cones printed in place in their sockets.

import type { Manifold } from 'manifold-3d';
import type { CsgApi, CsgScope } from './csg';
import { hullOf, transformSolid, unionAll } from './csg';
import type { Dims } from './face';
import type { HalfHinge, LeafLayout } from './hinge';
import { CONE_FIT, KNUCKLE_LID_GAP, KNUCKLE_SINK, knuckleStrip, padLength } from './hinge';
import type { FastenerSpec } from './fasteners';
import { NUT_CLEARANCE, SCREWS, THROUGH_CLEARANCE, bossDiameter, holeDiameter } from './fasteners';
import { box, cylinder, roundSegments } from './standoffs';
import type { Affine, Vec3 } from './surface';

/** Points and solids in a half's hinge frame: x along the hinge, u outward from the wall's outer face, z up. */
interface HingeFrame {
  at(x: number, u: number, z: number): Vec3;
  /** a solid built along z (a cylinder, a prism) turned onto the axis: z → x */
  along(solid: Manifold): Manifold;
  /** the same, turned onto the line (x, z) through the wall: z → −u (inwards) */
  across(solid: Manifold, x: number, z: number): Manifold;
  /** a box over x, u and z ranges */
  box(x0: number, x1: number, u0: number, u1: number, z0: number, z1: number): Manifold;
  n: number;
}

function hingeFrame(csg: CsgApi, scope: CsgScope, hinge: HalfHinge, dims: Dims, segments: number): HingeFrame {
  const back = hinge.wall === 'back';
  const y = (u: number): number => (back ? dims.d + u : -u);
  const turn: Affine = [0, 0, 1, 0, 0, 1, 0, y(hinge.e), -1, 0, 0, hinge.zAxis];
  return {
    at: (x, u, z) => [x, y(u), z],
    along: (solid) => transformSolid(scope, solid, turn),
    // local z → case −u: on the back wall that is −y, on the front wall +y
    across: (solid, x, z) => transformSolid(scope, solid, back
      ? [1, 0, 0, x, 0, 0, -1, dims.d, 0, 1, 0, z]
      : [1, 0, 0, x, 0, 0, 1, 0, 0, -1, 0, z]),
    box: (x0, x1, u0, u1, z0, z1) => {
      const [ya, yb] = back ? [y(u0), y(u1)] : [y(u1), y(u0)];
      return box(csg, scope, x0, ya, z0, x1, yb, z1);
    },
    n: roundSegments(segments),
  };
}

/** The axle's solids for one half: what it adds (a snap's bars, cones) and what it cuts (holes, seats, rings, sockets). */
function axleSolids(csg: CsgApi, scope: CsgScope, hinge: HalfHinge, frame: HingeFrame): { add: Manifold[]; cut: Manifold[] } {
  const { holes } = hinge;
  const { along, n } = frame;
  const lower = hinge.wall === 'back';
  const rod = (x0: number, x1: number, r0: number, r1 = r0, sides = n): Manifold => along(cylinder(csg, scope, 0, 0, x0, x1, r0, sides, r1));
  if (holes.snap) {
    const { snap } = holes;
    // the lower half's bars between its neighbouring knuckles; the upper half's rings, split outwards from its wall
    if (lower) {
      return {
        add: hinge.blocks.flatMap((block) => {
          const own = hinge.runs.filter((run) => run.x0 >= block.x0 - 1e-6 && run.x1 <= block.x1 + 1e-6);
          return own.slice(1).map((run, i) => rod(own[i].x1 - 1, run.x0 + 1, snap.barR));
        }),
        cut: [],
      };
    }
    return {
      add: [],
      cut: hinge.runs.flatMap((run) => [
        rod(run.x0 - 1, run.x1 + 1, snap.ringR),
        frame.box(run.x0 - 1, run.x1 + 1, hinge.e, hinge.e + hinge.r + 1, hinge.zAxis - snap.slit / 2, hinge.zAxis + snap.slit / 2),
      ]),
    };
  }
  if (holes.cones) {
    // the upper half's knuckles carry a cone on each end face; the lower half's knuckles take each in a socket
    const { r, reach } = holes.cones;
    const faces = (lower ? hinge.others : hinge.runs).flatMap((run) => [{ x: run.x0, dir: -1 }, { x: run.x1, dir: 1 }]);
    const len = hinge.clearance + reach;
    const cone = (x: number, dir: number, base: number, length: number, sink: number): Manifold => (dir > 0
      ? rod(x - sink, x + length, base + sink, base - length)
      : rod(x - length, x + sink, base - length, base + sink));
    if (!lower) return { add: faces.map((face) => cone(face.x, face.dir, r, len, 0.05)), cut: [] };
    const grow = CONE_FIT * Math.SQRT2;
    return { add: [], cut: faces.map((face) => cone(face.x, face.dir, r + grow, len + grow, 0)) };
  }
  return {
    add: [],
    cut: hinge.blocks.flatMap((block) => {
      const through = rod(block.x0 - 1, block.x1 + 1, holes.r);
      if (!holes.screw) return [through];
      const { headR, headDepth, nutAF, nutDepth } = holes.screw;
      // the head sunk into the block's first knuckle, the nut into its last; a corner of the hex
      // up (along −x before the turn), so the pocket's roof prints as a 60° peak
      return [through, rod(block.x0 - 1, block.x0 + headDepth, headR), rod(block.x1 - nutDepth, block.x1 + 1, nutAF / Math.sqrt(3), nutAF / Math.sqrt(3), 6)];
    }),
  };
}

/** A barrel's points at one end of a run, round the axis. */
function barrel(frame: HingeFrame, hinge: HalfHinge, x: number): Vec3[] {
  const { r, e, zAxis } = hinge;
  return Array.from({ length: frame.n }, (_, i) => {
    const a = (2 * Math.PI * i) / frame.n;
    return frame.at(x, e + r * Math.cos(a), zAxis + r * Math.sin(a));
  });
}

export function knuckleSolids(
  csg: CsgApi, scope: CsgScope, hinge: HalfHinge, dims: Dims, edgeR: number, body: readonly [number, number], segments: number,
): { material: Manifold; holes: Manifold | null } | null {
  const { r, e, zAxis } = hinge;
  const strip = knuckleStrip({ h: dims.h, edgeR, zAxis, r, e, body });
  if (!strip || hinge.runs.length === 0) return null;
  const frame = hingeFrame(csg, scope, hinge, dims, segments);
  const knuckles = hinge.runs.map((run) => hullOf(csg, scope, [run.x0, run.x1].flatMap((x) => [
    ...barrel(frame, hinge, x),
    ...strip.map((z) => frame.at(x, -KNUCKLE_SINK, z)),
  ])));
  // beyond the strip the web keeps off the wall: there is the lid, or the fillet
  const x0 = Math.min(...hinge.runs.map((run) => run.x0)) - 1;
  const x1 = Math.max(...hinge.runs.map((run) => run.x1)) + 1;
  const reach = e + r + 1;
  const keepOff = (z0: number, z1: number): Manifold => frame.box(x0, x1, -KNUCKLE_SINK - 1, KNUCKLE_LID_GAP, z0, z1);
  const off = unionAll(csg, scope, [keepOff(zAxis - reach - 1, strip[0]), keepOff(strip[1], zAxis + reach + 1)]);
  const axle = axleSolids(csg, scope, hinge, frame);
  const material = scope.keep(unionAll(csg, scope, [...knuckles, ...axle.add]).subtract(off));
  return { material, holes: axle.cut.length > 0 ? unionAll(csg, scope, axle.cut) : null };
}

/** The screw of a leaf and what it goes into. */
function leafFastener(leaf: LeafLayout): FastenerSpec {
  return { size: leaf.screw, hole: leaf.hole, head: 'none' };
}

/**
 * A half's leaf of a printed hinge, and what the half gets for it: the
 * screws' holes through its wall and pads inside the wall with what the
 * screws go into (a tapped hole, an insert's, a nut's pocket open inwards).
 */
export function leafSolids(
  csg: CsgApi, scope: CsgScope, hinge: HalfHinge, dims: Dims, wall: number, segments: number,
): { leaf: Manifold; pads: Manifold; holes: Manifold } | null {
  const { leaf } = hinge;
  if (!leaf || hinge.runs.length === 0) return null;
  const frame = hingeFrame(csg, scope, hinge, dims, segments);
  const { across, n } = frame;
  const knuckles = hinge.runs.map((run) => hullOf(csg, scope, [run.x0, run.x1].flatMap((x) => [
    ...barrel(frame, hinge, x),
    // on a pedestal past the axis, overlapping the plate a millimetre
    frame.at(x, 0, leaf.pedestal), frame.at(x, 0, leaf.z1 - 1), frame.at(x, leaf.t, leaf.z1 - 1),
  ])));
  const plates = hinge.blocks.map((block) => frame.box(block.x0, block.x1, 0, leaf.t, leaf.z0, leaf.z1));
  const axle = axleSolids(csg, scope, hinge, frame);
  const fastener = leafFastener(leaf);
  const dims0 = SCREWS[leaf.screw];
  const through = (dims0.d + THROUGH_CLEARANCE) / 2;
  // the screws' clearance through the plate (their pan heads sit on it)
  const plateHoles = leaf.screws.map((screw) => across(cylinder(csg, scope, 0, 0, -leaf.t - 1, 1, through, n), screw.x, leaf.z));
  const cut = [...axle.cut, ...plateHoles];
  let solid = unionAll(csg, scope, [...knuckles, ...plates, ...axle.add]);
  if (cut.length > 0) solid = scope.keep(solid.subtract(unionAll(csg, scope, cut)));
  // inside the wall: a pad per screw, a wedge on the wall (45° above and below, printable either way up)
  const length = padLength(leaf);
  const padR = bossDiameter(fastener) / 2;
  const pads = leaf.screws.map((screw) => hullOf(csg, scope, [
    ...Array.from({ length: n }, (_, i): Vec3 => {
      const a = (2 * Math.PI * i) / n;
      return frame.at(screw.x + padR * Math.cos(a), -wall - length, leaf.z + padR * Math.sin(a));
    }),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => frame.at(screw.x + sx * padR, -wall + 0.5, leaf.z + sz * (padR + length)))),
  ]));
  // the holes: clearance through the wall, then what the screw goes into, open towards the cavity
  const holes = leaf.screws.flatMap((screw) => {
    const at = (solid: Manifold): Manifold => across(solid, screw.x, leaf.z);
    const out = [at(cylinder(csg, scope, 0, 0, -1, wall + 0.5, through, n))];
    if (leaf.hole === 'nut') {
      const af = dims0.nutAF + NUT_CLEARANCE;
      const pocket = dims0.nutH + NUT_CLEARANCE;
      out.push(at(cylinder(csg, scope, 0, 0, wall, wall + length + 1, through, n)));
      out.push(at(cylinder(csg, scope, 0, 0, wall + length - pocket, wall + length + 1, af / Math.sqrt(3), 6)));
    } else {
      const r = holeDiameter(fastener) / 2;
      out.push(at(cylinder(csg, scope, 0, 0, wall, wall + length + 1, r, n)));
    }
    return out;
  });
  // the pads' wedges stop short of the lid's skirt and the plates
  const room = frame.box(-1, dims.w + 1, -wall - length - 1, 0, leaf.padZ[0], leaf.padZ[1]);
  return { leaf: solid, pads: scope.keep(unionAll(csg, scope, pads).intersect(room)), holes: unionAll(csg, scope, holes) };
}
