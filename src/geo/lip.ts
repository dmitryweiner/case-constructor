// Lid fastening solids: snap rods and grooves, posts with their screw holes
// or magnet pockets, the holes and head seats in the lid plate or its magnet
// bosses. Worker only; the positions come from fastening.ts.

import type { CrossSection, Manifold } from 'manifold-3d';
import type { CsgApi, CsgScope } from './csg';
import { extrude, hullOf, transformSolid, trimByPlane, unionAll } from './csg';
import { cutterSolid } from './cut';
import type { CutterSpec } from './cutters';
import type { FaceFrame } from './face';
import { NUT_CLEARANCE, SCREWS, THROUGH_CLEARANCE } from './fasteners';
import type { PostSpot } from './fastening';
import { magnetPockets, postLength, snapSpots } from './fastening';
import { threadSolid } from './screwSolids';
import { THREADS, minorRadius, threadEngagement, threadPoints } from './thread';
import type { LidState } from './lidSpec';
import { HEAD_FLOOR, headSeat } from './lidSpec';
import type { Vec2 } from './section';
import { bounds2, convexIntersect } from './opening';
import { SPLIT_OFFSET } from './parting';
import type { Vec3 } from './surface';

const EPS = 0.05;
/** How far below the body's rim the wall-hugging part of a post stops. */
const POST_STEP = 0.3;

export function snapSolids(
  csg: CsgApi, scope: CsgScope, opening: readonly Vec2[], frame: FaceFrame, zp: number, lid: LidState, round: boolean,
  cutters: readonly CutterSpec[], segments: number,
): { bumps: Manifold | null; grooves: Manifold | null } {
  const spots = snapSpots(opening, frame, zp, lid, round, cutters);
  if (spots.length === 0) return { bumps: null, grooves: null };
  return {
    bumps: unionAll(csg, scope, spots.map((spot) => cutterSolid(csg, scope, spot.bump, segments))),
    grooves: unionAll(csg, scope, spots.map((spot) => cutterSolid(csg, scope, spot.groove, segments))),
  };
}

function circlePoints(c: Vec2, r: number, n: number): Vec2[] {
  return Array.from({ length: n }, (_, i): Vec2 => [c[0] + r * Math.cos((2 * Math.PI * i) / n), c[1] + r * Math.sin((2 * Math.PI * i) / n)]);
}

/** A cylinder along the face normal in the face frame, z' from z0 to z1. */
function column(csg: CsgApi, scope: CsgScope, c: Vec2, r0: number, z0: number, z1: number, n: number, r1 = r0): Manifold {
  const solid = scope.keep(csg.Manifold.cylinder(z1 - z0, r0, r1, n));
  return scope.keep(solid.translate([c[0], c[1], z0]));
}

export interface PostParts {
  /** material for the body, case frame */
  posts: Manifold;
  /** holes in the posts, case frame */
  postHoles: Manifold;
  /** magnets: bosses under the lid plate, added before `lidHoles`; case frame */
  lidBosses: Manifold | null;
  /** through holes and head seats in the lid, or its magnet pockets, case frame */
  lidHoles: Manifold;
  /** where the skirt must step aside for the posts, case frame */
  skirtClearance: Manifold;
}

