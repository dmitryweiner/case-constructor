// The catalog review page (board.mjs --review): every entry's top view over
// its vendor drawing from the local cache (drawings/), aligned without a
// person — by the mounting holes (scale, a quarter turn, a mirror), the
// board's edge breaking the ties a symmetric hole pattern leaves, or by the
// outline alone for a board without holes. A person then looks for what
// does not match; the page keeps their marks and notes.
//
// Every layer is drawn in display millimetres: the board frame with y down
// (x, -y), so the entry's scheme and the drawing share one coordinate system.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pdfToSvg, polylines, readDxf, readSvg } from './drawing.mjs';
import { chainLoops } from './outline.mjs';
import { readBrd, readKicad, turnBoard } from './pcb.mjs';
import { readStep } from './step.mjs';

const MAX_PAGES = 40;
const r2 = (v) => Math.round(v * 100) / 100;

// --- which files

function kindOf(file) {
  const ext = extname(file).toLowerCase();
  const kinds = { '.dxf': 'dxf', '.pdf': 'pdf', '.brd': 'brd', '.kicad_pcb': 'kicad', '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.webp': 'image', '.step': 'step', '.stp': 'step', '.html': 'page', '.htm': 'page' };
  if (kinds[ext]) return kinds[ext];
  if (ext) return null;
  const head = readFileSync(file).subarray(0, 256).toString('latin1');
  if (head.startsWith('%PDF')) return 'pdf';
  if (head.trimStart().startsWith('<')) return 'page';
  return null;
}

/** The cached drawing files of an entry (drawings/index.json, by board id or by its source URL); zips are read unpacked. */
export function drawingFiles(def) {
  if (!existsSync('drawings/index.json')) return [];
  const index = JSON.parse(readFileSync('drawings/index.json', 'utf8'));
  const files = [];
  const walk = (path) => {
    if (!existsSync(path)) return;
    if (statSync(path).isDirectory()) {
      for (const name of readdirSync(path).sort()) if (name !== '__MACOSX' && !name.startsWith('.')) walk(join(path, name));
      return;
    }
    if (existsSync(`${path}.d`)) return walk(`${path}.d`);
    const kind = kindOf(path);
    if (kind && !files.some((f) => f.file === path)) files.push({ file: path, kind });
  };
  for (const [url, entry] of Object.entries(index)) if (entry.board === def.id || url === def.source) walk(entry.path);
  // a top view before a bottom one
  const rank = (f) => (/top/i.test(basename(f.file)) ? 0 : /bot/i.test(basename(f.file)) ? 2 : 1);
  return files.sort((a, b) => rank(a) - rank(b));
}

// --- transforms: board frame → drawing, D = s·R(th)·(f·x, y) + t

function apply(T, x, y) {
  const X = T.f * x;
  const c = Math.cos(T.th);
  const s = Math.sin(T.th);
  return [T.s * (c * X - s * y) + T.tx, T.s * (s * X + c * y) + T.ty];
}

function invert(T, x, y) {
  const c = Math.cos(T.th);
  const s = Math.sin(T.th);
  const dx = (x - T.tx) / T.s;
  const dy = (y - T.ty) / T.s;
  return [T.f * (c * dx + s * dy), -s * dx + c * dy];
}

function quarterOf(T) {
  return ((Math.round(T.th / (Math.PI / 2)) % 4) + 4) % 4;
}

// --- the board's own geometry

