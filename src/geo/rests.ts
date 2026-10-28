// Rests under a keyboard that rocks (plans/PLAN-KEYBOARDS.md K5). Pure: where
// they stand and how long they are; the worker builds them (build.ts).
//
// A key press pushes the board away from the fingers. Screwed at two holes
// on a diagonal (the BBQ20KBD), its free corners give; a rest under each one
// takes the press: a column from the floor up under the PCB — touching a
// board on the floor, `REST_GAP` short of a hung one (it comes from the other
// part). It goes to whoever owns the floor, like a floor board's standoffs.

import { keyFields, onFace } from '../boards/schema';
import type { CaseLayout, PlacedBoard } from './layout';
import { dedupe } from './layout';
import type { Message } from './message';
import { boardParams, boxSpot } from './message';
import { applyAffine } from './surface';

/** A corner with no hole closer than this gets a rest, mm. */
export const REST_REACH = 20;
/** A rest's radius, mm. */
export const REST_R = 2.5;
/** How far in from the corner a rest stands at first, mm. */
export const REST_INSET = 3;
/** A rest under a hung board stops this short of its PCB, mm. */
export const REST_GAP = 0.2;
/** A rest is not built longer than this, mm. */
export const REST_MAX = 40;
/** Steps a rest takes along the diagonal to clear the parts underneath, and their length, mm. */
const REST_STEPS = 6;
const REST_STEP = 2;

/** One rest: its centre in the board frame and in the case, its top (absolute z). */
export interface Rest {
  board: number;
  x: number;
  y: number;
  cx: number;
  cy: number;
  top: number;
  /** too long to build, or blocked by another board under it */
  problem?: 'long' | 'blocked';
}

/** Whether a circle at (x, y) in the board frame clears the board's parts underneath. */
function clearUnder(board: PlacedBoard, x: number, y: number): boolean {
  const { w, d } = board.def.size;
  if (x - REST_R < 0 || y - REST_R < 0 || x + REST_R > w || y + REST_R > d) return false;
  return board.def.ports.every((port) => {
    const [x0, y0, x1, y1] = onFace(port)
      ? (port.edge === 'bottom' ? [port.x - port.w / 2, port.y - port.d / 2, port.x + port.w / 2, port.y + port.d / 2] : [0, 0, 0, 0])
      : underEdge(board, port);
    if (x1 <= x0) return true;
    const dx = Math.max(x0 - x, 0, x - x1);
    const dy = Math.max(y0 - y, 0, y - y1);
    return Math.hypot(dx, dy) >= REST_R;
  });
}

/** An edge part under the PCB (negative z) as a box in the board frame; empty above it. */
function underEdge(board: PlacedBoard, port: Exclude<PlacedBoard['def']['ports'][number], { edge: 'top' | 'bottom' }>): [number, number, number, number] {
  if (port.z >= 0) return [0, 0, 0, 0];
  const { w, d } = board.def.size;
  const half = port.w / 2;
  const depth = port.d - port.protrude;
  switch (port.edge) {
    case 'front': return [port.along - half, 0, port.along + half, depth];
    case 'back': return [port.along - half, d - depth, port.along + half, d];
    case 'left': return [0, port.along - half, depth, port.along + half];
    default: return [w - depth, port.along - half, w, port.along + half];
  }
}

/** The rests under a keyboard's free corners. */
export function restsOf(board: PlacedBoard, layout: CaseLayout, floor: number): Rest[] {
  // three holes or more hold it flat; one or two (on a diagonal) let it rock
  if (board.attached !== undefined || keyFields(board.def).length === 0 || board.def.mount.kind !== 'holes' || board.def.mount.holes.length > 2) return [];
  const { w, d } = board.def.size;
  const holes = board.def.mount.holes;
  const out: Rest[] = [];
  for (const [cx, cy] of [[0, 0], [w, 0], [w, d], [0, d]]) {
    if (holes.some((hole) => Math.hypot(hole.x - cx, hole.y - cy) < REST_REACH)) continue;
    // from the corner inwards along the diagonal until the parts underneath leave room
    const ux = cx === 0 ? 1 : -1;
    const uy = cy === 0 ? 1 : -1;
    let at: [number, number] | null = null;
    for (let i = 0; i <= REST_STEPS && !at; i++) {
      const inset = REST_INSET + i * REST_STEP;
      if (clearUnder(board, cx + ux * inset, cy + uy * inset)) at = [cx + ux * inset, cy + uy * inset];
    }
    if (!at) continue;
    const p = applyAffine(board.toCase, [at[0], at[1], 0]);
    const top = board.hung ? p[2] - REST_GAP : p[2];
    // another board between the floor and this one
    const blocked = layout.boards.some((other) => other !== board && other.index !== board.index
      && other.zTop > floor && other.zBottom < top
      && p[0] + REST_R > other.outline.x0 && p[0] - REST_R < other.outline.x1 && p[1] + REST_R > other.outline.y0 && p[1] - REST_R < other.outline.y1);
    const long = top - floor > REST_MAX;
    out.push({ board: board.index, x: at[0], y: at[1], cx: p[0], cy: p[1], top, ...(blocked ? { problem: 'blocked' as const } : long ? { problem: 'long' as const } : {}) });
  }
  return out;
}

/** The rests of every board in the case, the ones that can be built. */
export function caseRests(layout: CaseLayout, floor: number): Rest[] {
  return layout.boards.flatMap((board) => restsOf(board, layout, floor)).filter((rest) => rest.problem === undefined);
}

/** A rest that could not be built: too long, or another board in its way. */
export function restWarnings(layout: CaseLayout, floor: number): Message[] {
  return dedupe(layout.boards.flatMap((board) => restsOf(board, layout, floor).flatMap((rest): Message[] => {
    if (!rest.problem) return [];
    const spot = boxSpot({ min: [rest.cx - REST_R, rest.cy - REST_R, floor], max: [rest.cx + REST_R, rest.cy + REST_R, rest.top] }, { board: board.index });
    return [{ code: rest.problem === 'long' ? 'warn.restTooLong' : 'warn.restBlocked', params: { ...boardParams(board), mm: REST_MAX }, spot }];
  })));
}
