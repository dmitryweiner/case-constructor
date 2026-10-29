// Adds keys to all four dictionaries at once, each after an anchor key that
// is already there — the dictionaries keep one order, so a new key lands at
// the same place in each.
//
//   node scripts/i18n.mjs --file keys.json
//
// keys.json: [{ "after": "shape.console", "key": "shape.hinged",
//               "en": "Hinged", "ru": "…", "uk": "…", "he": "…" }, …]
// Entries are inserted in order, so the next one may name the previous key
// as its anchor. A key already present is replaced in place. Values are
// written as single-quoted literals (double quotes when the text has an
// apostrophe), like the rest of the files.

import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from './lib/harness.mjs';

const LANGS = ['en', 'ru', 'uk', 'he'];
const flags = parseArgs(process.argv.slice(2), ['file']);
const file = flags.get('file');
if (!file) {
  console.error('usage: node scripts/i18n.mjs --file keys.json');
  process.exit(2);
}
const entries = JSON.parse(readFileSync(file, 'utf8'));

const literal = (text) => (text.includes("'") ? JSON.stringify(text) : `'${text.replaceAll('\\', '\\\\')}'`);
const lineOf = (key) => new RegExp(`^  '${key.replaceAll('.', '\\.')}': .*$`, 'm');

let failed = false;
for (const lang of LANGS) {
  const path = `src/i18n/${lang}.ts`;
  let text = readFileSync(path, 'utf8');
  for (const entry of entries) {
    const value = entry[lang];
    if (typeof value !== 'string') {
      console.error(`${entry.key}: no ${lang} text`);
      failed = true;
      continue;
    }
    const line = `  '${entry.key}': ${literal(value)},`;
    if (lineOf(entry.key).test(text)) {
      text = text.replace(lineOf(entry.key), line);
      continue;
    }
    const anchor = text.match(lineOf(entry.after));
    if (!anchor || anchor.index === undefined) {
      console.error(`${lang}: no anchor ${entry.after} for ${entry.key}`);
      failed = true;
      continue;
    }
    // the anchor's value may run over several lines: insert after its closing comma
    const end = text.indexOf(',\n', anchor.index) + 2;
    text = `${text.slice(0, end)}${line}\n${text.slice(end)}`;
  }
  writeFileSync(path, text);
}
console.log(`${entries.length} keys × ${LANGS.length} dictionaries`);
process.exit(failed ? 1 : 0);
