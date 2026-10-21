// Faces of the case. Every face carries a rigid frame: z along its outward
// normal, the face plane at z = 0, and a 2D basis (u, v) on it as seen from
// outside — u to the viewer's right, v up (for the top face "up" is the back,
// for the bottom face the front). The case lies at z ≤ 0 of every frame.
//
// Everything that happens "on a face" works in its frame: the lid is the part
// beyond a plane parallel to the face, a cutout is a 2D shape there pushed
// through the wall.

import type { Affine, Vec3 } from './surface';
import { invertRigid } from './surface';

export const FACES = ['top', 'bottom', 'front', 'back', 'left', 'right'] as const;
export type Face = (typeof FACES)[number];

export function isFace(value: unknown): value is Face {
  return typeof value === 'string' && FACES.some((face) => face === value);
}

/** Outer size of the case's bounding box, mm. */
export interface Dims {
  w: number;
  d: number;
  h: number;
}

export interface FaceFrame {
  face: Face;
  /** case frame → face frame */
  toFace: Affine;
  /** face frame → case frame */
  fromFace: Affine;
  /** outward normal in the case frame */
  n: Vec3;
  /** size of the face rectangle in (u, v) */
  extent: { w: number; h: number };
  /** size of the case along the normal */
  depth: number;
}

export function faceFrame(face: Face, dims: Dims): FaceFrame {
  const { w, d, h } = dims;
  // Rows are the face axes (u, v, n) written in case coordinates, last
  // column the offset: u = R·p + t.
  let toFace: Affine;
  let extent: { w: number; h: number };
  let depth: number;
  switch (face) {
    case 'top':
      toFace = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, -h];
      extent = { w, h: d };
      depth = h;
      break;
    case 'bottom':
      toFace = [1, 0, 0, 0, 0, -1, 0, d, 0, 0, -1, 0];
      extent = { w, h: d };
      depth = h;
      break;
    case 'front':
      toFace = [1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0];
      extent = { w, h };
      depth = d;
      break;
    case 'back':
      toFace = [-1, 0, 0, w, 0, 0, 1, 0, 0, 1, 0, -d];
      extent = { w, h };
      depth = d;
      break;
    case 'left':
      toFace = [0, -1, 0, d, 0, 0, 1, 0, -1, 0, 0, 0];
      extent = { w: d, h };
      depth = w;
      break;
    case 'right':
      toFace = [0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, -w];
      extent = { w: d, h };
      depth = w;
      break;
  }
  return {
    face,
    toFace,
    fromFace: invertRigid(toFace),
    n: [toFace[8], toFace[9], toFace[10]],
    extent,
    depth,
  };
}

/** Faces whose normal is horizontal. */
export function isSideFace(face: Face): boolean {
  return face !== 'top' && face !== 'bottom';
}
