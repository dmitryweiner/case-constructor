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
import { minimumDims } from '../geo/layout';
import { SIZE_MAX, SIZE_MIN, clampNum } from '../geo/shape';
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

export interface HingeState {
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
  return { b: defaultHalf(), gap: 1 };
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
