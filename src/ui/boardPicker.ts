// The board picker: a search box over the catalog, grouped by vendor,
// unverified entries marked. A modal like the preset list.

import { make } from './dom';
import { t } from '../i18n';
import { CATALOG } from '../boards/catalog';
import type { BoardDef } from '../boards/schema';

export function renderBoardList(root: HTMLElement, query: string, onPick: (def: BoardDef) => void): void {
  root.replaceChildren();
  const needle = query.trim().toLowerCase();
  const matches = CATALOG.filter((def) => !needle
    || `${def.vendor} ${def.name} ${def.id}`.toLowerCase().includes(needle));
  if (matches.length === 0) {
    root.append(make('p', 'preset-empty', t('picker.none')));
    return;
  }
  const vendors = [...new Set(matches.map((def) => def.vendor))];
  for (const vendor of vendors) {
    root.append(make('p', 'preset-group', vendor));
    for (const def of matches.filter((item) => item.vendor === vendor)) {
      const row = make('button', 'picker-row');
      row.type = 'button';
      row.dataset.board = def.id;
      row.append(make('span', undefined, def.name));
      if (!def.verified) {
        const mark = make('span', 'unverified', '≈');
        mark.title = t('board.unverified');
        row.append(mark);
      }
      row.append(make('span', 'picker-size', `${def.size.w} × ${def.size.d}`));
      row.addEventListener('click', () => onPick(def));
      root.append(row);
    }
  }
}
