// Board ghosts for the preview: the PCB as a slab, every port and top
// element as a block. A parametric mesh without CSG, so the main thread
// rebuilds it at slider speed while the case follows after the debounce.

import type { PortDef } from '../boards/schema';
import type { PlacedBoard } from './layout';
import { edgeNormal } from './layout';
import type { SurfaceMesh, Vec3 } from './surface';
import { applyAffine, mergeMeshes } from './surface';
import { meshNormals } from './normals';

/** An axis-aligned box in the board frame, mapped to the case frame. */
function boxMesh(board: PlacedBoard, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): SurfaceMesh {
  const corners: Vec3[] = [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
  ];
  const positions = new Float32Array(24);
  corners.forEach((corner, i) => positions.set(applyAffine(board.toCase, corner), i * 3));
  const indices = new Uint32Array([
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4,
    2, 3, 7, 2, 7, 6, 1, 2, 6, 1, 6, 5, 3, 0, 4, 3, 4, 7,
  ]);
  return { positions, indices, normals: meshNormals(positions, indices) };
}

/** The block of one port in the board frame (z = 0 at the PCB underside). */
export function portBlock(board: PlacedBoard, port: PortDef): [number, number, number, number, number, number] {
  const { w, d, t } = board.def.size;
  if (port.edge === 'top') {
    return [port.x - port.w / 2, port.y - port.d / 2, t, port.x + port.w / 2, port.y + port.d / 2, t + port.h];
  }
  const [nx, ny] = edgeNormal(port.edge);
  const z0 = t + port.z;
  const z1 = z0 + port.h;
  // along the edge from its origin end; the body reaches `d` inward from the protruding face
  const face = port.protrude;
  if (nx !== 0) {
    const edgeX = nx > 0 ? w : 0;
    const outer = edgeX + nx * face;
    const inner = outer - nx * port.d;
    return [Math.min(outer, inner), port.along - port.w / 2, z0, Math.max(outer, inner), port.along + port.w / 2, z1];
  }
  const edgeY = ny > 0 ? d : 0;
  const outer = edgeY + ny * face;
  const inner = outer - ny * port.d;
  return [port.along - port.w / 2, Math.min(outer, inner), z0, port.along + port.w / 2, Math.max(outer, inner), z1];
}

/** One mesh per board: slab plus port blocks, in the case frame. */
export function boardGhost(board: PlacedBoard): SurfaceMesh {
  const { w, d, t } = board.def.size;
  const parts = [boxMesh(board, 0, 0, 0, w, d, t)];
  for (const port of board.def.ports) {
    const [x0, y0, z0, x1, y1, z1] = portBlock(board, port);
    parts.push(boxMesh(board, x0, y0, z0, x1, y1, z1));
  }
  return mergeMeshes(parts);
}
