#!/usr/bin/env node
// The parts of a board's STEP model, placed in the board frame: the bounding
// box of every part (where a connector is, how tall it stands) and, with
// --part, the circles of a part (mounting hole candidates). Parsing lives in
// scripts/lib/step.mjs; no CAD kernel (CLAUDE.md).
//
//   node scripts/step.mjs board.step                    # every part, board frame
//   node scripts/step.mjs board.step --match 'USB|HDMI'  # only parts whose path matches
//   node scripts/step.mjs board.step --part BOARD        # circles of the parts named so
//   node scripts/step.mjs board.step --board PCB_ASM     # the part that is the board
//   node scripts/step.mjs board.step --rotate 90         # turn the model about z first
//   node scripts/step.mjs board.step --flip              # the model is a bottom view: mirror x
//   node scripts/step.mjs board.step --min 2 --max 30    # parts by their larger side
//
// The board frame (the add-board skill): origin at the lower-left corner of
// the board part's box, x right, y up, z = 0 on the board's top face (the
// highest z of the board part). The board part is the one named by --board,
// else the largest of those whose name says BOARD or PCB (a PCBA model names
// every small part so), else the part with the largest footprint. Rotation (degrees, counter-clockwise seen from above) and the
// flip apply about the model origin, before the corner is found.

import { readFileSync } from 'node:fs';
import { parseArgs } from './lib/harness.mjs';
import { readStep } from './lib/step.mjs';

const file = process.argv[2];
const flags = parseArgs(process.argv.slice(3), ['match', 'part', 'board', 'rotate', 'min', 'max']);
if (!file) {
  console.error('usage: node scripts/step.mjs <file.step> [--match re] [--part name] [--board name] [--rotate deg] [--flip] [--min mm] [--max mm]');
  process.exit(2);
}

const model = readStep(readFileSync(file, 'latin1'));
const parts = model.parts();
if (parts.length === 0) {
  console.log('no parts with geometry (a STEP without an assembly, or one this reader cannot follow)');
  process.exit(1);
}

const angle = (Number(flags.get('rotate') ?? 0) * Math.PI) / 180;
const flip = flags.has('flip') ? -1 : 1;
/** Model xy → turned xy, before the corner is taken. */
const turn = ([x, y]) => {
  const fx = flip * x;
  return [fx * Math.cos(angle) - y * Math.sin(angle), fx * Math.sin(angle) + y * Math.cos(angle)];
};
/** A model box → its xy box after the turn. */
const turnedBox = ({ lo, hi }) => {
  const corners = [[lo[0], lo[1]], [hi[0], lo[1]], [lo[0], hi[1]], [hi[0], hi[1]]].map(turn);
  const xs = corners.map(([x]) => x);
  const ys = corners.map(([, y]) => y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), z0: lo[2], z1: hi[2] };
};

const named = flags.get('board');
const footprint = (p) => (p.hi[0] - p.lo[0]) * (p.hi[1] - p.lo[1]);
const largest = (list) => [...list].sort((a, b) => footprint(b) - footprint(a))[0];
const board = (named ? parts.find((p) => p.path.includes(named)) : undefined)
  ?? largest(parts.filter((p) => /board|pcb/i.test(p.name) && !/asm|assembly/i.test(p.name)))
  ?? largest(parts);
const frame = turnedBox(board);
const round = (v) => Math.round(v * 100) / 100;
console.log(`board: ${board.path}  ${round(frame.x1 - frame.x0)} × ${round(frame.y1 - frame.y0)}, top at z ${round(frame.z1)} (model)`);

const match = flags.get('match') ? new RegExp(String(flags.get('match')), 'i') : null;
const min = Number(flags.get('min') ?? 0);
const max = Number(flags.get('max') ?? Infinity);
const rows = parts
  .filter((p) => p !== board && (!match || match.test(p.path)))
  .map((p) => {
    const b = turnedBox(p);
    return { path: p.path, x0: b.x0 - frame.x0, x1: b.x1 - frame.x0, y0: b.y0 - frame.y0, y1: b.y1 - frame.y0, z0: b.z0 - frame.z1, z1: b.z1 - frame.z1 };
  })
  .filter((r) => {
    const size = Math.max(r.x1 - r.x0, r.y1 - r.y0);
    return size >= min && size <= max;
  })
  .sort((a, b) => a.x0 - b.x0 || a.y0 - b.y0);
for (const r of rows) {
  console.log(`${r.path}\n    x ${round(r.x0)}…${round(r.x1)}  y ${round(r.y0)}…${round(r.y1)}  z ${round(r.z0)}…${round(r.z1)}  (${round(r.x1 - r.x0)} × ${round(r.y1 - r.y0)}, centre ${round((r.x0 + r.x1) / 2)}, ${round((r.y0 + r.y1) / 2)})`);
}

const partName = flags.get('part');
if (partName) {
  const seen = new Set();
  for (const c of model.circles(String(partName))) {
    // holes through the board: circles whose axis is vertical
    if (Math.abs(c.normal[2]) < 0.9) continue;
    const [x, y] = turn(c.centre);
    const key = `${round(x - frame.x0)},${round(y - frame.y0)},${round(2 * c.r)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(`circle Ø${round(2 * c.r)} at ${round(x - frame.x0)}, ${round(y - frame.y0)}  (${c.path})`);
  }
}
