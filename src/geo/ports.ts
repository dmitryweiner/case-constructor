// Board ports → cutters, and the warnings about cutouts. Pure.
//
// An edge port becomes a channel along the edge's outward normal, starting
// at the connector's face: whatever wall stands in front of it — flat, round,
// the console's — gets an opening exactly where the plug goes in, and nothing
// behind the face is touched. A board against a wall has its connectors'
// bodies in the wall: their channels start at the board edge. A top element becomes a column from just above
// it up through the ceiling; a part on the underside, a column from just
// below it down through the floor.

import type { PortDef } from '../boards/schema';
import { onFace } from '../boards/schema';
import { portCut } from '../boards/placement';
import type { CutterSpec, ExtraCut } from './cutters';
import { VERTICAL_AXES, flareAt, horizontalAxes } from './cutters';
import type { Dims } from './face';
import { faceFrame } from './face';
import type { CaseLayout, PlacedBoard } from './layout';
import { edgeNormal } from './layout';
import type { LidState } from './lidSpec';
import type { Message } from './message';
import type { ShapeState } from './shape';
import { plateOf } from './shape';
import type { Vec3 } from './surface';
import { applyAffine, invertRigid, rotateVec } from './surface';

/** A port this far from the inner wall would need a long plug: warn. */
export const PORT_FAR_MM = 12;
/** Columns start this far above the element they open. */
const COLUMN_GAP = 0.3;
/** Channels start this far behind the connector face. */
const CHANNEL_BACK = 0.2;
/** A display window's chamfer: mm wider per mm through the plate, on every side (45°). */
export const WINDOW_FLARE = 1;

/** Inner top of the cavity at (x, y): the ceiling, or the console's slope. */
export function ceilingAt(shape: ShapeState, dims: Dims, frontH: number, backH: number): (x: number, y: number) => number {
  if (shape.kind !== 'console') return () => dims.h - shape.floor;
  const k = (backH - frontH) / dims.d;
  return (_x, y) => frontH + k * y - shape.floor * Math.hypot(1, k);
}

/** Outer top at (x, y): the case height, or the console's slope. */
export function outerTopAt(shape: ShapeState, dims: Dims, frontH: number, backH: number): (x: number, y: number) => number {
  if (shape.kind !== 'console') return () => dims.h;
  const k = (backH - frontH) / dims.d;
  return (_x, y) => frontH + k * y;
}

/** How high an edge port's opening is: the part, or its bottom `cutH` (a terminal's wire slot). */
function openingH(port: PortDef): number {
  return onFace(port) ? port.h : port.cutH ?? port.h;
}

function sectionOf(port: PortDef): { shape: 'rect' | 'round'; w: number; h: number; r: number } {
  const c = port.clearance;
  if (port.shape === 'round') return { shape: 'round', w: port.w + 2 * c, h: port.w + 2 * c, r: 0 };
  return { shape: 'rect', w: port.w + 2 * c, h: openingH(port) + 2 * c, r: Math.min(1.5, c) };
}

/** The connector face point and the outward direction of an edge port, case frame. */
export function portAxis(board: PlacedBoard, port: PortDef & { edge: 'front' | 'back' | 'left' | 'right' }): { face: Vec3; dir: [number, number] } {
  const { w, d, t } = board.def.size;
  const [nx, ny] = edgeNormal(port.edge);
  const [ex, ey] = port.edge === 'front' ? [port.along, 0]
    : port.edge === 'back' ? [port.along, d]
      : port.edge === 'left' ? [0, port.along]
        : [w, port.along];
  const zc = t + port.z + openingH(port) / 2;
  const face = applyAffine(board.toCase, [ex + nx * port.protrude, ey + ny * port.protrude, zc]);
  const dir = rotateVec(board.toCase, [nx, ny, 0]);
  return { face, dir: [dir[0], dir[1]] };
}

