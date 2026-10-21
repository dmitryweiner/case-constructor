// The Openings card: user-defined cuts on any face — rectangle or circle,
// position and size in the face's own coordinates.

import { make } from './dom';
import type { Control, ControlsHandle } from './controls';
import { renderControls } from './controls';
import { t } from '../i18n';
import type { ExtraCut } from '../geo/cutters';
import { MAX_EXTRA_CUTS, cutFaces, defaultExtraCut } from '../geo/cutters';
import type { AppState } from '../state/schema';

function patchCut(state: AppState, index: number, patch: Partial<ExtraCut>): AppState {
  return { ...state, extraCuts: state.extraCuts.map((cut, i) => (i === index ? { ...cut, ...patch } : cut)) };
}

function cutControls(index: number): Control<AppState>[] {
  const at = (state: AppState): ExtraCut => state.extraCuts[index];
  const round = (state: AppState): boolean => at(state).shape === 'round';
  // `key` names the element (#cut0_d), `field` the value it edits: the diameter edits w
  const range = (key: string, field: 'x' | 'y' | 'w' | 'h' | 'r', label: Control<AppState>['label'], min: number, max: number,
    when?: (state: AppState) => boolean): Control<AppState> => ({
    kind: 'range', key, label, min, max, step: 0.5, when,
    ...(field === 'x' || field === 'y' ? { hint: 'cut.xy.hint' as const } : {}),
    get: (state) => at(state)[field],
    set: (state, value) => patchCut(state, index, { [field]: value }),
  });
  return [
    {
      kind: 'select', key: 'face', label: 'cut.face',
      options: cutFaces('box').map((value) => ({ value, label: `face.${value}` as const })),
      get: (state) => at(state).face,
      set: (state, value) => patchCut(state, index, { face: cutFaces(state.shape.kind).find((face) => face === value) ?? at(state).face }),
    },
    {
      kind: 'segmented', key: 'shape', label: 'cut.shape',
      options: [{ value: 'rect', label: 'cutshape.rect' }, { value: 'round', label: 'cutshape.round' }],
      get: (state) => at(state).shape,
      set: (state, value) => patchCut(state, index, { shape: value === 'round' ? 'round' : 'rect' }),
    },
    range('x', 'x', 'cut.x', 0, 400),
    range('y', 'y', 'cut.y', 0, 400),
    range('w', 'w', 'cut.w', 1, 200, (state) => !round(state)),
    range('d', 'w', 'cut.d', 1, 200, round),
    range('h', 'h', 'cut.h', 1, 200, (state) => !round(state)),
    range('r', 'r', 'cut.r', 0, 50, (state) => !round(state)),
  ];
}

export interface CutsCardHandle {
  sync(state: AppState): void;
}

export function renderCutsCard(
  container: HTMLElement, read: () => AppState, onChange: (next: AppState) => void,
): CutsCardHandle {
  let handles: ControlsHandle<AppState>[] = [];
  let count = -1;

  function build(state: AppState): void {
    container.replaceChildren();
    handles = state.extraCuts.map((_, index) => {
      const box = make('div', 'board-box');
      box.id = `cut${index}`;
      const head = make('div', 'board-head');
      head.append(make('span', 'board-name', t('cut.title', { n: index + 1 })));
      const remove = make('button', 'tb-btn board-del', '✕');
      remove.type = 'button';
      remove.id = `cut${index}_remove`;
      remove.title = t('cut.remove');
      remove.setAttribute('aria-label', t('cut.remove'));
      remove.addEventListener('click', () => {
        const current = read();
        onChange({ ...current, extraCuts: current.extraCuts.filter((__, i) => i !== index) });
      });
      head.append(remove);
      const controls = make('div');
      box.append(head, controls);
      container.append(box);
      return renderControls(controls, cutControls(index), read, onChange, `cut${index}`);
    });
  }

  function sync(state: AppState): void {
    if (state.extraCuts.length !== count) {
      count = state.extraCuts.length;
      build(state);
    }
    for (const handle of handles) handle.sync(state);
  }

  sync(read());
  return { sync };
}

/** A new cut in the middle of the front face (or the first face the shape allows). */
export function addCut(state: AppState): AppState {
  if (state.extraCuts.length >= MAX_EXTRA_CUTS) return state;
  return { ...state, extraCuts: [...state.extraCuts, defaultExtraCut(cutFaces(state.shape.kind)[2])] };
}
