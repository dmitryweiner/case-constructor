// PCB layout files as a list of placed footprints, for the board tools
// (scripts/board.mjs --brd / --kicad): Eagle .brd (XML) and KiCad
// .kicad_pcb (s-expressions). Every footprint comes in the board frame —
// origin at the lower-left corner of the outline, x right, y up — with its
// side, its pads' box and the nets on its pads (a button's net tells reset
// from boot). Standard library only (CLAUDE.md).

import { arcSweep, arcThrough } from './outline.mjs';

// --- frame helpers

function rotated(x, y, deg) {
  const a = (deg * Math.PI) / 180;
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
}

function bboxOf(points) {
  if (points.length === 0) return null;
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/** A local box turned by a footprint's rotation (and mirror), as a box around its centre. */
function placedSize(local, deg, mirror) {
  if (!local) return null;
  const corners = [[local.x0, local.y0], [local.x1, local.y0], [local.x0, local.y1], [local.x1, local.y1]]
    .map(([x, y]) => rotated(mirror ? -x : x, y, deg));
  const b = bboxOf(corners);
  // a turn by 90° leaves 1e-16 noise in the sizes
  const clean = (v) => Math.round(v * 1e4) / 1e4;
  return { w: clean(b.x1 - b.x0), d: clean(b.y1 - b.y0), cx: clean((b.x0 + b.x1) / 2), cy: clean((b.y0 + b.y1) / 2) };
}

// --- Eagle

function attrs(tag) {
  const out = {};
  for (const m of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

/** Eagle's rotation attribute: "R90", "MR270", "SR45"… */
function eagleRot(rot) {
  const s = rot ?? 'R0';
  return { deg: Number(s.match(/R(-?[\d.]+)/)?.[1] ?? 0), mirror: s.includes('M') };
}

/**
 * An Eagle board: { outline: { w, d }, holes, elements: [...] }. An element
 * on the bottom side is mirrored in Eagle (rot "MR…"); its position is still
 * given as seen from the top.
 */
export function readBrd(text) {
  const board = text.slice(text.indexOf('<board'), text.indexOf('</board>'));
  const plain = board.slice(board.indexOf('<plain'), board.indexOf('</plain>'));
  const outlinePieces = [];
  const holes = [...plain.matchAll(/<hole\b[^>]*>/g)].map(([tag]) => {
    const a = attrs(tag);
    return { x: Number(a.x), y: Number(a.y), d: Number(a.drill) };
  });
  for (const [tag] of plain.matchAll(/<wire\b[^>]*>/g)) {
    const a = attrs(tag);
    if (a.layer !== '20') continue;
    const p0 = [Number(a.x1), Number(a.y1)];
    const p1 = [Number(a.x2), Number(a.y2)];
    // a curved wire: Eagle's curve is the arc's sweep in degrees, counter-clockwise positive
    outlinePieces.push(a.curve ? [p0, ...arcSweep(p0, p1, Number(a.curve))] : [p0, p1]);
  }
  // package geometry: pads and smds give the footprint's box
  const packages = new Map();
  for (const lib of board.matchAll(/<library\b([^>]*)>([\s\S]*?)<\/library>/g)) {
    const libName = attrs(lib[1]).name;
    for (const pkg of lib[2].matchAll(/<package\b([^>]*)>([\s\S]*?)<\/package>/g)) {
      const points = [];
      for (const [tag] of pkg[2].matchAll(/<(?:smd|pad)\b[^>]*>/g)) {
        const a = attrs(tag);
        const x = Number(a.x), y = Number(a.y);
        const dx = Number(a.dx ?? a.diameter ?? 0) / 2, dy = Number(a.dy ?? a.diameter ?? 0) / 2;
        const { deg } = eagleRot(a.rot);
        for (const [cx, cy] of [[-dx, -dy], [dx, -dy], [-dx, dy], [dx, dy]]) {
          const [rx, ry] = rotated(cx, cy, deg);
          points.push([x + rx, y + ry]);
        }
      }
      if (points.length === 0) {
        for (const [tag] of pkg[2].matchAll(/<wire\b[^>]*>/g)) {
          const a = attrs(tag);
          if (a.layer === '21' || a.layer === '51') points.push([Number(a.x1), Number(a.y1)], [Number(a.x2), Number(a.y2)]);
        }
      }
      packages.set(`${libName}/${attrs(pkg[1]).name}`, bboxOf(points));
    }
  }
  const nets = new Map();
  for (const sig of board.matchAll(/<signal\b([^>]*)>([\s\S]*?)<\/signal>/g)) {
    const name = attrs(sig[1]).name;
    for (const [tag] of sig[2].matchAll(/<contactref\b[^>]*>/g)) {
      const element = attrs(tag).element;
      if (!nets.has(element)) nets.set(element, new Set());
      nets.get(element).add(name);
    }
  }
  const elements = [];
  for (const [tag] of board.matchAll(/<element\b[^>]*>/g)) {
    const a = attrs(tag);
    const { deg, mirror } = eagleRot(a.rot);
    elements.push({
      name: a.name, value: a.value ?? '', package: a.package ?? '',
      x: Number(a.x), y: Number(a.y), rot: deg, side: mirror ? 'bottom' : 'top',
      size: placedSize(packages.get(`${a.library}/${a.package}`), deg, mirror),
      nets: [...(nets.get(a.name) ?? [])],
    });
  }
  return frame(outlinePieces, elements, false, holes);
}

// --- KiCad

/** A tiny s-expression reader: lists of atoms and lists. */
function sexp(text) {
  const root = [];
  const stack = [root];
  const re = /\(|\)|"((?:[^"\\]|\\.)*)"|[^\s()"]+/g;
  for (const m of text.matchAll(re)) {
    const t = m[0];
    if (t === '(') {
      const list = [];
      stack[stack.length - 1].push(list);
      stack.push(list);
    } else if (t === ')') {
      stack.pop();
    } else {
      stack[stack.length - 1].push(m[1] !== undefined ? m[1] : t);
    }
  }
  return root[0] ?? [];
}

