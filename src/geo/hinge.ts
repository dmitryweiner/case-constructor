// The hinge of a hinged case: where its axis is and how the upper half
// turns about it. Pure: the main thread poses the halves with it, the worker
// builds the knuckles along it.
//
// Each half is a box in its own case frame. The hinge runs along x: on the
// lower half's back edge (y = d) and on the upper half's front edge (y = 0),
// so that laid open flat the upper half lies behind the lower one, both
// inner faces (their tops) up and both frames pointing the same way. Closed,
// the upper half lies on the lower one upside down, its inner face `gap`
// above the lower one's. The axis lies in that gap, behind the hinge walls by
// the barrel's radius and a clearance: the other half's edge then clears a
// barrel all the way round. (plans/PLAN-HINGED.md, "How it folds".)

import type { Affine } from './surface';
import { composeAffine, translation } from './surface';

/** Barrel diameter of the knuckles, mm. */
export const BARREL_D = 8;
/** Between a barrel and the other half's wall, mm. */
export const BARREL_CLEARANCE = 0.4;
/** The view's angle by default: a laptop's screen, open. */
export const ANGLE_DEFAULT = 110;

export interface Fold {
  /** the axis in the lower half's frame (parallel to x) */
  y: number;
  z: number;
  /** the axis in the upper half's frame */
  yB: number;
  zB: number;
}

/**
 * The axis of two halves of depth `d`, heights `hA` and `hB`, closed with
 * `gap` between their inner faces; `share` is how much of the gap lies on
 * the lower half's side of the axis (half of it by default).
 */
export function foldOf(d: number, hA: number, hB: number, gap: number, share = gap / 2): Fold {
  const e = BARREL_D / 2 + BARREL_CLEARANCE;
  return { y: d + e, z: hA + share, yB: -e, zB: hB + gap - share };
}

/** Rotation by `deg` about the line parallel to x through (y, z). */
function turnAboutX(y: number, z: number, deg: number): Affine {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const turn: Affine = [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0];
  return composeAffine(translation(0, y, z), composeAffine(turn, translation(0, -y, -z)));
}

/**
 * The upper half's frame → the lower half's, open by `angle`: 180° lies open
 * flat behind the lower half, 0° is closed on top of it.
 */
export function upperPose(fold: Fold, angle: number): Affine {
  const flat = translation(0, fold.y - fold.yB, fold.z - fold.zB);
  return composeAffine(turnAboutX(fold.y, fold.z, 180 - angle), flat);
}
