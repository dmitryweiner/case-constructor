// The board picker: a search box over the catalog, grouped by vendor,
// unverified entries marked. A modal like the preset list.

import { make } from './dom';
import { t } from '../i18n';
import { CATALOG } from '../boards/catalog';
import type { BoardDef } from '../boards/schema';
import { BATTERY_KINDS, CELLS, batteryDef, defaultBattery } from '../boards/battery';

export function renderBoardList(root: HTMLElement, query: string, onPick: (def: BoardDef) => void): void {
  root.replaceChildren();
  const needle = query.trim().toLowerCase();
  const matches = CATALOG.filter((def) => !needle
    || `${def.vendor} ${def.name} ${def.id} ${def.kind === 'holder' ? `${t('picker.holders')} battery` : ''}`.toLowerCase().includes(needle));
  // batteries: one row per kind, the count and size are set on the card
  const batteries = BATTERY_KINDS.filter((kind) => !needle
    || `${t('picker.batteries')} ${t(`battery.kind.${kind}`)} battery ${kind}`.toLowerCase().includes(needle));
  if (matches.length === 0 && batteries.length === 0) {
    root.append(make('p', 'preset-empty', t('picker.none')));
    return;
  }
  // battery holders have a group of their own after the boards, whatever their maker
  const groupOf = (def: BoardDef): string => (def.kind === 'holder' ? t('picker.holders') : def.vendor);
  const groups = [...new Set([...matches.filter((def) => def.kind !== 'holder'), ...matches.filter((def) => def.kind === 'holder')].map(groupOf))];
  for (const group of groups) {
    root.append(make('p', 'preset-group', group));
    for (const def of matches.filter((item) => groupOf(item) === group)) {
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
  if (batteries.length > 0) root.append(make('p', 'preset-group', t('picker.batteries')));
  for (const kind of batteries) {
    const def = batteryDef(defaultBattery(kind));
    const row = make('button', 'picker-row');
    row.type = 'button';
    row.dataset.board = `battery-${kind}`;
    row.append(make('span', undefined, t(`battery.kind.${kind}`)));
    if (kind !== 'pack') row.append(make('span', 'picker-size', `⌀${CELLS[kind].d} × ${CELLS[kind].l}`));
    row.addEventListener('click', () => onPick(def));
    root.append(row);
  }
}