const head = (list) => (Array.isArray(list) ? list[0] : undefined);
const child = (list, name) => list.find((x) => head(x) === name);
const childrenNamed = (list, name) => list.filter((x) => head(x) === name);
const xy = (list, name) => {
  const c = child(list, name);
  return c ? [Number(c[1]), Number(c[2])] : null;
};

/** An Edge.Cuts drawing (line, arc, rect, poly, circle) as a polyline in its parent's frame; null on other layers. */
function edgePiece(item) {
  const name = head(item);
  if (child(item, 'layer')?.[1] !== 'Edge.Cuts') return null;
  if (name.endsWith('_poly')) {
    const pts = childrenNamed(child(item, 'pts') ?? [], 'xy').map((p) => [Number(p[1]), Number(p[2])]);
    return pts.length > 2 ? [...pts, pts[0]] : null;
  }
  if (name.endsWith('_circle')) {
    const c = xy(item, 'center');
    const e = xy(item, 'end');
    if (!c || !e) return null;
    const r = Math.hypot(e[0] - c[0], e[1] - c[1]);
    return Array.from({ length: 33 }, (_, i) => [c[0] + r * Math.cos((i * Math.PI) / 16), c[1] + r * Math.sin((i * Math.PI) / 16)]);
  }
  const a = xy(item, 'start');
  const b = xy(item, 'end');
  if (!a || !b) return null;
  if (name.endsWith('_rect')) return [a, [b[0], a[1]], b, [a[0], b[1]], a];
  const m = xy(item, 'mid');
  if (name.endsWith('_arc') && m) return [a, ...arcThrough(a, m, b)];
  return [a, b];
}

/**
 * A KiCad board: { outline: { w, d }, holes (none), elements: [...] }. KiCad's y
 * points down; the frame turns it up. A footprint on B.Cu is on the bottom.
 */
