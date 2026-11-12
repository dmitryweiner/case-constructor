import { loadRecord, saveRecord } from 'maker-kit/core/storage';
import { USER_PRESETS_KEY, storePreset, userPresetsRecord } from '../src/state/userPresets';
import { defaultState, sanitizeState } from '../src/state/schema';

function fakeStorage(initial: Record<string, string> = {}): {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  data: Map<string, string>;
} {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

describe('user presets in storage', () => {
  it("the app's list before maker-kit (a bare list by name) gets ids; garbage is dropped or cleaned", () => {
    const old = [{ name: 'Desk', state: { shape: { wall: -1 } } }, { name: '' }, 5, { name: 'Shelf', state: defaultState() }];
    const list = loadRecord(fakeStorage({ [USER_PRESETS_KEY]: JSON.stringify(old) }), userPresetsRecord);
    expect(list?.map(({ id, name }) => [id, name])).toEqual([
      ['u1', 'Desk'],
      ['u2', 'Shelf'],
    ]);
    expect(list?.[0]?.state.shape.wall).toBe(1.2);
  });

  it('are written with their ids under the same key and read back', () => {
    const storage = fakeStorage();
    const list = [{ id: 'u3', name: 'Desk', state: sanitizeState({ shape: { kind: 'cylinder' } }) }];
    expect(saveRecord(storage, userPresetsRecord, list)).toBe('ok');
    expect(JSON.parse(storage.data.get(USER_PRESETS_KEY) ?? '')).toEqual({ version: 1, presets: list });
    expect(loadRecord(storage, userPresetsRecord)).toEqual(list);
  });

  it('none stored, or not a list: none', () => {
    expect(loadRecord(fakeStorage(), userPresetsRecord)).toBeNull();
    expect(loadRecord(fakeStorage({ [USER_PRESETS_KEY]: '{"version":1,"presets":"x"}' }), userPresetsRecord)).toEqual([]);
  });
});

describe('saving a preset', () => {
  const desk = sanitizeState({ shape: { wall: 2 } });
  const shelf = sanitizeState({ shape: { wall: 3 } });

  it('a new name is a new preset with a fresh id', () => {
    const { list, id } = storePreset([{ id: 'u1', name: 'Desk', state: desk }], 'Shelf', shelf);
    expect(id).toBe('u2');
    expect(list.map((preset) => preset.name)).toEqual(['Desk', 'Shelf']);
  });

  it('the name of one already saved replaces its state; it keeps its id and its place', () => {
    const before = [
      { id: 'u1', name: 'Desk', state: desk },
      { id: 'u2', name: 'Shelf', state: desk },
    ];
    const { list, id } = storePreset(before, 'Desk', shelf);
    expect(id).toBe('u1');
    expect(list).toEqual([
      { id: 'u1', name: 'Desk', state: shelf },
      { id: 'u2', name: 'Shelf', state: desk },
    ]);
  });
});
