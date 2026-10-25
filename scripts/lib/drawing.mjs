// 2D drawings as plain shapes, for the board tools (scripts/dxf.mjs): a DXF
// with its blocks expanded, or a vector PDF through `pdftocairo -svg`. Every
// shape is in millimetres, y up, and remembers its layer and the top-level
// block it came from — Allegro and Radxa exports name the package there
// (TYPEC, CON_HDMI, USB3_TH18…), so a block is a component.
//
// Standard library only (CLAUDE.md: no new dependencies); pdftocairo comes
// with poppler.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// --- affine 2D transforms: [a, b, c, d, e, f] maps (x, y) to (a·x + c·y + e, b·x + d·y + f), as SVG's matrix()

const IDENTITY = [1, 0, 0, 1, 0, 0];

function mul(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

function apply(m, x, y) {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** How a transform scales lengths (a circle's radius). */
function scaleOf(m) {
  return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
}

/** Transforms a shape, keeping its layer and block. */
function place(shape, m) {
  const s = scaleOf(m);
  if (shape.kind === 'line') {
    const [x1, y1] = apply(m, shape.x1, shape.y1);
    const [x2, y2] = apply(m, shape.x2, shape.y2);
    return { ...shape, x1, y1, x2, y2 };
  }
  if (shape.kind === 'circle') {
    const [x, y] = apply(m, shape.x, shape.y);
    return { ...shape, x, y, r: shape.r * s };
  }
  if (shape.kind === 'arc') {
    // an arc becomes a polyline: a rotated or mirrored block would turn its angles around
    return place(arcToPoly(shape), m);
  }
  return { ...shape, pts: shape.pts.map(([x, y]) => apply(m, x, y)) };
}

function arcToPoly(arc) {
  let a0 = (arc.a0 * Math.PI) / 180;
  let a1 = (arc.a1 * Math.PI) / 180;
  if (a1 < a0) a1 += 2 * Math.PI;
  const n = Math.max(2, Math.ceil(((a1 - a0) / Math.PI) * 16));
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [arc.x + arc.r * Math.cos(a), arc.y + arc.r * Math.sin(a)];
  });
  return { kind: 'poly', pts, closed: false, layer: arc.layer, block: arc.block, instance: arc.instance };
}

// --- DXF

/** Group code / value pairs of a DXF file. */
function dxfPairs(text) {
  const lines = text.split(/\r?\n/);
  const pairs = [];
  for (let i = 0; i + 1 < lines.length; i += 2) pairs.push([Number(lines[i].trim()), lines[i + 1].trim()]);
  return pairs;
}

/** Entities of a section, each { type, codes }; old-style POLYLINE gets its VERTEX list. */
function sectionEntities(pairs, name) {
  const out = [];
  let inside = false;
  let expectName = false;
  let current = null;
  for (const [code, value] of pairs) {
    if (code === 0 && value === 'SECTION') { expectName = true; continue; }
    if (expectName && code === 2) { inside = value === name; expectName = false; continue; }
    if (code === 0 && value === 'ENDSEC') { inside = false; current = null; continue; }
    if (!inside) continue;
    if (code === 0) {
      current = { type: value, codes: [] };
      out.push(current);
    } else if (current) {
      current.codes.push([code, value]);
    }
  }
  for (let i = 0; i < out.length; i++) {
    if (out[i].type !== 'POLYLINE') continue;
    out[i].vertices = [];
    while (out[i + 1] && out[i + 1].type === 'VERTEX') out[i].vertices.push(out.splice(i + 1, 1)[0]);
    if (out[i + 1]?.type === 'SEQEND') out.splice(i + 1, 1);
  }
  return out;
}

const code = (e, c, index = 0) => e.codes.filter(([k]) => k === c)[index]?.[1];
const num = (e, c, fallback = NaN, index = 0) => {
  const v = code(e, c, index);
  return v === undefined ? fallback : Number(v);
};
const layerOf = (e) => code(e, 8) ?? '0';

/** BLOCKS: name → { base: [x, y], entities }. */
function dxfBlocks(pairs) {
  const blocks = new Map();
  let current = null;
  for (const e of sectionEntities(pairs, 'BLOCKS')) {
    if (e.type === 'BLOCK') {
      current = { base: [num(e, 10, 0), num(e, 20, 0)], entities: [] };
      blocks.set(code(e, 2) ?? '', current);
    } else if (e.type === 'ENDBLK') {
      current = null;
    } else if (current) {
      current.entities.push(e);
    }
  }
  return blocks;
}

/** The transform of an INSERT: the block's base point to the insertion point, scaled and rotated. */
function insertTransform(e, base, col = 0, row = 0) {
  const sx = num(e, 41, 1);
  const sy = num(e, 42, 1);
  const angle = (num(e, 50, 0) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // array inserts: columns and rows step in the block's rotated frame
  const dx = col * num(e, 44, 0);
  const dy = row * num(e, 45, 0);
  const tx = num(e, 10, 0) + cos * dx - sin * dy;
  const ty = num(e, 20, 0) + sin * dx + cos * dy;
  const rotate = [cos, sin, -sin, cos, tx, ty];
  const scale = [sx, 0, 0, sy, 0, 0];
  const toBase = [1, 0, 0, 1, -base[0], -base[1]];
  return mul(mul(rotate, scale), toBase);
}

/**
 * The drawable shapes of a DXF, blocks expanded (nested, with their
 * transforms; an entity on layer 0 inside a block takes the INSERT's layer).
 * Each shape says the top-level block it came from (`block`, or '') and
 * which placement of it (`instance`, 0 outside blocks).
 */
export function readDxf(text) {
  const pairs = dxfPairs(text);
  const blocks = dxfBlocks(pairs);
  const shapes = [];
  let instances = 0;
  const walk = (entities, m, inherited, block, instance, depth) => {
    for (const e of entities) {
      const own = layerOf(e);
      const layer = own === '0' && inherited ? inherited : own;
      const shape = dxfShape(e, layer, block, instance);
      if (shape) shapes.push(m === IDENTITY ? shape : place(shape, m));
      if (e.type === 'INSERT' && depth < 16) {
        const name = code(e, 2) ?? '';
        const def = blocks.get(name);
        if (!def) continue;
        const cols = Math.max(1, num(e, 70, 1));
        const rows = Math.max(1, num(e, 71, 1));
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            // a top-level insert is one component; nested ones belong to it
            walk(def.entities, mul(m, insertTransform(e, def.base, c, r)), layer, block || name, block ? instance : ++instances, depth + 1);
          }
        }
      }
    }
  };
  walk(sectionEntities(pairs, 'ENTITIES'), IDENTITY, '', '', 0, 0);
  return shapes;
}

