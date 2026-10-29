// The Case card: shape tiles, radii, walls, size. The size rows show the
// size the case is actually built at — computed from the boards when "Size
// from boards" is on, the manual size grown to the minimum otherwise — so a
// clamp is visible right where the number is.

import type { Control } from './controls';
import { caseDims } from '../geo/layout';
import { H_MIN, HINGED_H_MIN, SHAPE_KINDS, SIZE_MAX, SIZE_MIN, WALL_MAX, WALL_MIN, CORNER_MAX, EDGE_MAX } from '../geo/shape';
import type { ShapeState } from '../geo/shape';
import type { Dims } from '../geo/face';
import type { AppState } from '../state/schema';
import { withShapeKind } from '../state/schema';
import type { Half } from '../state/hinged';
import { halfState, isHinged } from '../state/hinged';

type Dim = 'w' | 'd' | 'h';

/** The size the case is built at; a hinged case's footprint and the lower half's height, or the upper half's. */
function builtDims(state: AppState, half: Half = 'a'): Dims {
  return caseDims(isHinged(state) ? halfState(state, half) : state);
}

function shapeOf(state: AppState, patch: Partial<ShapeState>): AppState {
  return { ...state, shape: { ...state.shape, ...patch } };
}

function sizeControl(key: string, dim: Dim, label: 'param.sizeW' | 'param.sizeD' | 'param.sizeH' | 'param.diameter' | 'param.sizeHA',
  when: (state: AppState) => boolean): Control<AppState> {
  return {
    kind: 'range', key, label, min: key === 'hA' ? HINGED_H_MIN : dim === 'h' ? H_MIN : SIZE_MIN, max: SIZE_MAX, step: 1, when,
    disabled: (state) => state.shape.auto,
    get: (state) => Math.round(builtDims(state)[dim]),
    set: (state, value) => shapeOf(state, { size: { ...state.shape.size, [dim]: value } }),
  };
}

export function caseControls(): Control<AppState>[] {
  const kind = (state: AppState): string => state.shape.kind;
  return [
    {
      kind: 'segmented', key: 'kind', label: 'shape.kind',
      options: SHAPE_KINDS.map((value) => ({ value, label: `shape.${value}` as const })),
      get: kind,
      set: (state, value) => withShapeKind(state, SHAPE_KINDS.find((k) => k === value) ?? state.shape.kind),
    },
    {
      kind: 'range', key: 'cornerR', label: 'param.cornerR', hint: 'param.cornerR.hint',
      min: 0, max: CORNER_MAX, step: 0.5, when: (state) => kind(state) !== 'cylinder',
      get: (state) => state.shape.cornerR,
      set: (state, value) => shapeOf(state, { cornerR: value }),
    },
    {
      kind: 'range', key: 'edgeR', label: 'param.edgeR', hint: 'param.edgeR.hint',
      min: 0, max: EDGE_MAX, step: 0.5, when: (state) => kind(state) !== 'console',
      get: (state) => state.shape.edgeR,
      set: (state, value) => shapeOf(state, { edgeR: value }),
    },
    {
      kind: 'range', key: 'wall', label: 'param.wall', hint: 'param.wall.hint',
      min: WALL_MIN, max: WALL_MAX, step: 0.1,
      get: (state) => state.shape.wall,
      set: (state, value) => shapeOf(state, { wall: value }),
    },
    {
      kind: 'range', key: 'floor', label: 'param.floor', hint: 'param.floor.hint',
      min: WALL_MIN, max: WALL_MAX, step: 0.1,
      get: (state) => state.shape.floor,
      set: (state, value) => shapeOf(state, { floor: value }),
    },
    {
      kind: 'check', key: 'auto', label: 'param.auto', hint: 'param.auto.hint',
      get: (state) => state.shape.auto,
      // switching auto off starts from the size the case has now, not from a stale manual one
      set: (state, value) => {
        if (value) return shapeOf(state, { auto: true });
        const manual = shapeOf(state, { auto: false, size: builtDims(state) });
        return isHinged(state) ? { ...manual, hinge: { ...state.hinge, b: { ...state.hinge.b, h: builtDims(state, 'b').h } } } : manual;
      },
    },
    sizeControl('w', 'w', 'param.sizeW', (state) => kind(state) !== 'cylinder'),
    sizeControl('diameter', 'w', 'param.diameter', (state) => kind(state) === 'cylinder'),
    sizeControl('d', 'd', 'param.sizeD', (state) => kind(state) !== 'cylinder'),
    sizeControl('h', 'h', 'param.sizeH', (state) => kind(state) !== 'console' && kind(state) !== 'hinged'),
    sizeControl('hA', 'h', 'param.sizeHA', (state) => kind(state) === 'hinged'),
    {
      kind: 'range', key: 'hB', label: 'param.sizeHB', min: HINGED_H_MIN, max: SIZE_MAX, step: 1,
      when: (state) => kind(state) === 'hinged',
      disabled: (state) => state.shape.auto,
      get: (state) => Math.round(builtDims(state, 'b').h),
      set: (state, value) => ({ ...state, hinge: { ...state.hinge, b: { ...state.hinge.b, h: value } } }),
    },
    {
      kind: 'range', key: 'frontH', label: 'param.frontH', min: 10, max: SIZE_MAX, step: 1,
      when: (state) => kind(state) === 'console',
      get: (state) => state.shape.console.frontH,
      set: (state, value) => shapeOf(state, { console: { ...state.shape.console, frontH: value } }),
    },
    {
      kind: 'range', key: 'backH', label: 'param.backH', min: 10, max: SIZE_MAX, step: 1,
      when: (state) => kind(state) === 'console',
      get: (state) => state.shape.console.backH,
      set: (state, value) => shapeOf(state, { console: { ...state.shape.console, backH: value } }),
    },
  ];
}
