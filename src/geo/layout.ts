// Case size, board placement and the checks that need no CSG. Pure
// functions: the main thread calls them on every slider move (sizes, board
// ghosts, warnings), the worker on every job — both get the same layout.
//
// Board positions live in the layout frame (relative to each other). The
// cavity is sized to the bounding box of all footprints plus margins (auto)
// or larger (manual), and the layout is centred in it: board positions never
// depend on the case size, which breaks the circular dependency.

import type { BoardDef, Edge } from '../boards/schema';
import type { BoardPlacement, Rotation } from '../boards/placement';
import { boardOf } from '../boards/placement';
import type { Dims } from './face';
import { faceFrame } from './face';
import { bossDiameter } from './fasteners';
import { POST_LEN } from './fastening';
import type { LidState } from './lidSpec';
import type { Message } from './message';
import type { ShapeState } from './shape';
import { SIZE_MIN, SIZE_MAX, plateOf, shapeSpec } from './shape';
import { effectiveRadii } from './loft';
import type { Affine } from './surface';
import { applyAffine } from './surface';

/** Smallest cavity the case keeps when there is nothing inside to size it by. */
export const INNER_MIN: Dims = { w: 16, d: 16, h: 10 };
/** Rails: how far the groove grips the board edge, the rail thickness, the clearance in the groove. */
export const RAIL_GRIP = 1.5;
export const RAIL_THICK = 3;
export const RAIL_GAP = 0.15;
/** Rails stand this much above the PCB top. */
export const RAIL_LIP = 1.2;
/** Rails are shorter than the board edge by this much at each end. */
export const RAIL_SHORTEN = 2;

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface LayoutInput {
  shape: ShapeState;
  lid: LidState;
  boards: readonly BoardPlacement[];
}

export interface PlacedBoard {
  index: number;
  def: BoardDef;
  placement: BoardPlacement;
  /** board frame (z = 0 at the PCB underside) → case frame */
  toCase: Affine;
  /** the rotated PCB outline in the case frame */
  outline: Rect;
  /** outline plus protruding ports and rails */
  footprint: Rect;
  /** PCB underside, absolute z */
  z0: number;
  /** top of the tallest part */
  zTop: number;
  /** bottom of the lowest part under the board */
  zBottom: number;
}

export interface CaseLayout {
  dims: Dims;
  boards: PlacedBoard[];
  /** console only: the heights actually built (raised to clear the boards) */
  console: { frontH: number; backH: number };
}

/** Board frame → layout frame for a rotation, with the rotated outline's corner at (x, y). */
export function boardTransform(def: BoardDef, rot: Rotation, x: number, y: number, z: number): Affine {
  const { w, d } = def.size;
  switch (rot) {
    case 90: return [0, -1, 0, x + d, 1, 0, 0, y, 0, 0, 1, z];
    case 180: return [-1, 0, 0, x + w, 0, -1, 0, y + d, 0, 0, 1, z];
    case 270: return [0, 1, 0, x, -1, 0, 0, y + w, 0, 0, 1, z];
    default: return [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z];
  }
}

/** Outward direction of a board edge in the board frame. */
export function edgeNormal(edge: Edge): [number, number] {
  switch (edge) {
    case 'front': return [0, -1];
    case 'back': return [0, 1];
    case 'left': return [-1, 0];
    default: return [1, 0];
  }
}

function rectOf(points: readonly [number, number][]): Rect {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/** Rails sit along these edges. */
export function railEdges(def: BoardDef): Edge[] {
  const longX = def.size.w >= def.size.d;
  const alongX = (def.mount.rails === 'long') === longX;
  return alongX ? ['front', 'back'] : ['left', 'right'];
}

/** How far beyond each edge the board's footprint reaches (ports, rails). */
function edgeReach(def: BoardDef): Record<Edge, number> {
  const reach: Record<Edge, number> = { front: 0, back: 0, left: 0, right: 0 };
  for (const port of def.ports) {
    if (port.edge !== 'top') reach[port.edge] = Math.max(reach[port.edge], port.protrude);
  }
  if (def.mount.kind === 'rails') {
    for (const edge of railEdges(def)) reach[edge] = Math.max(reach[edge], RAIL_THICK - RAIL_GRIP + RAIL_GAP);
  }
  return reach;
}

function place(input: LayoutInput, offsetX: number, offsetY: number): PlacedBoard[] {
  return input.boards.map((placement, index) => {
    const def = boardOf(placement);
    const z0 = input.shape.floor + placement.z;
    const toCase = boardTransform(def, placement.rot, placement.x + offsetX, placement.y + offsetY, z0);
    const { w, d } = def.size;
    const corner = (bx: number, by: number): [number, number] => {
      const p = applyAffine(toCase, [bx, by, 0]);
      return [p[0], p[1]];
    };
    const reach = edgeReach(def);
    return {
      index,
      def,
      placement,
      toCase,
      outline: rectOf([corner(0, 0), corner(w, d)]),
      footprint: rectOf([corner(-reach.left, -reach.front), corner(w + reach.right, d + reach.back)]),
      z0,
      zTop: z0 + def.size.t + def.topHeight,
      zBottom: z0 - def.bottomHeight,
    };
  });
}

function union(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null;
  return rects.reduce((a, b) => ({
    x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1),
  }));
}

