// Where the lid's fasteners go — pure geometry in the lid's face frame.
//
// Snaps: half-buried rods on the outside of the skirt, `SNAP_FROM_END` above
// its free end; the body gets a groove from the same rod grown by the fit.
// One primitive for both, so bump and groove cannot drift apart. Two per side
// longer than 40 mm, one otherwise (a round opening: four at 90°). A side lid
// has no skirt along the floor, so no snap there either.
//
// Screws: a post in every corner of the opening — a round boss as close to
// the corner as fits, filled out to the corner walls — from `POST_LEN` below
// the parting plane up to the lid plate (less the fit), with a 45° taper
// under it so it prints without support.

import type { CutterSpec } from './cutters';
import { cutterContains } from './cutters';
import type { PlacedBoard } from './layout';
import type { Message } from './message';
import type { FaceFrame } from './face';
import type { LidState } from './lidSpec';
import type { Vec2 } from './section';
import { bossDiameter } from './fasteners';
import { boundaryHit, bounds2 } from './opening';
import type { Vec3 } from './surface';
import { applyAffine, rotateVec } from './surface';

/** How far a snap rod stands out of the skirt. */
export const SNAP_R = 0.6;
/**
 * The rod's axis sits this far inside the skirt rather than on its surface:
 * an axis on the surface puts circle vertices on the face, and the boolean
 * leaves zero-area slivers there.
 */
export const SNAP_SINK = 0.1;
export const SNAP_LEN = 10;
export const SNAP_FROM_END = 1.5;
/** A side with a straight run longer than this gets two snaps. */
export const SNAP_TWO_FROM = 40;
/** How far a screw post reaches below the parting plane (above its taper). */
export const POST_LEN = 8;

export interface SnapSpot {
  bump: CutterSpec;
  groove: CutterSpec;
}

/** A cutter-shaped rod in the face frame, converted to the case frame. */
function rod(frame: FaceFrame, centre: Vec3, normal: Vec2, tangent: Vec2, diameter: number, length: number, index: number): CutterSpec {
  const ex = rotateVec(frame.fromFace, [normal[0], normal[1], 0]);
  const ey = rotateVec(frame.fromFace, [0, 0, 1]);
  // right-handed: ex × ey = −tangent for an outward normal of a CCW polygon
  const ez = rotateVec(frame.fromFace, [-tangent[0], -tangent[1], 0]);
  return {
    origin: applyAffine(frame.fromFace, centre),
    ex,
    ey,
    ez,
    s0: -length / 2,
    s1: length / 2,
    shape: 'round',
    w: diameter,
    h: diameter,
    r: 0,
    source: { kind: 'extra', index },
  };
}

/**
 * Snap positions. A snap that would land in an opening (a port cut through
 * the skirt and the wall) is left out: it would hold nothing.
 */
export function snapSpots(
  opening: readonly Vec2[], frame: FaceFrame, zp: number, lid: LidState, round: boolean, cutters: readonly CutterSpec[] = [],
): SnapSpot[] {
  if (opening.length < 3) return [];
  const box = bounds2(opening);
  const side = frame.face !== 'top' && frame.face !== 'bottom';
  // depth of the rods: SNAP_FROM_END above the skirt's end, never past either end
  const z = Math.min(zp - SNAP_R - 0.2, Math.max(zp - lid.lip.h + SNAP_R + 0.2, zp - lid.lip.h + SNAP_FROM_END));
  const spots: SnapSpot[] = [];
  const sides: { axis: 0 | 1; dir: 1 | -1 }[] = [
    { axis: 1, dir: 1 }, { axis: 1, dir: -1 }, { axis: 0, dir: 1 }, { axis: 0, dir: -1 },
  ];
  for (const { axis, dir } of sides) {
    // a side lid's frame has v = case z: v−side is the floor, no skirt there
    if (side && axis === 0 && dir === -1) continue;
    // axis 1: lines v = const crossing the u± sides; axis 0: lines u = const crossing the v± sides
    const [lo, hi] = axis === 1 ? [box.v0, box.v1] : [box.u0, box.u1];
    const length = hi - lo;
    const mid = (lo + hi) / 2;
    const positions = !round && length > SNAP_TWO_FROM ? [mid - length / 4, mid + length / 4] : [mid];
    const rodLength = Math.min(SNAP_LEN, length / 2.5);
    for (const at of positions) {
      const hit = boundaryHit(opening, axis, at, dir);
      if (!hit) continue;
      const normal: Vec2 = [hit.tangent[1], -hit.tangent[0]];
      // on the skirt's outer surface: the opening less the fit
      const inset = lid.fit + SNAP_SINK;
      const centre: Vec3 = [hit.point[0] - normal[0] * inset, hit.point[1] - normal[1] * inset, z];
      const radius = SNAP_R + SNAP_SINK;
      const ends = [-rodLength / 2, 0, rodLength / 2].map((t): Vec3 => applyAffine(frame.fromFace,
        [centre[0] + hit.tangent[0] * t, centre[1] + hit.tangent[1] * t, centre[2]]));
      if (cutters.some((cutter) => ends.some((end) => cutterContains(cutter, end, radius + lid.fit)))) continue;
      spots.push({
        bump: rod(frame, centre, normal, hit.tangent, 2 * radius, rodLength, spots.length),
        groove: rod(frame, centre, normal, hit.tangent, 2 * (radius + lid.fit), rodLength + 2 * lid.fit, spots.length),
      });
    }
  }
  return spots;
}

