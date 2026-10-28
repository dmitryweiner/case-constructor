// Case size, board placement and the checks that need no CSG. Pure
// functions: the main thread calls them on every slider move (sizes, board
// ghosts, warnings), the worker on every job — both get the same layout.
//
// Board positions live in the layout frame (relative to each other). The
// cavity is sized to the bounding box of all footprints plus margins (auto)
// or larger (manual), and the layout is centred in it: board positions never
// depend on the case size, which breaks the circular dependency.

import type { BoardDef, Edge, PortDef, TopPort } from '../boards/schema';
import { EDGES, keyFields, keysOf, onFace, resolveVariant } from '../boards/schema';
import type { BoardPlacement, Rotation } from '../boards/placement';
import { CLAMP_POST_ZONE } from '../boards/battery';
import { RIM_FIT, rimReach } from './rim';
import { CLAMP_BAR_T, CLAMP_BAR_W, clampHold, postReach } from './clamp';
import { attachTransform } from './attach';
import { CEILING_GAP, backPortDefault, boardOf, frontHeight, portCut, ownPortDefault, pinsDown, undersideOf } from '../boards/placement';
import { catalogBoard } from '../boards/catalog';
import type { Dims } from './face';
import { faceFrame } from './face';
import { bossDiameter } from './fasteners';
import { postLength } from './fastening';
import type { LidState } from './lidSpec';
import { postDiameter } from './lidSpec';
import type { Message, SpotBox } from './message';
import { boardParams, boxAround, spotOf } from './message';
import type { ShapeState } from './shape';
import { SIZE_MIN, SIZE_MAX, WALL_MIN, plateOf, shapeSpec } from './shape';
import { effectiveRadii } from './loft';
import type { Affine, Vec3 } from './surface';
import { applyAffine, composeAffine, invertRigid, rotateVec } from './surface';

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
/** Soldered pins: the header's plastic under the PCB, its width across the row. */
export const PIN_SPACER = 2.5;
export const PIN_SPACER_W = 2.54;
/** The pin bed's slot for a row of pins, its width and the room under the pin tips. */
export const PIN_SLOT = 1.2;
export const PIN_TIP_GAP = 0.5;
/** The narrowest wall the pin bed keeps inside the slot for the pins. */
export const PIN_BED_WALL = 1.2;

/** How far inside the board edge a rail reaches under it: the lower lip, or the pin bed's shelf. */
export function railReach(pins: { inset: number } | null): number {
  if (!pins) return RAIL_GRIP - RAIL_GAP;
  return Math.max(pins.inset + PIN_SPACER_W / 2, pins.inset + PIN_SLOT / 2 + PIN_BED_WALL);
}

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

/** A board against a case wall: which wall, which of its edges faces it, where the inner wall goes. */
export interface PlacedWall {
  /** the case wall, case frame */
  side: Edge;
  /** the board's own edge that faces it, board frame */
  edge: Edge;
  /** where this board puts the inner wall: x for left / right, y for front / back */
  line: number;
  /** how much deeper than asked its connectors sit (they are shorter than the wall), mm */
  recessed: number;
  /** how far the edge's connectors stick out past the board edge (0 at least), mm */
  protrude: number;
  /** the edge has connectors at all */
  ports: boolean;
  /** the wall really is there: another board did not push it further out */
  against: boolean;
}

/** The least room between a board edge and the wall it stands against, mm. */
export const WALL_GAP = 0.3;

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
  /** the walls it stands against: those asked for that can be (not on a cylinder, a rail edge, the side lid's face) */
  walls: PlacedWall[];
  /** hung from the ceiling (its top still up): its supports come down from the ceiling plate */
  hung: boolean;
  /**
   * A hung board's plate frame → case frame: w = 0 on the plate's outer
   * face, w along its outward normal — the top raised to the case height, or
   * the console's slope. Its supports are built in it.
   */
  frame?: Affine;
  /**
   * A board on a display's back: the display's index (`index` is the same).
   * It has no supports of its own; it comes after every placed board.
   */
  attached?: number;
  /** an attached board's standoffs, as drawn: the display's frame, its back holes, their length below its back */
  standoffs?: { toCase: Affine; holes: { x: number; y: number }[]; length: number };
  /** a display carried by the board under it (D9): `attached` is that board's index */
  carried?: true;
  /** a carried display under a flat top: the gap from its front to the ceiling, once the case height is known */
  gap?: number;
}

/** The top plate's frame of a flat-topped case h high: w = 0 on the outer top. */
export function flatFrame(h: number): Affine {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, h];
}

/** The console's slope frame: turned about x by the slope's angle, w = 0 on the outer slope. */
export function slopeFrame(frontH: number, backH: number, depth: number): Affine {
  const angle = Math.atan2(backH - frontH, depth);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, frontH];
}

