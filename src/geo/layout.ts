// Case size and the checks that need no CSG. Pure functions: the main
// thread calls them on every slider move, the worker on every job.

import type { Dims } from './face';
import { faceFrame } from './face';
import type { LidState } from './lidSpec';
import type { ShapeState } from './shape';
import { SIZE_MIN, plateOf } from './shape';

/** Smallest cavity the case keeps when there is nothing inside to size it by. */
export const INNER_MIN: Dims = { w: 16, d: 16, h: 10 };

/** Minimum outer size: the minimum cavity plus walls, floor and ceiling. */
export function minimumDims(shape: ShapeState): Dims {
  const w = Math.max(SIZE_MIN, INNER_MIN.w + 2 * shape.wall);
  const d = Math.max(SIZE_MIN, INNER_MIN.d + 2 * shape.wall);
  const h = Math.max(SIZE_MIN, INNER_MIN.h + 2 * shape.floor);
  if (shape.kind === 'cylinder') {
    const diameter = Math.max(w, d);
    return { w: diameter, d: diameter, h };
  }
  return { w, d, h };
}

/**
 * The outer size the case is built at: the minimum when sized automatically,
 * the manual size grown to the minimum otherwise. The cylinder is as deep as
 * it is wide; the console is as high as its higher end.
 */
export function caseDims(shape: ShapeState): Dims {
  const min = minimumDims(shape);
  const base = shape.auto ? min : {
    w: Math.max(min.w, shape.size.w),
    d: Math.max(min.d, shape.size.d),
    h: Math.max(min.h, shape.size.h),
  };
  if (shape.kind === 'cylinder') return { w: base.w, d: base.w, h: base.h };
  if (shape.kind === 'console') {
    const h = Math.max(min.h, shape.console.frontH, shape.console.backH);
    return { w: base.w, d: base.d, h };
  }
  return base;
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

/** The lid as built: depth clamped to what the case allows. */
export function effectiveLid(shape: ShapeState, lid: LidState, dims: Dims): LidState {
  return { ...lid, depth: Math.min(lid.depth, lidDepthMax(shape, lid, dims)) };
}
