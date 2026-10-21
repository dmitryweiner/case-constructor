// Parting: the lid is the part of the shell beyond a plane parallel to the
// lid face, `plate + depth` in from the outer surface. The lid then gets a
// skirt that drops into the body's opening. Worker only.

import type { CrossSection, Manifold } from 'manifold-3d';
import type { CsgApi, CsgScope } from './csg';
import { extrude, splitByPlane, transformSolid } from './csg';
import type { FaceFrame } from './face';
import type { LidState } from './lidSpec';
import type { ShapeSpec } from './shape';
import type { Vec2 } from './section';
import { loftSlice } from './section';

export interface Parted {
  body: Manifold;
  lid: Manifold;
}

/** The parting plane's depth in the face frame (the face is z = 0, the case below). */
export function partingZ(plate: number, depth: number): number {
  return -(plate + depth);
}

/**
 * How far into the body the cut actually goes. With a flat lid the parting
 * plane IS the cavity ceiling, and a split on a face leaves the body a
 * zero-thickness membrane over its opening (watertight, so no check sees it
 * — a slicer would print a closed box). Cutting a hair lower keeps the body
 * open; the lid gets a 0.01 mm rim it does not mind.
 */
export const SPLIT_OFFSET = 0.01;

export function splitAtParting(scope: CsgScope, shell: Manifold, frame: FaceFrame, zp: number): Parted {
  // z' = n·p + t_z, so the plane z' = zp is n·p = zp − t_z
  const [lid, body] = splitByPlane(scope, shell, frame.n, zp - SPLIT_OFFSET - frame.toFace[11]);
  return { body, lid };
}

/** How far the skirt's web reaches up into the lid, bridging the fit gap. */
const WEB_H = 1;
/** Overlap of touching solids, so unions never meet on a coplanar face. */
const OVERLAP = 0.05;
/**
 * The web starts this far above the parting plane: exactly on it, its bottom
 * would lie in the plane of the lid's ceiling, and a later boolean on the
 * skirt (posts stepping aside) leaves slivers on the shared face.
 */
const WEB_LIFT = 0.02;

function section(csg: CsgApi, scope: CsgScope, poly: Vec2[]): CrossSection | null {
  if (poly.length < 3) return null;
  return scope.keep(new csg.CrossSection([poly], 'Positive'));
}

/**
 * A rounded offset, cleaned: clipper leaves near-duplicate vertices on the
 * arcs, and extruded they become zero-area slivers in the mesh.
 */
function offset(scope: CsgScope, outline: CrossSection, delta: number, circular: number): CrossSection {
  const grown = scope.keep(outline.offset(delta, 'Round', 2, circular));
  return scope.keep(grown.simplify(1e-3));
}

/**
 * The skirt: a ring following the opening at the parting plane, inset by the
 * fit and `lip.t` thick, hanging `lip.h` into the body; plus a web just above
 * the plane that ties it to the lid's own walls (with a deep lid the ring
 * alone would float a fit away from them).
 *
 * A side lid's ring leaves out its floor strip (see below).
 *
 * The ring follows the intersection of the cavity sections at both ends of
 * the skirt. The cavity is convex, so every section in between contains that
 * intersection: the skirt fits all the way down, and a straight prism never
 * makes an undercut when the opening is narrower than the cavity below it
 * (rounded corners, edge fillets).
 */
export function skirtSolid(
  csg: CsgApi, scope: CsgScope, spec: ShapeSpec, outer: Manifold, frame: FaceFrame,
  zp: number, lid: LidState, shape: { wall: number; floor: number }, segments: number,
): Manifold | null {
  const { wall } = shape;
  const topPoly = loftSlice(spec.inner, spec.innerCut, frame, zp, segments);
  const bottomPoly = loftSlice(spec.inner, spec.innerCut, frame, zp - lid.lip.h, segments);
  const top = section(csg, scope, topPoly);
  const bottom = section(csg, scope, bottomPoly);
  if (!top || !bottom) return null;
  const opening = scope.keep(top.intersect(bottom));
  const circular = Math.max(16, segments * 4);
  const ringOuter = offset(scope, opening, -lid.fit, circular);
  const ringInner = offset(scope, opening, -lid.fit - lid.lip.t, circular);
  if (ringInner.isEmpty() || ringOuter.isEmpty()) return null;
  let ring = scope.keep(ringOuter.subtract(ringInner));
  const webOuter = offset(scope, top, Math.min(wall / 2, 1), circular);
  let webRing = scope.keep(webOuter.subtract(ringInner));
  if (frame.face !== 'top' && frame.face !== 'bottom') {
    // A side lid's skirt has no strip along the floor: there it would run
    // into the standoffs and rails, and three sides hold the lid as well.
    // In a side frame v is the case z.
    // the opening's lowest point: above the floor where a fillet rounds it
    const low = Math.max(shape.floor, ...[topPoly, bottomPoly].map((poly) => Math.min(...poly.map((p) => p[1]))));
    const above = low + lid.fit + lid.lip.t + 0.01;
    const floorBand = scope.keep(new csg.CrossSection([[[-1e4, -1e4], [1e4, -1e4], [1e4, above], [-1e4, above]]], 'Positive'));
    ring = scope.keep(ring.subtract(floorBand));
    webRing = scope.keep(webRing.subtract(floorBand));
  }
  const prism = extrude(csg, scope, ring, zp - lid.lip.h, zp + OVERLAP);
  const web = extrude(csg, scope, webRing, zp + WEB_LIFT, zp + WEB_H);
  const skirt = transformSolid(scope, scope.keep(prism.add(web)), frame.fromFace);
  // the web must not poke through a thin, filleted outer surface
  return scope.keep(skirt.intersect(outer));
}
