import { storageNotes } from '../src/ui/storageNote';

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
