// A hinged case: two halves, each an ordinary case. The state keeps the
// lower half where a single case keeps its contents (boards, lid, openings,
// extras, the height) and the upper half in `hinge.b`, so a box turned into a
// hinged case keeps its boards below and back to a box keeps the upper half
// for later. `halfState` makes either half a case of its own — the layout,
// the warnings and the worker's build run on it unchanged — and `withHalf`
// writes what a card did to it back (plans/PLAN-HINGED.md, P1, P2).

import type { BoardPlacement } from '../boards/placement';
import { sanitizePlacements } from '../boards/placement';
import type { ExtraCut } from '../geo/cutters';
import { sanitizeExtraCuts } from '../geo/cutters';
import type { FanState, LabelState, VentState } from '../geo/extras';
import { defaultFan, defaultLabel, defaultVents, sanitizeFan, sanitizeLabel, sanitizeVents } from '../geo/extras';
import type { LidState } from '../geo/lidSpec';
import { defaultLid, sanitizeLid } from '../geo/lidSpec';
import { caseDims, caseLayout, effectiveLid, minimumDims } from '../geo/layout';
import { topProtrusion } from '../geo/ports';
import { SIZE_MAX, SIZE_MIN, clampNum, plateOf, shapeSpec } from '../geo/shape';
import type { CableSlot, CableThrough, Fold, HalfHinge, HingeSpec } from '../geo/hinge';
import {
  CABLE_KEEP, CABLE_TOP_GAP, GAP_DEFAULT, gapFor, magnetBosses, upperPose, axisOffset, axisSplit, axleHoles, bodyRange, cableSlot, defaultHingeSpec, foldOf, hingeScrews, knuckleRuns,
  knuckleStrip, leafLayout, leafScrews, pivotLayout, pivotThickness, sanitizeHingeSpec,
} from '../geo/hinge';
import { SCREWS, bossDiameter } from '../geo/fasteners';
import type { Message, SpotBox } from '../geo/message';
import { boxSpot } from '../geo/message';
import type { Vec3 } from '../geo/surface';
import { applyAffine } from '../geo/surface';
import { effectiveRadii } from '../geo/loft';
import type { AppState } from './schema';

export const HALVES = ['a', 'b'] as const;
/** The lower half (the base) and the upper one (the cover), as the case lies closed. */
export type Half = (typeof HALVES)[number];

/** What one half holds: everything a single case holds but its shape. */
export interface HalfContent {
  /** the manual outer height */
  h: number;
  boards: BoardPlacement[];
  lid: LidState;
  extraCuts: ExtraCut[];
  vents: VentState;
  fan: FanState;
  label: LabelState;
}

export interface HingeState extends HingeSpec {
  /** the upper half */
  b: HalfContent;
  /** between the inner faces when closed, mm */
  gap: number;
}

export const GAP_MAX = 10;

export function defaultHalf(): HalfContent {
  return { h: 25, boards: [], lid: defaultLid(), extraCuts: [], vents: defaultVents(), fan: defaultFan(), label: defaultLabel() };
}

export function defaultHinge(): HingeState {
  return { ...defaultHingeSpec(), b: defaultHalf(), gap: 1 };
}

function sanitizeHalf(raw: unknown): HalfContent {
  const d = defaultHalf();
  const r = typeof raw === 'object' && raw !== null ? raw : {};
  return {
    h: clampNum(Reflect.get(r, 'h'), SIZE_MIN, SIZE_MAX, d.h),
    boards: sanitizePlacements(Reflect.get(r, 'boards')),
    lid: sanitizeLid(Reflect.get(r, 'lid'), 'hinged'),
    extraCuts: sanitizeExtraCuts(Reflect.get(r, 'extraCuts'), 'hinged'),
    vents: sanitizeVents(Reflect.get(r, 'vents')),
    fan: sanitizeFan(Reflect.get(r, 'fan')),
    label: sanitizeLabel(Reflect.get(r, 'label')),
  };
}

export function sanitizeHinge(raw: unknown): HingeState {
  const d = defaultHinge();
  const r = typeof raw === 'object' && raw !== null ? raw : {};
  return {
    ...sanitizeHingeSpec(r),
    b: sanitizeHalf(Reflect.get(r, 'b')),
    gap: clampNum(Reflect.get(r, 'gap'), 0, GAP_MAX, d.gap),
  };
}

export function isHinged(state: Pick<AppState, 'shape'>): boolean {
  return state.shape.kind === 'hinged';
}

