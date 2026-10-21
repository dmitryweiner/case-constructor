#!/usr/bin/env node
// A look into a board's DXF drawing (vendors publish 2D outlines as DXF):
// the extents, every circle (mounting hole candidates) and a PNG of the
// entities, to transcribe a catalog entry from (the add-board skill).
//
//   node scripts/dxf.mjs board.dxf                      # extents and circles
//   node scripts/dxf.mjs board.dxf --png shots/x.png    # and a picture
//   node scripts/dxf.mjs board.dxf --min 2 --max 4      # only circles of that diameter
//   node scripts/dxf.mjs board.dxf --layers             # entity counts per layer
//   node scripts/dxf.mjs board.dxf --layer L --boxes    # bounding box of every polyline
//                                                       # (component outlines: where a connector is)
//   node scripts/dxf.mjs board.dxf --origin x,y         # origin in drawing coordinates
//
// Coordinates are printed relative to the lower-left corner of the extents
// of the LINE/ARC/POLYLINE entities (the board outline, usually), which is
// the board frame's origin when the drawing is a top view. Some vendors ship
// only the drill layer: then the extents are those of the circles — the
// hole pattern is still right, the origin is not the board corner. A panel
// drawing (the board with break-off rails) has extents larger than the board:
// pass the board corner with --origin. Old-style POLYLINE/VERTEX entities
// (Allegro exports) are read like LWPOLYLINE; bulges are drawn straight.

import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from 'playwright';
import { parseArgs } from './lib/harness.mjs';

const file = process.argv[2];
const flags = parseArgs(process.argv.slice(3), ['png', 'min', 'max', 'layer', 'origin']);
if (!file) {
  console.error('usage: node scripts/dxf.mjs <file.dxf> [--png out.png] [--min d] [--max d] [--layer name] [--layers] [--boxes] [--origin x,y]');
  process.exit(2);
}

// group code / value pairs
const lines = readFileSync(file, 'latin1').split(/\r?\n/);
const pairs = [];
for (let i = 0; i + 1 < lines.length; i += 2) pairs.push([Number(lines[i].trim()), lines[i + 1].trim()]);

const entities = [];
let inEntities = false;
let current = null;
for (const [code, value] of pairs) {
  if (code === 2 && value === 'ENTITIES') inEntities = true;
  if (code === 0 && value === 'ENDSEC') inEntities = false;
  if (!inEntities) continue;
  if (code === 0) {
    current = { type: value, codes: [] };
    entities.push(current);
  } else if (current) {
    current.codes.push([code, value]);
  }
}

const num = (e, code, index = 0) => Number(e.codes.filter(([c]) => c === code)[index]?.[1] ?? NaN);
const layerOf = (e) => e.codes.find(([c]) => c === 8)?.[1] ?? '';
const layer = flags.get('layer');

// old-style POLYLINE: the vertices follow as VERTEX entities up to SEQEND
for (let i = 0; i < entities.length; i++) {
  const e = entities[i];
  if (e.type !== 'POLYLINE') continue;
  e.vertices = [];
  while (entities[i + 1] && entities[i + 1].type === 'VERTEX') e.vertices.push(entities.splice(i + 1, 1)[0]);
  if (entities[i + 1]?.type === 'SEQEND') entities.splice(i + 1, 1);
}

