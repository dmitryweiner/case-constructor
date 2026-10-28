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
import { caseDims, effectiveLid, minimumDims } from '../geo/layout';
import { SIZE_MAX, SIZE_MIN, clampNum, plateOf, shapeSpec } from '../geo/shape';
import type { Fold, HalfHinge, HingeSpec } from '../geo/hinge';
import { axisOffset, axisSplit, bodyRange, defaultHingeSpec, foldOf, knuckleRuns, knuckleStrip, sanitizeHingeSpec } from '../geo/hinge';
import type { Message } from '../geo/message';
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

/** The hinge's axis for the halves as they are built (the axis split follows their lids). */
export function foldOfState(state: AppState): Fold {
  const a = halfState(state, 'a');
  const b = halfState(state, 'b');
  const dimsA = caseDims(a);
  const { zA } = axisSplit(state.hinge, state.hinge.gap, a.lid.face, b.lid.face);
  return foldOf(state.hinge, dimsA.d, dimsA.h, caseDims(b).h, state.hinge.gap, zA);
}

/** What one half's build adds for the hinge: its knuckles on its hinge wall and the pins' holes; null for a single case. */
export function halfHinge(state: AppState, half: Half): HalfHinge | null {
  if (!isHinged(state)) return null;
  const fold = foldOfState(state);
  const dims = caseDims(halfState(state, half));
  const cornerR = Math.max(0, Math.min(state.shape.cornerR, dims.w / 2, dims.d / 2));
  const { blocks, runs } = knuckleRuns(state.hinge, dims.w, cornerR);
  const { hinge } = state;
  return {
    wall: half === 'a' ? 'back' : 'front',
    r: hinge.barrelD / 2,
    e: axisOffset(hinge),
    zAxis: half === 'a' ? fold.z : fold.zB,
    runs: runs.filter((run) => run.half === half),
    blocks,
    holeR: hinge.pinD / 2 + hinge.pinFit,
  };
}

/**
 * Where a half's knuckles hold on to its hinge wall (`knuckleStrip`), as its
 * build finds it; null when its body keeps no wall there.
 */
export function halfStrip(state: AppState, half: Half): [number, number] | null {
  const hinge = halfHinge(state, half);
  if (!hinge) return null;
  const one = halfState(state, half);
  const dims = caseDims(one);
  const lid = effectiveLid(one.shape, one.lid, dims);
  const body = bodyRange(dims.h, lid.face, plateOf(one.shape, lid.face), lid.depth);
  const { edgeR } = effectiveRadii(shapeSpec(one.shape, dims).outer);
  return knuckleStrip({ h: dims.h, edgeR, zAxis: hinge.zAxis, r: hinge.r, e: hinge.e, body });
}

/** What the hinge says about the case as a whole: knuckles with both lids on the bottom cannot print. */
export function hingeNotes(state: AppState): Message[] {
  if (!isHinged(state)) return [];
  const { printable } = axisSplit(state.hinge, state.hinge.gap, state.lid.face, state.hinge.b.lid.face);
  return printable ? [] : [{ code: 'warn.hingeUnprintable' }];
}