export function contentOf(state: AppState, half: Half): HalfContent {
  if (half === 'b') return state.hinge.b;
  const { boards, lid, extraCuts, vents, fan, label } = state;
  return { h: state.shape.size.h, boards, lid, extraCuts, vents, fan, label };
}

function withContent(state: AppState, content: HalfContent): AppState {
  const { boards, lid, extraCuts, vents, fan, label } = content;
  return { ...state, boards, lid, extraCuts, vents, fan, label, shape: { ...state.shape, size: { ...state.shape.size, h: content.h } } };
}

/**
 * One half as a case of its own: both halves share the footprint — the
 * larger of what each needs, or the manual size grown to it — and each has
 * its own height. The size is fixed (`auto` off), so whatever reads the
 * half's dims gets them without knowing about the other half. A hinged case
 * has no wall mount.
 */
export function halfState(state: AppState, half: Half): AppState {
  const lower = withContent(state, contentOf(state, 'a'));
  const upper = withContent(state, contentOf(state, 'b'));
  const minA = minimumDims(lower);
  const minB = minimumDims(upper);
  const own = half === 'a' ? minA : minB;
  const { auto } = state.shape;
  const size = {
    w: Math.max(minA.w, minB.w, auto ? 0 : state.shape.size.w),
    d: Math.max(minA.d, minB.d, auto ? 0 : state.shape.size.d),
    h: auto ? own.h : Math.max(own.h, contentOf(state, half).h),
  };
  const base = half === 'a' ? lower : upper;
  return { ...base, shape: { ...base.shape, auto: false, size }, wallMount: { ...base.wallMount, kind: 'none' } };
}

/** The state after a card changed `next`, the half it was given: only the half's contents go back. */
export function withHalf(state: AppState, half: Half, next: AppState): AppState {
  const content: HalfContent = { ...contentOf(next, 'a'), h: contentOf(state, half).h };
  if (half === 'b') return { ...state, hinge: { ...state.hinge, b: content } };
  return { ...withContent(state, content), shape: state.shape };
}

/** The cases a state is made of: itself, or its two halves. */
export function casesOf(state: AppState): { half: Half | null; state: AppState }[] {
  return isHinged(state) ? HALVES.map((half) => ({ half, state: halfState(state, half) })) : [{ half: null, state }];
}

/**
 * How far anything stands out of a half's inner face: what goes through its
 * plate, plugs in their slots, a raised label on a lid on top.
 */
export function innerProtrusion(state: AppState, half: Half): number {
  const one = halfState(state, half);
  const layout = caseLayout(one);
  const label = one.label.on && one.label.raised && one.lid.face === 'top' ? one.label.depth : 0;
  return Math.max(topProtrusion(layout, { ...one.shape, console: layout.console }), label);
}

/** The gap between the closed halves: from what stands out of their inner faces, or as set. */
export function gapOf(state: AppState): number {
  return state.hinge.gapAuto ? gapFor(innerProtrusion(state, 'a'), innerProtrusion(state, 'b')) : state.hinge.gap;
}

/** The hinge's axis for the halves as they are built (the axis split follows their lids). */
export function foldOfState(state: AppState): Fold {
  const a = halfState(state, 'a');
  const b = halfState(state, 'b');
  const dimsA = caseDims(a);
  const gap = gapOf(state);
  const { zA } = axisSplit(state.hinge, gap, a.lid.face, b.lid.face);
  return foldOf(state.hinge, dimsA.d, dimsA.h, caseDims(b).h, gap, zA);
}

/** The cables' slots along the hinge: x range and size, the same in both halves. */
export function cableSlots(state: AppState): { x: number; w: number; h: number; through: CableThrough }[] {
  return state.hinge.cables.map((cable) => ({ x: cable.x, through: cable.through, ...cableSlot(cable) }));
}

/**
 * What one half's build adds for the hinge: its knuckles on its hinge wall
 * (clear of the cables' slots), the axles' holes, the slots — as close to
 * the inner face as its wall allows; null for a single case.
 */