if (flags.has('layers')) {
  const counts = new Map();
  for (const e of entities) {
    const key = `${layerOf(e)}\t${e.type}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const [key, n] of [...counts].sort()) console.log(`${key}\t${n}`);
  process.exit(0);
}

const shapes = [];
for (const e of entities) {
  if (layer && layerOf(e) !== layer) continue;
  if (e.type === 'LINE') shapes.push({ kind: 'line', x1: num(e, 10), y1: num(e, 20), x2: num(e, 11), y2: num(e, 21) });
  else if (e.type === 'CIRCLE') shapes.push({ kind: 'circle', x: num(e, 10), y: num(e, 20), r: num(e, 40) });
  else if (e.type === 'ARC') shapes.push({ kind: 'arc', x: num(e, 10), y: num(e, 20), r: num(e, 40), a0: num(e, 50), a1: num(e, 51) });
  else if (e.type === 'LWPOLYLINE') {
    const xs = e.codes.filter(([c]) => c === 10).map(([, v]) => Number(v));
    const ys = e.codes.filter(([c]) => c === 20).map(([, v]) => Number(v));
    const closed = (num(e, 70) & 1) === 1;
    shapes.push({ kind: 'poly', pts: xs.map((x, i) => [x, ys[i]]), closed });
  } else if (e.type === 'POLYLINE') {
    const pts = e.vertices.map((v) => [num(v, 10), num(v, 20)]);
    shapes.push({ kind: 'poly', pts, closed: (num(e, 70) & 1) === 1 });
  }
}

// extents of the outline-ish entities (circles excluded: holes sit inside)
let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
const grow = (x, y) => {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
};
for (const s of shapes) {
  if (s.kind === 'line') { grow(s.x1, s.y1); grow(s.x2, s.y2); }
  if (s.kind === 'arc') { grow(s.x - s.r, s.y - s.r); grow(s.x + s.r, s.y + s.r); }
  if (s.kind === 'poly') for (const [x, y] of s.pts) grow(x, y);
}
if (!Number.isFinite(x0)) for (const s of shapes) if (s.kind === 'circle') { grow(s.x - s.r, s.y - s.r); grow(s.x + s.r, s.y + s.r); }

const round = (v) => Math.round(v * 100) / 100;
const origin = flags.get('origin');
if (origin) {
  const [ox, oy] = String(origin).split(',').map(Number);
  x1 -= x0 - ox; y1 -= y0 - oy; x0 = ox; y0 = oy;
}
if (!Number.isFinite(x0)) {
  // entities inside BLOCKS (INSERT) are not expanded; export the drawing exploded
  console.log(`${shapes.length} drawable entities: nothing to show (blocks are not expanded — explode them in a CAD tool)`);
  process.exit(1);
}
console.log(`${shapes.length} entities; extents ${round(x1 - x0)} × ${round(y1 - y0)} (origin at ${round(x0)}, ${round(y0)})`);
const min = Number(flags.get('min') ?? 0);
const max = Number(flags.get('max') ?? Infinity);
const circles = shapes.filter((s) => s.kind === 'circle' && 2 * s.r >= min && 2 * s.r <= max)
  .sort((a, b) => b.r - a.r || a.y - b.y || a.x - b.x);
const seen = new Set();
for (const c of circles) {
  const key = `${round(c.x - x0)},${round(c.y - y0)},${round(2 * c.r)}`;
  if (seen.has(key)) continue;
  seen.add(key);
  console.log(`circle Ø${round(2 * c.r)} at ${round(c.x - x0)}, ${round(c.y - y0)}`);
}

// --boxes: every polyline's bounding box (relative to the origin), the larger
// side within --min/--max, biggest first
if (flags.has('boxes')) {
  const boxes = shapes.filter((sh) => sh.kind === 'poly' && sh.pts.length > 1).map((sh) => {
    const bx = sh.pts.map(([x]) => x - x0);
    const by = sh.pts.map(([, y]) => y - y0);
    const b = { x0: Math.min(...bx), x1: Math.max(...bx), y0: Math.min(...by), y1: Math.max(...by) };
    return { ...b, size: Math.max(b.x1 - b.x0, b.y1 - b.y0) };
  }).filter((b) => b.size >= min && b.size <= max).sort((a, b) => b.size - a.size);
  const keys = new Set();
  for (const b of boxes) {
    const line = `box x ${round(b.x0)}…${round(b.x1)}  y ${round(b.y0)}…${round(b.y1)}  (${round(b.x1 - b.x0)} × ${round(b.y1 - b.y0)}, centre ${round((b.x0 + b.x1) / 2)}, ${round((b.y0 + b.y1) / 2)})`;
    if (keys.has(line)) continue;
    keys.add(line);
    console.log(line);
  }
}

const png = flags.get('png');
if (png) {
  const s = 1600 / Math.max(x1 - x0, y1 - y0);
  const pad = 20;
  const W = Math.ceil((x1 - x0) * s + 2 * pad);
  const H = Math.ceil((y1 - y0) * s + 2 * pad);
  const X = (x) => pad + (x - x0) * s;
  const Y = (y) => H - pad - (y - y0) * s;
  const parts = [];
  for (const sh of shapes) {
    if (sh.kind === 'line') parts.push(`<line x1="${X(sh.x1)}" y1="${Y(sh.y1)}" x2="${X(sh.x2)}" y2="${Y(sh.y2)}"/>`);
    if (sh.kind === 'circle') parts.push(`<circle cx="${X(sh.x)}" cy="${Y(sh.y)}" r="${sh.r * s}"/>`);
    if (sh.kind === 'poly') parts.push(`<polyline points="${sh.pts.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ')}${sh.closed ? ` ${X(sh.pts[0][0])},${Y(sh.pts[0][1])}` : ''}"/>`);
    if (sh.kind === 'arc') {
      const a0 = (sh.a0 * Math.PI) / 180;
      let a1 = (sh.a1 * Math.PI) / 180;
      if (a1 < a0) a1 += 2 * Math.PI;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      parts.push(`<path d="M ${X(sh.x + sh.r * Math.cos(a0))} ${Y(sh.y + sh.r * Math.sin(a0))} A ${sh.r * s} ${sh.r * s} 0 ${large} 0 ${X(sh.x + sh.r * Math.cos(a1))} ${Y(sh.y + sh.r * Math.sin(a1))}"/>`);
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#fff"/><g fill="none" stroke="#000" stroke-width="1.2">${parts.join('')}</g></svg>`;
  mkdirSync(dirname(png), { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CASE_BROWSER || undefined });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.setContent(`<body style="margin:0">${svg}</body>`);
  await page.screenshot({ path: png });
  await browser.close();
  console.log(`png → ${png}`);
}
