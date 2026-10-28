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
  /**
   * Every bar: its centre along the other axis; its screw holes into the
   * panel and the posts it rests on, along `across`. A pressing bar spans
   * the panel from post to post; a screwed one is a tab from the nearer post
   * to its hole, so the back between stays free (a connector there).
   */
  bars: { at: number; holes: number[]; posts: number[] }[];
  /** the posts' places beyond the long edges, along `across` */
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
    // a tab from the nearer post to every hole on the back
    const bars = def.mount.holes.map((hole) => ({
      at: along(hole), holes: [side(hole)], posts: [side(hole) < width / 2 ? posts[0] : posts[1]],
    }));
    return { across, bars, posts, face, blocked: false };
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
        if (at >= CLAMP_BAR_W / 2 && at <= length - CLAMP_BAR_W / 2 && free(at)) return { at, holes: [], posts: [...posts] };
      }
    }
    blocked = true;
    return { at: home, holes: [], posts: [...posts] };
  });
  return { across, bars, posts, face, blocked };
}

/** A pad between a clamped board's front and the plate, opposite a bar's end: how far in over the PCB, its width along the edge, mm. */
export const PAD_IN = 1.5;
export const PAD_W = 6;
/** The pad's lip beyond the PCB's edge: its room to the edge and its thickness, mm. */
export const PAD_FIT = 0.2;
export const PAD_LIP = 1.2;
/** How far a pad moves along its edge to clear a part there, mm. */
const PAD_SEARCH = 8;

/** One pad: which long edge (0 at `across` = 0, 1 at its far side) and its centre along that edge, board frame. */
export interface ClampPad {
  side: 0 | 1;
  at: number;
}

/**
 * The pads of a clamped board: one opposite each end of each bar, on the
 * front at the long edge, a lip down over the edge (it locates the board
 * across); the plate's gap above the board is their height. None for a
 * panel whose glass has its rim (the rim locates it), none where a part on
 * the front or at that edge leaves no room within `PAD_SEARCH`.
 */
export function clampPads(def: BoardDef, placement: Pick<BoardPlacement, 'press' | 'mount'>): ClampPad[] {
  if (def.mount.kind !== 'clamp' || def.ports.some((port) => onFace(port) && port.glass)) return [];
  const hold = clampHold(def, placement);
  const { w, d } = def.size;
  const width = hold.across === 'x' ? w : d;
  const length = hold.across === 'x' ? d : w;
  // the front's parts and the edge's connectors above the back, as boxes (along the edge, across it)
  const boxes = def.ports.flatMap((port): [number, number, number, number][] => {
    if (onFace(port)) {
      if (port.edge !== 'top') return [];
      const [hw, hd] = [port.w / 2, (port.shape === 'round' ? port.w : port.d) / 2];
      return hold.across === 'x' ? [[port.y - hd, port.y + hd, port.x - hw, port.x + hw]] : [[port.x - hw, port.x + hw, port.y - hd, port.y + hd]];
    }
    if (port.z + port.h <= 0) return [];
    const half = port.w / 2;
    const edgeAcross = hold.across === 'x' ? (port.edge === 'left' || port.edge === 'right') : (port.edge === 'front' || port.edge === 'back');
    if (!edgeAcross) return [];
    const far = port.edge === 'right' || port.edge === 'back';
    const [a0, a1] = far ? [width - port.d + port.protrude, width + port.protrude] : [-port.protrude, port.d - port.protrude];
    return [[port.along - half, port.along + half, a0, a1]];
  });
  const free = (side: 0 | 1, at: number): boolean => {
    const [c0, c1] = side === 0 ? [-PAD_FIT - PAD_LIP, PAD_IN] : [width - PAD_IN, width + PAD_FIT + PAD_LIP];
    const [s0, s1] = [at - PAD_W / 2, at + PAD_W / 2];
    return s0 >= 0 && s1 <= length && boxes.every(([b0, b1, a0, a1]) => s1 <= b0 || s0 >= b1 || c1 <= a0 || c0 >= a1);
  };
  return hold.bars.flatMap((bar) => ([0, 1] as const).flatMap((side): ClampPad[] => {
    for (let step = 0; step <= PAD_SEARCH; step += 0.5) {
      for (const at of [bar.at - step, bar.at + step]) if (free(side, at)) return [{ side, at }];
    }
    return [];
  }));
}
