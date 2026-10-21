// The mesh type every part of the core speaks, plus a few pure transforms.
// Typed arrays only, no Three.js. The model axis is z-up (printing
// convention); the renderer rotates it.

/** A finished mesh: positions + per-vertex normals + triangle indices. */
export interface SurfaceMesh {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
}

export type Vec3 = [number, number, number];

/** Row-major 3×4 affine transform: [r00 r01 r02 tx, r10 r11 r12 ty, r20 r21 r22 tz]. */
export type Affine = readonly [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];

export const IDENTITY: Affine = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];

export function applyAffine(m: Affine, p: Readonly<Vec3>): Vec3 {
  return [
    m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[3],
    m[4] * p[0] + m[5] * p[1] + m[6] * p[2] + m[7],
    m[8] * p[0] + m[9] * p[1] + m[10] * p[2] + m[11],
  ];
}

/** Rotation part only — for directions and normals. */
export function rotateVec(m: Affine, v: Readonly<Vec3>): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[4] * v[0] + m[5] * v[1] + m[6] * v[2],
    m[8] * v[0] + m[9] * v[1] + m[10] * v[2],
  ];
}

/** a ∘ b: first b, then a. */
export function composeAffine(a: Affine, b: Affine): Affine {
  const out: number[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      let value = c === 3 ? a[r * 4 + 3] : 0;
      for (let k = 0; k < 3; k++) value += a[r * 4 + k] * b[k * 4 + c];
      out.push(value);
    }
  }
  return toAffine(out);
}

/** Inverse of a rigid transform (rotation + translation). */
export function invertRigid(m: Affine): Affine {
  // R⁻¹ = Rᵀ, t' = −Rᵀ t
  const out = [
    m[0], m[4], m[8], 0,
    m[1], m[5], m[9], 0,
    m[2], m[6], m[10], 0,
  ];
  for (let r = 0; r < 3; r++) {
    out[r * 4 + 3] = -(out[r * 4] * m[3] + out[r * 4 + 1] * m[7] + out[r * 4 + 2] * m[11]);
  }
  return toAffine(out);
}

export function translation(x: number, y: number, z: number): Affine {
  return [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z];
}

function toAffine(v: readonly number[]): Affine {
  if (v.length !== 12) throw new Error(`toAffine: ${v.length} values`);
  return [v[0], v[1], v[2], v[3], v[4], v[5], v[6], v[7], v[8], v[9], v[10], v[11]];
}

/** Transforms a mesh; a mirroring transform (det < 0) also flips the winding. */
export function transformMesh(mesh: SurfaceMesh, m: Affine): SurfaceMesh {
  const positions = new Float32Array(mesh.positions.length);
  const normals = new Float32Array(mesh.normals.length);
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const p = applyAffine(m, [mesh.positions[i], mesh.positions[i + 1], mesh.positions[i + 2]]);
    positions.set(p, i);
    if (i < mesh.normals.length) {
      normals.set(rotateVec(m, [mesh.normals[i], mesh.normals[i + 1], mesh.normals[i + 2]]), i);
    }
  }
  const det = m[0] * (m[5] * m[10] - m[6] * m[9])
    - m[1] * (m[4] * m[10] - m[6] * m[8])
    + m[2] * (m[4] * m[9] - m[5] * m[8]);
  let indices = mesh.indices;
  if (det < 0) {
    indices = new Uint32Array(mesh.indices.length);
    for (let t = 0; t < mesh.indices.length; t += 3) {
      indices[t] = mesh.indices[t];
      indices[t + 1] = mesh.indices[t + 2];
      indices[t + 2] = mesh.indices[t + 1];
    }
  }
  return { positions, normals, indices };
}

/** Several meshes into one buffer (one STL with several bodies). */
export function mergeMeshes(meshes: readonly SurfaceMesh[]): SurfaceMesh {
  let vertices = 0;
  let triangles = 0;
  for (const mesh of meshes) {
    vertices += mesh.positions.length;
    triangles += mesh.indices.length;
  }
  const positions = new Float32Array(vertices);
  const normals = new Float32Array(vertices);
  const indices = new Uint32Array(triangles);
  let vOff = 0;
  let iOff = 0;
  for (const mesh of meshes) {
    positions.set(mesh.positions, vOff);
    normals.set(mesh.normals, vOff);
    const base = vOff / 3;
    for (let i = 0; i < mesh.indices.length; i++) indices[iOff + i] = mesh.indices[i] + base;
    vOff += mesh.positions.length;
    iOff += mesh.indices.length;
  }
  return { positions, normals, indices };
}

export interface Bounds {
  min: Vec3;
  max: Vec3;
}

export function meshBounds(mesh: Pick<SurfaceMesh, 'positions'>): Bounds {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < mesh.positions.length; i += 3) {
    for (let axis = 0; axis < 3; axis++) {
      const value = mesh.positions[i + axis];
      if (value < min[axis]) min[axis] = value;
      if (value > max[axis]) max[axis] = value;
    }
  }
  return { min, max };
}
