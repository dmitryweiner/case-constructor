// A board's outline from the pieces a drawing draws it with — lines, arcs
// and polylines that meet end to end — as the catalog's `outline`: one
// closed polygon, counter-clockwise, corners' arcs reduced to a few points.
// Used by dxf.mjs --outline and board.mjs --brd/--kicad --outline.

/** Points along an arc from a to b through m (three points on a circle), excluding a. */
export function arcThrough(a, m, b, maxStep = Math.PI / 16) {
  const d = 2 * (a[0] * (m[1] - b[1]) + m[0] * (b[1] - a[1]) + b[0] * (a[1] - m[1]));
  if (Math.abs(d) < 1e-12) return [m, b];
  const sq = (p) => p[0] * p[0] + p[1] * p[1];
  const cx = (sq(a) * (m[1] - b[1]) + sq(m) * (b[1] - a[1]) + sq(b) * (a[1] - m[1])) / d;
  const cy = (sq(a) * (b[0] - m[0]) + sq(m) * (a[0] - b[0]) + sq(b) * (m[0] - a[0])) / d;
  const r = Math.hypot(a[0] - cx, a[1] - cy);
  const ang = (p) => Math.atan2(p[1] - cy, p[0] - cx);
  const a0 = ang(a);
  // the sweep that passes through m
  const norm = (x) => ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const ccw = norm(ang(m) - a0) < norm(ang(b) - a0);
  const sweep = ccw ? norm(ang(b) - a0) : -norm(a0 - ang(b));
  const n = Math.max(2, Math.ceil(Math.abs(sweep) / maxStep));
  return Array.from({ length: n }, (_, i) => {
    const t = a0 + (sweep * (i + 1)) / n;
    return [cx + r * Math.cos(t), cy + r * Math.sin(t)];
  });
}

/** An arc of `sweepDeg` degrees (positive counter-clockwise) from a to b, as points excluding a. */
export function arcSweep(a, b, sweepDeg) {
  const s = (sweepDeg * Math.PI) / 180;
  const half = Math.hypot(b[0] - a[0], b[1] - a[1]) / 2;
  if (Math.abs(s) < 1e-9 || half < 1e-12) return [b];
  const r = half / Math.sin(Math.abs(s) / 2);
  // the centre lies to the left of a→b for a counter-clockwise sweep below 180°
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const ux = (b[0] - a[0]) / (2 * half), uy = (b[1] - a[1]) / (2 * half);
  const h = Math.sqrt(Math.max(0, r * r - half * half)) * (Math.abs(s) > Math.PI ? -1 : 1) * Math.sign(s);
  const cx = mx - uy * h, cy = my + ux * h;
  const a0 = Math.atan2(a[1] - cy, a[0] - cx);
  const n = Math.max(2, Math.ceil(Math.abs(s) / (Math.PI / 16)));
  return Array.from({ length: n }, (_, i) => {
    const t = a0 + (s * (i + 1)) / n;
    return [cx + r * Math.cos(t), cy + r * Math.sin(t)];
  });
}

const close = (p, q, tol) => Math.abs(p[0] - q[0]) <= tol && Math.abs(p[1] - q[1]) <= tol;

/**
 * Closed loops from polylines that meet end to end (within `tol`), plus the
 * polylines that are closed already. Each loop is a point list without the
 * repeated first point. Where several pieces meet (a dimension line starting
 * at the outline's corner) every branch is tried, starting from the longest
 * pieces, and the loops found are all returned — `largestLoop` picks.
 */
