// Clamp bars for a hung panel with no holes in front of its glass (plans/
// PLAN-DISPLAYS.md D5): Touch Display 2, a bare e-paper panel. Pure; the
// worker builds the posts and bars (clampSolids.ts) and the layout sizes the
// case by them.
//
// The bars run across the panel's back along its short side — shorter and
// stiffer — on two posts from the plate beyond its long edges. A panel with
// threaded holes on its back (Touch Display 2's brackets) gets a bar along
// each row of them, screwed to the panel; one without gets two bars that
// press it through foam tape. A pressing bar steps aside for parts on the
// back.

import type { BoardDef } from '../boards/schema';
import { onFace } from '../boards/schema';
import type { BoardPlacement } from '../boards/placement';
import { bossDiameter } from './fasteners';
import { EDGE_KEEP, RIM_FIT, RIM_W } from './rim';

/** The bar's width along the panel and its thickness, mm. */
export const CLAMP_BAR_W = 8;
export const CLAMP_BAR_T = 3;
/** Room between a post and the rim around the glass, mm. */
const POST_GAP = 0.3;

/** How far beyond the long edge a post's centre stands: clear of the rim around the glass (touching it left slivers). */
export function postOut(placement: Pick<BoardPlacement, 'mount'>): number {
  return bossDiameter(placement.mount) / 2 + RIM_FIT + RIM_W + POST_GAP;
}

/** How far the posts reach beyond the long edges. */
export function postReach(placement: Pick<BoardPlacement, 'mount'>): number {
  return postOut(placement) + bossDiameter(placement.mount) / 2 + EDGE_KEEP;
}
/** Default press: a bar screwed to the back sits on it; a pressing one leaves room for foam tape, mm. */
export const PRESS_SCREWED = 0;
export const PRESS_FOAM = -1;
/** Where the two pressing bars go along the long side, as its share. */
const PRESSING_AT = [0.2, 0.8];
/** Bars that hit a part on the back move along the panel up to this share of it either way. */
const SEARCH_SHARE = 0.3;

export interface ClampHold {
  /** the axis the bars run along (board frame): x when the panel is narrower than deep */
  across: 'x' | 'y';
  /** every bar: its centre along the other axis, and its screw holes into the panel along `across` */
  bars: { at: number; holes: number[] }[];
  /** the two posts of every bar, along `across` */
  posts: [number, number];
  /** the bars' face against the panel's back, board frame z (0 = the back; negative leaves a gap) */
  face: number;
  /** a pressing bar found no free place on the back */
  blocked: boolean;
}

/** The default press of a clamped panel. */
export function defaultPress(def: BoardDef): number {
  return def.mount.holes.length > 0 ? PRESS_SCREWED : PRESS_FOAM;
}

export function clampHold(def: BoardDef, placement: Pick<BoardPlacement, 'press' | 'mount'>): ClampHold {
  const { w, d } = def.size;
  const across: 'x' | 'y' = w <= d ? 'x' : 'y';
  const width = across === 'x' ? w : d;
  const length = across === 'x' ? d : w;
  const out = postOut(placement);
  const posts: [number, number] = [-out, width + out];
  const face = placement.press ?? defaultPress(def);
  const along = (p: { x: number; y: number }): number => (across === 'x' ? p.y : p.x);
  const side = (p: { x: number; y: number }): number => (across === 'x' ? p.x : p.y);
  if (def.mount.holes.length > 0) {
    // a bar along every row of holes on the back
    const rows = new Map<number, number[]>();
    for (const hole of def.mount.holes) {
      const key = [...rows.keys()].find((at) => Math.abs(at - along(hole)) < 1) ?? along(hole);
      rows.set(key, [...(rows.get(key) ?? []), side(hole)]);
    }
    return { across, bars: [...rows].map(([at, holes]) => ({ at, holes })), posts, face, blocked: false };
  }
  // parts on the back, as spans along the long side
  const spans = def.ports.flatMap((port): [number, number][] => {
    if (!onFace(port) || port.edge !== 'bottom') return [];
    const half = (across === 'x' ? (port.shape === 'round' ? port.w : port.d) : port.w) / 2;
    return [[along(port) - half, along(port) + half]];
  });
  const free = (at: number): boolean => spans.every(([a, b]) => at + CLAMP_BAR_W / 2 <= a || at - CLAMP_BAR_W / 2 >= b);
  let blocked = false;
  const bars = PRESSING_AT.map((share) => {
    const home = share * length;
    for (let step = 0; step <= SEARCH_SHARE * length; step += 0.5) {
      for (const at of [home - step, home + step]) {
        if (at >= CLAMP_BAR_W / 2 && at <= length - CLAMP_BAR_W / 2 && free(at)) return { at, holes: [] };
      }
    }
    blocked = true;
    return { at: home, holes: [] };
  });
  return { across, bars, posts, face, blocked };
}
