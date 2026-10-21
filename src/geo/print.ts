// Print layout: each part turned so it prints without supports. The body
// stands with its opening up (lid face normal → +z), the lid lies on its
// outer face (normal → −z) with the skirt up. Pure transforms on meshes.

import type { Face, Dims } from './face';
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

export function bodyForPrint(body: SurfaceMesh, face: Face, dims: Dims): SurfaceMesh {
  return onBed(transformMesh(body, upright(face, dims)), 0);
}

export function lidForPrint(lid: SurfaceMesh, face: Face, dims: Dims, x0 = 0): SurfaceMesh {
  return onBed(transformMesh(lid, composeAffine(FLIP, upright(face, dims))), x0);
}

/** Body and lid side by side on the bed, the lid to the right. */
export function printLayout(body: SurfaceMesh, lid: SurfaceMesh, face: Face, dims: Dims): SurfaceMesh[] {
  const placedBody = bodyForPrint(body, face, dims);
  const width = meshBounds(placedBody).max[0];
  return [placedBody, lidForPrint(lid, face, dims, width + PRINT_GAP_MM)];
}
