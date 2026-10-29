// The Hinge card of a hinged case: how the halves meet when closed. The
// half being edited and the view's angle are view settings, not the
// project's: their rows are built over `HalfView`.

import type { Control, ControlsHandle } from './controls';
import { renderControls } from './controls';
import { make } from './dom';
import { t } from '../i18n';
import type { AppState } from '../state/schema';
import type { Half, HingeState } from '../state/hinged';
import { GAP_MAX, HALVES, gapOf } from '../state/hinged';
import { HOLE_KINDS, MAGNETS, MAGNET_SIZES } from '../geo/fasteners';
import type { Cable } from '../geo/hinge';
import {
  CABLE_KINDS, CABLE_THROUGH, CABLE_W_MAX, HINGE_KINDS, MAX_CABLES, PLUG_MAX, axlesFor, defaultCable,
  AXLES, BARREL_D_MAX, BARREL_D_MIN, HINGE_LAYOUTS, HINGE_SCREWS, KNUCKLE_COUNTS, KNUCKLE_LENGTH_MAX, KNUCKLE_LENGTH_MIN, PIN_D_MAX, PIN_D_MIN,
} from '../geo/hinge';

function hingeOf(state: AppState, patch: Partial<HingeState>): AppState {
  return { ...state, hinge: { ...state.hinge, ...patch } };
}

