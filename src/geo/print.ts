// Print layout: each part turned so it prints without supports. The body
// stands with its opening up (lid face normal → +z), the lid lies on its
// outer face (normal → −z) with the skirt up. One exception: a console with
// its lid on the bottom would stand on the edge of its slope — it lies on the
// slope instead, a flat face on the bed, the walls leaning by the slope's
// angle. Pure transforms on meshes.

import type { Face, Dims } from './face';
import type { ShapeKind } from './shape';
import { faceFrame } from './face';
import type { Vec2 } from './section';
import type { Affine, SurfaceMesh } from './surface';
import { composeAffine, meshBounds, mergeMeshes, transformMesh, translation } from './surface';
import { SCREW_GAP } from './thread';
import { clampNum } from './shape';

/** Gap between the body and the lid on the bed, mm. */
export const PRINT_GAP_MM = 10;
export const PRINT_GAP_MIN = 2;
export const PRINT_GAP_MAX = 50;

/** Where the lid goes next to the body in the Both STL; auto takes the more compact of the two. */
export const LID_PLACES = ['auto', 'right', 'behind'] as const;
export type LidPlace = (typeof LID_PLACES)[number];

export interface PrintArrange {
  lid: LidPlace;
  /** between the body, the lid and the screws, mm */
  gap: number;
}

export function defaultPrint(): PrintArrange {
  return { lid: 'auto', gap: PRINT_GAP_MM };
}

export function sanitizePrint(raw: unknown): PrintArrange {
  const d = defaultPrint();
  const r = typeof raw === 'object' && raw !== null ? raw : {};
  const lid: unknown = Reflect.get(r, 'lid');
  return {
    lid: LID_PLACES.find((place) => place === lid) ?? d.lid,
    gap: clampNum(Reflect.get(r, 'gap'), PRINT_GAP_MIN, PRINT_GAP_MAX, d.gap),
  };
}

/** Rotation of the face frame without its offset: lid normal → +z. */
function upright(face: Face, dims: Dims): Affine {
  const m = faceFrame(face, dims).toFace;
  return [m[0], m[1], m[2], 0, m[4], m[5], m[6], 0, m[8], m[9], m[10], 0];
}

/** Half-turn about x: +z → −z. */
const FLIP: Affine = [1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, 0];

/** Moves a mesh so its bounding box starts at (x0, 0, 0). */
function onBed(mesh: SurfaceMesh, x0: number): SurfaceMesh {
  const { min } = meshBounds(mesh);
  return transformMesh(mesh, translation(x0 - min[0], -min[1], -min[2]));
}

/** What the print layout needs to know about the shape: the console's slope. */
export interface PrintShape {
  kind: ShapeKind;
  console: { frontH: number; backH: number };
}

/** Rotation about x taking the console's outward slope normal to −z. */
function onSlope(shape: PrintShape, dims: Dims): Affine {
  const k = (shape.console.backH - shape.console.frontH) / dims.d;
  // outward normal of z = frontH + k·y is (0, −k, 1)
  const theta = -Math.PI / 2 - Math.atan2(1, -k);
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0];
}

export function bodyForPrint(body: SurfaceMesh, face: Face, dims: Dims, shape?: PrintShape): SurfaceMesh {
  const turn = shape?.kind === 'console' && face === 'bottom' ? onSlope(shape, dims) : upright(face, dims);
  return onBed(transformMesh(body, turn), 0);
}

export function lidForPrint(lid: SurfaceMesh, face: Face, dims: Dims, x0 = 0): SurfaceMesh {
  return onBed(transformMesh(lid, composeAffine(FLIP, upright(face, dims))), x0);
}

/**
 * Body and lid on the bed: the lid to the right of the body or behind it,
 * `gap` apart. Auto puts it behind when that makes the longer side of the
 * pair's footprint shorter (a long case: side by side it outgrows the bed).
 */
export function printLayout(
  body: SurfaceMesh, lid: SurfaceMesh, face: Face, dims: Dims, shape?: PrintShape, arrange: PrintArrange = { lid: 'right', gap: PRINT_GAP_MM },
): SurfaceMesh[] {
  return placeLid(body, lid, face, dims, shape, arrange).parts;
}