function perimeter(def) {
  const pts = def.outline ?? [[0, 0], [def.size.w, 0], [def.size.w, def.size.d], [0, def.size.d]];
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
    for (let k = 0; k < n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  return out;
}


/** Items with a box in a grid; a query scans only cells inside the grid, or the list when that is fewer. */
function gridOf(items, boxOf) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const item of items) {
    const [ax, ay, bx, by] = boxOf(item);
    x0 = Math.min(x0, ax); y0 = Math.min(y0, ay); x1 = Math.max(x1, bx); y1 = Math.max(y1, by);
  }
  const cell = Math.max((x1 - x0) / 150, (y1 - y0) / 150, 1e-9);
  const nx = Math.floor((x1 - x0) / cell);
  const ny = Math.floor((y1 - y0) / cell);
  const cells = new Map();
  for (const item of items) {
    const [ax, ay, bx, by] = boxOf(item);
    for (let i = Math.floor((ax - x0) / cell); i <= Math.floor((bx - x0) / cell); i++) {
      for (let j = Math.floor((ay - y0) / cell); j <= Math.floor((by - y0) / cell); j++) {
        const key = i * 100003 + j;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(item);
      }
    }
  }
  return function* around(x, y, r) {
    const i0 = Math.max(0, Math.floor((x - r - x0) / cell));
    const i1 = Math.min(nx, Math.floor((x + r - x0) / cell));
    const j0 = Math.max(0, Math.floor((y - r - y0) / cell));
    const j1 = Math.min(ny, Math.floor((y + r - y0) / cell));
    if (i1 < i0 || j1 < j0) return;
    if ((i1 - i0 + 1) * (j1 - j0 + 1) > items.length) {
      yield* items;
      return;
    }
    // an item spanning several cells comes once per cell: callers only test, so a repeat costs nothing wrong
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) yield* cells.get(i * 100003 + j) ?? [];
  };
}

// --- a drawing's segments, for "is there a line near this point"

function segmentGrid(lines) {
  const segs = [];
  for (const pts of lines) for (let i = 1; i < pts.length; i++) segs.push([pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]]);
  const around = gridOf(segs, ([ax, ay, bx, by]) => [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)]);
  return {
    near(x, y, tol) {
      for (const [ax, ay, bx, by] of around(x, y, tol)) {
        const vx = bx - ax;
        const vy = by - ay;
        const len2 = vx * vx + vy * vy;
        const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / len2)) : 0;
        if (Math.hypot(ax + t * vx - x, ay + t * vy - y) <= tol) return true;
      }
      return false;
    },
  };
}

