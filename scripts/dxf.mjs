#!/usr/bin/env node
// A look into a board's 2D drawing — a vendor DXF, or a vector PDF (some
// vendors call it "DXF"): the extents, every circle (mounting hole
// candidates), component boxes and a PNG, to transcribe a catalog entry
// from (the add-board skill). Parsing lives in scripts/lib/drawing.mjs.
//
//   node scripts/dxf.mjs board.dxf                      # extents and circles
//   node scripts/dxf.mjs board.dxf --png shots/x.png    # and a picture
//   node scripts/dxf.mjs board.dxf --min 2 --max 4      # only circles (and boxes) of that size
//   node scripts/dxf.mjs board.dxf --layers             # entity counts per layer
//   node scripts/dxf.mjs board.dxf --layer L --boxes    # bounding box of every polyline and every
//                                                       # block placement, with the block's name
//                                                       # (Allegro writes the package there: TYPEC…)
//   node scripts/dxf.mjs board.dxf --origin x,y         # origin in drawing coordinates
//   node scripts/dxf.mjs board.pdf [--page 2]           # a vector PDF, through pdftocairo -svg
//   node scripts/dxf.mjs board.pdf --fit 85,56          # scaled so the extents are 85 mm wide
//   node scripts/dxf.mjs board.pdf --scale 2            # or by a factor (on top of pt → mm)
//   node scripts/dxf.mjs board.pdf --flip --rotate 90   # a bottom view, turned: the catalog's top view
//   node scripts/dxf.mjs board.dxf --outline            # the board's outline as the entry's "outline"
//                                                       # (the largest closed loop; --eps 0.15 simplifies,
//                                                       # --tol 0.02 joins pieces whose ends are that close)
//   node scripts/dxf.mjs board.pdf --compare <id>       # the entry's holes and size against the drawing's
//                                                       # (in the frame above: --origin/--flip/--rotate first)
//
// Coordinates are printed relative to the lower-left corner of the extents
// of the LINE/ARC/POLYLINE entities (the board outline, usually), which is
// the board frame's origin when the drawing is a top view. Some vendors ship
// only the drill layer: then the extents are those of the circles — the
// hole pattern is still right, the origin is not the board corner. A panel
// drawing (the board with break-off rails) has extents larger than the board:
// pass the board corner with --origin. INSERT blocks are expanded (nested,
// moved, rotated, scaled); old-style POLYLINE/VERTEX (Allegro) is read like
// LWPOLYLINE, bulges drawn straight. A PDF page's text is left out; its
// round closed paths become circles, and with --fit the extents are scaled to
// the board's known size (print both axes: a wrong page shows at once).

import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from 'playwright';
import { parseArgs } from './lib/harness.mjs';
import { componentBoxes, extents, layerCounts, pdfToSvg, polylines, readDxf, readSvg, scaled, turned } from './lib/drawing.mjs';
import { chainLoops, largestLoop, toOutline } from './lib/outline.mjs';
import { inline } from './lib/boardJson.mjs';
import { compareHoles, readEntry } from './lib/compare.mjs';

const file = process.argv[2];
const flags = parseArgs(process.argv.slice(3), ['png', 'min', 'max', 'layer', 'origin', 'page', 'scale', 'fit', 'rotate', 'eps', 'tol', 'compare']);
if (!file) {
  console.error('usage: node scripts/dxf.mjs <file.dxf|file.pdf> [--png out.png] [--min d] [--max d] [--layer name] [--layers] [--boxes] [--origin x,y] [--page n] [--scale k] [--fit w,d] [--flip] [--rotate deg] [--outline] [--eps mm]');
  process.exit(2);
}

const pdf = /\.pdf$/i.test(file);
let all = pdf
  ? readSvg(pdfToSvg(file, Number(flags.get('page') ?? 1)), Number(flags.get('scale') ?? 1))
  : readDxf(readFileSync(file, 'latin1'));

if (flags.has('layers')) {
  for (const [key, n] of [...layerCounts(all)].sort()) console.log(`${key}\t${n}`);
  process.exit(0);
}

const layer = flags.get('layer');
let shapes = layer ? all.filter((s) => s.layer === layer) : all;

