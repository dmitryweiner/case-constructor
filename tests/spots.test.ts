// Where a message points on the model (plans/PLAN-IMPROVEMENTS-2026-10-27.md
// U3): the red boxes and the badge of each warning that has a place.

import { readFileSync } from 'node:fs';
import { caseLayout, collisions } from '../src/geo/layout';
import { cutWarnings, outerTopAt, portCutters } from '../src/geo/ports';
import { effectiveLid } from '../src/geo/layout';
import type { Message, SpotBox } from '../src/geo/message';
import { defaultState, sanitizeState } from '../src/state/schema';
import type { AppState } from '../src/state/schema';
import { extraCutters } from '../src/geo/cutters';

const file: unknown = JSON.parse(readFileSync(new URL('./fixtures/korpus-1.json', import.meta.url), 'utf8'));
const user = sanitizeState(Reflect.get(file ?? {}, 'state'));

function inside(box: SpotBox, p: readonly number[], eps = 1e-6): boolean {
  return [0, 1, 2].every((k) => p[k] >= box.min[k] - eps && p[k] <= box.max[k] + eps);
}

function byCode(messages: Message[], code: string): Message[] {
  return messages.filter((m) => m.code === code);
}

function cutMessages(state: AppState): Message[] {
  const layout = caseLayout(state);
  const shape = { ...state.shape, console: layout.console };
  const top = outerTopAt(shape, layout.dims, layout.console.frontH, layout.console.backH);
  const cutters = [...portCutters(layout, shape), ...extraCutters(state.extraCuts, shape, layout.dims, top)];
  return cutWarnings(layout, shape, effectiveLid(shape, state.lid, layout.dims), cutters, state.extraCuts);
}

describe('message spots', () => {
  const layout = caseLayout(user);
  const messages = collisions(layout);

  it('a board off its wall: the strip between its edge and the wall it asked for, moving with the board', () => {
    const [first] = byCode(messages, 'warn.notAgainstWall');
    const board = layout.boards[0];
    expect(first.spot?.holder).toEqual({ board: 0 });
    const [box] = first.spot?.boxes ?? [];
    expect(box.min[0]).toBeCloseTo(board.outline.x1, 6);
    expect(box.max[0]).toBeCloseTo(layout.dims.w - user.shape.wall, 6);
    expect(box.min[1]).toBeCloseTo(board.outline.y0, 6);
    expect(box.max[1]).toBeCloseTo(board.outline.y1, 6);
    expect(inside(box, first.spot?.at ?? [])).toBe(true);
  });

  it('recessed connectors: a box per wall, from the connectors to the outer surface', () => {
    const [note] = byCode(messages, 'info.portsRecessed');
    const boxes = note.spot?.boxes ?? [];
    expect(boxes).toHaveLength(2);
    const [front, back] = boxes;
    expect(front.min[1]).toBeCloseTo(0, 6);
    expect(back.max[1]).toBeCloseTo(layout.dims.d, 6);
    // the TPA3118's front button at along 13, its jack on the back at 26.5
    expect(inside(front, [13, 1, front.min[2] + 0.1])).toBe(true);
    expect(inside(back, [26.5, layout.dims.d - 1, back.min[2] + 0.1])).toBe(true);
  });

  it('boards overlapping: the shared volume', () => {
    const base = defaultState();
    const state = sanitizeState({ ...base, boards: [base.boards[0], { ...base.boards[0], x: 20 }] });
    const shared = caseLayout(state);
    const [overlap] = byCode(collisions(shared), 'warn.boardsOverlap');
    const [box] = overlap.spot?.boxes ?? [];
    const [a, b] = shared.boards;
    expect(box.min[0]).toBeCloseTo(Math.max(a.outline.x0, b.outline.x0), 6);
    expect(box.max[0]).toBeCloseTo(Math.min(a.outline.x1, b.outline.x1), 6);
    expect(box.max[2]).toBeCloseTo(Math.min(a.zTop, b.zTop), 6);
  });

  it('a port far from its wall: its connector and the way to the wall', () => {
    const base = defaultState();
    const state = sanitizeState({ ...base, shape: { ...base.shape, auto: false, size: { w: 160, d: 120, h: 40 } } });
    const [far] = byCode(cutMessages(state), 'warn.portFar');
    expect(far.spot?.holder).toEqual({ board: 0 });
    const [box] = far.spot?.boxes ?? [];
    const dims = caseLayout(state).dims;
    // it reaches a wall of the case
    expect(Math.min(box.min[0], box.min[1], dims.w - box.max[0], dims.d - box.max[1])).toBeLessThan(state.shape.wall + 1e-6);
  });

  it('every spot of the user\'s project is inside the case', () => {
    const all = [...messages, ...cutMessages(user)].filter((m) => m.spot);
    expect(all.length).toBeGreaterThanOrEqual(5);
    for (const m of all) {
      for (const box of m.spot?.boxes ?? []) {
        for (let k = 0; k < 3; k++) {
          expect(box.min[k], m.code).toBeGreaterThanOrEqual(-1e-6);
          expect(box.max[k], m.code).toBeLessThanOrEqual([layout.dims.w, layout.dims.d, layout.dims.h][k] + 1e-6);
          expect(box.max[k], m.code).toBeGreaterThan(box.min[k]);
        }
      }
    }
  });
});
