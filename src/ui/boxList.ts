// A list card whose every item is open with its own controls — the boards,
// the openings, the labels, the cables: maker-kit's ui/listCard without
// `select`, an item per index (rows `<prefix>_<i>`, ✕ `<prefix>_<i>_remove`;
// the controls inside keep their `<prefix><i>_<key>` ids). A body is the
// same node while its item is there, so a field being typed in keeps its
// focus; the bodies are filled again only when the list's layout changes
// (an item added or removed, or what `signature` names).

import { make } from 'maker-kit/ui/dom';
import { renderItemList } from 'maker-kit/ui/listCard';
import { t } from '../i18n';
import type { AppState } from '../state/schema';
import type { Change } from './controls';

export interface BoxListOptions {
  idPrefix: string;
  read: () => AppState;
  onChange: Change<AppState>;
  count(state: AppState): number;
  title(state: AppState, index: number): string;
  /** after the name, and its tooltip: an unverified board's ≈ */
  hint?(state: AppState, index: number): { text: string; title: string } | undefined;
  /** what the bodies' layout depends on besides the count; a change fills them again */
  signature?(state: AppState): string;
  /** fills an item's body for the state: its controls, and how to sync them */
  fill(body: HTMLElement, index: number, state: AppState): { sync(state: AppState): void };
  remove(state: AppState, index: number): AppState;
}

export interface BoxListHandle {
  sync(state: AppState): void;
}

export function renderBoxList(list: HTMLUListElement, o: BoxListOptions): BoxListHandle {
  const bodies: HTMLElement[] = [];
  let handles: { sync(state: AppState): void }[] = [];
  let layout: string | null = null;
  const draw = (state: AppState | null): void =>
    renderItemList(list, {
      items: state
        ? bodies.map((_, index) => {
            const hint = o.hint?.(state, index);
            return { id: String(index), title: o.title(state, index), ...(hint ? { hint: hint.text } : {}) };
          })
        : [],
      body: (id) => bodies[Number(id)] ?? null,
      t,
      idPrefix: o.idPrefix,
      remove: (id) => o.onChange(o.remove(o.read(), Number(id))),
    });
  // the kit's list draws only what changed, and these bodies are new: start from an empty one
  draw(null);

  function sync(state: AppState): void {
    const count = o.count(state);
    const next = `${count}|${o.signature?.(state) ?? ''}`;
    if (next !== layout) {
      layout = next;
      while (bodies.length < count) bodies.push(make('div', 'item-body'));
      bodies.length = count;
      handles = bodies.map((body, index) => {
        body.replaceChildren();
        return o.fill(body, index, state);
      });
    }
    draw(state);
    if (o.hint) {
      for (const [index, row] of [...list.children].entries()) {
        const hint = row.querySelector('.item-hint');
        if (hint instanceof HTMLElement) hint.title = o.hint(state, index)?.title ?? '';
      }
    }
    for (const handle of handles) handle.sync(state);
  }

  sync(o.read());
  return { sync };
}
