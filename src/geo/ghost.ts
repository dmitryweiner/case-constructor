// Board ghosts for the preview: the PCB as a slab (its real outline when the
// entry has one) with its mounting holes
// through it and a pad ring around each, every port and top element as a
// block. A parametric mesh without CSG (the slab's faces are triangulated
// with earcut), so the main thread rebuilds it at slider speed while the
// case follows after the debounce.

import earcut from 'earcut';
import type { BoardDef, Glass, PortDef } from '../boards/schema';
import { onFace } from '../boards/schema';
import type { PlacedBoard } from './layout';
import { PIN_SPACER, PIN_SPACER_W, edgeNormal, pinEdges } from './layout';
import type { Affine, SurfaceMesh, Vec3 } from './surface';
import { applyAffine, composeAffine, mergeMeshes } from './surface';
import type { BatterySpec } from '../boards/battery';
import { batterySize, cellCentres } from '../boards/battery';
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

/** Segments of a hole or pad circle. */
export const GHOST_CIRCLE = 24;
/** Width of the copper pad drawn around a mounting hole, mm. */
const PAD = 1;
/** Pads stand this much proud of both PCB faces, mm. */
const PAD_PROUD = 0.05;
/** Material kept between a pad and the board edge or another pad, mm. */
const PAD_KEEP = 0.2;

/** A mounting hole as drawn: centre in the board frame, hole radius, pad width. */
export interface GhostHole {
  x: number;
  y: number;
  r: number;
  pad: number;
}

/**
 * The holes the ghost draws: inside the outline, not on top of each other.
 * A pad narrows where the board edge or another pad is close; a hole that
 * does not fit at all (a half-hole on the edge) is left out of the picture.
 */
export function ghostHoles(def: BoardDef): GhostHole[] {
  if (def.mount.kind !== 'holes') return [];
  const { w, d } = def.size;
  const out: GhostHole[] = [];
  for (const hole of def.mount.holes) {
    const r = hole.d / 2;
    let pad = Math.min(PAD, Math.min(hole.x, hole.y, w - hole.x, d - hole.y) - r - PAD_KEEP);
    for (const other of out) {
      pad = Math.min(pad, Math.hypot(hole.x - other.x, hole.y - other.y) - r - other.r - other.pad - PAD_KEEP);
    }
    if (pad >= 0.1) out.push({ x: hole.x, y: hole.y, r, pad });
  }
  return out;
}

function circle(x: number, y: number, r: number, clockwise: boolean): [number, number][] {
  return Array.from({ length: GHOST_CIRCLE }, (_, i) => {
    const a = ((clockwise ? -i : i) * 2 * Math.PI) / GHOST_CIRCLE;
    return [x + r * Math.cos(a), y + r * Math.sin(a)];
  });
}

/**
 * A prism of a polygon with holes from z0 to z1, board frame → case frame:
 * the outer loop counter-clockwise, the holes clockwise, so every wall quad
 * built the same way faces out of the material. Vertices are shared, so the
 * mesh is closed.
 */
function prismMesh(board: PlacedBoard, outer: [number, number][], holes: [number, number][][], z0: number, z1: number): SurfaceMesh {
  const loops = [outer, ...holes];
  const flat = loops.flat();
  const n = flat.length;
  const holeStarts: number[] = [];
  let start = outer.length;
  for (const hole of holes) {
    holeStarts.push(start);
    start += hole.length;
  }
  const positions = new Float32Array(n * 6);
  flat.forEach(([x, y], i) => {
    positions.set(applyAffine(board.toCase, [x, y, z0]), i * 3);
    positions.set(applyAffine(board.toCase, [x, y, z1]), (i + n) * 3);
  });
  const indices: number[] = [];
  const caps = earcut(flat.flat(), holeStarts, 2);
  for (let k = 0; k < caps.length; k += 3) {
    const a = caps[k];
    let [b, c] = [caps[k + 1], caps[k + 2]];
    const [pa, pb, pc] = [flat[a], flat[b], flat[c]];
    // earcut's winding is not fixed: the top faces up, the bottom down
    if ((pb[0] - pa[0]) * (pc[1] - pa[1]) - (pc[0] - pa[0]) * (pb[1] - pa[1]) < 0) [b, c] = [c, b];
    indices.push(a + n, b + n, c + n, a, c, b);
  }
  let offset = 0;
  for (const loop of loops) {
    for (let i = 0; i < loop.length; i++) {
      const a = offset + i;
      const b = offset + ((i + 1) % loop.length);
      indices.push(a, b, b + n, a, b + n, a + n);
    }
    offset += loop.length;
  }
  const index = new Uint32Array(indices);
  return { positions, indices: index, normals: meshNormals(positions, index) };
}

/** How thick a display's window is drawn over its glass, mm. */
const WINDOW_LAYER = 0.1;

