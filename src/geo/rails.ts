// Rails on screws (plans/PLAN-IMPROVEMENTS-2026-10-29.md, N2): a rail
// printed apart, an ear at each end, screwed down onto a post of the case.
// Pure: where the ears and the posts are and how far they widen the board's
// footprint. The solids are `railSolids.ts` (worker).
//
// A rail's own frame is the one `rails` builds it in (`standoffs.ts`): u
// along its edge from the rail's start (`RAIL_SHORTEN` inside the board's
// end), s across the edge outwards, z up from the PCB underside.

import type { BoardDef, Edge } from '../boards/schema';
import type { BoardPlacement } from '../boards/placement';
import type { FastenerSpec } from './fasteners';
import { bossDiameter } from './fasteners';
import { RAIL_GAP, RAIL_GRIP, RAIL_LIP, RAIL_SHORTEN, RAIL_THICK, railEdges } from './layout';

/** The ear's thickness, mm. */
export const RAIL_EAR_T = 2;
/** The room between a loose rail and the case: under its foot, round a post, mm. */
export const RAIL_SEAT = 0.2;
/** How far past the board's end an ear along the edge keeps, mm. */
export const RAIL_EAR_CLEAR = 0.3;
/**
 * An ear stops this far short of the rail's end and sinks this far into its
 * outer face: a face of one shared with the other leaves slivers in the union.
 */
const EAR_INSET = 0.5;
const EAR_SINK = 0.1;

/** Where a rail's ears are: outwards from its outer face (missing), or past its ends along the edge. */
export const RAIL_EARS = ['out', 'along'] as const;
export type RailEars = (typeof RAIL_EARS)[number];

/** The rail's outer face, s (a function: `layout.ts` imports this module back). */
export function railOuter(): number {
  return RAIL_GAP - RAIL_GRIP + RAIL_THICK;
}

/** A board held by rails on screws: its rails are printed apart. */
export function railsScrewed(def: Pick<BoardDef, 'mount' | 'battery'>, placement: Pick<BoardPlacement, 'railScrews'>): boolean {
  return def.mount.kind === 'rails' && !def.battery && placement.railScrews === true;
}

/** The rails' screw: the placement's, an M2 at least (an M1.6 holds no rail). */
export function railScrewSpec(spec: FastenerSpec): FastenerSpec {
  return { ...spec, size: spec.size === 'M1.6' ? 'M2' : spec.size, head: 'none' };
}

/** The radius of an ear's round end and of the post under it. */
export function railEarR(spec: FastenerSpec): number {
  return bossDiameter(railScrewSpec(spec)) / 2;
}

/** The two ears' centres of a rail `length` long, its own frame (u, s). */
export function earCentres(ears: RailEars, length: number, r: number): [[number, number], [number, number]] {
  if (ears === 'along') {
    // past the board's ends, flush with the rail's outer face
    const u = RAIL_SHORTEN + RAIL_EAR_CLEAR + r;
    const s = railOuter() - EAR_SINK - r;
    return [[-u, s], [length + u, s]];
  }
  // off the outer face, a seat's room between the rail and the post under the ear
  const s = railOuter() + RAIL_SEAT + r;
  return [[r + EAR_INSET, s], [length - r - EAR_INSET, s]];
}

/**
 * An ear's outline in the rail's frame: its round end round the centre,
 * joined to the rail (the hull of the two), `EAR_SINK` into the rail's
 * outer face. Along the edge, the part over the board's end is cut away by
 * the worker (`railKeepOut`).
 */
export function earOutline(ears: RailEars, centre: readonly [number, number], length: number, r: number, k = 16): [number, number][] {
  const [u, s] = centre;
  const ring = Array.from({ length: k }, (_, i): [number, number] => [u + r * Math.cos((2 * Math.PI * i) / k), s + r * Math.sin((2 * Math.PI * i) / k)]);
  const inner = railOuter() - EAR_SINK;
  if (ears === 'along') {
    // from the round end to 1 mm into the rail, the rail's outer wall's width
    const end = u < 0 ? 1 : length - 1;
    return [...ring, [end, inner], [end, s - r]];
  }
  return [...ring, [u - r, inner - 1], [u + r, inner - 1]];
}

/** Where the board lies in a rail's frame, past which an ear along the edge stays: its end grown by the clearance, the groove's side of the rail. */
export function railKeepOut(length: number): { u0: number; u1: number; s1: number } {
  return { u0: -RAIL_SHORTEN - RAIL_EAR_CLEAR, u1: length + RAIL_SHORTEN + RAIL_EAR_CLEAR, s1: RAIL_GAP + EAR_SINK };
}

/**
 * How far under the rail's top the ear's top stays, mm: within the first
 * layer, so both print on the bed, and not on one plane with the rail's top
 * (the pin bed's top and an ear's on one plane left zero-area triangles).
 */
export const EAR_DROP = 0.05;

/** The ear's top and bottom above the PCB underside: (almost) flush with the rail's top, so both lie on the bed. */
export function earLevels(t: number): { top: number; bottom: number } {
  const top = t + RAIL_LIP - EAR_DROP;
  return { top, bottom: top - RAIL_EAR_T };
}

/**
 * How far past each board edge the ears and their posts reach: off the rail
 * edges (out), or past the other two edges (along).
 */
export function earReach(def: BoardDef, placement: BoardPlacement): Partial<Record<Edge, number>> {
  if (!railsScrewed(def, placement)) return {};
  const r = railEarR(placement.mount);
  const edges = railEdges(def);
  const out: Partial<Record<Edge, number>> = {};
  if (placement.railEars === 'along') {
    const across: Edge[] = edges.includes('front') ? ['left', 'right'] : ['front', 'back'];
    for (const edge of across) out[edge] = RAIL_EAR_CLEAR + 2 * r;
    return out;
  }
  for (const edge of edges) out[edge] = railOuter() + RAIL_SEAT + 2 * r;
  return out;
}