function dxfShape(e, layer, block, instance) {
  const common = { layer, block, instance };
  if (e.type === 'LINE') return { kind: 'line', x1: num(e, 10), y1: num(e, 20), x2: num(e, 11), y2: num(e, 21), ...common };
  if (e.type === 'CIRCLE') return { kind: 'circle', x: num(e, 10), y: num(e, 20), r: num(e, 40), ...common };
  if (e.type === 'ARC') return { kind: 'arc', x: num(e, 10), y: num(e, 20), r: num(e, 40), a0: num(e, 50), a1: num(e, 51), ...common };
  if (e.type === 'LWPOLYLINE') {
    const xs = e.codes.filter(([c]) => c === 10).map(([, v]) => Number(v));
    const ys = e.codes.filter(([c]) => c === 20).map(([, v]) => Number(v));
    return { kind: 'poly', pts: xs.map((x, i) => [x, ys[i]]), closed: (num(e, 70, 0) & 1) === 1, ...common };
  }
  if (e.type === 'POLYLINE') {
    return { kind: 'poly', pts: e.vertices.map((v) => [num(v, 10), num(v, 20)]), closed: (num(e, 70, 0) & 1) === 1, ...common };
  }
  if (e.type === 'SOLID') {
    // a filled triangle or quad (Gerber flashes exported to DXF): its corners
    const pts = [0, 1, 3, 2].map((i) => [num(e, 10 + i), num(e, 20 + i)]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
    return { kind: 'poly', pts, closed: true, ...common };
  }
  return null;
}

/** Layer → entity type → count, blocks expanded. */
export function layerCounts(shapes) {
  const counts = new Map();
  for (const s of shapes) {
    const key = `${s.layer}\t${s.kind}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

// --- SVG (pdftocairo output) and PDF

const PT_MM = 25.4 / 72;

function parseTransform(s) {
  let m = IDENTITY;
  for (const [, name, args] of String(s ?? '').matchAll(/(\w+)\(([^)]*)\)/g)) {
    const v = args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    let t = null;
    if (name === 'matrix') t = v;
    else if (name === 'translate') t = [1, 0, 0, 1, v[0], v[1] ?? 0];
    else if (name === 'scale') t = [v[0], 0, 0, v[1] ?? v[0], 0, 0];
    else if (name === 'rotate') {
      const a = (v[0] * Math.PI) / 180;
      t = [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0];
    }
    if (t) m = mul(m, t);
  }
  return m;
}

function attr(tag, name) {
  return tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
}

/** The subpaths of an SVG path's d, curves sampled; each { pts, closed, curves }. */
function subpaths(d) {
  const tokens = d.match(/[MLCZHVmlczhv]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  const out = [];
  let cur = null;
  let cmd = '';
  let i = 0;
  let pos = [0, 0];
  let start = [0, 0];
  const take = () => Number(tokens[i++]);
  const flush = (closed) => {
    if (cur && cur.pts.length > 1) out.push({ ...cur, closed });
    cur = null;
  };
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase();
    const at = (x, y) => (rel ? [pos[0] + x, pos[1] + y] : [x, y]);
    switch (cmd.toUpperCase()) {
      case 'M':
        flush(false);
        pos = at(take(), take());
        start = pos;
        cur = { pts: [pos], curves: 0 };
        cmd = rel ? 'l' : 'L';
        break;
      case 'L':
        pos = at(take(), take());
        cur?.pts.push(pos);
        break;
      case 'H':
        pos = [rel ? pos[0] + take() : take(), pos[1]];
        cur?.pts.push(pos);
        break;
      case 'V':
        pos = [pos[0], rel ? pos[1] + take() : take()];
        cur?.pts.push(pos);
        break;
      case 'C': {
        const p0 = pos;
        const p1 = at(take(), take());
        const p2 = at(take(), take());
        const p3 = at(take(), take());
        for (let k = 1; k <= 8; k++) {
          const u = k / 8;
          const a = (1 - u) ** 3, b = 3 * (1 - u) ** 2 * u, c = 3 * (1 - u) * u * u, e = u ** 3;
          cur?.pts.push([a * p0[0] + b * p1[0] + c * p2[0] + e * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + e * p3[1]]);
        }
        pos = p3;
        if (cur) cur.curves++;
        break;
      }
      case 'Z':
        if (cur) cur.pts.push(start);
        pos = start;
        flush(true);
        cur = { pts: [start], curves: 0 };
        cmd = '';
        break;
      default:
        i++;
    }
  }
  flush(false);
  return out;
}

/** A closed subpath made of curves whose points all sit at one distance from their centre: a circle. */
function asCircle(pts) {
  if (pts.length < 9) return null;
  const xs = pts.map(([x]) => x);
  const ys = pts.map(([, y]) => y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const rs = pts.map(([x, y]) => Math.hypot(x - cx, y - cy));
  const r = rs.reduce((a, b) => a + b, 0) / rs.length;
  if (r <= 0.01 || Math.max(...rs) - Math.min(...rs) > 0.03 * r + 0.005) return null;
  return { x: cx, y: cy, r };
}

/**
 * The shapes of a pdftocairo SVG, in mm (1 pt = 25.4/72 mm, times `scale`),
 * y up. Text glyphs (in <defs>, drawn with <use>) are left out. A closed
 * subpath of curves that is round becomes a circle (cairo writes circles as
 * four Béziers).
 */
export function readSvg(text, scale = 1) {
  const k = PT_MM * scale;
  const shapes = [];
  const stack = [IDENTITY];
  let skip = 0;
  for (const [tag] of text.matchAll(/<\/?[a-zA-Z][^>]*>/g)) {
    const closing = tag.startsWith('</');
    const name = tag.match(/^<\/?([a-zA-Z]+)/)[1];
    const selfClosing = tag.endsWith('/>');
    if (['defs', 'clipPath', 'symbol', 'mask', 'pattern'].includes(name)) {
      if (closing) skip--;
      else if (!selfClosing) skip++;
      continue;
    }
    if (name === 'g' || name === 'svg') {
      if (closing) stack.pop();
      else if (!selfClosing) stack.push(mul(stack[stack.length - 1], parseTransform(attr(tag, 'transform'))));
      continue;
    }
    if (closing || skip > 0) continue;
    const m = mul(stack[stack.length - 1], parseTransform(attr(tag, 'transform')));
    let d = null;
    if (name === 'path') d = attr(tag, 'd');
    else if (name === 'rect') {
      const [x, y, w, h] = ['x', 'y', 'width', 'height'].map((a) => Number(attr(tag, a) ?? 0));
      d = `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
    }
    if (!d) continue;
    const fill = attr(tag, 'fill') ?? '';
    for (const sub of subpaths(d)) {
      const pts = sub.pts.map(([x, y]) => {
        const [X, Y] = apply(m, x, y);
        return [X * k, -Y * k];
      });
      // some exporters end a circle where it started without a Z
      const [first, last] = [pts[0], pts[pts.length - 1]];
      const closed = sub.closed || Math.hypot(first[0] - last[0], first[1] - last[1]) < 0.005;
      const circle = closed && sub.curves >= 2 ? asCircle(pts) : null;
      const layer = fill && fill !== 'none' ? 'fill' : 'stroke';
      if (circle) shapes.push({ kind: 'circle', ...circle, layer, block: '', instance: 0 });
      else shapes.push({ kind: 'poly', pts, closed, layer, block: '', instance: 0 });
    }
  }
  return shapes;
}

