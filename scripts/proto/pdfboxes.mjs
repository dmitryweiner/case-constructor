// The bbox of every path (each subpath) of a pdftocairo SVG, in page coordinates
// (pt, y down), as JSON with fill and stroke width: filled round ones are holes and
// pads, stroked rectangles are part outlines. Scale to mm against the board outline
// (the largest box).
//   pdftocairo -svg drawing.pdf drawing.svg && node pdfboxes.mjs drawing.svg > boxes.json
import { readFileSync } from 'node:fs';
const svg = readFileSync(process.argv[2], 'utf8');
const out = [];
for (const m of svg.matchAll(/<path([^>]*)>/g)) {
  const a = m[1];
  const d = a.match(/ d="([^"]*)"/)?.[1]; if (!d) continue;
  const fill = a.match(/fill="([^"]*)"/)?.[1] ?? '';
  const sw = Number(a.match(/stroke-width="([^"]*)"/)?.[1] ?? 0);
  const t = a.match(/transform="matrix\(([^)]*)\)"/)?.[1]?.split(',').map(Number) ?? [1, 0, 0, 1, 0, 0];
  const tok = d.trim().split(/\s+/);
  let cur = null;
  const flush = () => { if (cur && cur.n > 1) out.push(cur); cur = null; };
  for (let i = 0; i < tok.length;) {
    const c = tok[i];
    if (c === 'M') { flush(); cur = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9, n: 0, fill, sw, curve: false }; i++; continue; }
    if (c === 'Z') { i++; continue; }
    if (c === 'L' || c === 'C') { if (c === 'C') cur.curve = true; i++; continue; }
    const x = Number(tok[i]), y = Number(tok[i + 1]); i += 2;
    const X = t[0] * x + t[2] * y + t[4], Y = t[1] * x + t[3] * y + t[5];
    cur.x0 = Math.min(cur.x0, X); cur.x1 = Math.max(cur.x1, X); cur.y0 = Math.min(cur.y0, Y); cur.y1 = Math.max(cur.y1, Y); cur.n++;
  }
  flush();
}
console.log(JSON.stringify(out));
