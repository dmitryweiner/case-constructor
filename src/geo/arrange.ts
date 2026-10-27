// Arranging several boards: all of them in a row, in a column or compact,
// or one board aligned to another. Pure functions over placements in the
// layout frame (the layout as a whole is centred in the cavity anyway, so
// only the boards' positions relative to each other matter). Footprints —
// the outline plus protruding ports and rails — are what is packed, so
// nothing overlaps; rotations are never changed: they decide which wall a
// connector faces.

import type { BoardPlacement } from '../boards/placement';
import { placementMinZ, withSide } from '../boards/placement';
import type { LayoutInput, PlacedBoard } from './layout';
import { placeBoards, sideMargin } from './layout';

export const ARRANGE_MODES = ['row', 'column', 'compact'] as const;
export type ArrangeMode = (typeof ARRANGE_MODES)[number];

export const ALIGN_X = ['left', 'centreX', 'right', 'nextX'] as const;
export const ALIGN_Y = ['front', 'centreY', 'back', 'nextY'] as const;
export type Align = (typeof ALIGN_X)[number] | (typeof ALIGN_Y)[number] | 'height';

/** How far a footprint reaches beyond the outline on each side, and the outline's size. */
interface Extent {
  left: number;
  right: number;
  front: number;
  back: number;
  w: number;
  d: number;
}

/** Positions to a micron: the footprints come through an affine, and arranging twice must give the same numbers. */
const micron = (value: number): number => Math.round(value * 1000) / 1000 + 0;

function extentOf(board: PlacedBoard): Extent {
  const { outline: o, footprint: f } = board;
  return { left: o.x0 - f.x0, right: f.x1 - o.x1, front: o.y0 - f.y0, back: f.y1 - o.y1, w: o.x1 - o.x0, d: o.y1 - o.y0 };
}

/** One row of boards left to right from y = y0, front edges aligned: positions and the row's size. */
function packRow(extents: readonly Extent[], y0: number, gap: number): { at: [number, number][]; w: number; d: number } {
  const front = Math.max(...extents.map((e) => e.front));
  const at: [number, number][] = [];
  let x = 0;
  for (const e of extents) {
    at.push([x + e.left, y0 + front]);
    x += e.left + e.w + e.right + gap;
  }
  const d = front + Math.max(...extents.map((e) => e.d + e.back));
  return { at, w: x - gap, d };
}

/** Rows of consecutive boards stacked front to back: every way to break the order into rows. */
function packRows(extents: readonly Extent[], breaks: readonly number[], gap: number): { at: [number, number][]; w: number; d: number } {
  const at: [number, number][] = [];
  let y = 0;
  let w = 0;
  let start = 0;
  for (const end of [...breaks, extents.length]) {
    const row = packRow(extents.slice(start, end), y, gap);
    at.push(...row.at);
    w = Math.max(w, row.w);
    y += row.d + gap;
    start = end;
  }
  return { at, w, d: y - gap };
}

/** Every split of n boards in order into consecutive rows (2^(n − 1) of them; n ≤ MAX_BOARDS). */
function rowSplits(n: number): number[][] {
  const out: number[][] = [];
  for (let mask = 0; mask < 1 << Math.max(0, n - 1); mask++) {
    const breaks: number[] = [];
    for (let i = 1; i < n; i++) if (mask & (1 << (i - 1))) breaks.push(i);
    out.push(breaks);
  }
  return out;
}

/**
 * All boards placed anew: in a row, in a column, or compact — the split
 * into rows that gives the smallest case: the outer area for a box or a
 * console (the margins and walls make it favour squarer layouts), the
 * diameter for a cylinder.
 */
export function arrangeBoards(input: LayoutInput, mode: ArrangeMode, gap: number): BoardPlacement[] {
  if (input.boards.length < 2) return [...input.boards];
  const extents = placeBoards(input).map(extentOf);
  const around = 2 * (sideMargin(input.shape, input.lid) + input.shape.wall);
  const cost = (w: number, d: number): number => (input.shape.kind === 'cylinder'
    ? Math.hypot(w + around, d + around)
    : (w + around) * (d + around));
  let at: [number, number][];
  if (mode === 'row') {
    at = packRow(extents, 0, gap).at;
  } else if (mode === 'column') {
    // a row of the boards turned on their side: swap x and y
    const swapped = extents.map((e) => ({ left: e.front, right: e.back, front: e.left, back: e.right, w: e.d, d: e.w }));
    at = packRow(swapped, 0, gap).at.map(([x, y]): [number, number] => [y, x]);
  } else {
    let best: { at: [number, number][]; w: number; d: number } | null = null;
    for (const breaks of rowSplits(extents.length)) {
      const packed = packRows(extents, breaks, gap);
      if (!best) {
        best = packed;
        continue;
      }
      const [mine, theirs] = [cost(packed.w, packed.d), cost(best.w, best.d)];
      // the smallest case; on a tie the squarer one
      if (mine < theirs - 1e-9 || (Math.abs(mine - theirs) <= 1e-9 && packed.w + packed.d < best.w + best.d)) best = packed;
    }
    at = best ? best.at : [];
  }
  return input.boards.map((board, i) => ({ ...board, x: micron(at[i][0]), y: micron(at[i][1]) }));
}

/**
 * One board moved so that its outline lines up with another board's: an
 * edge, the centre, right next to it (to the right / behind, footprints a
 * gap apart) — or set to the same standoff height (or the same gap under
 * the ceiling: it takes the reference's side). Only that board moves,
 * unless it would leave the positive quadrant: then the whole layout shifts,
 * which changes nothing in the case (the layout is centred).
 */
export function alignBoard(input: LayoutInput, index: number, ref: number, how: Align, gap: number): BoardPlacement[] {
  const boards = [...input.boards];
  if (index === ref || !boards[index] || !boards[ref]) return boards;
  if (how === 'height') {
    // the same height means the same side too: a hung reference makes it hang at its gap (never a battery)
    const next = withSide(boards[index], boards[ref].on === 'ceiling' && !boards[index].battery ? 'ceiling' : 'floor');
    boards[index] = { ...next, z: Math.max(placementMinZ(next), boards[ref].z) };
    return boards;
  }
  const placed = placeBoards(input);
  const r = placed[ref];
  const me = extentOf(placed[index]);
  let { x, y } = boards[index];
  switch (how) {
    case 'left': x = r.outline.x0; break;
    case 'right': x = r.outline.x1 - me.w; break;
    case 'centreX': x = (r.outline.x0 + r.outline.x1 - me.w) / 2; break;
    case 'nextX': x = r.footprint.x1 + gap + me.left; break;
    case 'front': y = r.outline.y0; break;
    case 'back': y = r.outline.y1 - me.d; break;
    case 'centreY': y = (r.outline.y0 + r.outline.y1 - me.d) / 2; break;
    case 'nextY': y = r.footprint.y1 + gap + me.front; break;
  }
  boards[index] = { ...boards[index], x: micron(x), y: micron(y) };
  const dx = Math.max(0, -Math.min(...boards.map((board) => board.x)));
  const dy = Math.max(0, -Math.min(...boards.map((board) => board.y)));
  if (dx === 0 && dy === 0) return boards;
  return boards.map((board) => ({ ...board, x: micron(board.x + dx), y: micron(board.y + dy) }));
}