export function readKicad(text) {
  const pcb = sexp(text);
  const outlinePieces = [];
  for (const item of pcb) {
    const piece = Array.isArray(item) && /^gr_(line|arc|rect|poly|circle)$/.test(head(item)) ? edgePiece(item) : null;
    if (piece) outlinePieces.push(piece);
  }
  const elements = [];
  for (const fp of pcb) {
    if (!Array.isArray(fp) || (head(fp) !== 'footprint' && head(fp) !== 'module')) continue;
    const at = child(fp, 'at') ?? ['at', 0, 0, 0];
    const [fx, fy, frot] = [Number(at[1]), Number(at[2]), Number(at[3] ?? 0)];
    const side = child(fp, 'layer')?.[1] === 'B.Cu' ? 'bottom' : 'top';
    // a footprint's local frame is turned by -rot in KiCad's y-down coordinates
    const toBoard = ([x, y]) => {
      const [rx, ry] = rotated(x, y, -frot);
      return [fx + rx, fy + ry];
    };
    for (const item of fp) {
      const piece = Array.isArray(item) && /^fp_(line|arc|rect|poly|circle)$/.test(head(item)) ? edgePiece(item) : null;
      if (piece) outlinePieces.push(piece.map(toBoard));
    }
    const property = (name) => childrenNamed(fp, 'property').find((p) => p[1] === name)?.[2]
      ?? childrenNamed(fp, 'fp_text').find((p) => p[1] === name.toLowerCase())?.[2] ?? '';
    const pads = childrenNamed(fp, 'pad');
    const padPoints = [];
    const nets = new Set();
    for (const pad of pads) {
      const pat = child(pad, 'at');
      const size = child(pad, 'size');
      if (pat && size) {
        const [px, py, prot] = [Number(pat[1]), Number(pat[2]), Number(pat[3] ?? 0)];
        const hx = Number(size[1]) / 2, hy = Number(size[2]) / 2;
        // pad rotation in KiCad includes the footprint's: take it relative
        for (const [cx, cy] of [[-hx, -hy], [hx, -hy], [-hx, hy], [hx, hy]]) {
          const [rx, ry] = rotated(cx, cy, -(prot - frot));
          padPoints.push([px + rx, -(py + ry)]);
        }
      }
      const net = child(pad, 'net');
      if (net && net[2]) nets.add(net[2]);
    }
    elements.push({
      name: property('Reference'), value: property('Value'), package: String(fp[1] ?? ''),
      x: fx, y: fy, rot: frot, side,
      // pads are in the footprint's frame with y down; flipped to y up above, turned by the footprint's rotation
      size: placedSize(bboxOf(padPoints), frot, false),
      nets: [...nets],
    });
  }
  return frame(outlinePieces, elements, true);
}

/** Into the board frame: origin at the outline's lower-left corner, y up. */
function frame(outlinePieces, elements, yDown, holes = []) {
  const box = bboxOf(outlinePieces.flat()) ?? bboxOf(elements.map((e) => [e.x, e.y])) ?? { x0: 0, y0: 0, x1: 0, y1: 0 };
  const toFrame = (x, y) => [x - box.x0, yDown ? box.y1 - y : y - box.y0];
  return {
    outline: { w: box.x1 - box.x0, d: box.y1 - box.y0 },
    // the outline's drawing, piece by piece (outline.mjs chains them into the entry's polygon)
    outlinePieces: outlinePieces.map((piece) => piece.map(([x, y]) => toFrame(x, y))),
    // mounting holes drawn on the board itself (Eagle's plain <hole>)
    holes: holes.map((h) => {
      const [x, y] = toFrame(h.x, h.y);
      return { ...h, x, y };
    }),
    elements: elements.map((e) => {
      const [x, y] = toFrame(e.x, e.y);
      return { ...e, x, y };
    }),
  };
}

/**
 * The board turned (90/180/270, counter-clockwise) and/or mirrored (a bottom
 * view), re-origined at the lower-left corner, so it matches the catalog's
 * top view. A turned footprint swaps its w and d.
 */
export function turnBoard(board, deg = 0, flip = false) {
  const { w, d } = board.outline;
  const quarter = ((Math.round(deg / 90) % 4) + 4) % 4;
  const map = ([x, y]) => {
    const fx = flip ? w - x : x;
    switch (quarter) {
      case 1: return [d - y, fx];
      case 2: return [w - fx, d - y];
      case 3: return [y, w - fx];
      default: return [fx, y];
    }
  };
  const swap = quarter % 2 === 1;
  return {
    outline: swap ? { w: d, d: w } : { w, d },
    outlinePieces: board.outlinePieces.map((piece) => piece.map(map)),
    holes: board.holes.map((h) => {
      const [x, y] = map([h.x, h.y]);
      return { ...h, x, y };
    }),
    elements: board.elements.map((e) => {
      const [x, y] = map([e.x, e.y]);
      const size = e.size && swap ? { ...e.size, w: e.size.d, d: e.size.w } : e.size;
      return { ...e, x, y, size, side: flip ? (e.side === 'top' ? 'bottom' : 'top') : e.side };
    }),
  };
}
