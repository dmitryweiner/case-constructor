// The app's helpers over manifold-3d (WASM CSG); the bridge itself —
// initCSG, CsgScope, toManifold, fromManifold — is maker-kit's csg/manifold.
//
// A case is a shell minus a few dozen cutters plus posts: nearly every solid
// in it comes out of a boolean. Manifold objects are not garbage-collected —
// everything made goes into a CsgScope.
//
// Worker only: the main thread never imports this file (CLAUDE.md).

import type { CrossSection, Manifold, Mat4, SimplePolygon } from 'manifold-3d';
import type { CsgApi, CsgScope } from 'maker-kit/csg/manifold';
import type { Affine, Vec3 } from './surface';

/** Our row-major 3×4 affine → manifold's column-major 4×4. */
export function toMat4(m: Affine): Mat4 {
  return [m[0], m[4], m[8], 0, m[1], m[5], m[9], 0, m[2], m[6], m[10], 0, m[3], m[7], m[11], 1];
}

/** Convex hull of a point cloud — the shells are convex, so this is exact. */
export function hullOf(csg: CsgApi, scope: CsgScope, points: readonly Vec3[]): Manifold {
  return scope.keep(csg.Manifold.hull([...points]));
}

/**
 * Splits a solid by the plane `dot(p, normal) = offset`; the first result lies
 * on the side the normal points to. Both halves are kept in the scope.
 */
export function splitByPlane(scope: CsgScope, solid: Manifold, normal: Readonly<Vec3>, offset: number): [Manifold, Manifold] {
  const [front, back] = solid.splitByPlane(normal, offset);
  return [scope.keep(front), scope.keep(back)];
}

/** Keeps only the part of a solid on the side the normal points to. */
export function trimByPlane(scope: CsgScope, solid: Manifold, normal: Readonly<Vec3>, offset: number): Manifold {
  return scope.keep(solid.trimByPlane(normal, offset));
}

/** A 2D outline extruded along z from z0 to z1. */
export function extrude(csg: CsgApi, scope: CsgScope, outline: CrossSection | SimplePolygon[], z0: number, z1: number): Manifold {
  const section = outline instanceof csg.CrossSection ? outline : scope.keep(new csg.CrossSection(outline, 'Positive'));
  const prism = scope.keep(section.extrude(z1 - z0));
  return scope.keep(prism.translate([0, 0, z0]));
}

export function transformSolid(scope: CsgScope, solid: Manifold, m: Affine): Manifold {
  return scope.keep(solid.transform(toMat4(m)));
}

/** Union of many solids in one call — cheaper than a chain of pairwise unions. */
export function unionAll(csg: CsgApi, scope: CsgScope, solids: readonly Manifold[]): Manifold {
  if (solids.length === 1) return solids[0];
  return scope.keep(csg.Manifold.union([...solids]));
}
