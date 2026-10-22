// Interface language: dictionaries, detection, templates — and the guard
// against untranslated text. The first hint written past the dictionary
// would silently stay English in the Russian interface; it is caught here.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DICTS, LANGS, PLURAL_ORDER, detectLang, format, hasKey, placeholders } from '../src/i18n';
import type { Key } from '../src/i18n';
import { PRESETS } from '../src/state/presets';
import { FACES } from '../src/geo/face';
import { SHAPE_KINDS } from '../src/geo/shape';
import { FASTENINGS } from '../src/geo/lidSpec';

const KEYS = Object.keys(DICTS.en).filter(hasKey);
const FOREIGN = /[А-Яа-яЁёЇїІіЄєҐґ֐-׿]/;

describe('dictionaries', () => {
  it('every language has exactly the keys of English', () => {
    for (const lang of LANGS) expect(Object.keys(DICTS[lang]).sort(), lang).toEqual([...KEYS].sort());
  });

  it('no empty strings', () => {
    for (const lang of LANGS) {
      for (const key of KEYS) expect(DICTS[lang][key].trim().length, `${lang}:${key}`).toBeGreaterThan(0);
    }
  });

  it('English has no Cyrillic or Hebrew', () => {
    for (const key of KEYS) expect(DICTS.en[key], key).not.toMatch(FOREIGN);
  });

  it('every language uses the same template parameters', () => {
    for (const lang of LANGS) {
      for (const key of KEYS) {
        expect([...new Set(placeholders(DICTS[lang][key]))], `${lang}:${key}`)
          .toEqual([...new Set(placeholders(DICTS.en[key]))]);
      }
    }
  });

  it('plural forms: as many as the language has categories for whole numbers', () => {
    const forms = (template: string): number[] =>
      [...template.matchAll(/\{\w+\|([^}]*)\}/g)].map((match) => match[1].split('|').length);
    for (const lang of LANGS) {
      for (const key of KEYS) {
        for (const count of forms(DICTS[lang][key])) expect(count, `${lang}:${key}`).toBe(PLURAL_ORDER[lang].length);
      }
    }
  });

  it('PLURAL_ORDER covers every category Intl gives a whole number', () => {
    for (const lang of LANGS) {
      const rules = new Intl.PluralRules(lang);
      for (let n = 0; n <= 1000; n++) expect(PLURAL_ORDER[lang], `${lang}:${n}`).toContain(rules.select(n));
      const known = rules.resolvedOptions().pluralCategories;
      for (const category of PLURAL_ORDER[lang]) expect(known, lang).toContain(category);
    }
  });

  it('a built-in preset has one name in every language, and a translated note', () => {
    const names = PRESETS.map((preset) => preset.name);
    for (const name of names) expect(name.trim()).not.toBe('');
    expect(new Set(names).size).toBe(names.length);
    for (const preset of PRESETS) expect(hasKey(`preset.${preset.id}`), preset.id).toBe(false);
  });

  it('every built-in preset note, face, shape and fastening has a label', () => {
    const needed: string[] = [
      ...PRESETS.map((preset) => `preset.${preset.id}.note`),
      ...FACES.map((face) => `face.${face}`),
      ...SHAPE_KINDS.map((kind) => `shape.${kind}`),
      ...FASTENINGS.map((kind) => `fastening.${kind}`),
    ];
    for (const key of needed) expect(hasKey(key), key).toBe(true);
  });
});

describe('detectLang', () => {
  it('picks the first supported language of the browser list, English otherwise', () => {
    expect(detectLang(['ru-RU', 'en-US'], null)).toBe('ru');
    expect(detectLang(['uk-UA'], null)).toBe('uk');
    expect(detectLang(['he-IL'], null)).toBe('he');
    expect(detectLang(['iw'], null)).toBe('he');
    expect(detectLang(['de-DE', 'uk', 'en'], null)).toBe('uk');
    expect(detectLang(['be', 'kk'], null)).toBe('en');
    expect(detectLang([], null)).toBe('en');
  });

  it('a stored choice beats the browser, garbage in storage does not', () => {
    expect(detectLang(['ru-RU'], 'he')).toBe('he');
    expect(detectLang(['ru-RU'], 'klingon')).toBe('ru');
    expect(detectLang(['en-US'], 42)).toBe('en');
  });
});

describe('format', () => {
  it('substitutes parameters and leaves unknown ones', () => {
    expect(format('{w} × {h} mm', { w: 120, h: '90' }, 'en')).toBe('120 × 90 mm');
    expect(format('{a} and {b}', { a: 1 }, 'en')).toBe('1 and {b}');
  });

  it('plurals in every language', () => {
    const word = (template: string, n: number, lang: 'en' | 'ru' | 'uk' | 'he'): string => format(template, { n }, lang);
    expect(word('{n|part|parts}', 1, 'en')).toBe('part');
    expect(word('{n|part|parts}', 2, 'en')).toBe('parts');
    expect(word('{n|a|b|c}', 1, 'ru')).toBe('a');
    expect(word('{n|a|b|c}', 3, 'ru')).toBe('b');
    expect(word('{n|a|b|c}', 11, 'ru')).toBe('c');
    expect(word('{n|a|b|c}', 21, 'uk')).toBe('a');
    expect(word('{n|a|b|c}', 1, 'he')).toBe('a');
    expect(word('{n|a|b|c}', 2, 'he')).toBe('b');
    expect(word('{n|a|b|c}', 7, 'he')).toBe('c');
  });
});

describe('guard: visible text only through the dictionaries', () => {
  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? files(path) : [path];
    });
  }
  const sources = files('src').filter((path) => /\.(ts|css)$/.test(path) && !path.startsWith(join('src', 'i18n')));

  it('no Cyrillic or Hebrew in string literals outside src/i18n', () => {
    for (const path of sources) {
      const text = readFileSync(path, 'utf8');
      for (const match of text.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)) {
        expect(match[2], `${path}: ${match[0]}`).not.toMatch(FOREIGN);
      }
    }
  });

  it('a key used as a typed literal exists (spot check)', () => {
    const key: Key = 'panel.case';
    expect(hasKey(key)).toBe(true);
  });
});
