// Bridge between our SurfaceMesh and manifold-3d (WASM CSG).
//
// A case is a shell minus a few dozen cutters plus posts: nearly every solid
// in it comes out of a boolean. Manifold objects are not garbage-collected —
// everything created must be deleted explicitly, hence CsgScope.
//
// Worker only: the main thread never imports this file (CLAUDE.md).

import Module from 'manifold-3d';
import type { CrossSection, Manifold, Mat4, Mesh, ManifoldToplevel, SimplePolygon } from 'manifold-3d';
import type { Affine, SurfaceMesh, Vec3 } from './surface';
import { meshNormals } from './normals';

/** Everything we need from the WASM module: primitive constructors and Mesh. */
export type CsgApi = ManifoldToplevel;

let pending: Promise<CsgApi> | null = null;

/**
 * Loads WASM once per process / worker. Later calls return the same promise:
 * the instance is heavy and global by nature.
 */
export function initCSG(): Promise<CsgApi> {
  if (!pending) {
    pending = Module().then((wasm) => {
      wasm.setup();
      return wasm;
    });
  }
  return pending;
}

/**
 * Holds Manifold / CrossSection objects and frees them at once. Any chain of
 * booleans breeds intermediates; without a scope the WASM heap grows until
 * it runs out after a few exports.
 */
export class CsgScope {
  private items: { delete(): void }[] = [];

  /** Registers an object for deletion and returns it (handy in expressions). */
  keep<T extends { delete(): void }>(item: T): T {
    this.items.push(item);
    return item;
  }

  get size(): number {
    return this.items.length;
  }

  dispose(): void {
    for (const item of this.items) item.delete();
    this.items = [];
  }
}

/**
 * SurfaceMesh → Manifold. Throws if the mesh is not a closed solid: Manifold
 * would otherwise return an object with a NotManifold status that silently
 * spoils every later operation — better to fail here.
 */
export function toManifold(csg: CsgApi, mesh: Pick<SurfaceMesh, 'positions' | 'indices'>): Manifold {
  const input = new csg.Mesh({
    numProp: 3,
    vertProperties: new Float32Array(mesh.positions),
    triVerts: new Uint32Array(mesh.indices),
  });
  input.merge();
  let solid: Manifold;
  try {
    solid = csg.Manifold.ofMesh(input);
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`toManifold: mesh is not a closed solid (${reason})`, { cause });
  }
  const status = solid.status();
  if (status !== 'NoError') {
    solid.delete();
    throw new Error(`toManifold: mesh is not a closed solid (${status})`);
  }
  return solid;
}

/** Manifold → SurfaceMesh with recomputed vertex normals. */
export function fromManifold(solid: Manifold): SurfaceMesh {
  const mesh: Mesh = solid.getMesh();
  const positions = extractPositions(mesh);
  const indices = new Uint32Array(mesh.triVerts);
  return { positions, indices, normals: meshNormals(positions, indices) };
}

/**
 * The first three properties of each vertex are x, y, z. Manifold may return
 * numProp > 3, so positions are combed out of the interleaved buffer.
 */
function extractPositions(mesh: Mesh): Float32Array {
  const { numProp, vertProperties } = mesh;
  if (numProp === 3) return new Float32Array(vertProperties);
  const count = vertProperties.length / numProp;
  const positions = new Float32Array(count * 3);
  for (let v = 0; v < count; v++) {
    positions[v * 3] = vertProperties[v * numProp];
    positions[v * 3 + 1] = vertProperties[v * numProp + 1];
    positions[v * 3 + 2] = vertProperties[v * numProp + 2];
  }
  return positions;
}

/** Our row-major 3×4 affine → manifold's column-major 4×4. */
export function toMat4(m: Affine): Mat4 {
  return [
    m[0], m[4], m[8], 0,
    m[1], m[5], m[9], 0,
    m[2], m[6], m[10], 0,
    m[3], m[7], m[11], 1,
  ];
}

/** Convex hull of a point cloud — the shells are convex, so this is exact. */
export function hullOf(csg: CsgApi, scope: CsgScope, points: readonly Vec3[]): Manifold {
  return scope.keep(csg.Manifold.hull([...points]));
}

/**
 * Splits a solid by the plane `dot(p, normal) = offset`; the first result lies
 * on the side the normal points to. Both halves are kept in the scope.
 */
export function splitByPlane(
  scope: CsgScope, solid: Manifold, normal: Readonly<Vec3>, offset: number,
): [Manifold, Manifold] {
  const [front, back] = solid.splitByPlane(normal, offset);
  return [scope.keep(front), scope.keep(back)];
}

/** Keeps only the part of a solid on the side the normal points to. */
export function trimByPlane(scope: CsgScope, solid: Manifold, normal: Readonly<Vec3>, offset: number): Manifold {
  return scope.keep(solid.trimByPlane(normal, offset));
}

/** A 2D outline extruded along z from z0 to z1. */
export function extrude(
  csg: CsgApi, scope: CsgScope, outline: CrossSection | SimplePolygon[], z0: number, z1: number,
): Manifold {
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