export function hingeControls(): Control<AppState>[] {
  return [
    {
      kind: 'check', key: 'gapAuto', label: 'hinge.gapAuto', hint: 'hinge.gapAuto.hint',
      get: (state) => state.hinge.gapAuto,
      // switching it off starts from the gap the case has now
      set: (state, value) => hingeOf(state, value ? { gapAuto: true } : { gapAuto: false, gap: gapOf(state) }),
    },
    {
      kind: 'range', key: 'gap', label: 'hinge.gap', hint: 'hinge.gap.hint', min: 0, max: GAP_MAX, step: 0.1,
      disabled: (state) => state.hinge.gapAuto,
      get: (state) => gapOf(state),
      set: (state, value) => hingeOf(state, { gap: value }),
    },
    {
      kind: 'check', key: 'magnets', label: 'hinge.magnets', hint: 'hinge.magnets.hint',
      get: (state) => state.hinge.magnets,
      set: (state, value) => hingeOf(state, { magnets: value }),
    },
    {
      kind: 'select', key: 'magnet', label: 'lid.magnet', when: (state) => state.hinge.magnets,
      options: MAGNET_SIZES.map((size) => ({ value: size, text: `${MAGNETS[size].d} × ${MAGNETS[size].h}` })),
      get: (state) => state.hinge.magnet,
      set: (state, value) => hingeOf(state, { magnet: MAGNET_SIZES.find((one) => one === value) ?? state.hinge.magnet }),
    },
    {
      kind: 'segmented', key: 'kind', label: 'hinge.kind', hint: 'hinge.kind.hint',
      options: HINGE_KINDS.map((value) => ({ value, label: `hinge.kind.${value}` as const })),
      get: (state) => state.hinge.kind,
      set: (state, value) => hingeOf(state, { kind: HINGE_KINDS.find((one) => one === value) ?? state.hinge.kind }),
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
      kind: 'segmented', key: 'axle', label: 'hinge.axle', hint: 'hinge.axle.hint',
      options: AXLES.map((value) => ({ value, label: `hinge.axle.${value}` as const })),
      // cones print in place: only in a printed hinge, its leaves together
      optionDisabled: (state, value) => !axlesFor(state.hinge.kind).some((axle) => axle === value),
      get: (state) => state.hinge.axle,
      set: (state, value) => hingeOf(state, { axle: AXLES.find((one) => one === value) ?? state.hinge.axle }),
    },
    {
      kind: 'segmented', key: 'screw', label: 'hinge.screw', hint: 'hinge.screw.hint', when: (state) => state.hinge.axle === 'screw',
      options: HINGE_SCREWS.map((value) => ({ value, text: value })),
      get: (state) => state.hinge.screw,
      set: (state, value) => hingeOf(state, { screw: HINGE_SCREWS.find((one) => one === value) ?? state.hinge.screw }),
    },
    {
      kind: 'segmented', key: 'leafScrew', label: 'hinge.leafScrew', hint: 'hinge.leafScrew.hint', when: (state) => state.hinge.kind === 'leaves',
      options: HINGE_SCREWS.map((value) => ({ value, text: value })),
      get: (state) => state.hinge.leafScrew,
      set: (state, value) => hingeOf(state, { leafScrew: HINGE_SCREWS.find((one) => one === value) ?? state.hinge.leafScrew }),
    },
    {
      kind: 'segmented', key: 'leafHole', label: 'hinge.leafHole', hint: 'hinge.leafHole.hint', when: (state) => state.hinge.kind === 'leaves',
      options: HOLE_KINDS.map((value) => ({ value, label: `hole.${value}` as const })),
      get: (state) => state.hinge.leafHole,
      set: (state, value) => hingeOf(state, { leafHole: HOLE_KINDS.find((one) => one === value) ?? state.hinge.leafHole }),
    },
    {
      kind: 'range', key: 'pinD', label: 'hinge.pinD', hint: 'hinge.pinD.hint', min: PIN_D_MIN, max: PIN_D_MAX, step: 0.05,
      when: (state) => state.hinge.axle === 'pin',
      get: (state) => state.hinge.pinD,
      set: (state, value) => hingeOf(state, { pinD: value }),
    },
    {
      kind: 'range', key: 'pinFit', label: 'hinge.pinFit', hint: 'hinge.pinFit.hint', min: 0, max: 0.5, step: 0.05,
      when: (state) => state.hinge.axle === 'pin',
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

function patchCable(state: AppState, index: number, patch: Partial<Cable>): AppState {
  return hingeOf(state, { cables: state.hinge.cables.map((cable, i) => (i === index ? { ...cable, ...patch } : cable)) });
}

function cableControls(index: number): Control<AppState>[] {
  const at = (state: AppState): Cable => state.hinge.cables[index];
  const round = (state: AppState): boolean => at(state).kind === 'round';
  // `key` names the element (#cable0_d), `field` the value it edits: a round cable's diameter is its w
  const range = (key: string, field: 'x' | 'w' | 't' | 'plugW' | 'plugH', label: Control<AppState>['label'], min: number, max: number, step: number,
    when?: (state: AppState) => boolean, hint?: Control<AppState>['hint']): Control<AppState> => ({
    kind: 'range', key, label, min, max, step, when, ...(hint ? { hint } : {}),
    get: (state) => at(state)[field],
    set: (state, value) => patchCable(state, index, { [field]: value }),
  });
  return [
    {
      kind: 'segmented', key: 'kind', label: 'cable.kind',
      options: CABLE_KINDS.map((value) => ({ value, label: `cable.kind.${value}` as const })),
      get: (state) => at(state).kind,
      set: (state, value) => patchCable(state, index, { kind: CABLE_KINDS.find((one) => one === value) ?? at(state).kind }),
    },
    {
      kind: 'segmented', key: 'through', label: 'cable.through', hint: 'cable.through.hint',
      options: CABLE_THROUGH.map((value) => ({ value, label: `cable.through.${value}` as const })),
      get: (state) => at(state).through,
      set: (state, value) => patchCable(state, index, { through: CABLE_THROUGH.find((one) => one === value) ?? at(state).through }),
    },
    range('x', 'x', 'cable.x', 0, 400, 0.5, undefined, 'cable.x.hint'),
    range('w', 'w', 'cable.w', 1, CABLE_W_MAX, 0.5, (state) => !round(state)),
    range('t', 't', 'cable.t', 0.1, 5, 0.05, (state) => !round(state)),
    range('d', 'w', 'cable.d', 1, CABLE_W_MAX, 0.5, round),
    range('plugW', 'plugW', 'cable.plugW', 0, PLUG_MAX, 0.5, undefined, 'cable.plug.hint'),
    range('plugH', 'plugH', 'cable.plugH', 0, PLUG_MAX, 0.5, undefined, 'cable.plug.hint'),
  ];
}

export interface CablesCardHandle {
  sync(state: AppState): void;
}

/** The cables between the halves: a box per cable, like the openings' cards. */
export function renderCablesCard(container: HTMLElement, read: () => AppState, onChange: (next: AppState) => void): CablesCardHandle {
  let handles: ControlsHandle<AppState>[] = [];
  let count = -1;

  function build(state: AppState): void {
    container.replaceChildren();
    handles = state.hinge.cables.map((_, index) => {
      const box = make('div', 'board-box');
      box.id = `cable${index}`;
      const head = make('div', 'board-head');
      head.append(make('span', 'board-name', t('cable.title', { n: index + 1 })));
      const remove = make('button', 'tb-btn board-del', '✕');
      remove.type = 'button';
      remove.id = `cable${index}_remove`;
      remove.title = t('cable.remove');
      remove.setAttribute('aria-label', t('cable.remove'));
      remove.addEventListener('click', () => {
        const current = read();
        onChange(hingeOf(current, { cables: current.hinge.cables.filter((__, i) => i !== index) }));
      });
      head.append(remove);
      const controls = make('div');
      box.append(head, controls);
      container.append(box);
      return renderControls(controls, cableControls(index), read, onChange, `cable${index}`);
    });
  }

  function sync(state: AppState): void {
    if (state.hinge.cables.length !== count) {
      count = state.hinge.cables.length;
      build(state);
    }
    for (const handle of handles) handle.sync(state);
  }

  sync(read());
  return { sync };
}

/** A new cable in the middle of the hinge edge `w` long. */
export function addCable(state: AppState, w: number): AppState {
  if (state.hinge.cables.length >= MAX_CABLES) return state;
  return hingeOf(state, { cables: [...state.hinge.cables, defaultCable(Math.round(w / 2))] });
}
