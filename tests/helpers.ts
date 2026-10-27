// Shared test helpers: a tiny closed mesh, an STL decoder and garbage for
// fuzzing the sanitizers.

import type { SurfaceMesh } from '../src/geo/surface';
import { meshNormals } from '../src/geo/normals';

/** An axis-aligned box from (0,0,0) to (w,d,h), outward winding. */
export function boxMesh(w = 10, d = 8, h = 6): SurfaceMesh {
  const positions = new Float32Array([
    0, 0, 0, w, 0, 0, w, d, 0, 0, d, 0,
    0, 0, h, w, 0, h, w, d, h, 0, d, h,
  ]);
  const indices = new Uint32Array([
    0, 2, 1, 0, 3, 2, // bottom
    4, 5, 6, 4, 6, 7, // top
    0, 1, 5, 0, 5, 4, // front
    2, 3, 7, 2, 7, 6, // back
    1, 2, 6, 1, 6, 5, // right
    3, 0, 4, 3, 4, 7, // left
  ]);
  return { positions, indices, normals: meshNormals(positions, indices) };
}

export interface ParsedStl {
  header: string;
  triCount: number;
  normals: number[][];
  vertices: number[][][];
}

export function decodeSTL(buf: ArrayBuffer): ParsedStl {
  const dv = new DataView(buf);
  const header = new TextDecoder().decode(new Uint8Array(buf, 0, 80)).replace(/\0+$/, '');
  const triCount = dv.getUint32(80, true);
  const normals: number[][] = [];
  const vertices: number[][][] = [];
  let off = 84;
  for (let t = 0; t < triCount; t++) {
    normals.push([dv.getFloat32(off, true), dv.getFloat32(off + 4, true), dv.getFloat32(off + 8, true)]);
    off += 12;
    const tri: number[][] = [];
    for (let v = 0; v < 3; v++) {
      tri.push([dv.getFloat32(off, true), dv.getFloat32(off + 4, true), dv.getFloat32(off + 8, true)]);
      off += 12;
    }
    vertices.push(tri);
    off += 2;
  }
  return { header, triCount, normals, vertices };
}

/** A deterministic pseudo-random generator (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ATOMS: unknown[] = [
  null, undefined, true, false, 0, -1, 1e9, -1e9, NaN, Infinity, -Infinity, 0.5, 3, '', 'box', 'top',
  'M3', 'snaps', [], {}, [1, 2], { kind: 'cylinder' }, 'cylinder', 'console', 'bottom', 'left', 24, 64,
];

/**
 * Garbage shaped like the template: every leaf replaced at random by an
 * atom, a wrong type or the template's own value; sometimes a whole branch
 * is replaced.
 */
export function garbageLike(template: unknown, random: () => number, depth = 0): unknown {
  const r = random();
  if (r < 0.12 || depth > 6) return ATOMS[Math.floor(random() * ATOMS.length)];
  if (Array.isArray(template)) {
    const n = Math.floor(random() * 4);
    return Array.from({ length: n }, () => garbageLike(template[0] ?? {}, random, depth + 1));
  }
  if (typeof template === 'object' && template !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(template)) {
      if (random() < 0.1) continue;
      out[key] = garbageLike(value, random, depth + 1);
    }
    return out;
  }
  if (typeof template === 'number') return r < 0.5 ? template * (random() * 4 - 1) : (random() - 0.5) * 1000;
  return r < 0.6 ? template : ATOMS[Math.floor(random() * ATOMS.length)];
}

/**
 * A keyboard for the tests (plans/PLAN-KEYBOARDS.md): 3 × 4 MX switches at
 * 19.05 on a 64 × 84 PCB, M3 holes between the rows, the lid as the switch
 * plate 5 mm above the PCB, the key tops 11.6 above it; an encoder's shaft.
 */
export const KEYPAD = {
  id: 'keypad', name: 'Test keypad', vendor: 'Test', kind: 'keyboard',
  size: { w: 64, d: 84, t: 1.6 },
  mount: { kind: 'holes', holes: [{ x: 3, y: 21.5, d: 3.2 }, { x: 61, y: 21.5, d: 3.2 }, { x: 3, y: 59.6, d: 3.2 }, { x: 61, y: 59.6, d: 3.2 }], screw: 'M3' },
  topHeight: 4, bottomHeight: 2,
  ports: [
    { id: 'keys', type: 'keys', edge: 'top', x: 32, y: 40.55, w: 57.15, d: 76.2, h: 11.6, base: 5, open: 'holes',
      rows: [0, 1, 2, 3].map((i) => ({ y: 12 + i * 19.05, x: 12.95, n: 3, pitch: 19.05, w: 14, d: 14 })) },
    { id: 'knob', type: 'knob', edge: 'top', x: 54, y: 80, w: 6, h: 20, base: 4 },
    { id: 'usb-c-1', type: 'usb-c', edge: 'back', along: 20 },
  ],
  source: 'https://example.com/keypad', verified: false,
};
