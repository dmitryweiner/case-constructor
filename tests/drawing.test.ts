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