/** A shape that is a hole: a circle, a round closed polyline, or a closed two-point polyline (a DXF circle of two bulges, read straight). */
function asHole(s) {
  if (s.kind === 'circle') return { x: s.x, y: s.y, d: 2 * s.r };
  if (s.kind !== 'poly' || !s.closed) return null;
  if (s.pts.length === 2) {
    const [[ax, ay], [bx, by]] = s.pts;
    return { x: (ax + bx) / 2, y: (ay + by) / 2, d: Math.hypot(bx - ax, by - ay) };
  }
  if (s.pts.length < 8) return null;
  const xs = s.pts.map(([x]) => x);
  const ys = s.pts.map(([, y]) => y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const rs = s.pts.map(([x, y]) => Math.hypot(x - cx, y - cy));
  const r = rs.reduce((a, b) => a + b, 0) / rs.length;
  return r > 0 && Math.max(...rs) - Math.min(...rs) < 0.06 * r ? { x: cx, y: cy, d: 2 * r } : null;
}

/** Hole centres, concentric ones (a pad ring round its drill) merged, each with its diameters. */
function centresOf(shapes) {
  const map = new Map();
  for (const s of shapes) {
    const h = asHole(s);
    if (!h || !(h.d > 0)) continue;
    const key = `${h.x.toFixed(3)},${h.y.toFixed(3)}`;
    if (!map.has(key)) map.set(key, { x: h.x, y: h.y, ds: [] });
    map.get(key).ds.push(h.d);
  }
  return [...map.values()];
}

// --- alignment

/** Centres in a grid, for "every centre between r0 and r1 from here". */
function centreGrid(centres) {
  const around = gridOf(centres, (c) => [c.x, c.y, c.x, c.y]);
  return function* within(x, y, r0, r1) {
    for (const c of around(x, y, r1)) {
      const d = Math.hypot(c.x - x, c.y - y);
      if (d >= r0 && d <= r1) yield [c, d];
    }
  };
}

// a hole is drawn as its drill or as its pad ring: this much off the entry's diameter
const RING = [0.7, 2.6];
const fits = (c, s, d) => c.ds.some((cd) => cd / (s * d) > RING[0] && cd / (s * d) < RING[1]);

function holeFit(T, holes, within, tol = 0.4) {
  let n = 0;
  let err = 0;
  let worst = 0;
  for (const h of holes) {
    const [x, y] = apply(T, h.x, h.y);
    let best = Infinity;
    for (const [c, d] of within(x, y, 0, tol * T.s)) if (d < best && fits(c, T.s, h.d)) best = d;
    if (best < Infinity) { n++; err += (best / T.s) ** 2; worst = Math.max(worst, best / T.s); }
  }
  return { n, rms: n ? Math.sqrt(err / n) : Infinity, worst };
}

/** The pose moved by the mean miss of its matched holes: one hole put exactly leaves the rest, and the edge, off. */
function centred(T, holes, within, tol) {
  let dx = 0;
  let dy = 0;
  let n = 0;
  for (const h of holes) {
    const [x, y] = apply(T, h.x, h.y);
    let best = null;
    for (const [c, d] of within(x, y, 0, tol * T.s)) if (!best || d < best[1]) best = [c, d];
    if (best) { dx += best[0].x - x; dy += best[0].y - y; n++; }
  }
  return n ? { ...T, tx: T.tx + dx / n, ty: T.ty + dy / n } : T;
}

/**
 * A drawing at its true scale (a DXF, a model, a layout): every pose that puts
 * the entry's first hole on a centre, in each quarter turn and mirror, with
 * a loose tolerance, so an entry whose holes are a millimetre off still lands
 * on its drawing and the page shows by how much.
 */
function byHolesAtScale(holes, centres, s) {
  if (holes.length < 2 || centres.length < 2) return [];
  const within = centreGrid(centres);
  const need = Math.min(holes.length, 3);
  const out = [];
  const h0 = holes[0];
  for (const a of centres) {
    if (!fits(a, s, h0.d)) continue;
    for (const f of [1, -1]) {
      for (let q = 0; q < 4; q++) {
        const th = (q * Math.PI) / 2;
        const T = { s, th, f, tx: 0, ty: 0 };
        const [x, y] = apply(T, h0.x, h0.y);
        T.tx = a.x - x;
        T.ty = a.y - y;
        if (holeFit(T, holes, within, 1.5).n < need) continue;
        const C = centred(T, holes, within, 1.5);
        const fit = holeFit(C, holes, within, 1.5);
        if (fit.n >= need) out.push({ T: C, holes: fit.n, rms: fit.rms, worst: fit.worst });
      }
    }
  }
  return out.sort((a, b) => b.holes - a.holes || a.rms - b.rms).slice(0, 400);
}

function byHoles(holes, centres) {
  if (holes.length < 2 || centres.length < 2) return [];
  const within = centreGrid(centres);
  const pairs = [];
  for (let i = 0; i < holes.length; i++) for (let j = i + 1; j < holes.length; j++) pairs.push([i, j, Math.hypot(holes[i].x - holes[j].x, holes[i].y - holes[j].y)]);
  pairs.sort((a, b) => b[2] - a[2]);
  const need = Math.min(holes.length, 3);
  const out = [];
  for (const [i, j, len] of pairs.slice(0, 3)) {
    if (len < 1) continue;
    for (const f of [1, -1]) {
      const hi = [f * holes[i].x, holes[i].y];
      const ah = Math.atan2(holes[j].y - holes[i].y, f * holes[j].x - hi[0]);
      for (const a of centres) {
        // a's diameter bounds the scale, and the scale where b can be
        const smin = Math.max(0.02, Math.min(...a.ds) / (RING[1] * holes[i].d));
        const smax = Math.min(50, Math.max(...a.ds) / (RING[0] * holes[i].d));
        if (smin > smax) continue;
        for (const [b, dist] of within(a.x, a.y, len * smin, len * smax)) {
          if (a === b) continue;
          const s = dist / len;
          const th = Math.atan2(b.y - a.y, b.x - a.x) - ah;
          const q = th / (Math.PI / 2);
          if (Math.abs(q - Math.round(q)) > 0.02) continue;
          if (!fits(a, s, holes[i].d) || !fits(b, s, holes[j].d)) continue;
          const c = Math.cos(th);
          const sn = Math.sin(th);
          const T = { s, th, f, tx: a.x - s * (c * hi[0] - sn * hi[1]), ty: a.y - s * (sn * hi[0] + c * hi[1]) };
          const fit = holeFit(T, holes, within);
          if (fit.n >= need) out.push({ T, holes: fit.n, rms: fit.rms, worst: fit.worst });
        }
      }
    }
    if (out.length) break;
  }
  // one candidate per pose
  const seen = new Set();
  return out.sort((a, b) => b.holes - a.holes || a.rms - b.rms).filter(({ T }) => {
    const key = `${T.f},${quarterOf(T)},${Math.round(T.tx / T.s)},${Math.round(T.ty / T.s)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 400);
}

function byOutline(def, lines) {
  const loops = chainLoops(lines, 0.02, { budget: 20000 });
  const boxes = loops.map((loop) => {
    const xs = loop.map(([x]) => x);
    const ys = loop.map(([, y]) => y);
    return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  }).sort((a, b) => (b.x1 - b.x0) * (b.y1 - b.y0) - (a.x1 - a.x0) * (a.y1 - a.y0)).slice(0, 30);
  const { w, d } = def.size;
  const out = [];
  for (const box of boxes) {
    const bw = box.x1 - box.x0;
    const bh = box.y1 - box.y0;
    for (let quarter = 0; quarter < 4; quarter++) {
      const [W, D] = quarter % 2 ? [d, w] : [w, d];
      const s = bw / W;
      if (s <= 0 || Math.abs(bh - s * D) / bh > 0.03) continue;
      for (const f of [1, -1]) {
        const th = (quarter * Math.PI) / 2;
        const T = { s, th, f, tx: 0, ty: 0 };
        const [cx, cy] = apply(T, w / 2, d / 2);
        T.tx = (box.x0 + box.x1) / 2 - cx;
        T.ty = (box.y0 + box.y1) / 2 - cy;
        out.push({ T, holes: 0, rms: Infinity });
      }
    }
  }
  return out;
}

/** Points round every connector's box (board frame), every half millimetre. */
function portSamples(boxes) {
  const out = [];
  for (const [x0, y0, x1, y1] of boxes) {
    const corners = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    for (let i = 0; i < 4; i++) {
      const [ax, ay] = corners[i];
      const [bx, by] = corners[(i + 1) % 4];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.5));
      for (let k = 0; k < n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
    }
  }
  return out;
}

/** How many of the drawing's polylines lie wholly inside the board under the pose (its parts, drawn). */
function content(T, def, lines) {
  let n = 0;
  for (const pts of lines) {
    if (pts.every(([x, y]) => {
      const [bx, by] = invert(T, x, y);
      return bx > 0.3 && by > 0.3 && bx < def.size.w - 0.3 && by < def.size.d - 0.3;
    })) n++;
  }
  return n;
}

/**
 * The best pose of the board on a drawing's shapes (drawing units, y up), or
 * null. `borrowed`: poses that fitted another file of the same set (a bottom
 * view without the mounting holes drawn shares the top view's frame).
 */
export function align(def, shapes, borrowed = [], boxes = [], trueScale = false) {
  const lines = polylines(shapes.filter((s) => s.kind !== 'circle'));
  const grid = segmentGrid(lines);
  const edge = perimeter(def);
  const edgeHit = (T) => edge.filter(([x, y]) => {
    const [X, Y] = apply(T, x, y);
    return grid.near(X, Y, 0.3 * T.s);
  }).length / edge.length;
  const holes = def.mount.holes;
  for (const T of borrowed) {
    const hit = edgeHit(T);
    if (hit >= 0.6) return { T, holes: 0, edge: hit, score: hit, how: `as the other file of the set, edge ${Math.round(hit * 100)}%` };
  }
  const centres = centresOf(shapes);
  let candidates = byHoles(holes, centres);
  if (trueScale) candidates.push(...byHolesAtScale(holes, centres, 1));
  const outlined = candidates.length === 0;
  if (outlined) candidates = byOutline(def, lines);
  if (centres.length) {
    const within = centreGrid(centres);
    for (const T of borrowed) candidates.push({ T, ...holeFit(T, holes, within), borrowed: true });
  } else for (const T of borrowed) candidates.push({ T, holes: 0, rms: Infinity, borrowed: true });
  if (candidates.length === 0) return null;
  const parts = portSamples(boxes);
  let best = null;
  for (const c of candidates) {
    const hit = edgeHit(c.T);
    // a mirror or a half turn of a symmetric hole pattern: the connectors tell
    const partHit = parts.length && hit > 0.3 ? parts.filter(([x, y]) => {
      const [X, Y] = apply(c.T, x, y);
      return grid.near(X, Y, 0.5 * c.T.s);
    }).length / parts.length : 0;
    // by the outline alone, a table cell of the right proportions fits as well: the board has parts inside
    const byEdge = outlined && !c.borrowed;
    const inside = byEdge ? content(c.T, def, lines) : 0;
    if (byEdge && inside < 8) continue;
    // holes count only with the edge under them (tiny pads at a tiny scale match any pattern);
    // ties (a symmetric hole pattern, a rectangle): the top view, unturned
    const score = (c.holes + 1) * hit * hit + 0.6 * partHit + 0.5 * Math.min(1, inside / 40) + (c.T.f === 1 ? 0.02 : 0) + (quarterOf(c.T) === 0 ? 0.01 : 0);
    if (!best || score > best.score) best = { ...c, edge: hit, partHit, inside, score };
  }
  // round letters of a title block match two holes as well; the board's edge must be there
  if (!best || best.edge < 0.4 || ((outlined || best.holes === 0) && best.edge < 0.6)) return null;
  const how = best.borrowed
    ? `as the other file of the set, holes ${best.holes}/${holes.length}, edge ${Math.round(best.edge * 100)}%`
    : outlined
    ? `by the outline (no holes to go by), edge ${Math.round(best.edge * 100)}%, ${best.inside} shapes inside`
    : `by holes ${best.holes}/${holes.length} (rms ${r2(best.rms)} mm${best.worst > 0.4 ? `; HOLES OFF by up to ${r2(best.worst)} mm` : ''}), edge ${Math.round(best.edge * 100)}%, connectors ${Math.round(best.partHit * 100)}%`;
  const turn = `${quarterOf(best.T) * 90}°${best.T.f === -1 ? ', mirrored' : ''}`;
  const weak = best.edge < 0.5 ? ' — WEAK: check it' : '';
  return { ...best, how: `${how}; scale ${r2(best.T.s)}, ${turn}${weak}` };
}

// --- layers

const num = (v) => String(r2(v));

/** Shapes (drawing units, y up) into display millimetres through the pose, as SVG markup. */
function shapesMarkup(shapes, T) {
  const P = (x, y) => {
    const [bx, by] = invert(T, x, y);
    return `${num(bx)},${num(-by)}`;
  };
  const parts = [];
  for (const pts of polylines(shapes.filter((s) => s.kind !== 'circle'))) {
    if (pts.length > 1) parts.push(`M${pts.map(([x, y]) => P(x, y)).join('L')}`);
  }
  const circles = shapes.filter((s) => s.kind === 'circle').map((c) => {
    const [x, y] = invert(T, c.x, c.y);
    return `<circle cx="${num(x)}" cy="${num(-y)}" r="${r2(c.r / T.s)}"/>`;
  });
  const ns = 'vector-effect="non-scaling-stroke"';
  return `<g fill="none" stroke="currentColor" stroke-width="1"><path d="${parts.join('')}" ${ns}/>${circles.join('').replaceAll('/>', ` ${ns}/>`)}</g>`;
}

function dxfLayer(def, file, borrowed, boxes) {
  const shapes = readDxf(readFileSync(file, 'latin1'));
  const pose = align(def, shapes, borrowed, boxes, true);
  if (pose && pose.edge >= 0.7) borrowed.push(pose.T);
  return pose ? { markup: shapesMarkup(shapes, pose.T), how: pose.how, score: pose.score } : { markup: shapesMarkup(shapes, identityAt(shapes, def)), how: 'not aligned: two points by hand', score: 0.05 };
}

/** Unaligned: the drawing round the board at about twice its size, to be aligned by two points. */
function identityAt(shapes, def) {
  const lines = polylines(shapes);
  const pts = lines.length ? lines.flat() : shapes.filter((c) => c.kind === 'circle').map((c) => [c.x, c.y]);
  const xs = pts.map(([x]) => x);
  const ys = pts.map(([, y]) => y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const s = Math.max(x1 - x0, y1 - y0, 1e-6) / (2 * Math.max(def.size.w, def.size.d));
  return { s, th: 0, f: 1, tx: (x0 + x1) / 2 - (s * def.size.w) / 2, ty: (y0 + y1) / 2 - (s * def.size.d) / 2 };
}

function pageCount(file) {
  const out = spawnSync('pdfinfo', [file], { encoding: 'utf8' });
  return Number(out.stdout?.match(/Pages:\s+(\d+)/)?.[1] ?? 1);
}

/** Words of a page that say it is a mechanical drawing. */
function drawingWords(file, page) {
  const out = spawnSync('pdftotext', ['-f', String(page), '-l', String(page), file, '-'], { encoding: 'utf8' });
  const text = out.stdout ?? '';
  return (text.match(/dimension|mechanical|outline|drawing|尺寸|\bmm\b/gi) ?? []).length;
}

/**
 * The PDF page the board fits best, kept whole (with its text) and placed by
 * a matrix; when no page fits, the likeliest pages (by their words, then
 * their circles) unaligned, for two points by hand.
 */
function pdfLayers(def, file, boxes) {
  const pages = [];
  const count = pageCount(file);
  for (let page = 1; page <= Math.min(count, MAX_PAGES); page++) {
    let svg;
    try { svg = pdfToSvg(file, page); } catch { continue; }
    const shapes = readSvg(svg);
    if (shapes.length === 0) continue;
    pages.push({ page, svg, shapes, pose: align(def, shapes, [], boxes) });
  }
  const posed = pages.filter((p) => p.pose).sort((a, b) => b.pose.score - a.pose.score);
  if (posed.length) {
    const best = posed[0];
    return [{ nested: nestable(best.svg), matrix: pageMatrix(best.pose.T), how: `page ${best.page} of ${count}, ${best.pose.how}`, score: best.pose.score }];
  }
  for (const p of pages) p.rank = drawingWords(file, p.page) * 1000 + p.shapes.filter((s) => s.kind === 'circle').length;
  return pages.sort((a, b) => b.rank - a.rank).slice(0, 3).map((p, i) => ({
    nested: nestable(p.svg), matrix: pageMatrix(identityAt(p.shapes, def)), how: `page ${p.page} of ${count}, not aligned: two points by hand`, score: 0.05 - i * 0.01,
  }));
}

/** pdftocairo's units (pt, y down) → drawing mm (y up, readSvg) → board frame → display mm: one affine. */
function pageMatrix(T) {
  const k = 25.4 / 72;
  const map = (X, Y) => {
    const [bx, by] = invert(T, X * k, -Y * k);
    return [bx, -by];
  };
  const [e, f] = map(0, 0);
  const [ax, ay] = map(1, 0);
  const [cx, cy] = map(0, 1);
  return [ax - e, ay - f, cx - e, cy - f, e, f].map((v) => Number(v.toPrecision(8)));
}

/** A page SVG to nest in the stage: plain user units, so the matrix alone places it. */
function nestable(svg) {
  const vb = svg.match(/viewBox="([^"]+)"/)?.[1].split(/[\s,]+/).map(Number);
  const w = vb ? vb[2] : parseFloat(svg.match(/width="([\d.]+)/)?.[1] ?? '600');
  const h = vb ? vb[3] : parseFloat(svg.match(/height="([\d.]+)/)?.[1] ?? '800');
  return svg.replace(/<\?xml[^>]*>/, '').replace(/<svg\b[^>]*>/, `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" overflow="visible">`);
}

/**
 * A STEP model seen from above: every part's box, the board's own, and the
 * board's vertical circles (its holes), aligned like a drawing. The up axis
 * is the board part's thinnest (a model made Y-up turns by itself).
 */
function stepLayer(def, file, boxes) {
  const model = readStep(readFileSync(file, 'latin1'));
  const raw = model.parts();
  if (raw.length === 0) return { how: 'a STEP model this reader cannot follow', score: -1 };
  const footprint = (p, a, b) => (p.hi[a] - p.lo[a]) * (p.hi[b] - p.lo[b]);
  const pick = (list, a, b) => [...list].sort((p, q) => footprint(q, a, b) - footprint(p, a, b))[0];
  const named = raw.filter((p) => /board|pcb/i.test(p.name) && !/asm|assembly/i.test(p.name));
  let board = pick(named.length ? named : raw, 0, 1);
  const extent = [0, 1, 2].map((k) => board.hi[k] - board.lo[k]);
  const upAxis = extent.indexOf(Math.min(...extent));
  // the other two axes, right-handed, as x and y
  const [ax, ay] = [[1, 2], [2, 0], [0, 1]][upAxis];
  board = pick(named.length ? named : raw, ax, ay);
  const rect = (p) => {
    const [x0, y0, x1, y1] = [p.lo[ax], p.lo[ay], p.hi[ax], p.hi[ay]];
    return { kind: 'poly', pts: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], closed: true };
  };
  const shapes = raw.filter((p) => p !== board).map(rect);
  shapes.push(rect(board));
  for (const c of model.circles(board.name)) {
    if (Math.abs(c.normal[upAxis]) < 0.9) continue;
    shapes.push({ kind: 'circle', x: c.centre[ax], y: c.centre[ay], r: c.r });
  }
  const pose = align(def, shapes, [], boxes, true);
  const markup = shapesMarkup(shapes, pose ? pose.T : identityAt(shapes, def));
  // after a 2D drawing of the same board: boxes are coarser than outlines
  return { markup, how: `parts' boxes of the 3D model, ${pose ? pose.how : 'not aligned: two points by hand'}`, score: pose ? pose.score / 2 : 0.04 };
}

function pcbLayer(def, file, kind) {
  const read = kind === 'brd' ? readBrd(readFileSync(file, 'utf8')) : readKicad(readFileSync(file, 'utf8'));
  let best = null;
  for (const flip of [false, true]) {
    for (const deg of [0, 90, 180, 270]) {
      const board = turnBoard(read, deg, flip);
      const T = { s: 1, th: 0, f: 1, tx: 0, ty: 0 };
      const fit = board.holes.length ? holeFit(T, def.mount.holes, centreGrid(board.holes.map((h) => ({ x: h.x, y: h.y, ds: [h.d] })))) : { n: 0 };
      const size = Math.abs(board.outline.w - def.size.w) + Math.abs(board.outline.d - def.size.d);
      const score = fit.n - size / 10 + (flip ? 0 : 0.02) + (deg === 0 ? 0.01 : 0);
      if (!best || score > best.score) best = { board, deg, flip, fit, score };
    }
  }
  const { board } = best;
  const P = ([x, y]) => `${num(x)},${num(-y)}`;
  const outline = board.outlinePieces.filter((p) => p.length > 1).map((p) => `M${p.map(P).join('L')}`).join('');
  const holes = board.holes.map((h) => `<circle cx="${num(h.x)}" cy="${num(-h.y)}" r="${r2(h.d / 2)}"/>`).join('');
  const pads = board.elements.filter((e) => e.size && Math.max(e.size.w, e.size.d) >= 2).map((e) => ({
    e, x: e.x + e.size.cx - e.size.w / 2, y: e.y + e.size.cy + e.size.d / 2,
  }));
  const rects = pads.map(({ e, x, y }) => `<rect x="${num(x)}" y="${num(-y)}" width="${num(e.size.w)}" height="${num(e.size.d)}"${e.side === 'bottom' ? ' stroke-dasharray="1 0.6"' : ''}/>`).join('');
  const names = pads.map(({ e, x, y }) => `<text x="${num(x + e.size.w / 2)}" y="${num(-y + e.size.d / 2)}">${e.name}</text>`).join('');
  const markup = `<g fill="none" stroke="currentColor" stroke-width="0.15"><path d="${outline}" stroke-width="0.3"/>${holes}${rects}</g><g font-size="1.2" text-anchor="middle" dominant-baseline="middle" fill="currentColor">${names}</g>`;
  const how = `pads of the layout (≥ 2 mm); holes ${best.fit.n}/${def.mount.holes.length}, turned ${best.deg}°${best.flip ? ', mirrored' : ''}; dashed: underside`;
  return { markup, how, score: best.fit.n + 0.5 };
}

/**
 * Every layer of an entry (`boxes`: its connectors' boxes in the board
 * frame, [x0, y0, x1, y1]): { name, kind, how, score } with `markup` (display
 * mm), or `nested` + `matrix` (a PDF page), or `image` (a file next to the
 * page, placed by hand), or `link` (an HTML page the drawing is only on).
 */
export function layersFor(def, boxes, outDir, log = () => {}) {
  const layers = [];
  const borrowed = [];
  for (const { file, kind } of drawingFiles(def)) {
    const name = basename(file);
    const t0 = Date.now();
    try {
      if (kind === 'dxf') layers.push({ name, kind, ...dxfLayer(def, file, borrowed, boxes) });
      else if (kind === 'pdf') for (const layer of pdfLayers(def, file, boxes)) layers.push({ name, kind, ...layer });
      else if (kind === 'brd' || kind === 'kicad') layers.push({ name, kind, ...pcbLayer(def, file, kind) });
      else if (kind === 'image') {
        mkdirSync(join(outDir, 'images'), { recursive: true });
        const target = `images/${def.id}-${layers.length}${extname(file).toLowerCase()}`;
        copyFileSync(file, join(outDir, target));
        layers.push({ name, kind, image: target, how: 'a picture: align it by two points', score: 0.1 });
      } else if (kind === 'step') layers.push({ name, kind, ...stepLayer(def, file, boxes) });
      else if (kind === 'page') layers.push({ name, kind, how: 'a web page: the drawing is somewhere on it', score: -2 });
    } catch (error) {
      layers.push({ name, kind, how: `failed: ${String(error.message ?? error).slice(0, 200)}`, score: -3 });
    }
    log(`  ${def.id}: ${name} — ${layers.at(-1).how} (${Date.now() - t0} ms)`);
  }
  return layers.sort((a, b) => b.score - a.score);
}

/**
 * The page: the template with the schemes inline; each board's layers in
 * data/<id>.js, loaded when it is opened. A run on some boards (--only)
 * replaces just those in the page already there (boards.json keeps the rest).
 */
export function writeReview(outDir, boards, layers) {
  mkdirSync(join(outDir, 'data'), { recursive: true });
  for (const [id, list] of Object.entries(layers)) {
    writeFileSync(join(outDir, 'data', `${id}.js`), `window.__layers(${JSON.stringify(id)}, ${JSON.stringify(list)});\n`);
  }
  const summaryOf = (list) => list.map(({ name, kind, how }) => ({ name, kind, how }));
  const kept = join(outDir, 'boards.json');
  const before = existsSync(kept) ? JSON.parse(readFileSync(kept, 'utf8')) : { boards: [], summary: {} };
  // in the catalog's order: the old list with these boards replaced, new ones at the end
  const fresh = new Map(boards.map((b) => [b.id, b]));
  const all = [...before.boards.map((b) => fresh.get(b.id) ?? b), ...boards.filter((b) => !before.boards.some((o) => o.id === b.id))];
  const summary = { ...before.summary, ...Object.fromEntries(Object.entries(layers).map(([id, list]) => [id, summaryOf(list)])) };
  writeFileSync(kept, JSON.stringify({ boards: all, summary }));
  const template = readFileSync(new URL('./review.html', import.meta.url), 'utf8');
  const data = JSON.stringify({ boards: all, summary }).replaceAll('</', '<\\/');
  writeFileSync(join(outDir, 'index.html'), template.replace('/*DATA*/null', data));
}
