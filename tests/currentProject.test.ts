import { CURRENT_PROJECT_KEY, loadCurrentProject, saveCurrentProject } from '../src/state/currentProject';
import { defaultState } from '../src/state/schema';

/** A Map behind the two Storage methods the module uses. */
function fakeStorage(initial: Record<string, string> = {}): { getItem(key: string): string | null; setItem(key: string, value: string): void; data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

const broken = {
  getItem(): string | null {
    throw new Error('SecurityError');
  },
  setItem(): void {
    throw new Error('QuotaExceededError');
  },
};

describe('the current project in storage', () => {
  it('is null when nothing was saved', () => {
    expect(loadCurrentProject(() => fakeStorage())).toBeNull();
  });

  it('comes back as it was saved: state, name and the open preset', () => {
    const storage = fakeStorage();
    const state = { ...defaultState(), exportMode: 'lid' as const };
    expect(saveCurrentProject({ name: 'Mine', ref: 'u:Mine', state }, () => storage)).toBe(true);
    expect(storage.data.has(CURRENT_PROJECT_KEY)).toBe(true);
    expect(loadCurrentProject(() => storage)).toEqual({ name: 'Mine', ref: 'u:Mine', state });
  });

  it('passes the stored state through the sanitizer', () => {
    const raw = JSON.stringify({ version: 1, name: 'x', ref: 'b:plain-box', state: { shape: { kind: 'box', wall: 999 } } });
    const project = loadCurrentProject(() => fakeStorage({ [CURRENT_PROJECT_KEY]: raw }));
    expect(project?.state.shape.wall).toBeLessThan(999);
    expect(project?.state.shape.kind).toBe('box');
  });

  it('drops a bad name or preset reference but keeps the state', () => {
    const raw = JSON.stringify({ version: 1, name: 42, ref: 'nonsense', state: defaultState() });
    expect(loadCurrentProject(() => fakeStorage({ [CURRENT_PROJECT_KEY]: raw }))).toEqual({ name: '', ref: '', state: defaultState() });
  });

  it.each([
    ['not JSON', '{'],
    ['a list', '[]'],
    ['no state', JSON.stringify({ version: 1, name: 'x' })],
    ['a state that is not an object', JSON.stringify({ version: 1, state: 'box' })],
    ['another version', JSON.stringify({ version: 2, state: defaultState() })],
  ])('is null for %s', (_, raw) => {
    expect(loadCurrentProject(() => fakeStorage({ [CURRENT_PROJECT_KEY]: raw }))).toBeNull();
  });

  it('never throws when storage is unavailable or full', () => {
    expect(loadCurrentProject(() => broken)).toBeNull();
    expect(saveCurrentProject({ name: '', ref: '', state: defaultState() }, () => broken)).toBe(false);
    const missing = (): Storage => {
      throw new Error('localStorage is blocked');
    };
    expect(loadCurrentProject(missing)).toBeNull();
    expect(saveCurrentProject({ name: '', ref: '', state: defaultState() }, missing)).toBe(false);
  });
});
