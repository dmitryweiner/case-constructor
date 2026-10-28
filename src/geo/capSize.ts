// Printed key caps (plans/PLAN-KEYBOARDS.md K3b): how big each one is.
// Pure, from the key field alone — the openings (ports.ts) and the caps
// themselves (caps.ts) both read it.
//
// A cap is a stem over its key, through a hole in the lid, and a flange
// under the lid wider than the hole, so it cannot fall out: the flange lies
// on the key, the lid comes down the gap above it.

import type { TopPort } from '../boards/schema';
import { keysOf } from '../boards/schema';

/** How far a cap stands out of the lid's face, mm. */
export const CAP_PROUD = 1;
/** The flange's thickness, mm. */
export const CAP_FLANGE_T = 0.8;
/** How far the flange reaches past the stem, per side, at most, mm. */
export const CAP_LIP = 1;
/** How far the stem reaches past its key (a tact switch's button), per side, mm. */
export const CAP_GROW = 0.75;
/** Room around a stem in its hole by default, mm. */
export const CAP_FIT = 0.25;
/** Room kept between two neighbours' flanges, mm. */
export const CAP_GAP = 0.3;
/** The least a flange reaches past its hole, per side, to hold the cap in, mm. */
export const CAP_HOLD = 0.4;

export interface CapSize {
  /** the key's centre, board frame */
  x: number;
  y: number;
  stemR: number;
  flangeR: number;
}

/** Each key's cap: its stem over the key, its flange as wide as the neighbours leave room for. */
export function capSizes(field: Pick<TopPort, 'rows'>): CapSize[] {
  const keys = keysOf(field);
  return keys.map((key, i) => {
    const stemR = Math.min(key.w, key.d) / 2 + CAP_GROW;
    let nearest = Infinity;
    keys.forEach((other, j) => {
      if (j !== i) nearest = Math.min(nearest, Math.hypot(other.x - key.x, other.y - key.y));
    });
    return { x: key.x, y: key.y, stemR, flangeR: Math.max(stemR, Math.min(stemR + CAP_LIP, (nearest - CAP_GAP) / 2)) };
  });
}
