// Printed key caps (plans/PLAN-KEYBOARDS.md K3b): how big each one is.
// Pure, from the key field alone — the openings (ports.ts) and the caps
// themselves (caps.ts) both read it. A board's top buttons are such a set of
// keys too (plans/PLAN-IMPROVEMENTS-2026-10-29.md N3).
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

/** A cap's stem: round, or a square with rounded corners. */
export const CAP_SHAPES = ['round', 'square'] as const;
export type CapShape = (typeof CAP_SHAPES)[number];
/** A square cap's corner radius: never sharp (a sharp corner would not print or fit), by default, at most, mm. */
export const CAP_R_MIN = 0.3;
export const CAP_R_DEFAULT = 0.8;
export const CAP_R_MAX = 5;

/** The stem's corner radius: a round stem is all corner; a square one's is the placement's, no more than the stem allows. */
export function capCorner(shape: CapShape, r: number, stemR: number): number {
  return shape === 'round' ? stemR : Math.min(stemR, Math.max(CAP_R_MIN, r));
}

export interface CapSize {
  /** the key's centre, board frame */
  x: number;
  y: number;
  stemR: number;
  flangeR: number;
}

/** The thinnest web the lid may keep between two keys' holes, mm. */
export const KEY_WEB = 0.8;

/** A key a cap goes over: its centre and its button's size, board frame. */
export interface CapKey {
  x: number;
  y: number;
  w: number;
  d: number;
}

/** The keys caps go over: a key field's rows, or a list (a board's buttons). */
export type CapKeys = Pick<TopPort, 'rows'> | readonly CapKey[];

function isKeyList(source: CapKeys): source is readonly CapKey[] {
  return Array.isArray(source);
}

function keysFrom(source: CapKeys): readonly CapKey[] {
  return isKeyList(source) ? source : keysOf(source);
}

/** Each key's nearest neighbour's distance, centre to centre (none: a long way). */
function nearestOf(source: CapKeys): number[] {
  const keys = keysFrom(source);
  return keys.map((key, i) => {
    let nearest = Infinity;
    keys.forEach((other, j) => {
      if (j !== i) nearest = Math.min(nearest, Math.hypot(other.x - key.x, other.y - key.y));
    });
    return nearest;
  });
}

/**
 * The stem widths a field's caps may have at a fit: at least the widest key
 * (the stem covers its button), at most what keeps every flange `CAP_HOLD`
 * past its hole, `CAP_GAP` from its neighbour's, and a `KEY_WEB` between the
 * holes. Null without keys.
 */
export function capSizeRange(field: CapKeys, fit: number): { min: number; max: number } | null {
  const keys = keysFrom(field);
  if (keys.length === 0) return null;
  const nearest = nearestOf(field);
  const min = Math.max(...keys.map((key) => Math.max(key.w, key.d)));
  const max = Math.min(...nearest.map((n) => 2 * Math.min((n - CAP_GAP) / 2 - CAP_HOLD - fit, (n - KEY_WEB) / 2 - fit)));
  return { min, max: Math.max(min, max) };
}

/**
 * Each key's cap: its stem over the key — `CAP_GROW` past it a side, or the
 * chosen width kept within `capSizeRange` — its flange as wide as the
 * neighbours leave room for.
 */
export function capSizes(field: CapKeys, chosen?: { size?: number; fit: number }): CapSize[] {
  const keys = keysFrom(field);
  const nearest = nearestOf(field);
  const range = chosen?.size !== undefined ? capSizeRange(field, chosen.fit) : null;
  return keys.map((key, i) => {
    const stemR = range && chosen?.size !== undefined
      ? Math.min(range.max, Math.max(range.min, chosen.size)) / 2
      : Math.min(key.w, key.d) / 2 + CAP_GROW;
    return { x: key.x, y: key.y, stemR, flangeR: Math.max(stemR, Math.min(stemR + CAP_LIP, (nearest[i] - CAP_GAP) / 2)) };
  });
}
