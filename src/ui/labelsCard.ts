// The labels: a list like the openings, each label its own face, text,
// font and place on that face.

import { make } from './dom';
import type { Control, ControlsHandle } from './controls';
import { renderControls } from './controls';
import { t } from '../i18n';
import { FACES } from '../geo/face';
import type { LabelAnchor, LabelState } from '../geo/extras';
import { LABELS_MAX, LABEL_ANCHORS, LABEL_FONTS, LABEL_MARGIN_MAX, LABEL_MAX_CHARS, defaultLabel, labelFace, labelFaces } from '../geo/extras';
import { LABEL_FONT_FILES } from './fonts';
import { boardOf } from '../boards/placement';
import type { AppState } from '../state/schema';

function patchLabel(state: AppState, index: number, patch: Partial<LabelState>): AppState {
  return { ...state, labels: state.labels.map((label, i) => (i === index ? { ...label, ...patch } : label)) };
}

/** The anchors as a 3 × 3 grid of arrows, in LABEL_ANCHORS order. */
const ANCHOR_ARROWS: Readonly<Record<LabelAnchor, string>> = {
  topLeft: '↖', top: '↑', topRight: '↗', left: '←', centre: '•', right: '→', bottomLeft: '↙', bottom: '↓', bottomRight: '↘',
};
const QUARTER_TURNS = [0, 90, 180, 270] as const;

function labelControls(index: number): Control<AppState>[] {
  const at = (state: AppState): LabelState => state.labels[index];
  const label = (state: AppState, patch: Partial<LabelState>): AppState => patchLabel(state, index, patch);
  return [
    {
      kind: 'select', key: 'face', label: 'label.face', hint: 'label.face.hint',
      options: FACES.map((value) => ({ value, label: `face.${value}` as const })),
      optionDisabled: (state, value) => !labelFaces(state.shape.kind).some((face) => face === value),
      get: (state) => labelFace(at(state), state.shape.kind),
      set: (state, value) => label(state, { face: FACES.find((face) => face === value) ?? at(state).face }),
    },
    {
      kind: 'text', key: 'text', label: 'label.text', placeholder: 'label.text.placeholder', maxLength: LABEL_MAX_CHARS,
      get: (state) => at(state).text, set: (state, value) => label(state, { text: value }),
    },
    {
      kind: 'select', key: 'font', label: 'label.font',
      options: LABEL_FONTS.map((font) => ({ value: font, text: LABEL_FONT_FILES[font].label })),
      get: (state) => at(state).font,
      set: (state, value) => label(state, { font: LABEL_FONTS.find((f) => f === value) ?? at(state).font }),
    },
    {
      kind: 'range', key: 'size', label: 'label.size', hint: 'label.size.hint', min: 3, max: 30, step: 0.5,
      get: (state) => at(state).sizeMm, set: (state, value) => label(state, { sizeMm: value }),
    },
    {
      kind: 'check', key: 'raised', label: 'label.raised', hint: 'label.raised.hint',
      get: (state) => at(state).raised, set: (state, value) => label(state, { raised: value }),
    },
    {
      kind: 'range', key: 'depth', label: 'label.depth', min: 0.4, max: 1.5, step: 0.1,
      get: (state) => at(state).depth, set: (state, value) => label(state, { depth: value }),
    },
    {
      kind: 'segmented', key: 'anchor', label: 'label.anchor', hint: 'label.anchor.hint',
      options: LABEL_ANCHORS.map((value) => ({ value, text: ANCHOR_ARROWS[value] })),
      get: (state) => at(state).anchor,
      // a new anchor starts without the old fine offset
      set: (state, value) => label(state, { anchor: LABEL_ANCHORS.find((a) => a === value) ?? at(state).anchor, x: 0, y: 0 }),
    },
    {
      kind: 'range', key: 'margin', label: 'label.margin', hint: 'label.margin.hint', min: 0, max: LABEL_MARGIN_MAX, step: 0.5,
      when: (state) => at(state).anchor !== 'centre',
      get: (state) => at(state).margin, set: (state, value) => label(state, { margin: value }),
    },
    {
      kind: 'range', key: 'x', label: 'fan.x', hint: 'label.xy.hint', min: -100, max: 100, step: 0.5,
      get: (state) => at(state).x, set: (state, value) => label(state, { x: value }),
    },
    {
      kind: 'range', key: 'y', label: 'fan.y', hint: 'label.xy.hint', min: -100, max: 100, step: 0.5,
      get: (state) => at(state).y, set: (state, value) => label(state, { y: value }),
    },
    {
      kind: 'segmented', key: 'turn', label: 'label.turn',
      options: QUARTER_TURNS.map((value) => ({ value: String(value), text: `${value}°` })),
      get: (state) => String((((Math.round(at(state).angle) % 360) + 360) % 360)),
      // 270° is −90° on the slider's −180…180
      set: (state, value) => label(state, { angle: Number(value) > 180 ? Number(value) - 360 : Number(value) }),
    },
    {
      kind: 'range', key: 'angle', label: 'label.angle', min: -180, max: 180, step: 1,
      get: (state) => at(state).angle, set: (state, value) => label(state, { angle: value }),
    },
  ];
}

export interface LabelsCardHandle {
  sync(state: AppState): void;
}

export function renderLabelsCard(
  container: HTMLElement, read: () => AppState, onChange: (next: AppState) => void,
): LabelsCardHandle {
  let handles: ControlsHandle<AppState>[] = [];
  let count = -1;

  // rebuilt only when the list's length changes: a text field keeps its focus while typing
  function build(state: AppState): void {
    container.replaceChildren();
    handles = state.labels.map((_, index) => {
      const box = make('div', 'board-box');
      box.id = `label${index}`;
      const head = make('div', 'board-head');
      head.append(make('span', 'board-name', t('label.title', { n: index + 1 })));
      const remove = make('button', 'tb-btn board-del', '✕');
      remove.type = 'button';
      remove.id = `label${index}_remove`;
      remove.title = t('label.remove');
      remove.setAttribute('aria-label', t('label.remove'));
      remove.addEventListener('click', () => {
        const current = read();
        onChange({ ...current, labels: current.labels.filter((__, i) => i !== index) });
      });
      head.append(remove);
      const controls = make('div');
      box.append(head, controls);
      container.append(box);
      return renderControls(controls, labelControls(index), read, onChange, `label${index}`);
    });
  }

  function sync(state: AppState): void {
    if (state.labels.length !== count) {
      count = state.labels.length;
      build(state);
    }
    for (const handle of handles) handle.sync(state);
  }

  sync(read());
  return { sync };
}

/**
 * A new label on the lid's face (the first face the shape allows a label on
 * otherwise), saying the name of the first board no label names yet —
 * batteries have no name worth printing.
 */
export function addLabel(state: AppState): AppState {
  if (state.labels.length >= LABELS_MAX) return state;
  const faces = labelFaces(state.shape.kind);
  const face = faces.includes(state.lid.face) ? state.lid.face : faces[0];
  const named = new Set(state.labels.map((label) => label.text.trim()));
  const name = state.boards.map((placement) => boardOf(placement)).filter((def) => !def.battery)
    .map((def) => [...def.name.trim()].slice(0, LABEL_MAX_CHARS).join('')).find((one) => one !== '' && !named.has(one)) ?? '';
  return { ...state, labels: [...state.labels, { ...defaultLabel(face), text: name }] };
}
