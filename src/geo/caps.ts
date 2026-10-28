// Printed key caps (plans/PLAN-KEYBOARDS.md K3b): where they stand, and
// their meshes. Pure and parametric (a cap is a solid of revolution, built
// here without CSG), so the main thread places them for the view and the
// STL like the printed screws: in their holes, or in a grid next to the lid
// as they print, flange down.

import { keyFields } from '../boards/schema';
import { capStyle, keyFit, keysOpen, portCut } from '../boards/placement';
import type { CaseLayout } from './layout';
import type { ShapeState } from './shape';
import type { Affine, SurfaceMesh } from './surface';
import { composeAffine, meshBounds, mergeMeshes, transformMesh, translation } from './surface';
import { meshNormals } from './normals';
import { CAP_FLANGE_T, CAP_PROUD, capCorner, capSizes } from './capSize';
import { keysProud } from './ports';

/** One cap: its frame (z along the board's normal, z = 0 on its key's top), its sizes. */
export interface KeyCap {
  board: number;
  port: string;
  frame: Affine;
  /** half the stem's width (a round one's radius), and the flange's */
  stemR: number;
  flangeR: number;
  /** the stem's corner radius: `stemR` for a round cap */
  corner: number;
  /** flange bottom to stem top, mm */
  length: number;
}

/** Room between two caps on the bed, mm. */
const CAP_BED_GAP = 2;
/** Caps per row on the bed. */
const CAPS_PER_ROW = 12;
/** Points on each quarter of a cap's outline. */
const CAP_QUARTER = 6;

/** The printed caps of every board whose lid has them over its keys. */
export function keyCaps(layout: CaseLayout, shape: ShapeState): KeyCap[] {
  return layout.boards.flatMap((board) => {
    if (keysOpen(board.def, board.placement) !== 'caps') return [];
    return keyFields(board.def).flatMap((field) => {
      if (!portCut(board.placement, field.id, field.cut) || !field.rows) return [];
      // from the key's top to the lid's face, and the cap standing out of it
      const depth = -keysProud(board, field, shape, layout.dims, layout.console.frontH, layout.console.backH);
      const length = Math.max(CAP_FLANGE_T + 1, depth + CAP_PROUD);
      const top = board.def.size.t + field.h;
      const style = capStyle(board.placement);
      return capSizes(field, { size: board.placement.capSize, fit: keyFit(board.def, board.placement, field) }).map((cap): KeyCap => ({
        board: board.index, port: field.id, frame: composeAffine(board.toCase, translation(cap.x, cap.y, top)),
        stemR: cap.stemR, flangeR: cap.flangeR, corner: capCorner(style.shape, style.r, cap.stemR), length,
      }));
    });
  });
}

/**
 * A square of half-width `half` with corners of radius `r`, counter-clockwise
 * from the right side: a circle when `r` is `half`. Always the same number
 * of points, so a cap's outlines join ring to ring.
 */
function outline(half: number, r: number, k = CAP_QUARTER): [number, number][] {
  const out: [number, number][] = [];
  const c = half - r;
  for (let q = 0; q < 4; q++) {
    const [sx, sy] = [[1, 1], [-1, 1], [-1, -1], [1, -1]][q];
    for (let i = 0; i <= k; i++) {
      const a = (Math.PI / 2) * (q + i / k);
      // a circle: the quarters' shared points spread out evenly instead
      const t = c < 1e-9 ? (Math.PI / 2) * (q + i / (k + 1)) : a;
      out.push([sx * c + r * Math.cos(t), sy * c + r * Math.sin(t)]);
    }
  }
  return out;
}

/**
 * A cap in its own frame: the flange from z = 0, the stem up to `length`,
 * a closed solid (a centre vertex on each end). Round, or a square with
 * rounded corners; the flange follows the stem's outline, its corners
 * grown by the lip.
 */
export function capMesh(cap: Pick<KeyCap, 'stemR' | 'flangeR' | 'corner' | 'length'>): SurfaceMesh {
  const corner = Math.min(cap.corner, cap.stemR);
  const flange = outline(cap.flangeR, Math.min(cap.flangeR, corner + cap.flangeR - cap.stemR));
  const stem = outline(cap.stemR, corner);
  const rings: [[number, number][], number][] = [[flange, 0], [flange, CAP_FLANGE_T], [stem, CAP_FLANGE_T], [stem, cap.length]];
  const n = stem.length;
  const positions: number[] = [0, 0, 0, 0, 0, cap.length];
  for (const [points, z] of rings) for (const [x, y] of points) positions.push(x, y, z);
  const at = (ring: number, i: number): number => 2 + ring * n + (i % n);
  const indices: number[] = [];
  for (let i = 0; i < n; i++) {
    // the bottom faces down, the top up; between the rings the faces look outwards (or up on the flange's top)
    indices.push(0, at(0, i + 1), at(0, i));
    for (let ring = 0; ring < rings.length - 1; ring++) {
      indices.push(at(ring, i), at(ring, i + 1), at(ring + 1, i + 1), at(ring, i), at(ring + 1, i + 1), at(ring + 1, i));
    }
    indices.push(1, at(rings.length - 1, i), at(rings.length - 1, i + 1));
  }
  const pos = new Float32Array(positions);
  const index = new Uint32Array(indices);
  return { positions: pos, indices: index, normals: meshNormals(pos, index) };
}

/** The caps in their holes, case frame; `lift` moves them along the lid's normal `n` (the exploded view). */
export function capsInCase(caps: readonly KeyCap[], n: readonly [number, number, number] = [0, 0, 1], lift = 0): SurfaceMesh | null {
  if (caps.length === 0) return null;
  return mergeMeshes(caps.map((cap) => transformMesh(capMesh(cap), composeAffine(translation(n[0] * lift, n[1] * lift, n[2] * lift), cap.frame))));
}

/** The caps as they print: flange down, in rows along x from (x0, y0). */
export function capsForPrint(caps: readonly KeyCap[], x0: number, y0 = 0): SurfaceMesh | null {
  if (caps.length === 0) return null;
  const step = 2 * Math.max(...caps.map((cap) => cap.flangeR)) + CAP_BED_GAP;
  return mergeMeshes(caps.map((cap, i) => transformMesh(capMesh(cap), translation(
    x0 + step / 2 + (i % CAPS_PER_ROW) * step, y0 + step / 2 + Math.floor(i / CAPS_PER_ROW) * step, 0,
  ))));
}

/** Parts already on the bed, then the caps to their right, `gap` apart. */
export function withCaps(parts: SurfaceMesh[], caps: readonly KeyCap[], gap: number): SurfaceMesh[] {
  const right = parts.length > 0 ? Math.max(...parts.map((part) => meshBounds(part).max[0])) : 0;
  const placed = capsForPrint(caps, right + gap);
  return placed ? [...parts, placed] : parts;
}
