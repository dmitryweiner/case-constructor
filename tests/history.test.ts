import { History } from '../src/state/history';

describe('History', () => {
  it('starts with nothing to undo or redo', () => {
    const history = new History({ a: 1 });
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    expect(history.undo()).toBeNull();
    expect(history.redo()).toBeNull();
  });

  it('undoes and redoes step by step', () => {
    const history = new History({ n: 0 });
    history.push({ n: 1 });
    history.push({ n: 2 });
    expect(history.undo()).toEqual({ n: 1 });
    expect(history.undo()).toEqual({ n: 0 });
    expect(history.canUndo).toBe(false);
    expect(history.redo()).toEqual({ n: 1 });
    expect(history.redo()).toEqual({ n: 2 });
    expect(history.canRedo).toBe(false);
  });

  it('a repeat of the current state is not an entry; a new push drops the future', () => {
    const history = new History({ n: 0 });
    history.push({ n: 1 });
    history.push({ n: 1 });
    expect(history.undo()).toEqual({ n: 0 });
    expect(history.canUndo).toBe(false);
    history.push({ n: 5 });
    expect(history.canRedo).toBe(false);
  });

  it('keeps at most `limit` entries', () => {
    const history = new History({ n: 0 }, 3);
    for (let n = 1; n <= 10; n++) history.push({ n });
    let steps = 0;
    while (history.undo()) steps++;
    expect(steps).toBe(3);
  });

  it('replace changes the current state without an entry', () => {
    const history = new History({ n: 0 });
    history.replace({ n: 9 });
    expect(history.value).toEqual({ n: 9 });
    expect(history.canUndo).toBe(false);
  });
});
