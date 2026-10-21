// A collapsible card with a toggle: the checkbox in the header turns the
// feature on, a click on the header folds the body. A card turned off folds
// itself — the panel does not swell with unused parameters.

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
  onToggle(on: boolean): void;
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
  const toggle = make('input');
  toggle.type = 'checkbox';
  toggle.checked = options.enabled;
  toggle.id = `on_${options.id}`;
  const title = make('span', 'fcard-title', t(options.title));
  const caret = make('span', 'fcard-caret', options.enabled ? '▾' : '▸');
  head.append(toggle, title);
  if (options.tag) head.append(make('span', 'fcard-tag', t(options.tag)));
  head.append(caret);

  const body = make('div', 'fcard-body');
  if (options.desc) body.append(make('p', 'fcard-desc', t(options.desc)));
  const controls = make('div');
  body.append(controls);

  function setCollapsed(collapsed: boolean): void {
    showCollapsed(card, collapsed);
  }
  setCollapsed(!options.enabled);

  toggle.addEventListener('click', (event) => {
    event.stopPropagation(); // a click on the checkbox must not also fold the card
    setCollapsed(!toggle.checked);
    options.onToggle(toggle.checked);
  });
  head.addEventListener('click', () => setCollapsed(!card.classList.contains('collapsed')));

  card.append(head, body);
  container.append(card);

  let lastEnabled = options.enabled;
  return {
    body: controls,
    setEnabled(on: boolean): void {
      toggle.checked = on;
      // Fold only when the toggle changes. Otherwise a card unfolded by hand
      // while off would collapse on every slider move inside it.
      if (on !== lastEnabled) {
        setCollapsed(!on);
        lastEnabled = on;
      }
    },
  };
}

function showCollapsed(card: Element, collapsed: boolean): void {
  card.classList.toggle('collapsed', collapsed);
  const caret = card.querySelector('.fcard-caret');
  if (caret) caret.textContent = collapsed ? '▸' : '▾';
}

/**
 * Which cards are folded — kept across a panel re-render (language switch).
 * Folding follows the toggle by default, and a re-render would otherwise
 * collapse a card unfolded by hand.
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