/**
 * The side margin the layout keeps: the user's margin, but never less than
 * the band the lid skirt occupies along the walls.
 */
export function sideMargin(shape: ShapeState, lid: LidState): number {
  // a top or bottom lid on screws has a post in every vertical corner
  const posts = lid.fastening === 'screws' && (lid.face === 'top' || lid.face === 'bottom') ? bossDiameter(lid.screw) + 0.5 : 0;
  return Math.max(shape.margin.side, lid.fit + lid.lip.t + 0.3, posts);
}

/** Boards in the layout frame (before centring) — for placing a new one beside them. */
export function placeBoards(input: LayoutInput): PlacedBoard[] {
  return place(input, 0, 0);
}

/**
 * Extra room on the lid side of the cavity: a side lid with depth takes that
 * much of the floor, and supports belong on the body's floor (PLAN.md §3.5).
 */
export function lidBand(lid: LidState, shape: ShapeState): { x0: number; x1: number; y0: number; y1: number } {
  // screw posts reach POST_LEN (and a boss) into the body from the parting plane
  const posts = lid.fastening === 'screws' ? POST_LEN + bossDiameter(lid.screw) : 0;
  // the lid takes at least the rounded corners of the walls (effectiveLid)
  const corner = shape.kind === 'cylinder' ? 0 : Math.max(0, shape.cornerR - shape.wall);
  const depth = Math.max(lid.depth, corner);
  const band = (depth > 0 ? depth + 0.5 : 0) + posts;
  return {
    x0: lid.face === 'left' ? band : 0,
    x1: lid.face === 'right' ? band : 0,
    y0: lid.face === 'front' ? band : 0,
    y1: lid.face === 'back' ? band : 0,
  };
}

/** The minimum outer size: the cavity the boards need plus walls, floor and ceiling. */
export function minimumDims(input: LayoutInput): Dims {
  const { shape } = input;
  const placed = place(input, 0, 0);
  const box = union(placed.map((board) => board.footprint));
  const margin = sideMargin(shape, input.lid);
  const top = Math.max(0, ...placed.map((board) => board.zTop - shape.floor));
  const band = lidBand(input.lid, input.shape);
  let innerW = Math.max(INNER_MIN.w, box ? box.x1 - box.x0 + 2 * margin + band.x0 + band.x1 : 0);
  let innerD = Math.max(INNER_MIN.d, box ? box.y1 - box.y0 + 2 * margin + band.y0 + band.y1 : 0);
  const innerH = Math.max(INNER_MIN.h, placed.length > 0 ? top + shape.margin.top : 0);
  if (shape.kind === 'cylinder') {
    const diameter = box ? Math.hypot(box.x1 - box.x0, box.y1 - box.y0) + 2 * margin : 0;
    innerW = Math.max(innerW, innerD, diameter);
    innerD = innerW;
  }
  const clamp = (value: number): number => Math.min(SIZE_MAX, Math.max(SIZE_MIN, value));
  return {
    w: clamp(innerW + 2 * shape.wall),
    d: clamp(innerD + 2 * shape.wall),
    h: clamp(innerH + 2 * shape.floor),
  };
}

/**
 * The layout as built: the outer size (auto = the minimum; manual = the
 * manual size grown to the minimum), boards centred in the cavity. The
 * cylinder is as deep as it is wide; the console's heights are raised
 * together until its slope clears every board.
 */