export interface CaseLayout {
  dims: Dims;
  boards: PlacedBoard[];
  /** console only: the heights actually built (raised to clear the boards) */
  console: { frontH: number; backH: number };
  /** where the inner walls are: x for left / right, y for front / back */
  inner: Record<Edge, number>;
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

/** The edges whose pins hang below the board: none unless they are soldered. */
export function pinEdges(board: Pick<PlacedBoard, 'def' | 'placement'>): Edge[] {
  return board.def.pins && pinsDown(board.def, board.placement) ? board.def.pins.edges : [];
}

/**
 * How far beyond each edge the board's footprint reaches (ports, rails; a
 * hung board's standoff bosses too: they come down through the band where a
 * top lid's skirt hangs, and the side margin must keep them off it).
 */
function edgeReach(def: BoardDef, placement: BoardPlacement, hung: boolean): Record<Edge, number> {
  const reach: Record<Edge, number> = { front: 0, back: 0, left: 0, right: 0 };
  // the rim around a hung display's glass, which may reach past its edge
  if (hung) {
    for (const port of def.ports) {
      if (!onFace(port) || port.edge !== 'top' || !port.glass) continue;
      const rim = rimReach(port.glass, def.size);
      for (const edge of EDGES) reach[edge] = Math.max(reach[edge], rim[edge]);
    }
  }
  // a clamped panel's posts stand beyond its long edges
  if (def.mount.kind === 'clamp') {
    const across = clampHold(def, placement).across;
    const posts = postReach(placement);
    if (across === 'x') {
      reach.left = Math.max(reach.left, posts);
      reach.right = Math.max(reach.right, posts);
    } else {
      reach.front = Math.max(reach.front, posts);
      reach.back = Math.max(reach.back, posts);
    }
  }
  if (hung && def.mount.kind === 'holes') {
    const r = bossDiameter(placement.mount) / 2;
    for (const hole of def.mount.holes) {
      reach.left = Math.max(reach.left, r - hole.x);
      reach.right = Math.max(reach.right, hole.x + r - def.size.w);
      reach.front = Math.max(reach.front, r - hole.y);
      reach.back = Math.max(reach.back, hole.y + r - def.size.d);
    }
  }
  for (const port of def.ports) {
    if (onFace(port)) continue;
    // a plug that stays inside keeps its slot clear of the wall
    const slot = port.reach !== undefined && portCut(placement, port.id, port.cut) ? port.protrude + port.reach : 0;
    reach[port.edge] = Math.max(reach[port.edge], port.protrude, slot);
  }
  if (def.mount.kind === 'rails') {
    for (const edge of railEdges(def)) reach[edge] = Math.max(reach[edge], RAIL_THICK - RAIL_GRIP + RAIL_GAP);
  }
  // a battery's clamp stands on posts in front of it and behind it
  if (def.battery) {
    reach.front = CLAMP_POST_ZONE;
    reach.back = CLAMP_POST_ZONE;
  }
  return reach;
}

/** A wall a placed board stands against, if it can: see PlacedWall. */
function wallOf(input: LayoutInput, def: BoardDef, placement: BoardPlacement, toCase: Affine, outline: Rect, side: Edge): PlacedWall | null {
  if (input.shape.kind === 'cylinder' || input.lid.face === side) return null;
  const [wx, wy] = edgeNormal(side);
  const edge = EDGES.find((one) => {
    const n = rotateVec(toCase, [...edgeNormal(one), 0]);
    return Math.abs(n[0] - wx) < 1e-9 && Math.abs(n[1] - wy) < 1e-9;
  });
  if (!edge || (def.mount.kind === 'rails' && railEdges(def).includes(edge))) return null;
  const onEdge = def.ports.filter((port) => port.edge === edge);
  const protrude = Math.max(0, ...onEdge.map((port) => (onFace(port) ? 0 : port.protrude)));
  // the inner wall goes beyond the board edge by what the connectors stick out, less the wall and the offset
  const wanted = protrude - (placement.wallOffset ?? 0) - input.shape.wall;
  const reach = Math.max(wanted, WALL_GAP);
  const sign = side === 'right' || side === 'back' ? 1 : -1;
  const at = side === 'right' ? outline.x1 : side === 'left' ? outline.x0 : side === 'back' ? outline.y1 : outline.y0;
  return { side, edge, line: at + sign * reach, recessed: reach - wanted, protrude, ports: onEdge.length > 0, against: true };
}

/** Whether a placement hangs from the ceiling (a box's or a cylinder's top, the console's slope). */
export function hangs(placement: BoardPlacement): boolean {
  return placement.on === 'ceiling';
}

/**
 * A hung board's board → case transform under the plate `frame` (see
 * PlacedBoard.frame): parallel to the plate, its front `gap` below the
 * plate's inside, its plan centre where the layout puts it (cx, cy).
 */
function hungTransform(def: BoardDef, front: number, rot: Rotation, cx: number, cy: number, gap: number, plate: number, frame: Affine): Affine {
  const turned = rot === 90 || rot === 270;
  const W = turned ? def.size.d : def.size.w;
  const D = turned ? def.size.w : def.size.d;
  const wf = -(plate + gap);
  // frame: y = v·cos − w·sin, so the plan centre cy sits at v = (cy + w·sin) / cos
  const [cos, sin] = [frame[5], frame[9]];
  const v = (cy + wf * sin) / cos;
  const local = composeAffine([1, 0, 0, cx - W / 2, 0, 1, 0, v - D / 2, 0, 0, 1, wf - def.size.t - front], boardTransform(def, rot, 0, 0, 0));
  return composeAffine(frame, local);
}

/**
 * The boards placed, `offsetX/Y` added to their positions; a hung board
 * under the plate `frame` (null while the case height is not known yet —
 * only their plan and their stacks count then).
 */
function place(input: LayoutInput, offsetX: number, offsetY: number, frame: Affine | null): PlacedBoard[] {
  const placed = placeOwn(input, offsetX, offsetY, frame);
  const attached = placed.flatMap((board) => attachedTo(board) ?? carriedBy(board) ?? []);
  // a display's stack reaches down to the board on its back
  const own = placed.map((board) => {
    const child = attached.find((one) => one.attached === board.index && !one.carried);
    return child ? { ...board, zBottom: Math.min(board.zBottom, child.zBottom) } : board;
  });
  return [...own, ...attached];
}

/** Corners of a box in a board's frame → their extremes in the case frame. */
function boxExtent(toCase: Affine, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): { rect: Rect; z0: number; z1: number } {
  const points = [x0, x1].flatMap((x) => [y0, y1].flatMap((y) => [z0, z1].map((z) => applyAffine(toCase, [x, y, z]))));
  const zs = points.map((p) => p[2]);
  return { rect: rectOf(points.map((p): [number, number] => [p[0], p[1]])), z0: Math.min(...zs), z1: Math.max(...zs) };
}

/** The board on a display's back, placed by its pattern; none without one. */
function attachedTo(parent: PlacedBoard): PlacedBoard | null {
  const back = parent.placement.back;
  const pattern = parent.def.back;
  const entry = back ? catalogBoard(back.board) : undefined;
  if (!back || !pattern || !entry) return null;
  const resolved = resolveVariant(entry, back.variant);
  const def: BoardDef = { ...resolved, ports: resolved.ports.map((port) => ({ ...port, cut: backPortDefault(port) })) };
  const toCase = composeAffine(parent.toCase, attachTransform(parent.def, def, back.rot, back.standoff));
  const placement: BoardPlacement = {
    board: def.id, x: 0, y: 0, z: 0, rot: back.rot, mount: { size: def.mount.screw, hole: 'tap', head: 'none' }, cuts: back.cuts,
    ...(back.variant !== undefined ? { variant: back.variant } : {}),
  };
  const { w, d, t } = def.size;
  const reach = edgeReach(def, placement, false);
  const body = boxExtent(toCase, 0, 0, -undersideOf(def, false), w, d, t + def.topHeight);
  return {
    index: parent.index,
    def,
    placement,
    toCase,
    outline: boxExtent(toCase, 0, 0, 0, w, d, 0).rect,
    footprint: boxExtent(toCase, -reach.left, -reach.front, 0, w + reach.right, d + reach.back, 0).rect,
    z0: boxExtent(toCase, 0, 0, 0, w, d, 0).z0,
    zTop: body.z1,
    zBottom: body.z0,
    walls: [],
    hung: parent.hung,
    attached: parent.index,
    standoffs: { toCase: parent.toCase, holes: pattern.holes, length: back.standoff },
  };
}

/**
 * The HAT display a floor board carries (D9): D6's pattern read the other
 * way round — the board's frame → the display's frame, inverted.
 */
function carriedBy(board: PlacedBoard): PlacedBoard | null {
  const top = board.placement.top;
  const entry = top ? catalogBoard(top.board) : undefined;
  if (!top || !entry || board.hung) return null;
  const def = resolveVariant(entry, top.variant);
  const toCase = composeAffine(board.toCase, invertRigid(attachTransform(def, board.def, top.rot, top.standoff)));
  const placement: BoardPlacement = {
    board: def.id, x: 0, y: 0, z: 0, rot: top.rot, mount: { size: def.mount.screw, hole: 'tap', head: 'none' }, cuts: top.cuts,
    ...(top.variant !== undefined ? { variant: top.variant } : {}),
  };
  const { w, d, t } = def.size;
  // the rim around its glass reaches past it; nothing else does (it has no supports)
  const reach = edgeReach({ ...def, mount: { ...def.mount, kind: 'holes', holes: [] } }, placement, true);
  const body = boxExtent(toCase, 0, 0, -undersideOf(def, false), w, d, t + def.topHeight);
  return {
    index: board.index,
    def,
    placement,
    toCase,
    outline: boxExtent(toCase, 0, 0, 0, w, d, 0).rect,
    footprint: boxExtent(toCase, -reach.left, -reach.front, 0, w + reach.right, d + reach.back, 0).rect,
    z0: boxExtent(toCase, 0, 0, 0, w, d, 0).z0,
    zTop: body.z1,
    zBottom: body.z0,
    walls: [],
    hung: false,
    attached: board.index,
    carried: true,
  };
}

/** The placed boards themselves, without the boards on their backs. */
function placeOwn(input: LayoutInput, offsetX: number, offsetY: number, frame: Affine | null): PlacedBoard[] {
  return input.boards.map((placement, index) => {
    const own = boardOf(placement);
    // a board carrying a display keeps its top parts closed by default
    const def = placement.top ? { ...own, ports: own.ports.map((port) => ({ ...port, cut: ownPortDefault(placement, port) })) } : own;
    const hung = hangs(placement);
    const pins = pinsDown(def, placement);
    const top = frontHeight(def, placement);
    const front = def.size.t + top;
    const { w, d } = def.size;
    const turned = placement.rot === 90 || placement.rot === 270;
    const cx = placement.x + offsetX + (turned ? d : w) / 2;
    const cy = placement.y + offsetY + (turned ? w : d) / 2;
    const plateFrame = frame ?? flatFrame(0);
    const toCase = hung
      ? hungTransform(def, top, placement.rot, cx, cy, placement.z, input.shape.floor, plateFrame)
      : boardTransform(def, placement.rot, placement.x + offsetX, placement.y + offsetY, input.shape.floor + placement.z);
    // a hung board may be tilted (the slope): its heights are its corners' extremes
    const zs = (bz: number): number[] => [[0, 0], [w, 0], [0, d], [w, d]].map(([bx, by]) => applyAffine(toCase, [bx, by, bz])[2]);
    const z0 = Math.min(...zs(0));
    const zTop = Math.max(...zs(front));
    // a clamped panel's bars go below its back
    const below = def.mount.kind === 'clamp' ? Math.max(undersideOf(def, pins), CLAMP_BAR_T - clampHold(def, placement).face) : undersideOf(def, pins);
    const zBottom = Math.min(...zs(-below));
    const corner = (bx: number, by: number): [number, number] => {
      const p = applyAffine(toCase, [bx, by, 0]);
      return [p[0], p[1]];
    };
    const reach = edgeReach(def, placement, hung);
    const outline = rectOf([corner(0, 0), corner(w, d)]);
    return {
      index,
      def,
      placement,
      toCase,
      outline,
      footprint: rectOf([corner(-reach.left, -reach.front), corner(w + reach.right, d + reach.back)]),
      z0,
      zTop,
      zBottom,
      walls: (placement.walls ?? []).flatMap((side) => wallOf(input, def, placement, toCase, outline, side) ?? []),
      hung,
      ...(hung ? { frame: plateFrame } : {}),
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
  // a top or bottom lid on screws or magnets has a post in every vertical corner
  const posts = lid.fastening !== 'snaps' && (lid.face === 'top' || lid.face === 'bottom') ? postDiameter(lid) + 0.5 : 0;
  return Math.max(shape.margin.side, lid.fit + lid.lip.t + 0.3, posts);
}

/**
 * The side margin a hung board keeps: under a rounded top edge the ceiling
 * is flat only that far in, and a top lid's opening — its skirt — is pushed
 * in as much. A hung board's rim and standoffs reach the ceiling, so it
 * keeps the whole rounded zone plus the skirt's band (a round panel's rim
 * touched the skirt there: slivers).
 */
export function hungMargin(shape: ShapeState, lid: LidState): number {
  const rounded = shape.kind === 'console' ? 0 : Math.max(0, shape.edgeR - Math.min(shape.wall, shape.floor));
  return Math.max(sideMargin(shape, lid), rounded + lid.fit + lid.lip.t + 0.3);
}

/** Boards in the layout frame (before centring) — for placing a new one beside them. */
export function placeBoards(input: LayoutInput): PlacedBoard[] {
  return placeOwn(input, 0, 0, null);
}

/**
 * Extra room on the lid side of the cavity: a side lid with depth takes that
 * much of the floor, and supports belong on the body's floor (plans/PLAN.md §3.5).
 */
export function lidBand(lid: LidState, shape: ShapeState): { x0: number; x1: number; y0: number; y1: number } {
  // posts reach their length (and a boss) into the body from the parting plane
  const posts = lid.fastening !== 'snaps' ? postLength(lid) + postDiameter(lid) : 0;
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

/**
 * The cavity the boards need, layout frame (the lid's band not included):
 * their footprints and the side margin — except where a board stands
 * against a wall, which puts the inner wall at its line. `fixed` says which
 * sides a board holds.
 */
function cavityOf(input: LayoutInput, placed: readonly PlacedBoard[]): (Rect & { fixed: Record<Edge, boolean> }) | null {
  if (placed.length === 0) return null;
  const floorMargin = sideMargin(input.shape, input.lid);
  const ceilingMargin = hungMargin(input.shape, input.lid);
  const fixed: Record<Edge, boolean> = { left: false, right: false, front: false, back: false };
  const sideOf = (board: PlacedBoard, side: Edge, free: number): number => {
    const wall = board.walls.find((one) => one.side === side);
    if (!wall) return free;
    fixed[side] = true;
    return wall.line;
  };
  const { footprint: f0 } = placed[0];
  const cavity = { x0: f0.x0, x1: f0.x1, y0: f0.y0, y1: f0.y1 };
  placed.forEach((board, i) => {
    const f = board.footprint;
    const margin = board.hung ? ceilingMargin : floorMargin;
    const x0 = sideOf(board, 'left', f.x0 - margin);
    const x1 = sideOf(board, 'right', f.x1 + margin);
    const y0 = sideOf(board, 'front', f.y0 - margin);
    const y1 = sideOf(board, 'back', f.y1 + margin);
    cavity.x0 = i === 0 ? x0 : Math.min(cavity.x0, x0);
    cavity.x1 = i === 0 ? x1 : Math.max(cavity.x1, x1);
    cavity.y0 = i === 0 ? y0 : Math.min(cavity.y0, y0);
    cavity.y1 = i === 0 ? y1 : Math.max(cavity.y1, y1);
  });
  return { ...cavity, fixed };
}

/** The minimum outer size: the cavity the boards need plus walls, floor and ceiling. */
export function minimumDims(input: LayoutInput): Dims {
  const { shape } = input;
  const placed = place(input, 0, 0, null);
  const box = union(placed.map((board) => board.footprint));
  const cavity = cavityOf(input, placed);
  const margin = placed.some((board) => board.hung) ? hungMargin(shape, input.lid) : sideMargin(shape, input.lid);
  const band = lidBand(input.lid, input.shape);
  let innerW = Math.max(INNER_MIN.w, cavity ? cavity.x1 - cavity.x0 + band.x0 + band.x1 : 0);
  let innerD = Math.max(INNER_MIN.d, cavity ? cavity.y1 - cavity.y0 + band.y0 + band.y1 : 0);
  const innerH = Math.max(INNER_MIN.h, placed.length > 0 ? stacksHeight(placed, shape) : 0);
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
 * The inner height the boards need: each floor board's top and each hung
 * board's stack (gap, board, parts and pins under it) with `margin.top` to
 * spare — the two added up where a hung board is over a floor board.
 */
function stacksHeight(placed: readonly PlacedBoard[], shape: ShapeState): number {
  const floorTop = (board: PlacedBoard): number => board.zTop - shape.floor;
  const hungDepth = (board: PlacedBoard): number => board.placement.z + board.zTop - board.zBottom;
  const floor = placed.filter((board) => !board.hung && !board.carried);
  const hung = placed.filter((board) => board.hung);
  // a carried display wants the ceiling the gap above its front: its window flush; so does a keyboard on the floor, its keys through the lid
  const flush = placed.filter((board) => board.carried || (!board.hung && opensKeys(board)));
  const rest = floor.filter((board) => !flush.includes(board));
  let need = Math.max(Math.max(0, ...rest.map(floorTop), ...hung.map(hungDepth)) + shape.margin.top, ...flush.map((board) => floorTop(board) + CEILING_GAP));
  for (const above of hung) {
    for (const below of floor) {
      if (overlap(above.outline, below.outline) > 0.01) need = Math.max(need, floorTop(below) + shape.margin.top + hungDepth(above));
    }
  }
  return need;
}

/** Whether a board opens the lid over a key field of its own. */
export function opensKeys(board: Pick<PlacedBoard, 'def' | 'placement'>): boolean {
  return keyFields(board.def).some((field) => portCut(board.placement, field.id, field.cut));
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

  const cavity = cavityOf(input, place(input, 0, 0, null));
  // centred in what is left of the cavity once the lid's band is taken off —
  // or against the wall a board stands against
  const band = lidBand(input.lid, input.shape);
  const { wall } = shape;
  const offsetX = !cavity ? 0
    : cavity.fixed.left ? wall + band.x0 - cavity.x0
      : cavity.fixed.right ? dims.w - wall - band.x1 - cavity.x1
        : (dims.w + band.x0 - band.x1) / 2 - (cavity.x0 + cavity.x1) / 2;
  const offsetY = !cavity ? 0
    : cavity.fixed.front ? wall + band.y0 - cavity.y0
      : cavity.fixed.back ? dims.d - wall - band.y1 - cavity.y1
        : (dims.d + band.y0 - band.y1) / 2 - (cavity.y0 + cavity.y1) / 2;
  const inner: Record<Edge, number> = {
    left: wall + band.x0, right: dims.w - wall - band.x1, front: wall + band.y0, back: dims.d - wall - band.y1,
  };
  const placeAll = (frame: Affine): PlacedBoard[] => place(input, offsetX, offsetY, frame).map((board): PlacedBoard => ({
    ...board,
    walls: board.walls.map((wall) => ({ ...wall, against: Math.abs(wall.line - inner[wall.side]) < 1e-6 })),
  }));

  let frontH = shape.console.frontH;
  let backH = shape.console.backH;
  if (shape.kind !== 'console') {
    // a carried display under the flat top: how far below the ceiling its front ended up
    const boards = placeAll(flatFrame(dims.h)).map((board): PlacedBoard => (board.carried
      ? { ...board, gap: dims.h - shape.floor - board.zTop } : board));
    return { dims, boards, console: { frontH, backH }, inner };
  }
  // The console's heights rise together — the slope's angle stays — until
  // its inside clears every floor board, and every board hung from it clears
  // the floor and the floor boards under it, by the top margin.
  const k = (backH - frontH) / dims.d;
  const plate = shape.floor * Math.hypot(1, k);
  const first = placeAll(slopeFrame(frontH, backH, dims.d));
  let deficit = Math.max(0, min.h - Math.max(frontH, backH));
  const floorBoards = first.filter((board) => !board.hung);
  for (const board of floorBoards) {
    const need = board.zTop + shape.margin.top;
    for (const y of [board.footprint.y0, board.footprint.y1]) {
      deficit = Math.max(deficit, need - (frontH + k * y - plate));
    }
  }
  for (const board of first.filter((one) => one.hung)) {
    const under = floorBoards.filter((below) => overlap(board.outline, below.outline) > 0.01);
    const need = Math.max(shape.floor, ...under.map((below) => below.zTop)) + shape.margin.top;
    deficit = Math.max(deficit, need - board.zBottom);
  }
  frontH = Math.min(SIZE_MAX, frontH + deficit);
  backH = Math.min(SIZE_MAX, backH + deficit);
  dims = { ...dims, h: Math.max(frontH, backH) };
  return { dims, boards: placeAll(slopeFrame(frontH, backH, dims.d)), console: { frontH, backH }, inner };
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

/**
 * Whether the lid holds the board: its supports grow from the lid's plate —
 * a hung board under a top lid, a floor board on a bottom lid. In the
 * exploded view it goes with the lid.
 */
export function heldByLid(board: Pick<PlacedBoard, 'hung'>, lidFace: string): boolean {
  return board.hung ? lidFace === 'top' : lidFace === 'bottom';
}

/** How thick a display's window is drawn over its glass, mm. */
const WINDOW_LAYER = 0.1;

/** How thick a key field's base is drawn when the entry gives none, mm. */
export const KEY_SLAB = 0.3;

/** The block of one port in the board frame (z = 0 at the PCB underside); a key field with rows is its base, its keys stand on it. */
export function portBlock(board: PlacedBoard, port: PortDef): [number, number, number, number, number, number] {
  const { w, d, t } = board.def.size;
  if (onFace(port)) {
    // a display with a glass: its window as a thin layer on the glass's front
    const top = port.rows ? t + Math.max(port.base ?? KEY_SLAB, 0.1) : t + port.h;
    const [z0, z1] = port.edge === 'top'
      ? [port.glass ? t + port.h - WINDOW_LAYER : t, top + (port.glass ? WINDOW_LAYER / 2 : 0)]
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

/** Standoff centres and radii of a placed board, in the case frame. */
export function standoffColumns(board: PlacedBoard): { x: number; y: number; r: number }[] {
  if (board.def.mount.kind !== 'holes') return [];
  const r = bossDiameter(board.placement.mount) / 2;
  return board.def.mount.holes.map((hole) => {
    const p = applyAffine(board.toCase, [hole.x, hole.y, 0]);
    return { x: p[0], y: p[1], r };
  });
}

/** A block in a board's frame (x0, y0, z0, x1, y1, z1) as a box in the case frame. */
function caseBox(board: PlacedBoard, b: readonly number[]): SpotBox {
  const corners: Vec3[] = [];
  for (const x of [b[0], b[3]]) for (const y of [b[1], b[4]]) for (const z of [b[2], b[5]]) corners.push(applyAffine(board.toCase, [x, y, z]));
  return boxAround(corners);
}

/** A board's own volume, case frame. */
function boardBox(board: PlacedBoard): SpotBox {
  const o = board.outline;
  return { min: [o.x0, o.y0, board.zBottom], max: [o.x1, o.y1, board.zTop] };
}

/** Where two boxes share volume (null when they do not). */
function shared(a: SpotBox, b: SpotBox): SpotBox | null {
  const min = [0, 1, 2].map((k) => Math.max(a.min[k], b.min[k]));
  const max = [0, 1, 2].map((k) => Math.min(a.max[k], b.max[k]));
  return [0, 1, 2].every((k) => max[k] > min[k]) ? { min: [min[0], min[1], min[2]], max: [max[0], max[1], max[2]] } : null;
}

/** A board in a message's spot: the boxes, moving with that board. */
function onBoard(board: PlacedBoard, boxes: readonly SpotBox[]): Pick<Message, 'spot'> {
  const spot = spotOf(boxes, { board: board.index });
  return spot ? { spot } : {};
}

/** How far a board reaches towards a side of the case, by its outline. */
function towards(board: PlacedBoard, side: Edge): number {
  const o = board.outline;
  return side === 'right' ? o.x1 : side === 'left' ? -o.x0 : side === 'back' ? o.y1 : -o.y0;
}

/**
 * Why a board is not at a wall it asked for: the board that reaches
 * further, or the case's own size. The spot is the strip between its edge
 * and the wall.
 */
function notAgainst(board: PlacedBoard, side: Edge, layout: CaseLayout): Message {
  const others = layout.boards.filter((other) => other.index !== board.index && other.attached === undefined);
  const further = others.reduce<PlacedBoard | undefined>((best, other) => (!best || towards(other, side) > towards(best, side) ? other : best), undefined);
  const o = board.outline;
  const wall = layout.inner[side];
  const [x0, x1] = side === 'left' ? [wall, o.x0] : side === 'right' ? [o.x1, wall] : [o.x0, o.x1];
  const [y0, y1] = side === 'front' ? [wall, o.y0] : side === 'back' ? [o.y1, wall] : [o.y0, o.y1];
  const strip = onBoard(board, [{ min: [x0, y0, board.zBottom], max: [x1, y1, board.zTop] }]);
  return further && towards(further, side) > towards(board, side) - 1e-6
    ? { code: 'warn.notAgainstWall', params: { ...boardParams(board), side, ...boardParams(further, 'other') }, ...strip }
    : { code: 'warn.notAgainstWallSize', params: { ...boardParams(board), side }, ...strip };
}

/**
 * The note about connectors that cannot reach the outer surface, one per
 * board and depth: the walls, the wall's thickness, how much deeper than
 * asked, and — when they do stick out — the wall that would bring them flush.
 */
function recessedNotes(board: PlacedBoard, dims: Dims): Message[] {
  const offset = board.placement.wallOffset ?? 0;
  const byDepth = new Map<string, PlacedWall[]>();
  for (const one of board.walls) {
    if (!one.against || !one.ports || one.recessed <= 0.05) continue;
    const mm = one.recessed.toFixed(1);
    byDepth.set(mm, [...(byDepth.get(mm) ?? []), one]);
  }
  return [...byDepth].map(([mm, walls]): Message => {
    const sides = EDGES.filter((side) => walls.some((one) => one.side === side)).join(',');
    // the board stands WALL_GAP off the inner wall: the rest of how deep they sit is the wall
    const { protrude, recessed } = walls[0];
    const wall = +(protrude - offset - WALL_GAP + recessed).toFixed(2);
    const params = { ...boardParams(board), walls: sides, wall, mm };
    // the edge's connectors and the way out to the outer surface
    const boxes = walls.flatMap((one): SpotBox[] => {
      const ports = board.def.ports.filter((port) => port.edge === one.edge);
      if (ports.length === 0) return [];
      const box = boxAround(ports.flatMap((port) => {
        const b = caseBox(board, portBlock(board, port));
        return [b.min, b.max];
      }));
      const min: Vec3 = [box.min[0], box.min[1], box.min[2]];
      const max: Vec3 = [box.max[0], box.max[1], box.max[2]];
      if (one.side === 'left') min[0] = 0;
      if (one.side === 'right') max[0] = dims.w;
      if (one.side === 'front') min[1] = 0;
      if (one.side === 'back') max[1] = dims.d;
      return [{ min, max }];
    });
    const spot = onBoard(board, boxes);
    // the wall that brings them flush
    const flush = protrude - offset - WALL_GAP;
    return flush >= WALL_MIN
      ? { code: 'info.portsRecessedOut', params: { ...params, out: protrude.toFixed(1), flush: flush.toFixed(1) }, ...spot }
      : { code: 'info.portsRecessed', params, ...spot };
  });
}

/**
 * Warnings about the layout: boards overlapping in 3D, a standoff running
 * into another board, a part on a board's underside landing on its own
 * standoff or rail. The user is the designer — none of these blocks.
 */
export function collisions(layout: CaseLayout): Message[] {
  const out: Message[] = [];
  const { boards } = layout;
  for (let i = 0; i < boards.length; i++) {
    for (let j = i + 1; j < boards.length; j++) {
      const a = boards[i];
      const b = boards[j];
      // a display and the board on its back are one stack
      if (a.index === b.index) continue;
      const zOverlap = Math.min(a.zTop, b.zTop) - Math.max(a.zBottom, b.zBottom);
      if (zOverlap > 0 && overlap(a.outline, b.outline) > 0.01) {
        const both = shared(boardBox(a), boardBox(b));
        out.push({ code: 'warn.boardsOverlap', params: { ...boardParams(a, 'a'), ...boardParams(b, 'b') }, ...onBoard(a, both ? [both] : []) });
      }
    }
  }
  for (const board of boards) {
    // a carried display must clear the parts of the board under it (a Pi's USB and Ethernet: an extension header)
    const carrier = board.carried ? boards[board.attached ?? -1] : undefined;
    if (carrier && board.z0 < carrier.zTop - 1e-6 && overlap(board.outline, carrier.outline) > 0.01) {
      const o = board.outline;
      const under = shared({ min: [o.x0, o.y0, board.z0], max: [o.x1, o.y1, carrier.zTop] }, boardBox(carrier));
      out.push({ code: 'warn.carriedOnParts', params: { ...boardParams(board), mm: (carrier.zTop - board.z0).toFixed(1) }, ...onBoard(board, under ? [under] : []) });
    }
    if (board.attached !== undefined) continue;
    for (const wall of board.walls) if (!wall.against) out.push(notAgainst(board, wall.side, layout));
    out.push(...recessedNotes(board, layout.dims));
    // the supports are under a floor board and over a hung one
    for (const port of board.def.ports) {
      if (port.edge === (board.hung ? 'top' : 'bottom') && partOnSupport(board, port)) {
        out.push({
          code: board.hung ? 'warn.topPartOnSupport' : 'warn.bottomPartOnSupport',
          params: { ...boardParams(board), port: port.id, portType: port.type },
          ...onBoard(board, [caseBox(board, portBlock(board, port))]),
        });
      }
    }
    if (board.def.mount.kind === 'clamp' && (clampHold(board.def, board.placement).blocked || barsOnBack(board, boards))) {
      out.push({ code: 'warn.clampBlocked', params: boardParams(board), ...onBoard(board, [boardBox(board)]) });
    }
    // a clamped panel is pressed against the plate on purpose
    if (board.hung && board.def.mount.kind !== 'clamp' && board.placement.z < CEILING_GAP - 1e-9) {
      out.push({ code: 'warn.glassGap', params: { ...boardParams(board), mm: CEILING_GAP }, ...onBoard(board, [boardBox(board)]) });
    }
  }
  for (const a of boards) {
    for (const column of standoffColumns(a)) {
      const rect: Rect = { x0: column.x - column.r, y0: column.y - column.r, x1: column.x + column.r, y1: column.y + column.r };
      for (const b of boards) {
        // a floor board's standoffs reach up to its PCB, a hung board's down to its top
        const clear = a.hung ? b.zTop <= a.z0 + a.def.size.t : b.zBottom >= a.z0;
        if (b === a || b.index === a.index || clear || overlap(rect, b.outline) <= 0) continue;
        const post = shared({ min: [rect.x0, rect.y0, a.hung ? a.z0 : 0], max: [rect.x1, rect.y1, a.hung ? Infinity : a.z0] }, boardBox(b));
        out.push({ code: 'warn.standoffHitsBoard', params: { ...boardParams(a, 'a'), ...boardParams(b, 'b') }, ...onBoard(a, post ? [post] : []) });
      }
    }
  }
  return dedupe(out);
}

/** Whether a clamped panel's bars run into the board on its back. */
function barsOnBack(board: PlacedBoard, boards: readonly PlacedBoard[]): boolean {
  const child = boards.find((one) => one.attached === board.index);
  if (!child) return false;
  const hold = clampHold(board.def, board.placement);
  return hold.bars.some((bar) => {
    const ends = [...bar.posts, ...bar.holes];
    const [a0, a1] = [Math.min(...ends), Math.max(...ends)];
    const [b0, b1] = [bar.at - CLAMP_BAR_W / 2, bar.at + CLAMP_BAR_W / 2];
    const rect = hold.across === 'x' ? boxExtent(board.toCase, a0, b0, 0, a1, b1, 0).rect : boxExtent(board.toCase, b0, a0, 0, b1, a1, 0).rect;
    return overlap(rect, child.outline) > 0.01;
  });
}

/** Whether a part on the side the supports come from lands on its board's standoffs or rails (board frame). */
function partOnSupport(board: PlacedBoard, port: TopPort): boolean {
  const { w, d } = board.def.size;
  // a hung display's standoffs step aside for its glass: only a screw hole under the glass counts
  const glass = board.hung ? port.glass : undefined;
  const hw = glass ? glass.w / 2 + RIM_FIT : port.w / 2;
  const hd = glass ? glass.d / 2 + RIM_FIT : (port.shape === 'round' ? port.w : port.d) / 2;
  const [cx, cy] = glass ? [glass.x, glass.y] : [port.x, port.y];
  // a key field's supports go between its keys: only the keys count
  const parts: Rect[] = port.rows && !glass
    ? keysOf(port).map((key) => ({ x0: key.x - key.w / 2, y0: key.y - key.d / 2, x1: key.x + key.w / 2, y1: key.y + key.d / 2 }))
    : [{ x0: cx - hw, y0: cy - hd, x1: cx + hw, y1: cy + hd }];
  if (board.def.mount.kind === 'holes') {
    const boss = bossDiameter(board.placement.mount) / 2;
    return board.def.mount.holes.some((hole) => parts.some((part) => {
      const dx = Math.max(part.x0 - hole.x, 0, hole.x - part.x1);
      const dy = Math.max(part.y0 - hole.y, 0, hole.y - part.y1);
      return Math.hypot(dx, dy) < (glass ? hole.d / 2 : boss);
    }));
  }
  // rails step aside for a glass as standoffs do; a clamp's bars step aside by themselves
  if (glass || board.def.mount.kind === 'clamp') return false;
  // a hung board's rails carry no pin bed: their lip over its top is a plain one
  const pinned = board.hung ? [] : pinEdges(board);
  return railEdges(board.def).some((edge) => {
    const reach = railReach(pinned.includes(edge) && board.def.pins ? board.def.pins : null);
    const strip: Rect = edge === 'front' ? { x0: RAIL_SHORTEN, y0: 0, x1: w - RAIL_SHORTEN, y1: reach }
      : edge === 'back' ? { x0: RAIL_SHORTEN, y0: d - reach, x1: w - RAIL_SHORTEN, y1: d }
        : edge === 'left' ? { x0: 0, y0: RAIL_SHORTEN, x1: reach, y1: d - RAIL_SHORTEN }
          : { x0: w - reach, y0: RAIL_SHORTEN, x1: w, y1: d - RAIL_SHORTEN };
    return parts.some((part) => overlap(part, strip) > 0);
  });
}

/** One message per code and parameters; the places of repeated ones (a standoff per hole) join its spot. */
export function dedupe(messages: Message[]): Message[] {
  const seen = new Map<string, Message>();
  for (const message of messages) {
    const key = JSON.stringify([message.code, message.params]);
    const first = seen.get(key);
    if (!first) seen.set(key, message);
    else if (first.spot && message.spot) seen.set(key, { ...first, spot: { ...first.spot, boxes: [...first.spot.boxes, ...message.spot.boxes] } });
  }
  return [...seen.values()];
}
