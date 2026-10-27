// A board on a display's back (plans/PLAN-DISPLAYS.md D6). Pure: where the
// attached board goes in the display's frame, found from the shared hole
// pattern; the layout places it, nothing builds supports for it — it rides
// on the display's own standoffs.

import type { BoardDef } from '../boards/schema';
import type { Rotation } from '../boards/placement';
import { ROTATIONS } from '../boards/placement';
import type { Affine } from './surface';
import { applyAffine, composeAffine } from './surface';

/** How close an attached board's hole must come to a pattern hole, mm. */
export const ATTACH_TOLERANCE = 0.3;

/** Turned over (the board's top towards -z), y mirrored to keep the frame right-handed. */
const TURN_OVER: Affine = [1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, 0];

/** The board's frame turned in the display's plane (and over, when its underside faces the display). */
function turned(rot: Rotation, over: boolean): Affine {
  const c = Math.cos((rot * Math.PI) / 180);
  const s = Math.sin((rot * Math.PI) / 180);
  const spin: Affine = [Math.round(c), -Math.round(s), 0, 0, Math.round(s), Math.round(c), 0, 0, 0, 0, 1, 0];
  return over ? composeAffine(spin, TURN_OVER) : spin;
}

/**
 * The attached board's frame → the display's frame for a turn, or null when
 * its holes do not land on the pattern: the holes' centres matched, the
 * standoffs `standoff` long below the display's back.
 */
function fit(parent: BoardDef, child: BoardDef, rot: Rotation, standoff: number): Affine | null {
  const back = parent.back;
  if (!back || child.mount.kind !== 'holes' || child.mount.holes.length !== back.holes.length) return null;
  const over = back.facing === 'bottom';
  const m = turned(rot, over);
  const moved = child.mount.holes.map((hole) => applyAffine(m, [hole.x, hole.y, 0]));
  const mean = (values: number[]): number => values.reduce((a, b) => a + b, 0) / values.length;
  const dx = mean(back.holes.map((h) => h.x)) - mean(moved.map((p) => p[0]));
  const dy = mean(back.holes.map((h) => h.y)) - mean(moved.map((p) => p[1]));
  const lands = moved.every((p) => back.holes.some((h) => Math.hypot(h.x - p[0] - dx, h.y - p[1] - dy) < ATTACH_TOLERANCE));
  if (!lands) return null;
  // facing away its underside meets the standoffs; facing the display its top does
  const dz = over ? -standoff : -standoff - child.size.t;
  return composeAffine([1, 0, 0, dx, 0, 1, 0, dy, 0, 0, 1, dz], m);
}

/** The turns of a board that put its holes on the display's pattern; none when it does not fit. */
export function attachTurns(parent: BoardDef, child: BoardDef): Rotation[] {
  return ROTATIONS.filter((rot) => fit(parent, child, rot, 1) !== null);
}

/** The attached board's frame → the display's board frame (identity when it does not fit). */
export function attachTransform(parent: BoardDef, child: BoardDef, rot: Rotation, standoff: number): Affine {
  return fit(parent, child, rot, standoff) ?? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
}
