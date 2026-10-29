import { decodePresetFile, encodePresetFile, presetFileName } from '../src/state/presetFile';
import { nextPresetNumber, parseUserPresets } from '../src/state/userPresets';
import { defaultState, sanitizeState } from '../src/state/schema';
import { PRESETS, presetById } from '../src/state/presets';
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
    expect(decoded).toEqual({ name: 'My case', state });
  });

  it('takes a bare state too, and sanitizes it', () => {
    const decoded = decodePresetFile(JSON.stringify({ shape: { kind: 'console', wall: 99 } }));
    expect(decoded?.state.shape.kind).toBe('console');
    expect(decoded?.state.shape.wall).toBe(6);
  });

  it('refuses anything else instead of resetting the work', () => {
    for (const text of ['', 'not json', '[]', '42', '{"hello":"world"}', '{"app":"clayform","state":{}}',
      '{"app":"case-constructor","state":null}']) {
      expect(decodePresetFile(text), text).toBeNull();
    }
  });

  it('file names are safe', () => {
    expect(presetFileName('Pi 4: desk/case')).toBe('case-constructor-Pi-4-desk-case.json');
    expect(presetFileName('   ')).toBe('case-constructor-preset.json');
  });
});

describe('user presets', () => {
  it('garbage in storage gives an empty or cleaned list, never a throw', () => {
    expect(parseUserPresets('nope')).toEqual([]);
    expect(parseUserPresets('{}')).toEqual([]);
    const list = parseUserPresets(JSON.stringify([{ name: 'a', state: { shape: { wall: -1 } } }, { name: '' }, 5]));
    expect(list).toHaveLength(1);
    expect(list[0].state.shape.wall).toBe(1.2);
  });

  it('auto-names count across all language prefixes', () => {
    const presets = [
      { name: 'Case 2', state: defaultState() },
      { name: 'Корпус 5', state: defaultState() },
      { name: 'Case x', state: defaultState() },
    ];
    expect(nextPresetNumber(presets, ['Case', 'Корпус'])).toBe(6);
    expect(nextPresetNumber([], ['Case'])).toBe(1);
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
    const files = readdirSync(dir).filter((name) => name.endsWith('.json')).sort();
    expect(files).toEqual(PRESETS.map((preset) => `${preset.id}.json`).sort());
    for (const name of files) {
      const file: unknown = JSON.parse(readFileSync(join(dir, name), 'utf8'));
      const state: unknown = typeof file === 'object' && file !== null ? Reflect.get(file, 'state') : null;
      // the sanitizer drops a key it does not know: a typo in a hand-edited file would vanish silently
      const built = new Set(keyPaths(presetById(name.replace(/\.json$/, ''))?.build()));
      expect(keyPaths(state).filter((path) => !built.has(path)), name).toEqual([]);
    }
  });
});
