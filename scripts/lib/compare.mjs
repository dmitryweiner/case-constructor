// An entry against its drawing: every mounting hole of the entry next to the
// nearest hole the drawing has, and the drawing's holes the entry lacks.
// Used by board.mjs --brd/--kicad --compare and dxf.mjs --compare.

import { readFileSync } from 'node:fs';

/** A catalog entry as written (src/boards/data/<id>.json). */
export function readEntry(id) {
  return JSON.parse(readFileSync(`src/boards/data/${id}.json`, 'utf8'));
}

const r = (v) => Math.round(v * 100) / 100 + 0;

/**
 * Lines of the comparison. `found` holds the drawing's holes in the board
 * frame; only those of a mounting size (`minD`…`maxD`) count as extra.
 */
export function compareHoles(entry, found, { minD = 1.5, maxD = 6, tol = 0.3, size } = {}) {
  const lines = [];
  if (size) {
    const dw = size.w - entry.size.w;
    const dd = size.d - entry.size.d;
    lines.push(`size  entry ${entry.size.w} × ${entry.size.d}, drawing ${r(size.w)} × ${r(size.d)}  (Δ ${r(dw)}, ${r(dd)})${Math.abs(dw) > tol || Math.abs(dd) > tol ? '  ← check' : ''}`);
  }
  const holes = entry.mount?.holes ?? [];
  const used = new Set();
  for (const h of holes) {
    // the nearest centre; among circles on that centre (a pad ring round its drill) the closest diameter
    const dists = found.map((f) => Math.hypot(f.x - h.x, f.y - h.y));
    const nearest = Math.min(...dists, Infinity);
    let best = -1;
    found.forEach((f, i) => {
      if (dists[i] > nearest + 0.1) return;
      if (best < 0 || Math.abs(f.d - h.d) < Math.abs(found[best].d - h.d)) best = i;
    });
    const dist = best >= 0 ? dists[best] : Infinity;
    if (best < 0) {
      lines.push(`hole  entry ${h.x}, ${h.y} Ø${h.d}: the drawing has no holes`);
      continue;
    }
    used.add(best);
    const f = found[best];
    lines.push(`hole  entry ${h.x}, ${h.y} Ø${h.d}  drawing ${r(f.x)}, ${r(f.y)} Ø${r(f.d)}  (Δ ${r(f.x - h.x)}, ${r(f.y - h.y)}, Ø ${r(f.d - h.d)})${dist > tol ? '  ← check' : ''}`);
  }
  // circles sharing a used hole's centre are its pad rings, not extra holes
  const centres = [...used].map((i) => found[i]);
  found.forEach((f, i) => {
    if (centres.some((c) => Math.hypot(c.x - f.x, c.y - f.y) < 0.1)) return;
    if (!used.has(i) && f.d >= minD && f.d <= maxD) lines.push(`extra drawing hole ${r(f.x)}, ${r(f.y)} Ø${r(f.d)}: not in the entry`);
  });
  return lines;
}
