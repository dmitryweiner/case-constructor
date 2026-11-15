// Adds keys to all four dictionaries at once, each after an anchor key that
// is already there — the dictionaries keep one order, so a new key lands at
// the same place in each. `--remove` takes keys out of all four (a value
// over several lines included): the strings a maker-kit piece now says.
//
//   node scripts/i18n.mjs --file keys.json
//   node scripts/i18n.mjs --remove storage.dismiss,presets.mine
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
const flags = parseArgs(process.argv.slice(2), ['file', 'remove']);
const file = flags.get('file');
const removed = flags.get('remove')?.split(',').filter(Boolean) ?? [];
if (!file && removed.length === 0) {
  console.error('usage: node scripts/i18n.mjs --file keys.json | --remove key,key');
  process.exit(2);
}
const entries = file ? JSON.parse(readFileSync(file, 'utf8')) : [];

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
  for (const key of removed) {
    const start = text.indexOf(`\n  '${key}':`);
    if (start < 0) {
      console.error(`${lang}: no ${key} to remove`);
      failed = true;
      continue;
    }
    // the value is one literal, on this line or the next: it ends at the first comma that ends a line
    text = text.slice(0, start + 1) + text.slice(text.indexOf(',\n', start) + 2);
  }
  writeFileSync(path, text);
}
console.log(`${entries.length} keys added, ${removed.length} removed × ${LANGS.length} dictionaries`);
process.exit(failed ? 1 : 0);