function placeLid(
  body: SurfaceMesh, lid: SurfaceMesh, face: Face, dims: Dims, shape: PrintShape | undefined, arrange: PrintArrange,
): { parts: SurfaceMesh[]; place: 'right' | 'behind' } {
  const placedBody = bodyForPrint(body, face, dims, shape);
  const flatLid = lidForPrint(lid, face, dims);
  const b = meshBounds(placedBody).max;
  const l = meshBounds(flatLid).max;
  const { gap } = arrange;
  const right = Math.max(b[0] + gap + l[0], b[1], l[1]);
  const behind = Math.max(b[0], l[0], b[1] + gap + l[1]);
  const place = arrange.lid === 'auto' ? (behind < right - 1e-6 ? 'behind' : 'right') : arrange.lid;
  return { parts: [placedBody, transformMesh(flatLid, place === 'right' ? translation(b[0] + gap, 0, 0) : translation(0, b[1] + gap, 0))], place };
}

/**
 * Body, lid and printed screws on the bed — the view and the STL of Both:
 * the screws in a row past the lid, the same way; `place` says where auto
 * put the lid (the caption names it).
 */
export function bothForPrint(
  body: SurfaceMesh, lid: SurfaceMesh, screw: SurfaceMesh | null, count: number, face: Face, dims: Dims, shape?: PrintShape,
  arrange: PrintArrange = { lid: 'right', gap: PRINT_GAP_MM },
): { parts: SurfaceMesh[]; place: 'right' | 'behind' } {
  const { parts, place } = placeLid(body, lid, face, dims, shape, arrange);
  const lidBox = meshBounds(parts[1]);
  const behind = place === 'behind';
  const screws = screw
    ? screwsForPrint(screw, count, behind ? 0 : lidBox.max[0] + arrange.gap, behind ? lidBox.max[1] + arrange.gap : 0) : null;
  return { parts: screws ? [...parts, screws] : parts, place };
}

/** Half-turn about x: the screw's own frame (shank up) → shank down. */
const SHANK_DOWN: Affine = [1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, 0];

/**
 * Printed screws in their holes, case frame: each head on the lid's outer
 * face over a post, the shank into it; `lift` moves them out along the
 * lid's normal (the exploded view lifts them off with the lid).
 */
export function screwsInCase(screw: SurfaceMesh, centres: readonly Vec2[], face: Face, dims: Dims, lift = 0): SurfaceMesh | null {
  if (centres.length === 0) return null;
  const { fromFace } = faceFrame(face, dims);
  return mergeMeshes(centres.map((c) => transformMesh(screw, composeAffine(fromFace, composeAffine(translation(c[0], c[1], lift), SHANK_DOWN)))));
}

/** Printed screws as they print: standing on their heads in a row along x from (x0, y0), `SCREW_GAP` apart. */
export function screwsForPrint(screw: SurfaceMesh, count: number, x0: number, y0 = 0): SurfaceMesh | null {
  if (count === 0) return null;
  const { min, max } = meshBounds(screw);
  const step = max[0] - min[0] + SCREW_GAP;
  return mergeMeshes(Array.from({ length: count }, (_, i) => transformMesh(screw, translation(x0 - min[0] + i * step, y0 - min[1], -min[2]))));
}

/** The lid and its screws on the bed: the lid from x0, the screws to its right. */
export function lidWithScrews(lid: SurfaceMesh, screw: SurfaceMesh | null, count: number, face: Face, dims: Dims, x0 = 0): SurfaceMesh[] {
  const placed = lidForPrint(lid, face, dims, x0);
  const screws = screw ? screwsForPrint(screw, count, meshBounds(placed).max[0] + PRINT_GAP_MM) : null;
  return screws ? [placed, screws] : [placed];
}

/** The batteries' clamp bars as they print: turned over, their flat tops on the bed, from x0. */
export function clampsForPrint(clamps: SurfaceMesh, x0: number): SurfaceMesh {
  return onBed(transformMesh(clamps, FLIP), x0);
}

/** Parts already on the bed, then the clamps to their right. */
export function withClamps(parts: SurfaceMesh[], clamps: SurfaceMesh | null): SurfaceMesh[] {
  if (!clamps) return parts;
  const right = Math.max(...parts.map((part) => meshBounds(part).max[0]));
  return [...parts, clampsForPrint(clamps, right + PRINT_GAP_MM)];
}

/**
 * A printed hinge as it prints (plans/PLAN-HINGED.md, H7): its leaves in the
 * closed pose, side by side on one plane, that plane — the faces that go on
 * the walls — on the bed, the bed's corner at (x0, y0).
 */
export function hingeForPrint(leaves: SurfaceMesh, x0: number, y0: number): SurfaceMesh {
  // the leaves face the walls along −y: turn −y to −z
  const turned = transformMesh(leaves, [1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0]);
  const { min } = meshBounds(turned);
  return transformMesh(turned, translation(x0 - min[0], y0 - min[1], -min[2]));
}

