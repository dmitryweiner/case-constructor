// @vitest-environment jsdom
// The box list over maker-kit's list card: a row per item with ✕, a body per
// item that stays the same node while the item is there (a field keeps its
// focus), filled again only when the list's layout changes.

import { renderBoxList } from '../src/ui/boxList';
import type { BoxListOptions } from '../src/ui/boxList';
import { addCut } from '../src/ui/cutsCard';
import { PRESETS } from '../src/state/presets';
import type { AppState } from '../src/state/schema';

const withCuts = (n: number): AppState => {
  let state: AppState = { ...PRESETS[0].build(), extraCuts: [] };
  for (let i = 0; i < n; i++) state = addCut(state);
  return state;
};

/** A list whose bodies hold a text field each; `fills` counts how often a body was filled. */
function setup(initial: AppState, more: Partial<BoxListOptions> = {}) {
  let state = initial;
  const list = document.createElement('ul');
  document.body.replaceChildren(list);
  const fills: number[] = [];
  const changes: AppState[] = [];
  const handle = renderBoxList(list, {
    idPrefix: 'cut',
    read: () => state,
    onChange: (next) => changes.push(next),
    count: (s) => s.extraCuts.length,
    title: (_s, index) => `Opening ${index + 1}`,
    fill: (body, index) => {
      fills.push(index);
      const field = document.createElement('input');
      field.id = `cut${index}_text`;
      body.append(field);
      return { sync: () => undefined };
    },
    remove: (s, index) => ({ ...s, extraCuts: s.extraCuts.filter((_, i) => i !== index) }),
    ...more,
  });
  const sync = (next: AppState): void => {
    state = next;
    handle.sync(next);
  };
  return { list, fills, changes, sync };
}

describe('renderBoxList', () => {
  it('draws a row per item, its title and ✕, the body under the head', () => {
    const { list } = setup(withCuts(2));
    expect([...list.children].map((row) => row.id)).toEqual(['cut_0', 'cut_1']);
    expect(list.querySelector('#cut_1 .item-title')?.textContent).toBe('Opening 2');
    expect(list.querySelector('#cut_1 #cut1_text')).not.toBeNull();
    expect(list.querySelector('#cut_0_remove')?.getAttribute('aria-label')).toBe('Delete: Opening 1');
  });

  it('✕ removes its item through onChange', () => {
    const { list, changes } = setup(withCuts(3));
    list.querySelector<HTMLButtonElement>('#cut_1_remove')?.click();
    expect(changes).toHaveLength(1);
    expect(changes[0]?.extraCuts).toHaveLength(2);
  });

  it('keeps the bodies and a field its focus while the list stays the same', () => {
    const state = withCuts(2);
    const { list, fills, sync } = setup(state);
    const field = list.querySelector<HTMLInputElement>('#cut1_text');
    field?.focus();
    sync({ ...state, extraCuts: state.extraCuts.map((cut) => ({ ...cut, x: cut.x + 1 })) });
    expect(fills).toEqual([0, 1]);
    expect(list.querySelector('#cut1_text')).toBe(field);
    expect(document.activeElement).toBe(field);
  });

  it('fills the bodies again when an item comes or goes, the rows after it renamed', () => {
    const { list, fills, sync } = setup(withCuts(1));
    const body = list.querySelector('#cut_0 .item-body');
    sync(withCuts(2));
    expect(fills).toEqual([0, 0, 1]);
    expect([...list.children].map((row) => row.id)).toEqual(['cut_0', 'cut_1']);
    // the first item's body is the same node, filled anew
    expect(list.querySelector('#cut_0 .item-body')).toBe(body);
  });

  it('fills the bodies again in place when the signature changes, the rows kept', () => {
    let kind = 'a';
    const { list, fills, sync } = setup(withCuts(1), { signature: () => kind });
    const row = list.querySelector('#cut_0');
    kind = 'b';
    sync(withCuts(1));
    expect(fills).toEqual([0, 0]);
    expect(list.querySelector('#cut_0')).toBe(row);
    expect(list.querySelectorAll('#cut_0 input')).toHaveLength(1);
  });

  it('puts a hint after the name, its tooltip on it', () => {
    const { list } = setup(withCuts(1), { hint: () => ({ text: '≈', title: 'Not checked' }) });
    const hint = list.querySelector<HTMLElement>('#cut_0 .item-hint');
    expect(hint?.textContent).toBe('≈');
    expect(hint?.title).toBe('Not checked');
  });

  it('a new list on the same element (a language switch) shows its own bodies', () => {
    const state = withCuts(1);
    const { list } = setup(state);
    const old = list.querySelector('#cut0_text');
    renderBoxList(list, {
      idPrefix: 'cut',
      read: () => state,
      onChange: () => undefined,
      count: (s) => s.extraCuts.length,
      title: (_s, index) => `Opening ${index + 1}`,
      fill: (body) => {
        body.append(document.createElement('textarea'));
        return { sync: () => undefined };
      },
      remove: (s) => s,
    });
    expect(list.querySelector('#cut0_text')).toBeNull();
    expect(old?.isConnected).toBe(false);
    expect(list.querySelectorAll('#cut_0 textarea')).toHaveLength(1);
  });
});
