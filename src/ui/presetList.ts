// The preset list: mine and built-in, with 🗑 next to mine.
//
// A system <select> cannot do that: on a phone it opens a system sheet with
// no room for a delete button, and on a desktop an optgroup takes nothing
// but text. Hence a panel of our own.
//
// Deleting takes two taps: the first turns 🗑 into "Delete?", the second
// deletes. A system confirm would block the page (and the smoke with it),
// and on a phone a finger easily lands on the next row.

import { make } from './dom';
import { t } from '../i18n';

export interface PresetRow {
  /** 'u:<name>' — mine, 'b:<id>' — built-in */
  ref: string;
  name: string;
  /** tooltip: what the preset is good for */
  note?: string;
  /** mine — can be deleted */
  mine: boolean;
}

export interface PresetListHandlers {
  onPick(ref: string): void;
  onDelete(ref: string): void;
}

/** How long "Delete?" waits for the second tap before turning back into 🗑. */
const CONFIRM_MS = 3000;

export function renderPresetList(
  root: HTMLElement,
  rows: PresetRow[],
  current: string,
  handlers: PresetListHandlers,
): void {
  root.replaceChildren();
  const mine = rows.filter((row) => row.mine);
  const builtin = rows.filter((row) => !row.mine);

  root.append(make('p', 'preset-group', t('presets.mine')));
  if (mine.length === 0) {
    root.append(make('p', 'preset-empty', t('presets.empty')));
  }
  for (const row of mine) root.append(presetRow(row, current, handlers));

  root.append(make('p', 'preset-group', t('presets.builtin')));
  for (const row of builtin) root.append(presetRow(row, current, handlers));
}

function presetRow(row: PresetRow, current: string, handlers: PresetListHandlers): HTMLElement {
  const wrap = make('div', 'preset-row');
  const pick = make('button', 'preset-pick', row.name);
  pick.type = 'button';
  pick.dataset.preset = row.ref;
  if (row.note) pick.title = row.note;
  if (row.ref === current) {
    pick.classList.add('current');
    pick.setAttribute('aria-current', 'true');
  }
  pick.addEventListener('click', () => handlers.onPick(row.ref));
  wrap.append(pick);

  if (row.mine) {
    const del = make('button', 'preset-del', '🗑');
    del.type = 'button';
    del.dataset.del = row.ref;
    del.title = t('presets.delete.title', { name: row.name });
    del.setAttribute('aria-label', t('presets.delete.aria', { name: row.name }));
    let timer: ReturnType<typeof setTimeout> | null = null;
    del.addEventListener('click', () => {
      if (del.classList.contains('armed')) {
        if (timer) clearTimeout(timer);
        handlers.onDelete(row.ref);
        return;
      }
      del.classList.add('armed');
      del.textContent = t('presets.delete.confirm');
      timer = setTimeout(() => {
        del.classList.remove('armed');
        del.textContent = '🗑';
      }, CONFIRM_MS);
    });
    wrap.append(del);
  }
  return wrap;
}
