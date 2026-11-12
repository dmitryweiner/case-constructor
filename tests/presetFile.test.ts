import { decodePresetFile, encodePresetFile, presetFileName } from '../src/state/presetFile';
import { nextPresetName } from 'maker-kit/core/presets';
import { autoPresetPrefixes } from '../src/i18n';
import { defaultState, sanitizeState } from '../src/state/schema';
import { PRESETS, presetById, presetSignature } from '../src/state/presets';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Every key path in `value` (list items by index), dotted. */
function keyPaths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, item]) => [`${prefix}${key}`, ...keyPaths(item, `${prefix}${key}.`)]);
}

describe('project file', () => {
  it('round-trips the state and the name', () => {
    const state = sanitizeState({ shape: { kind: 'cylinder', wall: 3 }, lid: { face: 'bottom', depth: 4 } });
    const decoded = decodePresetFile(encodePresetFile('My case', state, new Date(0)));
    expect(decoded).toEqual({ ok: true, name: 'My case', state });
  });

  it('is the wrapper maker-kit writes, with this app and version 1', () => {
    expect(JSON.parse(encodePresetFile('x', defaultState(), new Date(0)))).toEqual({
      app: 'case-constructor',
      version: 1,
      name: 'x',
      savedAt: '1970-01-01T00:00:00.000Z',
      state: defaultState(),
    });
  });

  it('takes a bare state too, and sanitizes it', () => {
    const decoded = decodePresetFile(JSON.stringify({ shape: { kind: 'console', wall: 99 } }));
    expect(decoded.ok && decoded.state.shape.kind).toBe('console');
    expect(decoded.ok && decoded.state.shape.wall).toBe(6);
  });

  it('refuses anything else with the reason, instead of resetting the work', () => {
    for (const [text, reason] of [
      ['', 'broken'],
      ['not json', 'broken'],
      ['[]', 'foreign'],
      ['42', 'foreign'],
      ['{"hello":"world"}', 'foreign'],
      ['{"app":"clayform","state":{}}', 'foreign'],
      ['{"app":"case-constructor","version":1,"state":null}', 'broken'],
      ['{"app":"case-constructor","version":2,"state":{}}', 'newer'],
    ]) {
      expect(decodePresetFile(text), text).toEqual({ ok: false, reason });
    }
  });

  it('file names are safe', () => {
    expect(presetFileName('Pi 4: desk/case')).toBe('case-constructor-pi-4-desk-case.json');
    expect(presetFileName('Корпус 2')).toBe('case-constructor-корпус-2.json');
    expect(presetFileName('   ')).toBe('case-constructor-preset.json');
  });
});

describe('user presets', () => {
  it("auto-names count across every language's prefix", () => {
    const presets = [{ name: 'Case 2' }, { name: 'Корпус 5' }, { name: 'מארז 3' }, { name: 'Case x' }];
    expect(nextPresetName(presets, autoPresetPrefixes(), 'Case')).toBe('Case 6');
    expect(nextPresetName([], autoPresetPrefixes(), 'Корпус')).toBe('Корпус 1');
  });
});

describe('built-in presets', () => {
  it('every preset builds a sanitized state and is found by id', () => {
    for (const preset of PRESETS) {
      const state = preset.build();
      expect(sanitizeState(state)).toEqual(state);
      expect(presetById(preset.id)).toBe(preset);
    }
  });

  it('every file in src/state/presets is a preset, named after its id, with no stray keys', () => {
    const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'state', 'presets');
    const files = readdirSync(dir)
      .filter((name) => name.endsWith('.json'))
      .sort();
    expect(files).toEqual(PRESETS.map((preset) => `${preset.id}.json`).sort());
    for (const name of files) {
      const file: unknown = JSON.parse(readFileSync(join(dir, name), 'utf8'));
      const state: unknown = typeof file === 'object' && file !== null ? Reflect.get(file, 'state') : null;
      // the sanitizer drops a key it does not know: a typo in a hand-edited file would vanish silently
      const built = new Set(keyPaths(presetById(name.replace(/\.json$/, ''))?.build()));
      expect(
        keyPaths(state).filter((path) => !built.has(path)),
        name,
      ).toEqual([]);
    }
  });
});

describe('whether the project still is the open preset', () => {
  const preset = PRESETS[0].build();

  it('is the preset as opened, and again through storage', () => {
    expect(presetSignature(sanitizeState(preset))).toBe(presetSignature(PRESETS[0].build()));
    expect(presetSignature(sanitizeState(JSON.parse(JSON.stringify(preset))))).toBe(presetSignature(preset));
  });

  it('is no longer the preset once a parameter changes', () => {
    const changed = sanitizeState({ ...preset, shape: { ...preset.shape, wall: preset.shape.wall + 0.5 } });
    expect(presetSignature(changed)).not.toBe(presetSignature(preset));
  });

  it('still is the preset when only the view or the export changes', () => {
    const viewed = sanitizeState({ ...preset, exportMode: 'lid', resolution: 64, print: { lid: 'behind', gap: 20 } });
    expect(presetSignature(viewed)).toBe(presetSignature(preset));
  });
});
