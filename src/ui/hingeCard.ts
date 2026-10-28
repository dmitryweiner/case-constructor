// The Hinge card of a hinged case: how the halves meet when closed. The
// half being edited and the view's angle are view settings, not the
// project's: their rows are built over `HalfView`.

import type { Control } from './controls';
import type { AppState } from '../state/schema';
import type { Half, HingeState } from '../state/hinged';
import { GAP_MAX, HALVES } from '../state/hinged';
import {
  BARREL_D_MAX, BARREL_D_MIN, HINGE_LAYOUTS, KNUCKLE_COUNTS, KNUCKLE_LENGTH_MAX, KNUCKLE_LENGTH_MIN, PIN_D_MAX, PIN_D_MIN,
} from '../geo/hinge';

function hingeOf(state: AppState, patch: Partial<HingeState>): AppState {
  return { ...state, hinge: { ...state.hinge, ...patch } };
}

export function hingeControls(): Control<AppState>[] {
  return [
    {
      kind: 'range', key: 'gap', label: 'hinge.gap', hint: 'hinge.gap.hint', min: 0, max: GAP_MAX, step: 0.1,
      get: (state) => state.hinge.gap,
      set: (state, value) => hingeOf(state, { gap: value }),
    },
    {
      kind: 'segmented', key: 'layout', label: 'hinge.layout', hint: 'hinge.layout.hint',
      options: HINGE_LAYOUTS.map((value) => ({ value, label: `hinge.layout.${value}` as const })),
      get: (state) => state.hinge.layout,
      set: (state, value) => hingeOf(state, { layout: HINGE_LAYOUTS.find((one) => one === value) ?? state.hinge.layout }),
    },
    {
      kind: 'segmented', key: 'knuckles', label: 'hinge.knuckles', hint: 'hinge.knuckles.hint',
      options: KNUCKLE_COUNTS.map((value) => ({ value: String(value), text: String(value) })),
      get: (state) => String(state.hinge.knuckles),
      set: (state, value) => hingeOf(state, { knuckles: KNUCKLE_COUNTS.find((one) => String(one) === value) ?? state.hinge.knuckles }),
    },
    {
      kind: 'range', key: 'length', label: 'hinge.length', hint: 'hinge.length.hint',
      min: KNUCKLE_LENGTH_MIN, max: KNUCKLE_LENGTH_MAX, step: 0.5, when: (state) => state.hinge.layout === 'ends',
      get: (state) => state.hinge.length,
      set: (state, value) => hingeOf(state, { length: value }),
    },
    {
      kind: 'range', key: 'barrelD', label: 'hinge.barrelD', hint: 'hinge.barrelD.hint', min: BARREL_D_MIN, max: BARREL_D_MAX, step: 0.5,
      get: (state) => state.hinge.barrelD,
      set: (state, value) => hingeOf(state, { barrelD: value }),
    },
    {
      kind: 'range', key: 'clearance', label: 'hinge.clearance', hint: 'hinge.clearance.hint', min: 0.2, max: 1, step: 0.05,
      get: (state) => state.hinge.clearance,
      set: (state, value) => hingeOf(state, { clearance: value }),
    },
    {
      kind: 'range', key: 'pinD', label: 'hinge.pinD', hint: 'hinge.pinD.hint', min: PIN_D_MIN, max: PIN_D_MAX, step: 0.05,
      get: (state) => state.hinge.pinD,
      set: (state, value) => hingeOf(state, { pinD: value }),
    },
    {
      kind: 'range', key: 'pinFit', label: 'hinge.pinFit', hint: 'hinge.pinFit.hint', min: 0, max: 0.5, step: 0.05,
      get: (state) => state.hinge.pinFit,
      set: (state, value) => hingeOf(state, { pinFit: value }),
    },
  ];
}

/** What the panel edits and how the halves are shown. */
export interface HalfView {
  half: Half;
  /** 0° closed … 180° open flat */
  angle: number;
}

export function halfControls(): Control<HalfView>[] {
  return [
    {
      kind: 'segmented', key: 'half', label: 'half.edit', hint: 'half.edit.hint',
      options: HALVES.map((value) => ({ value, label: `half.${value}` as const })),
      get: (view) => view.half,
      set: (view, value) => ({ ...view, half: HALVES.find((half) => half === value) ?? view.half }),
    },
  ];
}

/** `flat`: the parts lie on the bed, where the angle means nothing. */
export function angleControls(flat: () => boolean): Control<HalfView>[] {
  return [
    {
      kind: 'range', key: 'angle', label: 'view.angle', hint: 'view.angle.hint', min: 0, max: 180, step: 5,
      disabled: flat,
      get: (view) => view.angle,
      set: (view, value) => ({ ...view, angle: value }),
    },
  ];
}