export function chainLoops(polylines, tol = 0.02, { starts = 12, budget = 50000 } = {}) {
  const loops = [];
  const pieces = [];
  for (const pts of polylines) {
    if (pts.length < 2) continue;
    const closed = pts.length > 2 && close(pts[0], pts[pts.length - 1], tol);
    if (closed && Math.abs(signedArea2(pts)) > tol * tol) {
      loops.push(pts.slice(0, -1));
    } else if (closed) {
      // a line drawn there and back (some PDFs close every stroke with Z): the piece out to its far end
      let far = 0;
      for (let i = 1; i < pts.length; i++) if (Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]) > Math.hypot(pts[far][0] - pts[0][0], pts[far][1] - pts[0][1])) far = i;
      if (far > 0) pieces.push(pts.slice(0, far + 1));
    } else {
      pieces.push(pts);
    }
  }
  // endpoints snapped into nodes through a grid of cell `tol`
  const cell = Math.max(tol, 1e-6);
  const grid = new Map();
  const nodes = [];
  const nodeOf = (p) => {
    const gx = Math.round(p[0] / cell), gy = Math.round(p[1] / cell);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const id of grid.get(`${gx + dx},${gy + dy}`) ?? []) if (close(nodes[id], p, tol)) return id;
      }
    }
    nodes.push(p);
    const key = `${gx},${gy}`;
    grid.set(key, [...(grid.get(key) ?? []), nodes.length - 1]);
    return nodes.length - 1;
  };
  const edges = pieces.map((pts) => ({ pts, a: nodeOf(pts[0]), b: nodeOf(pts[pts.length - 1]) }));
  const adjacent = new Map();
  edges.forEach((e, i) => {
    if (e.a === e.b) return;
    for (const n of [e.a, e.b]) adjacent.set(n, [...(adjacent.get(n) ?? []), i]);
  });
  const length = (pts) => pts.reduce((sum, p, i) => (i ? sum + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
  const order = edges.map((e, i) => [i, length(e.pts)]).sort((x, y) => y[1] - x[1]).slice(0, starts).map(([i]) => i);
  const seen = new Set();
  for (const first of order) {
    let steps = 0;
    const usedEdges = new Set([first]);
    const usedNodes = new Set([edges[first].a]);
    const path = [first];
    const walk = (node) => {
      if (++steps > budget) return;
      for (const i of adjacent.get(node) ?? []) {
        if (usedEdges.has(i)) continue;
        const e = edges[i];
        const next = e.a === node ? e.b : e.a;
        if (next === edges[first].a) {
          const key = [...path, i].sort((x, y) => x - y).join(',');
          if (!seen.has(key)) {
            seen.add(key);
            loops.push(stitch([...path, i], edges, edges[first].a));
          }
          continue;
        }
        if (usedNodes.has(next)) continue;
        usedEdges.add(i);
        usedNodes.add(next);
        path.push(i);
        walk(next);
        path.pop();
        usedNodes.delete(next);
        usedEdges.delete(i);
      }
    };
    usedNodes.add(edges[first].b);
    walk(edges[first].b);
  }
  return loops;
}

/** The points of a cycle of edges, each piece turned to run on from the last. */
function stitch(cycle, edges, startNode) {
  const out = [];
  let node = startNode;
  for (const i of cycle) {
    const e = edges[i];
    const pts = e.a === node ? e.pts : [...e.pts].reverse();
    out.push(...pts.slice(0, -1));
    node = e.a === node ? e.b : e.a;
  }
  return out;
}

function signedArea2(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    s += x0 * y1 - x1 * y0;
  }
  return s;
}

function boxArea(pts) {
  const xs = pts.map(([x]) => x);
  const ys = pts.map(([, y]) => y);
  return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
}

/** The loop with the largest box: the board outline in a drawing of the board. */
export function largestLoop(loops) {
  return [...loops].sort((a, b) => boxArea(b) - boxArea(a))[0] ?? null;
}

/** Ramer–Douglas–Peucker on a closed loop: points closer than eps to a chord go. */
export function simplifyLoop(pts, eps) {
  if (pts.length <= 4) return pts;
  // split at the two points farthest apart so both halves are open polylines
  let far = 0;
  for (let i = 1; i < pts.length; i++) if (Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]) > Math.hypot(pts[far][0] - pts[0][0], pts[far][1] - pts[0][1])) far = i;
  const rdp = (line) => {
    if (line.length < 3) return line;
    const [a, b] = [line[0], line[line.length - 1]];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-12;
    let worst = 0, at = 0;
    for (let i = 1; i < line.length - 1; i++) {
      const dist = Math.abs((b[0] - a[0]) * (a[1] - line[i][1]) - (a[0] - line[i][0]) * (b[1] - a[1])) / len;
      if (dist > worst) { worst = dist; at = i; }
    }
    if (worst <= eps) return [a, b];
    return [...rdp(line.slice(0, at + 1)).slice(0, -1), ...rdp(line.slice(at))];
  };
  const first = rdp(pts.slice(0, far + 1));
  const second = rdp([...pts.slice(far), pts[0]]);
  return [...first.slice(0, -1), ...second.slice(0, -1)];
}

/**
 * The catalog's outline from a loop: relative to `origin`, counter-clockwise,
 * simplified, rounded to 0.01 mm, starting at the lowest-then-leftmost point.
 */
export function toOutline(loop, origin = { x0: 0, y0: 0 }, eps = 0.15) {
  let pts = simplifyLoop(loop, eps).map(([x, y]) => [x - origin.x0, y - origin.y0]);
  if (signedArea2(pts) < 0) pts = pts.reverse();
  const round = (v) => Math.round(v * 100) / 100 + 0;
  pts = pts.map(([x, y]) => [round(x), round(y)]);
  let start = 0;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i][1] < pts[start][1] - 1e-9 || (Math.abs(pts[i][1] - pts[start][1]) < 1e-9 && pts[i][0] < pts[start][0])) start = i;
  }
  return [...pts.slice(start), ...pts.slice(0, start)];
}
