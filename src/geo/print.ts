// Print layout: each part turned so it prints without supports. The body
// stands with its opening up (lid face normal → +z), the lid lies on its
// outer face (normal → −z) with the skirt up. One exception: a console with
// its lid on the bottom would stand on the edge of its slope — it lies on the
// slope instead, a flat face on the bed, the walls leaning by the slope's
// angle. Pure transforms on meshes.

import type { Face, Dims } from './face';
import type { ShapeKind } from './shape';
import { faceFrame } from './face';
import type { Affine, SurfaceMesh } from './surface';
import { composeAffine, meshBounds, transformMesh, translation } from './surface';

/** Gap between the body and the lid on the bed, mm. */
export const PRINT_GAP_MM = 10;

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

/** Body and lid side by side on the bed, the lid to the right. */
export function printLayout(body: SurfaceMesh, lid: SurfaceMesh, face: Face, dims: Dims, shape?: PrintShape): SurfaceMesh[] {
  const placedBody = bodyForPrint(body, face, dims, shape);
  const width = meshBounds(placedBody).max[0];
  return [placedBody, lidForPrint(lid, face, dims, width + PRINT_GAP_MM)];
}
