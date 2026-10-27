#!/usr/bin/env node
// Demand signals for a perspective list (plans/PERSPECTIVE-*.md, the skill
// .claude/skills/demand-research): counts from public APIs, one line per
// query, so a research agent does not write its own loop each time.
//
//   node scripts/demand.mjs github '"platform: ssd1306_i2c" extension:yaml' …   # GitHub code search total_count (gh)
//   node scripts/demand.mjs printables 'hyperpixel 4|hyperpixel' …             # Printables: total, top-N names matching the regex, their downloads
//   node scripts/demand.mjs circuitpython 'magtag|inky_frame'                   # CircuitPython downloads and rank per board id
//   node scripts/demand.mjs meshmap 'HELTEC|RAK'                                # Meshtastic nodes per hwModel (share of all)
//   node scripts/demand.mjs pypi luma.oled adafruit-circuitpython-ssd1306       # PyPI downloads last month
//
// --file <path> reads the queries from a file, one per line (# comments).
// --out <path> appends the result lines to a TSV and skips the queries it
// already holds: a run that stops (rate limit, a killed agent) resumes where
// it was. --top <n> (printables, default 60) is how many results are read.
// Large JSON (CircuitPython's files.json, meshmap's nodes.json) is cached for
// the day in drawings/demand/ (not committed).

import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from './lib/harness.mjs';

const CACHE = join('drawings', 'demand');
const VALUE_FLAGS = ['file', 'out', 'top'];

const args = process.argv.slice(2);
const flags = parseArgs(args, VALUE_FLAGS);
const positional = args.filter((a, i) => !a.startsWith('--') && !VALUE_FLAGS.includes(args[i - 1]?.slice(2)));
const [mode, ...inline] = positional;
const top = Number(flags.get('top') ?? 60);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function queries() {
  const file = flags.get('file');
  const fromFile = file
    ? readFileSync(file, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
    : [];
  return [...inline, ...fromFile];
}

/** Queries already answered in --out (the last column of each line). */
function done() {
  const out = flags.get('out');
  if (!out || !existsSync(out)) return new Set();
  return new Set(readFileSync(out, 'utf8').split('\n').filter(Boolean).map((l) => l.split('\t').at(-1)));
}

function emit(fields) {
  const line = fields.join('\t');
  console.log(line);
  const out = flags.get('out');
  if (out) appendFileSync(out, `${line}\n`);
}

async function cachedJson(name, url) {
  mkdirSync(CACHE, { recursive: true });
  const path = join(CACHE, `${new Date().toISOString().slice(0, 10)}-${name}`);
  if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8'));
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  const text = await res.text();
  writeFileSync(path, text);
  return JSON.parse(text);
}

// Code search allows 10 requests a minute: one every 6.5 s, a minute's
// pause on a rate-limit answer.
async function github() {
  const skip = done();
  for (const q of queries()) {
    if (skip.has(q)) continue;
    let count = 'error';
    for (let attempt = 0; attempt < 4; attempt++) {
      const r = spawnSync('gh', ['api', '-X', 'GET', 'search/code', '-f', `q=${q}`, '-f', 'per_page=1', '--jq', '.total_count'], { encoding: 'utf8' });
      if (r.status === 0) {
        count = r.stdout.trim();
        break;
      }
      if (!/rate limit|403|429/i.test(r.stderr)) {
        count = `error: ${r.stderr.trim().split('\n')[0]}`;
        break;
      }
      await sleep(60_000);
    }
    emit([count, q]);
    await sleep(6500);
  }
}

async function printablesSearch(query) {
  const body = JSON.stringify({
    query: 'query S($q: String!, $l: Int) { searchPrints2(query: $q, limit: $l) { totalCount items { name downloadCount } } }',
    variables: { q: query, l: top },
  });
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch('https://api.printables.com/graphql/', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json', 'Origin': 'https://www.printables.com', 'User-Agent': 'Mozilla/5.0' },
    });
    if (res.ok) return (await res.json()).data.searchPrints2;
    await sleep(20_000 * (attempt + 1));
  }
  throw new Error(`printables: ${query}`);
}

// The search's own total is fuzzy ("hdmi5" gives hundreds): what counts is
// how many of the top results name the thing, and their downloads.
async function printables() {
  const skip = done();
  for (const line of queries()) {
    if (skip.has(line)) continue;
    const [query, pattern = query] = line.split('|');
    const re = new RegExp(pattern, 'i');
    const found = await printablesSearch(query);
    const hits = found.items.filter((i) => re.test(i.name));
    const downloads = hits.reduce((s, i) => s + (i.downloadCount ?? 0), 0);
    const best = [...hits].sort((a, b) => b.downloadCount - a.downloadCount).slice(0, 2).map((i) => `${i.name} (${i.downloadCount})`);
    emit([found.totalCount, `${hits.length}/${found.items.length}`, downloads, best.join('; '), line]);
    await sleep(3000);
  }
}

async function circuitpython() {
  const boards = await cachedJson('circuitpython-files.json', 'https://raw.githubusercontent.com/adafruit/circuitpython-org/main/_data/files.json');
  const ranked = [...boards].sort((a, b) => b.downloads - a.downloads);
  const total = ranked.reduce((s, b) => s + b.downloads, 0);
  console.log(`# ${ranked.length} boards, ${total} downloads in all; below ≈1,000 is noise`);
  const res = queries().map((q) => new RegExp(q, 'i'));
  ranked.forEach((b, i) => {
    if (res.length === 0 ? i < 30 : res.some((re) => re.test(b.id))) emit([b.downloads, `#${i + 1}`, b.id]);
  });
}

async function meshmap() {
  const nodes = Object.values(await cachedJson('meshmap-nodes.json', 'https://meshmap.net/nodes.json'));
  const counts = new Map();
  for (const n of nodes) counts.set(n.hwModel, (counts.get(n.hwModel) ?? 0) + 1);
  console.log(`# ${nodes.length} nodes (only those publishing a position over MQTT)`);
  const res = queries().map((q) => new RegExp(q, 'i'));
  [...counts].sort((a, b) => b[1] - a[1]).forEach(([model, n], i) => {
    if (res.length === 0 ? i < 30 : res.some((re) => re.test(model))) emit([n, `${((100 * n) / nodes.length).toFixed(1)} %`, model]);
  });
}

async function pypi() {
  const skip = done();
  for (const pkg of queries()) {
    if (skip.has(pkg)) continue;
    const res = await fetch(`https://pypistats.org/api/packages/${pkg.toLowerCase()}/recent`);
    emit([res.ok ? (await res.json()).data.last_month : `error ${res.status}`, pkg]);
    await sleep(1500);
  }
}

const MODES = { github, printables, circuitpython, meshmap, pypi };
const run = MODES[mode];
if (!run) {
  console.error(`usage: node scripts/demand.mjs ${Object.keys(MODES).join('|')} <query…> [--file q.txt] [--out res.tsv]`);
  process.exit(2);
}
await run();