export function portCutters(layout: CaseLayout, shape: ShapeState): CutterSpec[] {
  const { dims } = layout;
  const reach = Math.hypot(dims.w, dims.d) + 5;
  const ceiling = ceilingAt(shape, dims, layout.console.frontH, layout.console.backH);
  const top = outerTopAt(shape, dims, layout.console.frontH, layout.console.backH);
  const out: CutterSpec[] = [];
  for (const board of layout.boards) {
    const up = rotateVec(board.toCase, [0, 0, 1]);
    // a board on the console's slope: its openings follow its own axes
    const tilted = Math.abs(up[2] - 1) > 1e-9;
    for (const port of board.def.ports) {
      if (!portCut(board.placement, port.id, port.cut)) continue;
      const source = { kind: 'port' as const, board: board.index, port: port.id };
      const section = sectionOf(port);
      if (tilted) {
        out.push(tiltedCutter(board, port, section, shape, dims, reach, source));
        continue;
      }
      if (onFace(port)) {
        const [cx, cy] = applyAffine(board.toCase, [port.x, port.y, 0]);
        const turned = board.placement.rot === 90 || board.placement.rot === 270;
        const w = port.shape === 'round' ? section.w : (turned ? port.d : port.w) + 2 * port.clearance;
        const h = port.shape === 'round' ? section.w : (turned ? port.w : port.d) + 2 * port.clearance;
        // up through the ceiling from just above a top element, down through the floor from just below an underside one
        const [s0, s1] = port.edge === 'top'
          ? [Math.min(board.z0 + board.def.size.t + port.h + COLUMN_GAP, ceiling(cx, cy) - 0.2), top(cx, cy) + 1]
          : [-1, Math.max(board.z0 - port.h - COLUMN_GAP, shape.floor + 0.2)];
        // a hung display's window widens 45° outwards from the inside of the top
        const bevel = board.hung && port.type === 'display' && port.edge === 'top' && board.placement.bevel !== false;
        const flare = bevel ? { flare: { from: ceiling(cx, cy), rate: WINDOW_FLARE } } : {};
        out.push({ origin: [cx, cy, 0], ...VERTICAL_AXES, s0, s1, ...section, w, h, ...flare, source });
      } else {
        const { face, dir } = portAxis(board, port);
        // against a wall the connector's body sits in the wall: the channel starts at the board edge
        const back = board.walls.some((wall) => wall.edge === port.edge) ? Math.max(0, port.protrude) + CHANNEL_BACK : CHANNEL_BACK;
        out.push({ origin: face, ...horizontalAxes(dir[0], dir[1]), s0: -back, s1: reach, ...section, source });
      }
    }
  }
  return out;
}

/**
 * An opening of a board tilted on the console's slope, in the board's own
 * axes: a top part's column (a display's window, flared) along its normal
 * through the slope, a part underneath along the other way, an edge port's
 * channel along its edge's normal, tilted with the board.
 */
function tiltedCutter(
  board: PlacedBoard, port: PortDef, section: ReturnType<typeof sectionOf>, shape: ShapeState, dims: Dims, reach: number,
  source: CutterSpec['source'],
): CutterSpec {
  const plate = shape.floor;
  const m = board.toCase;
  const axis = (v: Vec3): Vec3 => rotateVec(m, v);
  const { t } = board.def.size;
  if (onFace(port)) {
    const w = port.shape === 'round' ? section.w : port.w + 2 * port.clearance;
    const h = port.shape === 'round' ? section.w : port.d + 2 * port.clearance;
    if (port.edge === 'bottom') {
      const origin = applyAffine(m, [port.x, port.y, 0]);
      return { origin, ex: axis([1, 0, 0]), ey: axis([0, -1, 0]), ez: axis([0, 0, -1]), s0: port.h + COLUMN_GAP, s1: reach, ...section, w, h, source };
    }
    const origin = applyAffine(m, [port.x, port.y, t]);
    // how far the plate's inside is above the PCB along the normal (the board is parallel to it)
    const frame = board.frame;
    const inside = frame ? -plate - applyAffine(invertRigid(frame), origin)[2] : port.h;
    const bevel = port.type === 'display' && board.placement.bevel !== false ? { flare: { from: inside, rate: WINDOW_FLARE } } : {};
    return {
      origin, ex: axis([1, 0, 0]), ey: axis([0, 1, 0]), ez: axis([0, 0, 1]),
      s0: Math.min(port.h + COLUMN_GAP, inside - 0.2), s1: inside + plate + 1, ...section, w, h, ...bevel, source,
    };
  }
  const { face } = portAxis(board, port);
  const [nx, ny] = edgeNormal(port.edge);
  const ez = axis([nx, ny, 0]);
  const ey = axis([0, 0, 1]);
  const ex: Vec3 = [ey[1] * ez[2] - ey[2] * ez[1], ey[2] * ez[0] - ey[0] * ez[2], ey[0] * ez[1] - ey[1] * ez[0]];
  const back = board.walls.some((wall) => wall.edge === port.edge) ? Math.max(0, port.protrude) + CHANNEL_BACK : CHANNEL_BACK;
  // a channel tilted down must stop just past the wall it opens, not dive on under the floor
  const level = Math.hypot(ez[0], ez[1]);
  const out = level > 1e-6 ? (portToWall(shape, dims, face, [ez[0] / level, ez[1] / level]) + shape.wall + 1) / level : reach;
  return { origin: face, ex, ey, ez, s0: -back, s1: Math.min(reach, out), ...section, source };
}

/** Distance from a port face to the inner wall along its direction. */
export function portToWall(shape: ShapeState, dims: Dims, face: Vec3, dir: [number, number]): number {
  const { wall } = shape;
  if (shape.kind === 'cylinder') {
    const radius = dims.w / 2 - wall;
    const px = face[0] - dims.w / 2;
    const py = face[1] - dims.d / 2;
    const b = px * dir[0] + py * dir[1];
    const c = px * px + py * py - radius * radius;
    return Math.max(0, -b + Math.sqrt(Math.max(0, b * b - c)));
  }
  const tx = dir[0] > 0.5 ? dims.w - wall - face[0] : dir[0] < -0.5 ? face[0] - wall : Infinity;
  const ty = dir[1] > 0.5 ? dims.d - wall - face[1] : dir[1] < -0.5 ? face[1] - wall : Infinity;
  return Math.max(0, Math.min(tx, ty));
}