export function halfHinge(state: AppState, half: Half): HalfHinge | null {
  if (!isHinged(state)) return null;
  const fold = foldOfState(state);
  const one = halfState(state, half);
  const dims = caseDims(one);
  const cornerR = Math.max(0, Math.min(state.shape.cornerR, dims.w / 2, dims.d / 2));
  const slots = cableSlots(state);
  const keepOut = slots.map((slot) => ({ x0: slot.x - slot.w / 2 - CABLE_KEEP, x1: slot.x + slot.w / 2 + CABLE_KEEP }));
  const { hinge } = state;
  const sides = hinge.place === 'sides';
  // side pivots leave the back edge to the cables
  const { blocks, runs } = sides ? { blocks: [], runs: [] } : knuckleRuns(state.hinge, dims.w, cornerR, keepOut);
  const ceiling = dims.h - one.shape.floor;
  const zAxis = half === 'a' ? fold.z : fold.zB;
  return {
    wall: half === 'a' ? 'back' : 'front',
    r: hinge.barrelD / 2,
    e: axisOffset(hinge),
    zAxis,
    runs: runs.filter((run) => run.half === half),
    others: runs.filter((run) => run.half !== half),
    clearance: hinge.clearance,
    blocks,
    holes: axleHoles(hinge),
    slots: slots.map((slot): CableSlot => {
      const z = Math.max(one.shape.floor + slot.h / 2, ceiling - CABLE_TOP_GAP - slot.h / 2);
      // through the inner face: next to the hinge wall's inside, clear of a top lid's skirt —
      // one distance in both halves, so closed the slots face each other across the gap
      const off = one.shape.wall + Math.max(magnetClear(halfState(state, 'a')), magnetClear(halfState(state, 'b'))) + slot.h / 2;
      const y = half === 'a' ? dims.d - off : off;
      const mouth: [number, number, number] = slot.through === 'face' ? [slot.x, y, dims.h] : [slot.x, half === 'a' ? dims.d : 0, z];
      return { ...slot, z, y, mouth };
    }),
    kind: hinge.kind,
    magnets: hinge.magnets
      // one clearance for both halves: closed, their magnets meet
      ? magnetBosses(hinge.magnet, dims.w, dims.d, dims.h, one.shape.wall, half === 'a' ? 'front' : 'back',
        Math.max(magnetClear(halfState(state, 'a')), magnetClear(halfState(state, 'b'))))
      : null,
    place: hinge.place,
    leafScrew: { size: hinge.leafScrew, hole: hinge.leafHole },
    pivot: sides ? pivotLayout({
      upper: half === 'b', leaves: hinge.kind === 'leaves', t: pivotThickness(hinge), gap: hinge.clearance, r: hinge.barrelD / 2,
      c: hinge.clearance, e: axisOffset(hinge), zAxis, d: dims.d, cornerR, head: SCREWS[hinge.leafScrew].headD,
      padR: bossDiameter({ size: hinge.leafScrew, hole: hinge.leafHole, head: 'none' }) / 2, ...wallOf(one),
    }) : null,
    leaf: hinge.kind === 'leaves' && !sides ? leafLayout({
      zAxis, e: axisOffset(hinge), blocks, screw: hinge.leafScrew, hole: hinge.leafHole, ...wallOf(one),
    }) : null,
  };
}

/** How far a magnet's boss keeps off the wall: a top lid's skirt hangs there. */
function magnetClear(one: AppState): number {
  return one.lid.face === 'top' ? one.lid.lip.t + one.lid.fit + 0.5 : 0.5;
}

/**
 * A half's hinge wall: the z range its body owns, the flat between the edge
 * fillets, and inside the cavity the body's part clear of the lid's skirt
 * and of the plates.
 */
function wallOf(one: AppState): { body: [number, number]; flat: [number, number]; pads: [number, number] } {
  const dims = caseDims(one);
  const lid = effectiveLid(one.shape, one.lid, dims);
  const { edgeR } = effectiveRadii(shapeSpec(one.shape, dims).outer);
  const body = bodyRange(dims.h, lid.face, plateOf(one.shape, lid.face), lid.depth);
  const skirt = lid.lip.h + 0.5;
  const pads: [number, number] = lid.face === 'top'
    ? [one.shape.floor, body[1] - skirt]
    : [body[0] + skirt, dims.h - one.shape.floor];
  return { body, flat: [edgeR, dims.h - edgeR], pads };
}

/**
 * Where a half's knuckles hold on to its hinge wall (`knuckleStrip`), as its
 * build finds it; null when its body keeps no wall there.
 */
export function halfStrip(state: AppState, half: Half): [number, number] | null {
  const hinge = halfHinge(state, half);
  if (!hinge) return null;
  const one = halfState(state, half);
  const { body, flat } = wallOf(one);
  return knuckleStrip({ h: caseDims(one).h, edgeR: flat[0], zAxis: hinge.zAxis, r: hinge.r, e: hinge.e, body });
}

/**
 * What the hinge says about the case as a whole: knuckles with both lids on
 * the bottom cannot print; a screw axle's screws to buy.
 */
