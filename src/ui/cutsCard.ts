// The Openings card: user-defined cuts on any face — rectangle or circle,
// position and size in the face's own coordinates.

import type { Change, Control } from './controls';
import { renderControls } from './controls';
import type { BoxListHandle } from './boxList';
import { renderBoxList } from './boxList';
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
  const range = (
    key: string,
    field: 'x' | 'y' | 'w' | 'h' | 'r',
    label: Control<AppState>['label'],
    min: number,
    max: number,
    when?: (state: AppState) => boolean,
  ): Control<AppState> => ({
    kind: 'range',
    key,
    label,
    min,
    max,
    step: 0.5,
    when,
    ...(field === 'x' || field === 'y' ? { hint: 'cut.xy.hint' as const } : {}),
    get: (state) => at(state)[field],
    set: (state, value) => patchCut(state, index, { [field]: value }),
  });
  return [
    {
      kind: 'select',
      key: 'face',
      label: 'cut.face',
      options: cutFaces('box').map((value) => ({ value, label: `face.${value}` as const })),
      get: (state) => at(state).face,
      set: (state, value) => patchCut(state, index, { face: cutFaces(state.shape.kind).find((face) => face === value) ?? at(state).face }),
    },
    {
      kind: 'segmented',
      key: 'shape',
      label: 'cut.shape',
      options: [
        { value: 'rect', label: 'cutshape.rect' },
        { value: 'round', label: 'cutshape.round' },
      ],
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

export type CutsCardHandle = BoxListHandle;

export function renderCutsCard(list: HTMLUListElement, read: () => AppState, onChange: Change<AppState>): CutsCardHandle {
  return renderBoxList(list, {
    idPrefix: 'cut',
    read,
    onChange,
    count: (state) => state.extraCuts.length,
    title: (_state, index) => t('cut.title', { n: index + 1 }),
    fill: (body, index) => renderControls(body, cutControls(index), read, onChange, `cut${index}`),
    remove: (state, index) => ({ ...state, extraCuts: state.extraCuts.filter((_, i) => i !== index) }),
  });
}

/** A new cut in the middle of the front face (or the first face the shape allows). */
export function addCut(state: AppState): AppState {
  if (state.extraCuts.length >= MAX_EXTRA_CUTS) return state;
  return { ...state, extraCuts: [...state.extraCuts, defaultExtraCut(cutFaces(state.shape.kind)[2])] };
}