export function caseLayout(input: LayoutInput): CaseLayout {
  const { shape } = input;
  const min = minimumDims(input);
  let dims: Dims = shape.auto ? min : {
    w: Math.max(min.w, shape.size.w),
    d: Math.max(min.d, shape.size.d),
    h: Math.max(min.h, shape.size.h),
  };
  if (shape.kind === 'cylinder') dims = { ...dims, d: dims.w };

  const raw = place(input, 0, 0);
  const box = union(raw.map((board) => board.footprint));
  // centred in what is left of the cavity once the lid's band is taken off
  const band = lidBand(input.lid, input.shape);
  const offsetX = box ? (dims.w + band.x0 - band.x1) / 2 - (box.x0 + box.x1) / 2 : 0;
  const offsetY = box ? (dims.d + band.y0 - band.y1) / 2 - (box.y0 + box.y1) / 2 : 0;
  const boards = place(input, offsetX, offsetY);

  let frontH = shape.console.frontH;
  let backH = shape.console.backH;
  if (shape.kind === 'console') {
    // the slope's inner surface at y must clear every board corner there
    const k = (backH - frontH) / dims.d;
    const plate = shape.floor * Math.hypot(1, k);
    let deficit = Math.max(0, min.h - Math.max(frontH, backH));
    for (const board of boards) {
      const need = board.zTop + shape.margin.top;
      for (const y of [board.footprint.y0, board.footprint.y1]) {
        deficit = Math.max(deficit, need - (frontH + k * y - plate));
      }
    }
    frontH = Math.min(SIZE_MAX, frontH + deficit);
    backH = Math.min(SIZE_MAX, backH + deficit);
    dims = { ...dims, h: Math.max(frontH, backH) };
  }
  return { dims, boards, console: { frontH, backH } };
}

/** The outer size the case is built at. */
export function caseDims(input: LayoutInput): Dims {
  return caseLayout(input).dims;
}

/**
 * Deepest the lid may reach into the walls: the body keeps its own plate,
 * room for the skirt and a millimetre more.
 */
export function lidDepthMax(shape: ShapeState, lid: LidState, dims: Dims): number {
  const plate = plateOf(shape, lid.face);
  const along = faceFrame(lid.face, dims).depth;
  return Math.max(0, along - 2 * plate - lid.lip.h - 1);
}

/**
 * How deep the cavity keeps narrowing behind a face: its rounded corners
 * (side faces) or its edge fillet (top and bottom). A parting plane inside
 * that zone gives an opening narrower than the cavity just below it, and the
 * skirt would hang free of the walls — no snap could grip anything.
 */
export function cornerZone(shape: ShapeState, face: string, dims: Dims): number {
  const radii = effectiveRadii(shapeSpec(shape, dims).inner);
  return face === 'top' || face === 'bottom' ? radii.edgeR : shape.kind === 'cylinder' ? 0 : radii.cornerR;
}

/**
 * The lid as built: deep enough to take the rounded zone of the walls (the
 * parting line runs where the straight walls begin), never deeper than the
 * case allows.
 */
export function effectiveLid(shape: ShapeState, lid: LidState, dims: Dims): LidState {
  const depth = Math.max(lid.depth, cornerZone(shape, lid.face, dims));
  return { ...lid, depth: Math.min(depth, lidDepthMax(shape, lid, dims)) };
}

function overlap(a: Rect, b: Rect): number {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Standoff centres and radii of a placed board, in the case frame. */
export function standoffColumns(board: PlacedBoard): { x: number; y: number; r: number }[] {
  if (board.def.mount.kind !== 'holes') return [];
  const r = bossDiameter(board.placement.mount) / 2;
  return board.def.mount.holes.map((hole) => {
    const p = applyAffine(board.toCase, [hole.x, hole.y, 0]);
    return { x: p[0], y: p[1], r };
  });
}

/**
 * Warnings about the layout: boards overlapping in 3D, a standoff running
 * into another board. The user is the designer — none of these blocks.
 */
export function collisions(layout: CaseLayout): Message[] {
  const out: Message[] = [];
  const { boards } = layout;
  for (let i = 0; i < boards.length; i++) {
    for (let j = i + 1; j < boards.length; j++) {
      const a = boards[i];
      const b = boards[j];
      const zOverlap = Math.min(a.zTop, b.zTop) - Math.max(a.zBottom, b.zBottom);
      if (zOverlap > 0 && overlap(a.outline, b.outline) > 0.01) {
        out.push({ code: 'warn.boardsOverlap', params: { a: i + 1, b: j + 1 } });
      }
    }
  }
  for (const a of boards) {
    for (const column of standoffColumns(a)) {
      const rect: Rect = { x0: column.x - column.r, y0: column.y - column.r, x1: column.x + column.r, y1: column.y + column.r };
      for (const b of boards) {
        if (b === a || b.zBottom >= a.z0 || overlap(rect, b.outline) <= 0) continue;
        out.push({ code: 'warn.standoffHitsBoard', params: { a: a.index + 1, b: b.index + 1 } });
      }
    }
  }
  return dedupe(out);
}

function dedupe(messages: Message[]): Message[] {
  const seen = new Set<string>();
  return messages.filter((message) => {
    const key = JSON.stringify(message);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
