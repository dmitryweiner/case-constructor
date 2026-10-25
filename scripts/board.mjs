#!/usr/bin/env node
// Catalog tools.
//
//   node scripts/board.mjs --check                      # validate every catalog file
//   node scripts/board.mjs --svg raspberry-pi-4b        # top view → shots/<id>.svg
//   node scripts/board.mjs --svg <id> --out shots/x.svg
//   node scripts/board.mjs --svg <id> --png             # also a PNG next to it (rendered by Playwright)
//   node scripts/board.mjs --svg <id> --variant <v>     # one variant of a family → shots/<id>-<v>.svg
//   node scripts/board.mjs --review [--only a,b]          # every entry over its cached drawing → shots/review/index.html
//   node scripts/board.mjs --format                      # rewrite every catalog file in the one layout
//   node scripts/board.mjs --brd board.brd               # footprints of an Eagle board, board frame
//   node scripts/board.mjs --kicad board.kicad_pcb       # the same for KiCad
//     --match 'SW|LED|USB'   only footprints whose name, value or package matches
//     --rotate 90            turn the board (counter-clockwise) to match the catalog's top view
//     --flip                 the product's top is the file's bottom (mirror x, swap sides)
//     --outline              the board outline as the entry's "outline" (--eps 0.15 simplifies)
//     --compare <id>         the entry's holes and size against the drawing's

import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { parseArgs } from './lib/harness.mjs';
import { readBrd, readKicad, turnBoard } from './lib/pcb.mjs';
import { formatBoard, inline } from './lib/boardJson.mjs';
import { chainLoops, largestLoop, toOutline } from './lib/outline.mjs';
import { compareHoles, readEntry } from './lib/compare.mjs';

const flags = parseArgs(process.argv.slice(2), ['svg', 'out', 'variant', 'brd', 'kicad', 'match', 'rotate', 'eps', 'compare', 'only']);

// --format: every catalog file in the layout of scripts/lib/boardJson.mjs (values untouched)
if (flags.has('format')) {
  const dir = 'src/boards/data';
  let changed = 0;
  for (const name of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const path = `${dir}/${name}`;
    const text = readFileSync(path, 'utf8');
    const formatted = formatBoard(JSON.parse(text));
    if (formatted === text) continue;
    writeFileSync(path, formatted);
    changed++;
    console.log(`formatted ${name}`);
  }
  console.log(`${changed} file(s) changed`);
  process.exit(0);
}

// --brd / --kicad: a layout file's footprints in the board frame (scripts/lib/pcb.mjs), no vitest needed
if (flags.has('brd') || flags.has('kicad')) {
  const path = flags.get('brd') ?? flags.get('kicad');
  const text = readFileSync(path, 'utf8');
  const read = flags.has('brd') ? readBrd(text) : readKicad(text);
  const board = turnBoard(read, Number(flags.get('rotate') ?? 0), flags.has('flip'));
  const r = (v) => Math.round(v * 100) / 100;
  console.log(`outline ${r(board.outline.w)} × ${r(board.outline.d)}`);
  for (const h of board.holes) console.log(`hole Ø${r(h.d)} at ${r(h.x)}, ${r(h.y)}`);
  if (flags.get('compare')) {
    for (const line of compareHoles(readEntry(flags.get('compare')), board.holes, { size: board.outline })) console.log(line);
    process.exit(0);
  }
  if (flags.has('outline')) {
    const loop = largestLoop(chainLoops(board.outlinePieces));
    if (loop) console.log(`"outline": ${inline(toOutline(loop, { x0: 0, y0: 0 }, Number(flags.get('eps') ?? 0.15)))},`);
    else console.log('outline: the outline pieces do not close');
  }
  const match = flags.get('match') ? new RegExp(String(flags.get('match')), 'i') : null;
  for (const e of board.elements) {
    if (match && !match.test(`${e.name} ${e.value} ${e.package}`)) continue;
    // the pads' box can sit off the footprint's origin (a jack's origin is a pin): its centre too
    const size = e.size ? `  ${r(e.size.w)} × ${r(e.size.d)} pads centred ${r(e.x + e.size.cx)}, ${r(e.y + e.size.cy)}` : '';
    const nets = e.nets.filter((n) => !/^(GND|VSS|AGND)$/i.test(n)).slice(0, 3);
    console.log(`${e.name.padEnd(8)} ${String(e.value).padEnd(18).slice(0, 18)} ${e.package.padEnd(24).slice(0, 24)} at ${r(e.x)}, ${r(e.y)}  rot ${e.rot}  ${e.side}${size}${nets.length ? `  nets ${nets.join(',')}` : ''}`);
  }
  process.exit(0);
}
const args = Object.fromEntries(flags);
if (args.svg && !args.out) args.out = args.variant ? `shots/${args.svg}-${args.variant}.svg` : `shots/${args.svg}.svg`;
// vitest's output line by line as it comes (a --review runs for minutes), its own chatter left out
const noise = /^(stdout \||\s*RUN|\s*Test Files|\s*Tests|\s*Start at|\s*Duration|·|×|⎯|\s*FAIL\s+scripts|\s*❯|npm notice)/;
const child = spawn('npx', ['vitest', 'run', '--config', 'scripts/vitest.board.config.ts', '--silent=false', '--reporter=dot'], {
  env: { ...process.env, BOARD_ARGS: JSON.stringify(args) },
});
for (const stream of [child.stdout, child.stderr]) {
  let rest = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    const lines = (rest + chunk).split('\n');
    rest = lines.pop();
    for (const line of lines) if (line.trim() && !noise.test(line.trim())) console.log(line);
  });
}
const result = { status: await new Promise((resolve) => child.on('close', resolve)) };
if (flags.has('png') && flags.has('svg') && result.status === 0) {
  const svg = args.out;
  const png = svg.replace(/\.svg$/, '.png');
  const text = readFileSync(svg, 'utf8');
  const [, w, h] = text.match(/width="([\d.]+)" height="([\d.]+)"/) ?? [];
  const browser = await chromium.launch({ executablePath: process.env.CASE_BROWSER || undefined });
  const page = await browser.newPage({ viewport: { width: Math.ceil(Number(w) || 800), height: Math.ceil(Number(h) || 600) } });
  await page.setContent(`<body style="margin:0">${text}</body>`);
  await page.screenshot({ path: png });
  await browser.close();
  console.log(`png → ${png}`);
}
process.exit(result.status ?? 1);
