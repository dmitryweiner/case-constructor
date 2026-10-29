// Declarative controls over any state: describe how to read and how to write
// a value, and this module renders the rows, formats the numbers and keeps
// them in sync. Every card of the panel is drawn by the same code.
//
// Labels, hints and options are dictionary keys, not text: translation
// happens at render time, and a language switch is just a re-render.

import { make } from './dom';
import type { Key } from '../i18n';
import { t } from '../i18n';

/**
 * When a control is visible. Needed where a card has mutually exclusive
 * modes: a slider that does nothing in the current mode is worse than none.
 */
type Visibility<T> = (state: T) => boolean;

/** A label: a dictionary key, or ready text when there is nothing to translate (a port id). */
export type Label = Key | { text: string };

function labelText(label: Label): string {
  return typeof label === 'string' ? t(label) : label.text;
}

interface Common<T> {
  key: string;
  label: Label;
  hint?: Key;
  when?: Visibility<T>;
  /** shown but not editable (e.g. a size computed from the boards) */
  disabled?: (state: T) => boolean;
}

export interface RangeControl<T> extends Common<T> {
  kind: 'range';
  min: number;
  max: number;
  step: number;
  get(state: T): number;
  set(state: T, value: number): T;
}

/** An option: a value and its label key — or ready text when there is nothing to translate. */
export type SelectOption = { value: string; label: Key } | { value: string; text: string };

export interface SelectControl<T> extends Common<T> {
  kind: 'select';
  options: readonly SelectOption[];
  /** an option that cannot be chosen in this state */
  optionDisabled?: (state: T, value: string) => boolean;
  get(state: T): string;
  set(state: T, value: string): T;
}

/** A row of buttons, one per option, the current one pressed. */
export interface SegmentedControl<T> extends Common<T> {
  kind: 'segmented';
  options: readonly SelectOption[];
  /** an option that cannot be chosen in this state */
  optionDisabled?: (state: T, value: string) => boolean;
  get(state: T): string;
  set(state: T, value: string): T;
}

/** A row of buttons, any number of them pressed (the walls a board stands against). */
export interface TogglesControl<T> extends Common<T> {
  kind: 'toggles';
  options: readonly SelectOption[];
  optionDisabled?: (state: T, value: string) => boolean;
  get(state: T): readonly string[];
  set(state: T, values: string[]): T;
}

export interface CheckControl<T> extends Common<T> {
  kind: 'check';
  get(state: T): boolean;
  set(state: T, value: boolean): T;
}

/** A line of text; changes the state on every keystroke, like a slider. */
export interface TextControl<T> extends Common<T> {
  kind: 'text';
  placeholder?: Key;
  maxLength: number;
  get(state: T): string;
  set(state: T, value: string): T;
}

/** An action button over the state ("remove board"). */
export interface ButtonControl<T> extends Common<T> {
  kind: 'button';
  /** the caption on the button */
  button: Key;
  apply(state: T): T;
}

export type Control<T> =
  | RangeControl<T> | SelectControl<T> | SegmentedControl<T> | TogglesControl<T> | CheckControl<T> | TextControl<T> | ButtonControl<T>;

export interface ControlsHandle<T> {
  /** updates the shown values without rebuilding the DOM */
  sync(state: T): void;
}

function decimals(step: number): number {
  if (step >= 1) return 0;
  if (step >= 0.1) return 1;
  return 2;
}

function optionText(option: SelectOption): string {
  return 'text' in option ? option.text : t(option.label);
}

