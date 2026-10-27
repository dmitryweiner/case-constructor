// The board picker: a search box over the catalog, grouped by vendor
// (displays, holders and batteries in groups of their own), unverified
// entries marked. A modal like the preset list.

import { make } from './dom';
import { t } from '../i18n';
import { CATALOG } from '../boards/catalog';
import type { BoardDef } from '../boards/schema';
import { BATTERY_KINDS, CELLS, batteryDef, defaultBattery } from '../boards/battery';

export function renderBoardList(root: HTMLElement, query: string, onPick: (def: BoardDef) => void): void {
  root.replaceChildren();
  const needle = query.trim().toLowerCase();
  // a holder or a display is found by its group's name too, and by the English words
  const extra = (def: BoardDef): string => (def.kind === 'holder' ? `${t('picker.holders')} battery`
    : def.kind === 'display' ? `${t('picker.displays')} display screen` : '');
  const matches = CATALOG.filter((def) => !needle
    || `${def.vendor} ${def.name} ${def.id} ${extra(def)}`.toLowerCase().includes(needle));
  // batteries: one row per kind, the count and size are set on the card
  const batteries = BATTERY_KINDS.filter((kind) => !needle
    || `${t('picker.batteries')} ${t(`battery.kind.${kind}`)} battery ${kind}`.toLowerCase().includes(needle));
  if (matches.length === 0 && batteries.length === 0) {
    root.append(make('p', 'preset-empty', t('picker.none')));
    return;
  }
  // displays, then battery holders, have a group of their own after the boards, whatever their maker;
  // displays sorted by vendor and name
  const groupOf = (def: BoardDef): string => (def.kind === 'holder' ? t('picker.holders') : def.kind === 'display' ? t('picker.displays') : def.vendor);
  const displays = matches.filter((def) => def.kind === 'display')
    .sort((a, b) => `${a.vendor} ${a.name}`.localeCompare(`${b.vendor} ${b.name}`));
  const ordered = [
    ...matches.filter((def) => def.kind !== 'holder' && def.kind !== 'display'), ...displays, ...matches.filter((def) => def.kind === 'holder'),
  ];
  const groups = [...new Set(ordered.map(groupOf))];
  for (const group of groups) {
    root.append(make('p', 'preset-group', group));
    for (const def of ordered.filter((item) => groupOf(item) === group)) {
      const vendor = def.kind === 'display' ? `${def.vendor} ` : '';
      const row = make('button', 'picker-row');
      row.type = 'button';
      row.dataset.board = def.id;
      row.append(make('span', undefined, `${vendor}${def.name}`));
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
