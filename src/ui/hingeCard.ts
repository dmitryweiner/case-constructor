// The Hinge card of a hinged case: how the halves meet when closed. The
// half being edited and the view's angle are view settings, not the
// project's: their rows are built over `HalfView`.

import type { Control } from './controls';
import type { AppState } from '../state/schema';
import type { Half } from '../state/hinged';
import { GAP_MAX, HALVES } from '../state/hinged';

export function hingeControls(): Control<AppState>[] {
  return [
    {
      kind: 'range', key: 'gap', label: 'hinge.gap', hint: 'hinge.gap.hint', min: 0, max: GAP_MAX, step: 0.1,
      get: (state) => state.hinge.gap,
      set: (state, value) => ({ ...state, hinge: { ...state.hinge, gap: value } }),
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

export function angleControls(): Control<HalfView>[] {
  return [
    {
      kind: 'range', key: 'angle', label: 'view.angle', hint: 'view.angle.hint', min: 0, max: 180, step: 5,
      get: (view) => view.angle,
      set: (view, value) => ({ ...view, angle: value }),
    },
  ];
}
