// Interface language. A tiny binding instead of a library: tsc checks the
// keys (`Key` comes from the English reference dictionary, the others must
// repeat it key for key), and substitutions and plurals fit in one regexp.
//
// Template: `{name}` substitutes a parameter; `{n|form|form…}` picks a word
// by the number n, the forms in the order of the language's plural
// categories (PLURAL_ORDER).
//
// The language lives here, not in AppState: it never goes into a preset
// file — whoever opens someone else's file sees it in their own language.

import { en } from './en';
import { ru } from './ru';
import { uk } from './uk';
import { he } from './he';
import type { Message } from '../geo/message';

export type Lang = 'en' | 'ru' | 'uk' | 'he';
export const LANGS: readonly Lang[] = ['en', 'ru', 'uk', 'he'];
export type Key = keyof typeof en;
export type Params = Readonly<Record<string, string | number>>;

export const DICTS: Readonly<Record<Lang, Readonly<Record<Key, string>>>> = { en, ru, uk, he };

/** The language's own name, for the picker. */
export const ENDONYMS: Readonly<Record<Lang, string>> = {
  en: 'English',
  ru: 'Русский',
  uk: 'Українська',
  he: 'עברית',
};

/** localStorage key: a manual choice beats the browser settings. */
export const LANG_KEY = 'caseconstructor_lang';

/**
 * Order of the forms in `{n|…}`: the plural categories the language uses for
 * whole numbers (fractions are never counted here).
 */
export const PLURAL_ORDER: Readonly<Record<Lang, readonly Intl.LDMLPluralRule[]>> = {
  en: ['one', 'other'],
  ru: ['one', 'few', 'many'],
  uk: ['one', 'few', 'many'],
  he: ['one', 'two', 'other'],
};

let current: Lang = 'en';
const listeners = new Set<(lang: Lang) => void>();

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && LANGS.some((lang) => lang === value);
}

/**
 * The language from the stored choice, else from the browser: the first
 * language of the list that has a dictionary (`iw` is the old code of
 * Hebrew). Nothing found — English.
 */
export function detectLang(languages: readonly string[], stored: unknown): Lang {
  if (isLang(stored)) return stored;
  for (const tag of languages) {
    const primary = tag.toLowerCase().split(/[-_]/)[0];
    const code = primary === 'iw' ? 'he' : primary;
    if (isLang(code)) return code;
  }
  return 'en';
}

/** Picks the language at startup. Storage may be unavailable — then the browser alone. */
export function initLang(): Lang {
  const languages = navigator.languages.length > 0 ? navigator.languages : [navigator.language];
  current = detectLang(languages, storedLang());
  return current;
}

function storedLang(): string | null {
  try {
    return localStorage.getItem(LANG_KEY);
  } catch {
    return null;
  }
}

export function lang(): Lang {
  return current;
}

/** Sets the language, remembers the choice and calls the listeners. */
export function setLang(next: Lang): void {
  try {
    localStorage.setItem(LANG_KEY, next);
  } catch {
    // private mode: the choice lives until reload
  }
  if (next === current) return;
  current = next;
  for (const listener of listeners) listener(next);
}

export function onLangChange(listener: (lang: Lang) => void): void {
  listeners.add(listener);
}

export function t(key: Key, params?: Params): string {
  return format(DICTS[current][key], params, current);
}

export function hasKey(key: string): key is Key {
  return Object.hasOwn(en, key);
}

/** A key built on the fly (`face.top`): an unknown one is shown as is. */
export function tDynamic(key: string, params?: Params): string {
  return hasKey(key) ? t(key, params) : key;
}

/** A message from the core: a code plus parameters. */
export function tm(message: Message): string {
  return t(message.code, message.params && messageParams(message.params));
}

/**
 * The core's parameters in words: a board number with its `<key>Name` as
 * "1 “TPA3118”", a port with its `portType` as "LED · led-1", `walls` (a
 * comma list of faces) as "front and back", `side` as a face name.
 */
function messageParams(params: Params): Params {
  const out: Record<string, string | number> = { ...params };
  for (const [key, value] of Object.entries(params)) {
    const name = params[`${key}Name`];
    if (typeof name === 'string' && typeof value === 'number') out[key] = t('msg.board', { n: value, name });
  }
  const { port, portType, walls, side } = params;
  if (typeof port === 'string' && typeof portType === 'string') out.port = `${tDynamic(`port.${portType}`)} · ${port}`;
  if (typeof walls === 'string') {
    out.walls = new Intl.ListFormat(current, { type: 'conjunction' }).format(walls.split(',').map((face) => tDynamic(`face.${face}`)));
  }
  if (typeof side === 'string') out.side = tDynamic(`face.${side}`);
  return out;
}

/** Auto-name prefixes of presets in every language: the numbering is shared. */
export function autoPresetPrefixes(): string[] {
  return LANGS.map((language) => DICTS[language]['presets.auto'].replace(/\s*\{n\}\s*/, ''));
}

const PLACEHOLDER = /\{(\w+)(?:\|([^}]*))?\}/g;

export function format(template: string, params: Params | undefined, language: Lang): string {
  return template.replace(PLACEHOLDER, (whole, name: string, forms: string | undefined) => {
    const value = params?.[name];
    if (value === undefined) return whole;
    if (forms === undefined) return String(value);
    const variants = forms.split('|');
    const category = new Intl.PluralRules(language).select(Number(value));
    const index = PLURAL_ORDER[language].indexOf(category);
    return variants[index >= 0 ? index : variants.length - 1] ?? whole;
  });
}

/** Parameter names of a template — for the test that every language has the same. */
export function placeholders(template: string): string[] {
  return [...template.matchAll(PLACEHOLDER)].map((match) => match[1]).sort();
}
