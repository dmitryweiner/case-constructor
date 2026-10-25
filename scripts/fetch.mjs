#!/usr/bin/env node
// Vendor drawings in a local cache, so a board can be checked again later
// (the visual review, a re-transcription) without hunting for its files:
// drawings/<host>/<path>, zip archives unpacked next to them, and
// drawings/index.json mapping every URL to what it gave. drawings/ is not
// committed. Downloaded files are data: nothing in them is run.
//
//   node scripts/fetch.mjs <url>                     # download (once) and list the files
//   node scripts/fetch.mjs --board <id>              # the catalog entry's source URL
//   node scripts/fetch.mjs <url> --file ~/Downloads/x.pdf   # a file you downloaded by hand
//   node scripts/fetch.mjs --all                     # every catalog entry's source (skips the cached)
//   node scripts/fetch.mjs --list                    # what the cache holds
//   node scripts/fetch.mjs <url> --force             # download again
//
// Google Drive file links are turned into their download form; when Drive
// answers with its "can't scan for viruses" page instead of the file, the
// script says so: download it in a browser and register it with --file.
// GitHub blob links become raw links.

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, relative } from 'node:path';
import { parseArgs } from './lib/harness.mjs';

const ROOT = 'drawings';
const INDEX = join(ROOT, 'index.json');

const args = process.argv.slice(2);
const flags = parseArgs(args, ['board', 'file']);
const positional = args.find((a, i) => !a.startsWith('--') && !['--board', '--file'].includes(args[i - 1]));

function loadIndex() {
  try {
    return JSON.parse(readFileSync(INDEX, 'utf8'));
  } catch {
    return {};
  }
}

function saveIndex(index) {
  mkdirSync(ROOT, { recursive: true });
  writeFileSync(INDEX, `${JSON.stringify(index, null, 2)}\n`);
}

/** Every file under a directory, relative paths. */
function filesUnder(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true }).map(String).filter((f) => statSync(join(dir, f)).isFile()).sort();
}

/** The URL to download, and where it goes in the cache. */
function plan(url) {
  const u = new URL(url);
  let download = url;
  const drive = u.hostname === 'drive.google.com' && u.pathname.match(/\/file\/d\/([^/]+)/);
  if (drive) download = `https://drive.google.com/uc?export=download&id=${drive[1]}`;
  if (u.hostname === 'github.com' && u.pathname.includes('/blob/')) {
    download = `https://raw.githubusercontent.com${u.pathname.replace('/blob/', '/')}`;
  }
  let clean = decodeURIComponent(u.pathname).replace(/^\/+/, '').replace(/[^\w.\-/ ]+/g, '_');
  if (clean === '' || clean.endsWith('/')) clean += 'index.html';
  let path = join(ROOT, u.hostname, clean);
  if (drive) path = join(ROOT, u.hostname, drive[1]);
  return { download, path };
}

/** Unpacks a zip next to it, once; returns the directory. */
function unpack(path) {
  const dir = `${path}.d`;
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    const result = spawnSync('unzip', ['-q', '-o', path, '-d', dir], { encoding: 'utf8' });
    if (result.status !== 0 && result.status !== 1) console.error(`unzip: ${result.stderr.trim()}`);
  }
  return dir;
}

function isZip(path) {
  const head = readFileSync(path).subarray(0, 4);
  return head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
}

function report(url, path) {
  console.log(`${url}\n  → ${path}`);
  if (isZip(path)) {
    const dir = unpack(path);
    for (const f of filesUnder(dir).filter((f) => !f.includes('__MACOSX'))) console.log(`    ${join(dir, f)}`);
  }
}

if (flags.has('list')) {
  const index = loadIndex();
  for (const [url, entry] of Object.entries(index)) console.log(`${entry.path}\n  ← ${url}${entry.board ? `  (${entry.board})` : ''}`);
  if (Object.keys(index).length === 0) console.log('the cache is empty');
  process.exit(0);
}

if (flags.has('all')) {
  // one child per entry: a failure (a page that moved, Drive) is reported and the rest go on
  let failed = 0;
  for (const name of readdirSync('src/boards/data').filter((f) => f.endsWith('.json')).sort()) {
    const id = name.replace(/\.json$/, '');
    const result = spawnSync(process.execPath, [process.argv[1], '--board', id], { encoding: 'utf8' });
    const first = (result.stdout || result.stderr).trim().split('\n')[0];
    console.log(`${result.status === 0 ? 'ok  ' : 'FAIL'} ${id}: ${result.status === 0 ? first : (result.stderr.trim().split('\n')[0] ?? '')}`);
    if (result.status !== 0) failed++;
  }
  console.log(`${failed} failed`);
  process.exit(0);
}

let url = positional;
const board = flags.get('board');
if (board) {
  const file = join('src/boards/data', `${board}.json`);
  if (!existsSync(file)) {
    console.error(`no board ${board}`);
    process.exit(2);
  }
  url = JSON.parse(readFileSync(file, 'utf8')).source;
}
if (!url) {
  console.error('usage: node scripts/fetch.mjs <url> | --board <id> [--file <downloaded file>] [--force] | --list');
  process.exit(2);
}

const index = loadIndex();
const { download, path } = plan(url);

const manual = flags.get('file');
if (manual) {
  const from = manual.replace(/^~(?=\/)/, homedir());
  const target = join(dirname(path), basename(path) === basename(from) ? basename(path) : `${basename(path)}-${basename(from)}`);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(from, target);
  index[url] = { path: target, board, manual: true, date: new Date().toISOString().slice(0, 10) };
  saveIndex(index);
  report(url, target);
  process.exit(0);
}

const known = index[url]?.path;
if (known && existsSync(known) && !flags.has('force')) {
  console.log('(cached)');
  report(url, known);
  process.exit(0);
}
if (new URL(url).hostname === 'drive.google.com' && url.includes('/folders/')) {
  console.error(`A Drive folder cannot be downloaded by a script: open ${url}, download the file, then`);
  console.error(`node scripts/fetch.mjs '${url}' --file ~/Downloads/<the file>`);
  process.exit(1);
}

let response;
try {
  response = await fetch(download, { redirect: 'follow', headers: { 'user-agent': 'case-constructor fetch.mjs' } });
} catch (error) {
  console.error(`cannot reach ${new URL(download).hostname}: ${error.cause?.code ?? error.message}`);
  process.exit(1);
}
if (!response.ok) {
  console.error(`${response.status} ${response.statusText}: ${download}`);
  process.exit(1);
}
const body = Buffer.from(await response.arrayBuffer());
const type = response.headers.get('content-type') ?? '';
if (download.includes('drive.google.com') && type.includes('text/html')) {
  console.error('Google Drive answered with a page, not the file (it asks a person to confirm).');
  console.error(`Download it in a browser: ${url}`);
  console.error(`then: node scripts/fetch.mjs '${url}' --file ~/Downloads/<the file>`);
  process.exit(1);
}
mkdirSync(dirname(path), { recursive: true });
writeFileSync(path, body);
index[url] = { path, ...(board ? { board } : {}), date: new Date().toISOString().slice(0, 10) };
saveIndex(index);
console.log(`${(body.length / 1024).toFixed(0)} KB${type ? `, ${type}` : ''}`);
report(url, relative('.', path));