export function hingeNotes(state: AppState): Message[] {
  if (!isHinged(state)) return [];
  const out: Message[] = [];
  const { printable } = axisSplit(state.hinge, gapOf(state), state.lid.face, state.hinge.b.lid.face);
  if (!printable) out.push({ code: 'warn.hingeUnprintable' });
  const hinge = halfHinge(state, 'a');
  // a screw axle across a side pivot spans both cheeks
  const span = hinge?.pivot ? [{ x0: hinge.pivot.span[0], x1: hinge.pivot.span[1] }, { x0: hinge.pivot.span[0], x1: hinge.pivot.span[1] }] : null;
  const screws = hinge ? hingeScrews(state.hinge, span ?? hinge.blocks) : null;
  if (screws) out.push({ code: 'info.hingeScrews', params: { n: screws.count, size: state.hinge.screw, len: screws.length } });
  if (state.hinge.axle === 'snap') out.push({ code: 'info.hingeSnap' });
  const proud = innerProtrusion(state, 'a') + innerProtrusion(state, 'b');
  const need = gapFor(innerProtrusion(state, 'a'), innerProtrusion(state, 'b'));
  if (!state.hinge.gapAuto && state.hinge.gap < proud) out.push({ code: 'warn.gapSmall', params: { gap: state.hinge.gap.toFixed(1), need: need.toFixed(1) } });
  if (state.hinge.gapAuto && need > GAP_DEFAULT) out.push({ code: 'info.gapAuto', params: { gap: need.toFixed(1) } });
  if (state.hinge.kind === 'leaves') {
    const leaves = HALVES.flatMap((half) => {
      const one = halfHinge(state, half);
      // a side pivot's printed cheek: its screws through the cheek (the upper one's through its spacer)
      const pivot = one?.pivot;
      if (pivot) {
        const t = pivot.spacer ? pivot.spacer.q1 : pivot.q1;
        // on both sides
        return [{ t, screw: state.hinge.leafScrew, hole: state.hinge.leafHole, screws: Array.from({ length: 2 * pivot.screws.length }, () => ({ x: 0 })) }];
      }
      return one?.leaf ? [one.leaf] : [];
    });
    const screws = leafScrews(leaves, state.shape.wall);
    if (screws) out.push({ code: `info.leafScrews.${state.hinge.leafHole}`, params: { n: screws.count, size: state.hinge.leafScrew, len: screws.length } });
  }
  out.push(...cableNotes(state));
  return out;
}

/**
 * Each cable: whether its slot leaves the straight part of the hinge edge
 * or runs into another's, and how long it is from slot to slot as the case
 * opens — the slack it needs inside.
 */
function cableNotes(state: AppState): Message[] {
  const lower = halfHinge(state, 'a');
  const upper = halfHinge(state, 'b');
  if (!lower || !upper) return [];
  const dims = caseDims(halfState(state, 'a'));
  const cornerR = Math.max(0, Math.min(state.shape.cornerR, dims.w / 2, dims.d / 2));
  const fold = foldOfState(state);
  const out: Message[] = [];
  lower.slots.forEach((slot, i) => {
    const n = i + 1;
    const box: SpotBox = slot.through === 'face'
      ? { min: [slot.x - slot.w / 2, slot.y - slot.h / 2, dims.h - state.shape.floor], max: [slot.x + slot.w / 2, slot.y + slot.h / 2, dims.h] }
      : { min: [slot.x - slot.w / 2, dims.d - state.shape.wall, slot.z - slot.h / 2], max: [slot.x + slot.w / 2, dims.d, slot.z + slot.h / 2] };
    const spot = boxSpot(box, 'body');
    if (slot.x - slot.w / 2 < cornerR || slot.x + slot.w / 2 > dims.w - cornerR) out.push({ code: 'warn.cableAtCorner', params: { n }, spot });
    const other = lower.slots.findIndex((one, j) => j > i && Math.abs(one.x - slot.x) < (one.w + slot.w) / 2);
    if (other >= 0) out.push({ code: 'warn.cablesOverlap', params: { n, m: other + 1 }, spot });
    // from the lower half's slot mouth to the upper half's, as the upper half turns
    const from: Vec3 = slot.mouth;
    const lengths = Array.from({ length: 37 }, (_, k) => {
      const to = applyAffine(upperPose(fold, k * 5), upper.slots[i].mouth);
      return Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
    });
    out.push({ code: 'info.cableLength', params: { n, min: Math.floor(Math.min(...lengths)), max: Math.ceil(Math.max(...lengths)) } });
  });
  return out;
}