export interface PostSpot {
  /** boss centre in the face frame (u, v) */
  centre: Vec2;
  /** a point in the walls of the corner: the post is filled out to it */
  anchor: Vec2;
  /** boss radius */
  r: number;
}

/** Distance from a point to the nearest edge of a convex polygon (negative outside). */
function insideDistance(poly: readonly Vec2[], p: Vec2): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-9) continue;
    // left of a→b is inside for a CCW polygon
    const d = ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) / len;
    best = Math.min(best, d);
  }
  return best;
}

/**
 * Screw posts: from each corner of the opening's bounding box, slide a boss
 * of the screw's diameter along the diagonal until it fits — tight in a
 * square corner, further in where the corner is rounded or the opening is a
 * circle (which gives four bosses at 45°).
 */
export function postSpots(opening: readonly Vec2[], lid: LidState, wall: number): PostSpot[] {
  if (opening.length < 3) return [];
  const r = bossDiameter(lid.screw) / 2;
  const box = bounds2(opening);
  const cx = (box.u0 + box.u1) / 2;
  const cy = (box.v0 + box.v1) / 2;
  const spots: PostSpot[] = [];
  for (const [su, sv] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
    const corner: Vec2 = [su > 0 ? box.u1 : box.u0, sv > 0 ? box.v1 : box.v0];
    const diag = Math.hypot(corner[0] - cx, corner[1] - cy);
    const du = (cx - corner[0]) / diag;
    const dv = (cy - corner[1]) / diag;
    let centre: Vec2 = [corner[0] - su * r, corner[1] - sv * r];
    for (let step = 0; step < 400 && insideDistance(opening, centre) < r - 1e-6; step++) {
      centre = [centre[0] + du * 0.1, centre[1] + dv * 0.1];
    }
    if (insideDistance(opening, centre) < r - 1e-6) continue;
    spots.push({ centre, anchor: [corner[0] - du * wall / 2, corner[1] - dv * wall / 2], r });
  }
  return spots;
}

/**
 * Posts running into a board: the post's box (boss, filled corner, taper)
 * against the board's box (outline × its height range).
 */
export function postCollisions(spots: readonly PostSpot[], frame: FaceFrame, zp: number, plate: number, lid: LidState, boards: readonly PlacedBoard[]): Message[] {
  const out: Message[] = [];
  const hit = new Set<number>();
  for (const spot of spots) {
    const reach = Math.hypot(spot.centre[0] - spot.anchor[0], spot.centre[1] - spot.anchor[1]) + spot.r;
    const us = [spot.centre[0] - spot.r, spot.centre[0] + spot.r];
    const vs = [spot.centre[1] - spot.r, spot.centre[1] + spot.r];
    const zs = [zp - POST_LEN - reach * 0.5, -plate - lid.fit];
    const pts: Vec3[] = [];
    for (const u of us) for (const v of vs) for (const z of zs) pts.push(applyAffine(frame.fromFace, [u, v, z]));
    const lo = [0, 1, 2].map((k) => Math.min(...pts.map((p) => p[k])));
    const hi = [0, 1, 2].map((k) => Math.max(...pts.map((p) => p[k])));
    for (const board of boards) {
      const o = board.outline;
      const overlaps = lo[0] < o.x1 && hi[0] > o.x0 && lo[1] < o.y1 && hi[1] > o.y0 && lo[2] < board.zTop && hi[2] > board.zBottom;
      if (overlaps && !hit.has(board.index)) {
        hit.add(board.index);
        out.push({ code: 'warn.postHitsBoard', params: { board: board.index + 1 } });
      }
    }
  }
  return out;
}

/** Posts standing in the way of an opening: the cut would take the post away. */
export function postsInOpenings(spots: readonly PostSpot[], frame: FaceFrame, zp: number, plate: number, lid: LidState, cutters: readonly CutterSpec[]): Message[] {
  const out: Message[] = [];
  spots.forEach((spot, index) => {
    const zs = [zp - POST_LEN / 2, (zp - POST_LEN - plate - lid.fit) / 2 + zp / 2, -plate - lid.fit - 0.5];
    const hit = zs.some((z) => {
      const p = applyAffine(frame.fromFace, [spot.centre[0], spot.centre[1], z]);
      return cutters.some((cutter) => cutterContains(cutter, p, spot.r));
    });
    if (hit) out.push({ code: 'warn.postInOpening', params: { n: index + 1 } });
  });
  return out;
}