/** The block of one port in the board frame (z = 0 at the PCB underside). */
export function portBlock(board: PlacedBoard, port: PortDef): [number, number, number, number, number, number] {
  const { w, d, t } = board.def.size;
  if (onFace(port)) {
    // a display with a glass: its window as a thin layer on the glass's front
    const [z0, z1] = port.edge === 'top'
      ? [port.glass ? t + port.h - WINDOW_LAYER : t, t + port.h + (port.glass ? WINDOW_LAYER / 2 : 0)]
      : [-port.h, 0];
    return [port.x - port.w / 2, port.y - port.d / 2, z0, port.x + port.w / 2, port.y + port.d / 2, z1];
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

/** Where a port's caption hangs in the view: the middle of its block's top (its bottom for a part underneath), case frame. */
export function portCaptionAnchor(board: PlacedBoard, port: PortDef): Vec3 {
  const [x0, y0, z0, x1, y1, z1] = portBlock(board, port);
  return applyAffine(board.toCase, [(x0 + x1) / 2, (y0 + y1) / 2, port.edge === 'bottom' ? z0 : z1]);
}

/** Square pins as drawn, mm. */
const PIN_SIZE = 0.64;

/**
 * Soldered header rows under the board, board frame: the plastic and the
 * pins as one thin slab below it. A row runs the length of its edge (the
 * entry does not say where it ends).
 */
export function pinBlocks(board: PlacedBoard): [number, number, number, number, number, number][] {
  const pins = board.def.pins;
  if (!pins) return [];
  const { w, d } = board.def.size;
  const { inset, below } = pins;
  return pinEdges(board).flatMap((edge): [number, number, number, number, number, number][] => {
    const along = edge === 'front' || edge === 'back';
    const length = along ? w : d;
    // the row's centre line across the edge, in the board frame
    const c = edge === 'front' ? inset : edge === 'back' ? d - inset : edge === 'left' ? inset : w - inset;
    const row = (half: number, z0: number, z1: number): [number, number, number, number, number, number] => (along
      ? [inset, c - half, z0, length - inset, c + half, z1]
      : [c - half, inset, z0, c + half, length - inset, z1]);
    return [row(PIN_SPACER_W / 2, -PIN_SPACER, 0), row(PIN_SIZE / 2, -below, -PIN_SPACER)];
  });
}

/** The outline of a glass in the board frame, counter-clockwise: a circle, or a rectangle with its rounded corners. */
function glassOutline(glass: Glass): [number, number][] {
  if (glass.shape === 'round') return circle(glass.x, glass.y, glass.w / 2, false);
  const hw = glass.w / 2;
  const hd = glass.d / 2;
  if (glass.r <= 0) return [[glass.x - hw, glass.y - hd], [glass.x + hw, glass.y - hd], [glass.x + hw, glass.y + hd], [glass.x - hw, glass.y + hd]];
  const steps = GHOST_CIRCLE / 4;
  const corners: [number, number, number][] = [[hw - glass.r, -hd + glass.r, -90], [hw - glass.r, hd - glass.r, 0], [-hw + glass.r, hd - glass.r, 90], [-hw + glass.r, -hd + glass.r, 180]];
  return corners.flatMap(([cx, cy, from]) => Array.from({ length: steps + 1 }, (_, i): [number, number] => {
    const a = ((from + (90 * i) / steps) * Math.PI) / 180;
    return [glass.x + cx + glass.r * Math.cos(a), glass.y + cy + glass.r * Math.sin(a)];
  }));
}

/** The glass slabs of a board's display parts, case frame: `t` thick, their front at the part's height. */
function glassGhost(board: PlacedBoard): SurfaceMesh | null {
  const { t } = board.def.size;
  const slabs = board.def.ports.flatMap((port) => (onFace(port) && port.glass
    ? [prismMesh(board, glassOutline(port.glass), [], t + port.h - port.glass.t, t + port.h)]
    : []));
  return slabs.length > 0 ? mergeMeshes(slabs) : null;
}

/**
 * A board's ghost, case frame: the PCB slab with its mounting holes through
 * it; its ports and parts as blocks, soldered pin rows under it, and a pad
 * ring around each hole (drawn
 * in the ports' colour, so the holes read at a glance); a display's glass.
 */
export function boardGhost(board: PlacedBoard): { pcb: SurfaceMesh; ports: SurfaceMesh | null; glass: SurfaceMesh | null } {
  if (board.def.battery) return { pcb: batteryGhost(board, board.def.battery), ports: null, glass: null };
  const { w, d, t } = board.def.size;
  const blocks = [...board.def.ports.map((port) => portBlock(board, port)), ...pinBlocks(board)]
    .map(([x0, y0, z0, x1, y1, z1]) => boxMesh(board, x0, y0, z0, x1, y1, z1));
  const holes = ghostHoles(board.def);
  // the real outline when the entry has one (chamfers, notches); layout and cavity keep the rectangle
  const outer = board.def.outline ?? [[0, 0], [w, 0], [w, d], [0, d]];
  const pcb = holes.length === 0 && !board.def.outline
    ? boxMesh(board, 0, 0, 0, w, d, t)
    : prismMesh(board, outer, holes.map((hole) => circle(hole.x, hole.y, hole.r + hole.pad, true)), 0, t);
  const pads = holes.map((hole) => prismMesh(
    board, circle(hole.x, hole.y, hole.r + hole.pad, false), [circle(hole.x, hole.y, hole.r, true)], -PAD_PROUD, t + PAD_PROUD,
  ));
  const parts = [...blocks, ...pads];
  return { pcb, ports: parts.length > 0 ? mergeMeshes(parts) : null, glass: glassGhost(board) };
}

/** (u, v, w) → (w, u, v): a prism drawn in the (y, z) plane runs along x. */
const ALONG_X: Affine = [0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0];

/** A battery's ghost: its cells lying along x, or its pack as a block. */
function batteryGhost(board: PlacedBoard, spec: BatterySpec): SurfaceMesh {
  const size = batterySize(spec);
  if (spec.kind === 'pack') return boxMesh(board, 0, 0, 0, size.w, size.d, size.h);
  const alongX = { ...board, toCase: composeAffine(board.toCase, ALONG_X) };
  const r = size.h / 2;
  return mergeMeshes(cellCentres(spec).map((y) => prismMesh(alongX, circle(y, r, r, false), [], 0, size.w)));
}