const fit = flags.get('fit');
if (fit) {
  const [w, d] = String(fit).split(',').map(Number);
  const box = extents(shapes);
  const k = w / (box.x1 - box.x0);
  shapes = scaled(shapes, k);
  all = scaled(all, k);
  const after = extents(shapes);
  console.log(`fit: × ${k.toFixed(5)} → ${round(after.x1 - after.x0)} × ${round(after.y1 - after.y0)}${d ? ` (asked ${w} × ${d})` : ''}`);
}

// a bottom view or a turned page: into the catalog's top view before anything is measured
if (flags.has('flip') || flags.get('rotate')) {
  const deg = Number(flags.get('rotate') ?? 0);
  shapes = turned(shapes, deg, flags.has('flip'));
  all = turned(all, deg, flags.has('flip'));
}

function round(v) {
  return Math.round(v * 100) / 100;
}

const box = extents(shapes);
const origin = flags.get('origin');
if (origin) {
  const [ox, oy] = String(origin).split(',').map(Number);
  box.x1 -= box.x0 - ox; box.y1 -= box.y0 - oy; box.x0 = ox; box.y0 = oy;
}
if (!Number.isFinite(box.x0)) {
  console.log(`${shapes.length} drawable entities: nothing to show`);
  process.exit(1);
}
const { x0, y0, x1, y1 } = box;
console.log(`${shapes.length} entities; extents ${round(x1 - x0)} × ${round(y1 - y0)} (origin at ${round(x0)}, ${round(y0)})`);
if (flags.has('outline')) {
  const loop = largestLoop(chainLoops(polylines(shapes), Number(flags.get('tol') ?? 0.02)));
  if (!loop) console.log('outline: no closed loop (try --layer, or the drawing draws the outline in pieces that do not meet)');
  else {
    // the board frame's origin is the outline's own corner, unless --origin says otherwise
    const corner = origin ? box : { x0: Math.min(...loop.map(([x]) => x)), y0: Math.min(...loop.map(([, y]) => y)) };
    const outline = toOutline(loop, corner, Number(flags.get('eps') ?? 0.15));
    const xs = outline.map(([x]) => x);
    const ys = outline.map(([, y]) => y);
    const where = origin ? 'relative to --origin' : `relative to its own corner, at ${round(corner.x0 - box.x0)}, ${round(corner.y0 - box.y0)} in the coordinates above`;
    console.log(`outline ${round(Math.max(...xs) - Math.min(...xs))} × ${round(Math.max(...ys) - Math.min(...ys))}, ${outline.length} points, ${where}:`);
    console.log(`"outline": ${inline(outline)},`);
  }
}
if (flags.get('compare')) {
  const holes = shapes.filter((s) => s.kind === 'circle').map((c) => ({ x: c.x - x0, y: c.y - y0, d: 2 * c.r }));
  // the same circle is often drawn twice (pad and drill): one is enough
  const unique = holes.filter((h, i) => holes.findIndex((o) => Math.hypot(o.x - h.x, o.y - h.y) < 0.05 && Math.abs(o.d - h.d) < 0.05) === i);
  // the board's size from its outline when one closes, else the extents
  const loop = largestLoop(chainLoops(polylines(shapes), Number(flags.get('tol') ?? 0.02)));
  const lx = loop ? loop.map(([x]) => x) : [x0, x1];
  const ly = loop ? loop.map(([, y]) => y) : [y0, y1];
  const size = { w: Math.max(...lx) - Math.min(...lx), d: Math.max(...ly) - Math.min(...ly) };
  for (const line of compareHoles(readEntry(flags.get('compare')), unique, { size })) console.log(line);
}
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

// --boxes: every polyline's and every block placement's bounding box
// (relative to the origin), the larger side within --min/--max, biggest first
if (flags.has('boxes')) {
  const boxes = componentBoxes(shapes, box)
    .map((b) => ({ ...b, size: Math.max(b.x1 - b.x0, b.y1 - b.y0) }))
    .filter((b) => b.size >= min && b.size <= max)
    .sort((a, b) => b.size - a.size);
  const keys = new Set();
  for (const b of boxes) {
    const line = `box ${b.name ? `${b.name} ` : ''}x ${round(b.x0)}…${round(b.x1)}  y ${round(b.y0)}…${round(b.y1)}  (${round(b.x1 - b.x0)} × ${round(b.y1 - b.y0)}, centre ${round((b.x0 + b.x1) / 2)}, ${round((b.y0 + b.y1) / 2)})`;
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
