import { loadRecord, saveRecord } from 'maker-kit/core/storage';
import { CURRENT_PROJECT_KEY, currentProjectRecord } from '../src/state/currentProject';
import { defaultState } from '../src/state/schema';
import type { UserPreset } from 'maker-kit/core/presets';
import type { AppState } from '../src/state/schema';

/** A Map behind the Storage methods the kit uses. */
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

const record = currentProjectRecord([]);
const stored = (value: unknown): ReturnType<typeof fakeStorage> => fakeStorage({ [CURRENT_PROJECT_KEY]: JSON.stringify(value) });

describe('the current project in storage', () => {
  it('is null when nothing was saved', () => {
    expect(loadRecord(fakeStorage(), record)).toBeNull();
  });

  it('comes back as it was saved: state, name and the open preset, under its key', () => {
    const storage = fakeStorage();
    const state = { ...defaultState(), exportMode: 'lid' as const };
    expect(saveRecord(storage, record, { name: 'Mine', ref: 'u:u2', state })).toBe('ok');
    expect(JSON.parse(storage.data.get(CURRENT_PROJECT_KEY) ?? '')).toEqual({ version: 2, name: 'Mine', ref: 'u:u2', state });
    expect(loadRecord(storage, record)).toEqual({ name: 'Mine', ref: 'u:u2', state });
  });

  it('passes the stored state through the sanitizer', () => {
    const project = loadRecord(stored({ version: 2, name: 'x', ref: 'b:plain-box', state: { shape: { kind: 'box', wall: 999 } } }), record);
    expect(project?.state.shape.wall).toBeLessThan(999);
    expect(project?.state.shape.kind).toBe('box');
  });

  it('drops a bad name or preset reference but keeps the state', () => {
    expect(loadRecord(stored({ version: 2, name: 42, ref: 'nonsense', state: defaultState() }), record)).toEqual({
      name: '',
      ref: '',
      state: defaultState(),
    });
  });

  it.each([
    ['a list', []],
    ['no state', { version: 2, name: 'x' }],
    ['a state that is not an object', { version: 2, state: 'box' }],
    ['no version', { state: defaultState() }],
  ])('is null for %s', (_, value) => {
    expect(loadRecord(stored(value), record)).toBeNull();
  });

  describe('as the app before maker-kit kept it (version 1: a user preset by its name)', () => {
    const presets: UserPreset<AppState>[] = [
      { id: 'u1', name: 'Desk', state: defaultState() },
      { id: 'u2', name: 'Shelf', state: defaultState() },
    ];

    it('points at the user preset of that name by its id', () => {
      const project = loadRecord(
        stored({ version: 1, name: 'Shelf', ref: 'u:Shelf', state: defaultState() }),
        currentProjectRecord(presets),
      );
      expect(project?.ref).toBe('u:u2');
    });

    it('opens no preset when none has that name; a built-in one stays', () => {
      expect(loadRecord(stored({ version: 1, ref: 'u:Gone', state: defaultState() }), currentProjectRecord(presets))?.ref).toBe('');
      expect(loadRecord(stored({ version: 1, ref: 'b:plain-box', state: defaultState() }), currentProjectRecord(presets))?.ref).toBe(
        'b:plain-box',
      );
    });
  });
});
