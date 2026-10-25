// The drawing readers of the board tools (scripts/lib): a DXF with nested
// blocks, a one-page vector PDF (through its pdftocairo SVG), a two-part STEP
// assembly, and tiny Eagle and KiCad boards, each read back to the boxes
// they were made with (tests/fixtures/README.md).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { componentBoxes, extents, havePdftocairo, layerCounts, pdfToSvg, readDxf, readSvg, scaled } from '../scripts/lib/drawing.mjs';
import type { Box, Shape } from '../scripts/lib/drawing.mjs';
import { readStep } from '../scripts/lib/step.mjs';
import { readBrd, readKicad, turnBoard } from '../scripts/lib/pcb.mjs';
import { arcSweep, chainLoops, largestLoop, toOutline } from '../scripts/lib/outline.mjs';
import { polylines, turned } from '../scripts/lib/drawing.mjs';
import { compareHoles } from '../scripts/lib/compare.mjs';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const fixture = (name: string): string => readFileSync(join(FIXTURES, name), 'utf8');

const rounded = (b: Box): number[] => [b.x0, b.y0, b.x1, b.y1].map((v) => Math.round(v * 100) / 100);
const circles = (shapes: Shape[], origin: Box): number[][] => shapes.flatMap((s) => (s.kind === 'circle'
  ? [[s.x - origin.x0, s.y - origin.y0, 2 * s.r].map((v) => Math.round(v * 100) / 100)] : []));

describe('DXF blocks', () => {
  it('expands nested blocks with their move, turn and scale; layer 0 takes the insert\'s layer', () => {
    const shapes = readDxf(fixture('blocks.dxf'));
    expect(Object.fromEntries(layerCounts(shapes))).toEqual({ 'OUTLINE\tpoly': 1, 'SILK\tpoly': 3, 'SILK\tcircle': 2 });
    const box = extents(shapes);
    expect(rounded(box)).toEqual([0, 0, 30, 20]);
    const named = componentBoxes(shapes, box).filter((b) => b.name).map((b) => [b.name, ...rounded(b)]);
    // CONN turned 90° at (10, 5), its PAD inside it; PAD scaled 2 at (25, 15)
    expect(named).toEqual([['CONN', 8, 5, 10, 9], ['PAD', 23, 13, 27, 17]]);
    expect(circles(shapes, box)).toEqual([[9, 6, 1], [25, 15, 2]]);
  });
});

describe('vector PDF', () => {
  // two-boxes.pdf: a 30 × 20 outline at (5, 5) on a 60 × 40 mm page, a Ø3 circle at (10, 10), a 6 × 3 box at (25, 12)
  const check = (svg: string): void => {
    let shapes = readSvg(svg);
    const raw = extents(shapes);
    // Chrome printed the page 0.6 % large: --fit brings the outline back to its size
    shapes = scaled(shapes, 30 / (raw.x1 - raw.x0));
    const box = extents(shapes);
    expect(Math.round((box.x1 - box.x0) * 100) / 100).toBe(30);
    expect(Math.round((box.y1 - box.y0) * 10) / 10).toBe(20);
    const boxes = componentBoxes(shapes, box).map(rounded);
    expect(boxes).toContainEqual([20, 10, 26, 13]);
    expect(circles(shapes, box).map((c) => c.map((v) => Math.round(v * 10) / 10))).toEqual([[5, 15, 3]]);
  };

  it('reads the pdftocairo SVG: boxes, a circle from its curves, y up, in mm', () => {
    check(fixture('two-boxes.svg'));
  });

  it.runIf(havePdftocairo())('reads the PDF itself through pdftocairo', () => {
    check(pdfToSvg(join(FIXTURES, 'two-boxes.pdf')));
  });
});

describe('STEP assembly', () => {
  it('places every part by its transform and finds the circles of a part', () => {
    const model = readStep(fixture('two-parts.step'));
    const parts = Object.fromEntries(model.parts().map((p) => [p.name, [...p.lo, ...p.hi].map((v) => Math.round(v * 100) / 100)]));
    expect(parts).toEqual({ 'BOARD': [10, 20, -1.6, 30, 30, 0], 'USB-C; side': [9, 25, 0, 12, 29, 2] });
    const [hole] = model.circles('BOARD');
    expect(hole.centre.map((v) => Math.round(v * 100) / 100)).toEqual([13, 23, 0]);
    expect(hole.r).toBe(1.5);
    expect(Math.abs(hole.normal[2])).toBeCloseTo(1);
  });
});