/** One page of a PDF as SVG text, through pdftocairo. */
export function pdfToSvg(file, page = 1) {
  const dir = mkdtempSync(join(tmpdir(), 'case-pdf-'));
  try {
    const out = join(dir, 'page.svg');
    const result = spawnSync('pdftocairo', ['-svg', '-f', String(page), '-l', String(page), file, out], { encoding: 'utf8' });
    if (result.error || result.status !== 0) {
      throw new Error(`pdftocairo failed: ${result.error?.message ?? result.stderr} (install poppler)`);
    }
    return readFileSync(out, 'utf8');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Whether pdftocairo is on the PATH. */
export function havePdftocairo() {
  const result = spawnSync('pdftocairo', ['-v'], { encoding: 'utf8' });
  return !result.error;
}

// --- measuring

/**
 * Extents of the outline-ish shapes (circles left out: holes sit inside),
 * or of the circles when there is nothing else (a drill-only drawing).
 */
export function extents(shapes) {
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const grow = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    box.x0 = Math.min(box.x0, x); box.y0 = Math.min(box.y0, y);
    box.x1 = Math.max(box.x1, x); box.y1 = Math.max(box.y1, y);
  };
  for (const s of shapes) {
    if (s.kind === 'line') { grow(s.x1, s.y1); grow(s.x2, s.y2); }
    if (s.kind === 'arc') { grow(s.x - s.r, s.y - s.r); grow(s.x + s.r, s.y + s.r); }
    if (s.kind === 'poly') for (const [x, y] of s.pts) grow(x, y);
  }
  if (!Number.isFinite(box.x0)) for (const s of shapes) if (s.kind === 'circle') { grow(s.x - s.r, s.y - s.r); grow(s.x + s.r, s.y + s.r); }
  return box;
}

/** Scales every shape about the origin. */
export function scaled(shapes, k) {
  return shapes.map((s) => place(s, [k, 0, 0, k, 0, 0]));
}

/** The bounding box of one shape. */
export function shapeBox(s) {
  if (s.kind === 'circle' || s.kind === 'arc') return { x0: s.x - s.r, y0: s.y - s.r, x1: s.x + s.r, y1: s.y + s.r };
  const pts = s.kind === 'line' ? [[s.x1, s.y1], [s.x2, s.y2]] : s.pts;
  const xs = pts.map(([x]) => x);
  const ys = pts.map(([, y]) => y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/**
 * Component boxes: every polyline on its own, and every top-level block as
 * one box under its name (all it draws, expanded). Relative to `origin`.
 */
export function componentBoxes(shapes, origin = { x0: 0, y0: 0 }) {
  const out = [];
  const byInstance = new Map();
  for (const s of shapes) {
    const b = shapeBox(s);
    if (s.block) {
      const entry = byInstance.get(s.instance) ?? { name: s.block, boxes: [] };
      entry.boxes.push(b);
      byInstance.set(s.instance, entry);
    } else if (s.kind === 'poly' && s.pts.length > 1) {
      out.push({ name: '', ...b });
    }
  }
  for (const { name, boxes } of byInstance.values()) {
    out.push({
      name,
      x0: Math.min(...boxes.map((b) => b.x0)),
      y0: Math.min(...boxes.map((b) => b.y0)),
      x1: Math.max(...boxes.map((b) => b.x1)),
      y1: Math.max(...boxes.map((b) => b.y1)),
    });
  }
  return out.map((b) => ({ ...b, x0: b.x0 - origin.x0, x1: b.x1 - origin.x0, y0: b.y0 - origin.y0, y1: b.y1 - origin.y0 }));
}
