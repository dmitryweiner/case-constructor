// The glass seat of a hung display (plans/PLAN-DISPLAYS.md D3). Pure: the
// layout sizes the case by it, the worker builds it (rimSolids.ts).
//
// The glass lies against the inside of the top, the plate around the window
// hiding the panel's border; a rim around its outline locates it, coming
// down from the plate as far as the glass is thick (at most RIM_H_MAX) plus
// the board's gap. The rim steps aside for the board's other top parts (a
// round panel's FPC tail), and the board's own standoffs step aside for the
// glass (a 1602's holes are 1.85 mm from its bezel).

import type { Glass } from '../boards/schema';
import { onFace } from '../boards/schema';
import type { Edge } from '../boards/schema';
import type { PlacedBoard } from './layout';

/** Room around the glass in its rim, mm. */
export const RIM_FIT = 0.2;
/** The rim's wall, mm. */
export const RIM_W = 1.2;
/** The rim never comes down further than this past the plate (plus the gap), mm. */
export const RIM_H_MAX = 3;
/** How far a top part's box grows where the rim steps aside for it, mm. */
export const RIM_PART_GAP = 0.3;

/** One rim, board frame: the glass it holds, from z0 up to the plate's inner face z1. */
export interface RimSpec {
  glass: Glass;
  z0: number;
  z1: number;
  /** the display part it belongs to */
  port: string;
}

/** The rims of a board: one per display part with a glass, only when the board hangs. */
export function rimsOf(board: Pick<PlacedBoard, 'def' | 'placement' | 'hung'>): RimSpec[] {
  if (!board.hung) return [];
  const { t } = board.def.size;
  return board.def.ports.flatMap((port) => {
    if (!onFace(port) || port.edge !== 'top' || !port.glass) return [];
    const front = t + port.h;
    // never down onto the PCB
    const z0 = Math.max(t + 0.2, front - Math.min(port.glass.t, RIM_H_MAX));
    return [{ glass: port.glass, z0, z1: front + board.placement.z, port: port.id }];
  });
}

/** How far a glass with its rim reaches beyond each edge of the board (board frame). */
export function rimReach(glass: Glass, size: { w: number; d: number }): Record<Edge, number> {
  const out = RIM_FIT + RIM_W;
  return {
    left: Math.max(0, out - (glass.x - glass.w / 2)),
    right: Math.max(0, glass.x + glass.w / 2 + out - size.w),
    front: Math.max(0, out - (glass.y - glass.d / 2)),
    back: Math.max(0, glass.y + glass.d / 2 + out - size.d),
  };
}
