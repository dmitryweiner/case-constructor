// A collapsible card: a click on the header folds the body. Whether its
// feature is on is said by the controls inside (the vents' faces pressed, a
// face for the fan), not by a checkbox; a card off starts folded, and one
// turned on from outside (a preset, a file) unfolds — the panel does not
// swell with unused parameters, and nothing folds under the user's hand.

import { make } from './dom';
import type { Key } from '../i18n';
import { t } from '../i18n';

export interface CardOptions {
  id: string;
  title: Key;
  /** a short tag right of the title */
  tag?: Key;
  desc?: Key;
  enabled: boolean;
}

export interface CardHandle {
  /**
   * Container for the controls. Separate from the description: renderControls
   * clears its container, and a shared one would wipe the description on the
   * first render.
   */
  body: HTMLElement;
  setEnabled(on: boolean): void;
}

export function createCard(container: HTMLElement, options: CardOptions): CardHandle {
  const card = make('section', 'fcard');
  card.id = `card_${options.id}`;

  const head = make('div', 'fcard-head');
  const title = make('span', 'fcard-title', t(options.title));
  const caret = make('span', 'fcard-caret', options.enabled ? '▾' : '▸');
  head.append(title);
  if (options.tag) head.append(make('span', 'fcard-tag', t(options.tag)));
  head.append(caret);

  const body = make('div', 'fcard-body');
  if (options.desc) body.append(make('p', 'fcard-desc', t(options.desc)));
  const controls = make('div');
  body.append(controls);

  showCollapsed(card, !options.enabled);
  head.addEventListener('click', () => showCollapsed(card, !card.classList.contains('collapsed')));

  card.append(head, body);
  container.append(card);

  let lastEnabled = options.enabled;
  return {
    body: controls,
    setEnabled(on: boolean): void {
      card.classList.toggle('on', on);
      // unfold when it turns on; never fold: turning it off happens inside the open card
      if (on && !lastEnabled) showCollapsed(card, false);
      lastEnabled = on;
    },
  };
}

function showCollapsed(card: Element, collapsed: boolean): void {
  card.classList.toggle('collapsed', collapsed);
  const caret = card.querySelector('.fcard-caret');
  if (caret) caret.textContent = collapsed ? '▸' : '▾';
}

/**
 * Which cards are folded — kept across a panel re-render (language switch):
 * a re-render would otherwise collapse a card unfolded by hand.
 */
export function snapshotCards(root: ParentNode): Map<string, boolean> {
  const collapsed = new Map<string, boolean>();
  for (const card of root.querySelectorAll('.fcard')) {
    collapsed.set(card.id, card.classList.contains('collapsed'));
  }
  return collapsed;
}

export function restoreCards(root: ParentNode, collapsed: Map<string, boolean>): void {
  for (const card of root.querySelectorAll('.fcard')) {
    const value = collapsed.get(card.id);
    if (value !== undefined) showCollapsed(card, value);
  }
}
