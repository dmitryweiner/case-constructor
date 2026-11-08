import { writeStorage } from '../src/state/storage';
import { storageNotes } from '../src/ui/storageNote';

const throwing = (error: unknown) => () => ({
  setItem(): void {
    throw error;
  },
});

describe('writing to browser storage', () => {
  it('is ok when the value is written', () => {
    const data = new Map<string, string>();
    expect(writeStorage(() => ({ setItem: (key: string, value: string) => void data.set(key, value) }), 'k', 'v')).toBe('ok');
    expect(data.get('k')).toBe('v');
  });

  it.each([
    ['Chrome, Safari', new DOMException('quota', 'QuotaExceededError')],
    ['Firefox', new DOMException('quota', 'NS_ERROR_DOM_QUOTA_REACHED')],
  ])('tells a full storage (%s)', (_, error) => {
    expect(writeStorage(throwing(error), 'k', 'v')).toBe('full');
  });

  it('calls any other failure blocked', () => {
    expect(writeStorage(throwing(new DOMException('no', 'SecurityError')), 'k', 'v')).toBe('blocked');
    expect(writeStorage(throwing('weird'), 'k', 'v')).toBe('blocked');
    const missing = (): Storage => {
      throw new DOMException('blocked', 'SecurityError');
    };
    expect(writeStorage(missing, 'k', 'v')).toBe('blocked');
  });
});

describe('the storage notes', () => {
  it('are empty while everything is saved', () => {
    expect(storageNotes({ project: 'ok', preset: null })).toEqual([]);
  });

  it('say why the project is not kept', () => {
    expect(storageNotes({ project: 'blocked', preset: null })).toEqual([{ key: 'storage.project.blocked', dismiss: false }]);
    expect(storageNotes({ project: 'full', preset: null })).toEqual([{ key: 'storage.project.full', dismiss: false }]);
  });

  it('add a failed preset action, which can be dismissed', () => {
    expect(storageNotes({ project: 'ok', preset: { action: 'save', result: 'full' } })).toEqual([
      { key: 'error.presetSaveFull', dismiss: true },
    ]);
    expect(storageNotes({ project: 'blocked', preset: { action: 'save', result: 'blocked' } })).toEqual([
      { key: 'storage.project.blocked', dismiss: false },
      { key: 'error.presetSave', dismiss: true },
    ]);
    expect(storageNotes({ project: 'ok', preset: { action: 'delete', result: 'blocked' } })).toEqual([
      { key: 'error.presetDelete', dismiss: true },
    ]);
  });
});