/** The eight corners of a cutter (its flare's wider end included), case frame. */
export function cutterCorners(cutter: CutterSpec): Vec3[] {
  const out: Vec3[] = [];
  for (const s of [cutter.s0, cutter.s1]) {
    const g = flareAt(cutter, s);
    for (const a of [-cutter.w / 2 - g, cutter.w / 2 + g]) {
      for (const b of [-cutter.h / 2 - g, cutter.h / 2 + g]) {
        const p: Vec3 = [0, 0, 0];
        for (let k = 0; k < 3; k++) p[k] = cutter.origin[k] + cutter.ex[k] * a + cutter.ey[k] * b + cutter.ez[k] * s;
        out.push(p);
      }
    }
  }
  return out;
}

/**
 * Warnings about the openings: a port far from its wall, an opening split by
 * the parting plane (information: it is cut in both parts), an opening
 * through the lid skirt, a user cut in a rounded corner.
 */
export function cutWarnings(
  layout: CaseLayout, shape: ShapeState, lid: LidState, cutters: readonly CutterSpec[], extras: readonly ExtraCut[],
): Message[] {
  const out: Message[] = [];
  const { dims } = layout;
  for (const board of layout.boards) {
    for (const port of board.def.ports) {
      if (onFace(port) || !portCut(board.placement, port.id, port.cut)) continue;
      const { face, dir } = portAxis(board, port);
      const gap = portToWall(shape, dims, face, dir);
      if (gap > PORT_FAR_MM) out.push({ code: 'warn.portFar', params: { board: board.index + 1, port: port.id, mm: gap.toFixed(0) } });
    }
  }
  const frame = faceFrame(lid.face, dims);
  const zp = -(plateOf(shape, lid.face) + lid.depth);
  for (const cutter of cutters) {
    const zs = cutterCorners(cutter).map((p) => applyAffine(frame.toFace, p)[2]);
    const lo = Math.min(...zs);
    const hi = Math.max(...zs);
    // a column through the lid plate opens the lid, not a split
    const throughLid = lo > zp - 1e-6 || cutter.ez[2] === 1;
    const split = lo < zp && hi > zp && !throughLid;
    const skirt = !split && !throughLid && hi > zp - lid.lip.h && lo < zp;
    if (!split && !skirt) continue;
    if (cutter.source.kind === 'port') {
      const params = { board: cutter.source.board + 1, port: cutter.source.port };
      out.push({ code: split ? 'info.cutSplit' : 'warn.cutUnderSkirt', params });
    } else {
      out.push({ code: split ? 'info.extraSplit' : 'warn.extraUnderSkirt', params: { n: cutter.source.index + 1 } });
    }
  }
  for (const [index, cut] of extras.entries()) {
    if (shape.kind === 'cylinder' || !inCorner(shape, dims, cut)) continue;
    out.push({ code: 'warn.cutInCorner', params: { n: index + 1 } });
  }
  // a hung display's window on the top, at its outer width
  for (const cutter of cutters) {
    if (!cutter.flare || cutter.source.kind !== 'port' || shape.kind !== 'box') continue;
    const g = flareAt(cutter, cutter.s1);
    const window: ExtraCut = { face: 'top', shape: 'rect', x: cutter.origin[0], y: cutter.origin[1], w: cutter.w + 2 * g, h: cutter.h + 2 * g, r: 0 };
    if (inCorner(shape, dims, window)) out.push({ code: 'warn.windowInCorner', params: { board: cutter.source.board + 1, port: cutter.source.port } });
  }
  return out;
}

/** Whether a user cut reaches into a rounded corner zone of a flat face. */
function inCorner(shape: ShapeState, dims: Dims, cut: ExtraCut): boolean {
  const extent = faceFrame(cut.face, dims).extent;
  const edge = shape.kind === 'console' ? 0 : shape.edgeR;
  const corner = Math.min(shape.cornerR, dims.w / 2, dims.d / 2);
  const u0 = cut.x - cut.w / 2;
  const u1 = cut.x + cut.w / 2;
  const v0 = cut.y - cut.h / 2;
  const v1 = cut.y + cut.h / 2;
  if (cut.face === 'top' || cut.face === 'bottom') {
    if (u0 < edge || v0 < edge || u1 > extent.w - edge || v1 > extent.h - edge) return true;
    const r = Math.max(0, corner - edge);
    for (const [u, v] of [[u0, v0], [u1, v0], [u0, v1], [u1, v1]]) {
      const cu = Math.min(Math.max(u, corner), extent.w - corner);
      const cv = Math.min(Math.max(v, corner), extent.h - corner);
      if (Math.hypot(u - cu, v - cv) > r) return true;
    }
    return false;
  }
  return u0 < corner || u1 > extent.w - corner || v0 < edge || v1 > extent.h - edge;
}