export function renderControls<T>(
  container: HTMLElement,
  controls: readonly Control<T>[],
  read: () => T,
  onChange: (next: T) => void,
  idPrefix: string,
): ControlsHandle<T> {
  container.textContent = '';
  const syncers: ((state: T) => void)[] = [];

  for (const control of controls) {
    const id = `${idPrefix}_${control.key}`;
    const row = make(control.kind === 'segmented' || control.kind === 'toggles' ? 'div' : 'label', 'row');
    const name = make('span', 'row-label', labelText(control.label));
    if (control.hint) name.title = t(control.hint);
    row.append(name);
    let setDisabled: (off: boolean) => void = () => {};

    if (control.kind === 'text') {
      const input = make('input');
      input.type = 'text';
      input.id = id;
      input.maxLength = control.maxLength;
      input.spellcheck = false;
      input.dir = 'auto';
      if (control.placeholder) input.placeholder = t(control.placeholder);
      input.value = control.get(read());
      input.addEventListener('input', () => onChange(control.set(read(), input.value)));
      row.append(input);
      syncers.push((state) => {
        // rewrite only on a mismatch, or the caret would jump to the end
        const value = control.get(state);
        if (input.value !== value) input.value = value;
      });
      setDisabled = (off) => {
        input.disabled = off;
      };
    } else if (control.kind === 'button') {
      const button = make('button', 'tb-btn', t(control.button));
      button.type = 'button';
      button.id = id;
      button.addEventListener('click', () => onChange(control.apply(read())));
      row.append(button);
      setDisabled = (off) => {
        button.disabled = off;
      };
    } else if (control.kind === 'check') {
      const box = make('input');
      box.type = 'checkbox';
      box.id = id;
      box.checked = control.get(read());
      box.addEventListener('change', () => onChange(control.set(read(), box.checked)));
      row.classList.add('check-row');
      row.prepend(box);
      syncers.push((state) => {
        box.checked = control.get(state);
      });
      setDisabled = (off) => {
        box.disabled = off;
      };
    } else if (control.kind === 'select') {
      const select = make('select');
      select.id = id;
      const nodes = control.options.map((option) => {
        const node = make('option', undefined, optionText(option));
        node.value = option.value;
        select.append(node);
        return node;
      });
      const show = (state: T): void => {
        for (const node of nodes) node.disabled = control.optionDisabled?.(state, node.value) ?? false;
        select.value = control.get(state);
      };
      show(read());
      select.addEventListener('change', () => onChange(control.set(read(), select.value)));
      row.append(select);
      syncers.push(show);
      setDisabled = (off) => {
        select.disabled = off;
      };
    } else if (control.kind === 'toggles') {
      const group = make('div', 'segmented');
      group.id = id;
      group.setAttribute('role', 'group');
      const buttons = control.options.map((option) => {
        const button = make('button', 'seg-btn', optionText(option));
        button.type = 'button';
        button.id = `${id}_${option.value}`;
        button.dataset.value = option.value;
        button.addEventListener('click', () => {
          const now = control.get(read());
          const next = now.includes(option.value) ? now.filter((value) => value !== option.value) : [...now, option.value];
          onChange(control.set(read(), next));
        });
        group.append(button);
        return button;
      });
      row.append(group);
      const show = (state: T): void => {
        const values = control.get(state);
        for (const button of buttons) {
          const pressed = values.includes(button.dataset.value ?? '');
          button.classList.toggle('active', pressed);
          button.setAttribute('aria-pressed', String(pressed));
          button.disabled = control.optionDisabled?.(state, button.dataset.value ?? '') ?? false;
        }
      };
      show(read());
      syncers.push(show);
    } else if (control.kind === 'segmented') {
      const group = make('div', 'segmented');
      group.id = id;
      group.setAttribute('role', 'group');
      const buttons = control.options.map((option) => {
        const button = make('button', 'seg-btn', optionText(option));
        button.type = 'button';
        button.id = `${id}_${option.value}`;
        button.dataset.value = option.value;
        button.addEventListener('click', () => onChange(control.set(read(), option.value)));
        group.append(button);
        return button;
      });
      row.append(group);
      const show = (state: T): void => {
        const value = control.get(state);
        for (const button of buttons) {
          const pressed = button.dataset.value === value;
          button.classList.toggle('active', pressed);
          button.setAttribute('aria-pressed', String(pressed));
          button.disabled = control.optionDisabled?.(state, button.dataset.value ?? '') ?? false;
        }
      };
      show(read());
      syncers.push(show);
      setDisabled = (off) => {
        const state = read();
        for (const button of buttons) button.disabled = off || (control.optionDisabled?.(state, button.dataset.value ?? '') ?? false);
      };
    } else {
      const slider = make('input');
      slider.type = 'range';
      slider.id = id;
      slider.min = String(control.min);
      slider.max = String(control.max);
      slider.step = String(control.step);
      const digits = decimals(control.step);
      slider.value = String(control.get(read()));

      const readout = make('output', undefined, control.get(read()).toFixed(digits));
      const minus = make('button', 'adj-btn', '−');
      const plus = make('button', 'adj-btn', '+');
      for (const [button, dir] of [[minus, -1], [plus, 1]] as const) {
        button.type = 'button';
        button.dataset.slider = slider.id;
        button.dataset.dir = String(dir);
        button.tabIndex = -1;
      }
      slider.addEventListener('input', () => {
        const value = Number(slider.value);
        readout.textContent = value.toFixed(digits);
        onChange(control.set(read(), value));
      });
      row.append(minus, slider, plus, readout);
      syncers.push((state) => {
        const value = control.get(state);
        slider.value = String(value);
        readout.textContent = value.toFixed(digits);
      });
      setDisabled = (off) => {
        slider.disabled = off;
        minus.disabled = off;
        plus.disabled = off;
      };
    }

    const { when, disabled } = control;
    if (when || disabled) {
      const show = (state: T): void => {
        if (when) row.hidden = !when(state);
        if (disabled) {
          const off = disabled(state);
          setDisabled(off);
          row.classList.toggle('disabled', off);
        }
      };
      show(read());
      syncers.push(show);
    }

    container.append(row);
  }

  return {
    sync(state: T): void {
      for (const syncer of syncers) syncer(state);
    },
  };
}