describe('PCB layouts', () => {
  it('Eagle: footprints in the board frame, mirrored ones on the bottom, pad boxes turned, nets', () => {
    const board = readBrd(fixture('tiny.brd'));
    expect(board.outline).toEqual({ w: 30, d: 20 });
    expect(board.holes).toEqual([{ x: 3, y: 3, d: 3.2 }]);
    const [sw1, sw2] = board.elements;
    expect(sw1).toMatchObject({ name: 'SW1', value: 'RESET', x: 5, y: 5, rot: 90, side: 'top', nets: ['!RESET', 'GND'] });
    expect(sw1.size).toMatchObject({ w: 2, d: 5 });
    expect(sw2).toMatchObject({ name: 'SW2', x: 20, y: 15, side: 'bottom' });
    expect(sw2.size).toMatchObject({ w: 5, d: 2 });
  });

  it('KiCad: y turned up, B.Cu on the bottom; a turned board swaps its sides', () => {
    const board = readKicad(fixture('tiny.kicad_pcb'));
    expect(board.outline).toEqual({ w: 30, d: 20 });
    expect(board.elements.map((e) => [e.name, e.x, e.y, e.side])).toEqual([['K1', 5, 5, 'top'], ['D1', 20, 15, 'bottom']]);
    expect(board.elements[0].nets).toEqual(['EN', 'GND']);
    const turned = turnBoard(board, 90);
    expect(turned.outline).toEqual({ w: 20, d: 30 });
    expect(turned.elements.map((e) => [e.name, e.x, e.y])).toEqual([['K1', 15, 5], ['D1', 5, 20]]);
    const flipped = turnBoard(board, 0, true);
    expect(flipped.elements.map((e) => [e.name, e.x, e.side])).toEqual([['K1', 25, 'bottom'], ['D1', 10, 'top']]);
  });
});

describe('outlines', () => {
  const square: [number, number][][] = [[[0, 0], [10, 0]], [[10, 0], [10, 6]], [[10, 6], [0, 6]], [[0, 6], [0, 0]]];

  it('chains pieces end to end, even where a dimension line starts at a corner', () => {
    const dimension: [number, number][] = [[10, 6], [14, 6]];
    const loop = largestLoop(chainLoops([dimension, ...square]));
    expect(loop && toOutline(loop)).toEqual([[0, 0], [10, 0], [10, 6], [0, 6]]);
  });

  it('a stroke drawn there and back (closed with Z) is a piece, not a loop', () => {
    const pieces = square.map(([a, b]) => [a, b, a]);
    const loop = largestLoop(chainLoops(pieces));
    expect(loop && toOutline(loop)).toEqual([[0, 0], [10, 0], [10, 6], [0, 6]]);
  });

  it('corner arcs become a few points; the outline turns counter-clockwise from its lowest point', () => {
    // a 20 x 10 rounded rectangle, r 2, drawn clockwise
    const r = 2;
    const pieces: [number, number][][] = [
      [[r, 10], [20 - r, 10]], [[20 - r, 10], ...arcSweep([20 - r, 10], [20, 10 - r], -90)],
      [[20, 10 - r], [20, r]], [[20, r], ...arcSweep([20, r], [20 - r, 0], -90)],
      [[20 - r, 0], [r, 0]], [[r, 0], ...arcSweep([r, 0], [0, r], -90)],
      [[0, r], [0, 10 - r]], [[0, 10 - r], ...arcSweep([0, 10 - r], [r, 10], -90)],
    ];
    const loop = largestLoop(chainLoops(pieces));
    const outline = loop ? toOutline(loop) : [];
    expect(outline[0][1]).toBe(0);
    let area = 0;
    outline.forEach(([x0, y0], i) => {
      const [x1, y1] = outline[(i + 1) % outline.length];
      area += x0 * y1 - x1 * y0;
    });
    expect(area).toBeGreaterThan(0);
    expect(outline.length).toBeGreaterThan(8);
    expect(outline.length).toBeLessThanOrEqual(20);
    for (const [x, y] of outline) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(20);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(10);
    }
  });

  it('every reader gives its outline: DXF (turned), Eagle, KiCad', () => {
    const dxf = turned(readDxf(fixture('blocks.dxf')).filter((s) => s.layer === 'OUTLINE'), 90);
    const loop = largestLoop(chainLoops(polylines(dxf)));
    const box = extents(dxf);
    expect(loop && toOutline(loop, box)).toEqual([[0, 0], [20, 0], [20, 30], [0, 30]]);
    for (const board of [readBrd(fixture('tiny.brd')), readKicad(fixture('tiny.kicad_pcb'))]) {
      const pcbLoop = largestLoop(chainLoops(board.outlinePieces));
      expect(pcbLoop && toOutline(pcbLoop)).toEqual([[0, 0], [30, 0], [30, 20], [0, 20]]);
    }
  });
});

describe('comparing an entry with its drawing', () => {
  it('matches each hole to the drill on its centre, not the pad ring, and lists what the entry lacks', () => {
    const entry = { size: { w: 30, d: 20 }, mount: { holes: [{ x: 3, y: 3, d: 2.7 }, { x: 27, y: 17, d: 2.7 }] } };
    const found = [
      { x: 3.02, y: 3, d: 6 }, { x: 3.02, y: 3, d: 2.7 },
      { x: 27.5, y: 17, d: 2.7 },
      { x: 15, y: 10, d: 3 },
    ];
    const lines = compareHoles(entry, found, { size: { w: 30, d: 20.4 } });
    expect(lines[0]).toMatch(/^size .*Δ 0, 0\.4\) +← check$/);
    expect(lines[1]).toMatch(/drawing 3\.02, 3 Ø2\.7 .*Δ 0\.02, 0, Ø 0\)$/);
    expect(lines[2]).toMatch(/drawing 27\.5, 17 .*← check$/);
    expect(lines.slice(3)).toEqual(['extra drawing hole 15, 10 Ø3: not in the entry']);
  });
});