export function postSolids(
  csg: CsgApi, scope: CsgScope, spots: readonly PostSpot[], opening: readonly Vec2[], upperSection: readonly Vec2[],
  frame: FaceFrame, zp: number, plate: number, lid: LidState, segments: number,
): PostParts | null {
  if (spots.length === 0) return null;
  const n = Math.max(16, segments * 4);
  const dims = SCREWS[lid.screw.size];
  const magnets = lid.fastening === 'magnets' ? magnetPockets(lid, plate) : null;
  // a magnet post stops a fit below the lid's boss
  const top = magnets ? magnets.postTop : -plate - lid.fit;
  // offsets are simplified: clipper leaves near-duplicate arc vertices that become slivers
  const grow = (section: CrossSection, delta: number): CrossSection =>
    scope.keep(scope.keep(section.offset(delta, 'Round', 2, n)).simplify(1e-3));
  // above the plane the lid's cavity only narrows (rounded corners near its
  // plate): the post keeps a fit away from the narrowest section there
  const upperOutline = upperSection.length >= 3 ? convexIntersect(opening, upperSection) : [...opening];
  const insideOpening = grow(scope.keep(new csg.CrossSection([upperOutline], 'Positive')), -lid.fit);
  const posts: Manifold[] = [];
  const postHoles: Manifold[] = [];
  const lidHoles: Manifold[] = [];
  const lidBosses: Manifold[] = [];
  const clearance: Manifold[] = [];
  for (const spot of spots) {
    const outline = [...circlePoints(spot.centre, spot.r, n), spot.anchor];
    const footprint = scope.keep(csg.CrossSection.hull([outline]));
    const bottom = zp - postLength(lid);
    // The part filled out to the walls ends just below the body's rim (the
    // body is cut SPLIT_OFFSET below the plane): reaching the plane it would
    // poke into the lid's walls, and trimming that leaves a sliver step.
    // A magnet post ends below the rim: its corner fill stops POST_STEP under
    // its top all the same, or the top face meets the outer corner's edge on
    // the diagonal and leaves zero-area triangles there.
    const lowerTop = Math.min(zp - SPLIT_OFFSET - POST_STEP, magnets ? top - POST_STEP : top);
    const reach = Math.hypot(spot.centre[0] - spot.anchor[0], spot.centre[1] - spot.anchor[1]) + spot.r;
    // One prism for the whole post, then clipped: everything below the rim
    // level, and above it only what keeps a fit from the lid's walls. Two
    // stacked prisms of the same outline would share side faces — slivers.
    let post = extrude(csg, scope, footprint, bottom, top);
    if (top > lowerTop + EPS) {
      const box = bounds2(outline);
      const below = extrude(csg, scope, [[[box.u0 - 1, box.v0 - 1], [box.u1 + 1, box.v0 - 1], [box.u1 + 1, box.v1 + 1], [box.u0 - 1, box.v1 + 1]]], bottom - 1, lowerTop);
      const above = extrude(csg, scope, insideOpening, lowerTop - EPS, top + 1);
      post = scope.keep(post.intersect(scope.keep(below.add(above))));
    }
    // 45° taper down to the corner, so the post prints without support
    const taperPoints: Vec3[] = [...outline.map((p): Vec3 => [p[0], p[1], bottom + EPS]), [spot.anchor[0], spot.anchor[1], bottom - reach]];
    const parts: Manifold[] = [post, hullOf(csg, scope, taperPoints)];
    // In a low case the post and its taper reach the far plate: they stop in
    // its middle. Clipped by the outer shell instead, they met the outer
    // surface and left zero-area triangles on its fillet.
    const far = -frame.depth + plate / 2;
    const whole = unionAll(csg, scope, parts);
    posts.push(bottom - reach < far ? trimByPlane(scope, whole, [0, 0, 1], far) : whole);
    clearance.push(extrude(csg, scope, grow(footprint, lid.fit), zp - lid.lip.h - 1, zp + 2));

    // the hole the screw goes into, down from the post's top
    const c = spot.centre;
    const depth = Math.min(postLength(lid) - 1, top - bottom - 1);
    if (lid.fastening === 'printed') {
      // the thread the printed screw goes into, a 45° countersink at its mouth;
      // the lid: a clearance hole, the head stands proud (a thumb screw)
      const { size, fit } = lid.thread;
      const R = THREADS[size].d / 2;
      const holeDepth = Math.min(threadEngagement(size) + 0.5, depth);
      const thread = threadSolid(csg, scope, size, fit, top - holeDepth, top + EPS, threadPoints(segments));
      postHoles.push(scope.keep(thread.translate([c[0], c[1], 0])));
      const sink = R - minorRadius(size) + 0.5;
      postHoles.push(column(csg, scope, c, minorRadius(size) + fit, top - sink, top + EPS, n, R + fit + 0.5 + EPS));
      lidHoles.push(column(csg, scope, c, R + 0.3, top - 1, 1, n));
      continue;
    }
    if (magnets) {
      // pockets as deep as the magnet, a 0.5 mm chamfer at the mouth guides it in
      const { r, h, lidBossH, lidMouth } = magnets;
      postHoles.push(column(csg, scope, c, r, top - h, top + EPS, n));
      postHoles.push(column(csg, scope, c, r, top - 0.5, top + EPS, n, r + 0.5 + EPS));
      // the lid's boss: the post's round part, from the pocket's mouth into the plate
      if (lidBossH > 0) lidBosses.push(column(csg, scope, c, spot.r, lidMouth, -plate + 0.5, n));
      lidHoles.push(column(csg, scope, c, r, lidMouth - EPS, lidMouth + h, n));
      lidHoles.push(column(csg, scope, c, r + 0.5 + EPS, lidMouth - EPS, lidMouth + 0.5, n, r));
      continue;
    }
    if (lid.screw.hole === 'insert') {
      const ri = dims.insert / 2;
      const insertDepth = Math.min(dims.insertLen, depth);
      postHoles.push(column(csg, scope, c, ri, top - insertDepth, top + EPS, n));
      postHoles.push(column(csg, scope, c, ri, top - 0.5, top + EPS, n, ri + 0.5 + EPS));
      postHoles.push(column(csg, scope, c, dims.tap / 2, top - depth, top - insertDepth + EPS, n));
    } else if (lid.screw.hole === 'nut') {
      const af = dims.nutAF + NUT_CLEARANCE;
      const pocketH = dims.nutH + NUT_CLEARANCE;
      const z0 = top - 2 - pocketH;
      const hex = scope.keep(csg.Manifold.cylinder(pocketH, af / Math.sqrt(3), af / Math.sqrt(3), 6));
      // the slot opens towards the inside of the case, away from the corner
      const angle = Math.atan2(c[1] - spot.anchor[1], c[0] - spot.anchor[0]);
      const slotSolid = scope.keep(csg.Manifold.cube([spot.r + 2, af, pocketH]));
      const slot = scope.keep(slotSolid.translate([0, -af / 2, 0]));
      const pocket = scope.keep(scope.keep(hex.add(slot)).rotate([0, 0, (angle * 180) / Math.PI]));
      postHoles.push(scope.keep(pocket.translate([c[0], c[1], z0])));
      postHoles.push(column(csg, scope, c, (dims.d + THROUGH_CLEARANCE) / 2, top - depth, top + EPS, n));
    } else {
      postHoles.push(column(csg, scope, c, dims.tap / 2, top - depth, top + EPS, n));
    }

    // the lid plate: a through hole and the seat for the head
    const through = (dims.d + THROUGH_CLEARANCE) / 2;
    const seat = headSeat(lid);
    const head = (seat.d + THROUGH_CLEARANCE) / 2;
    lidHoles.push(column(csg, scope, c, through, top - 1, 1, n));
    if (lid.screw.head === 'counterbore') {
      lidHoles.push(column(csg, scope, c, head, -Math.min(seat.depth, plate - HEAD_FLOOR), 1, n));
    } else if (lid.screw.head === 'countersunk') {
      // 90°: the cone loses as much depth as it loses radius
      const sink = Math.min(head - through, plate - 0.4);
      lidHoles.push(column(csg, scope, c, head - sink, -sink, 0, n, head));
      lidHoles.push(column(csg, scope, c, head, -EPS, 1, n));
    }
  }
  const toCase = (solid: Manifold): Manifold => transformSolid(scope, solid, frame.fromFace);
  return {
    posts: toCase(unionAll(csg, scope, posts)),
    postHoles: toCase(unionAll(csg, scope, postHoles)),
    lidBosses: lidBosses.length > 0 ? toCase(unionAll(csg, scope, lidBosses)) : null,
    lidHoles: toCase(unionAll(csg, scope, lidHoles)),
    skirtClearance: toCase(unionAll(csg, scope, clearance)),
  };
}
