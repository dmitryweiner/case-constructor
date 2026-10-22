// Arranging several boards: in a row, in a column, compact; aligning one
// board to another. Footprints (ports that stick out, rails) never overlap,
// rotations are kept, positions stay valid.

import { alignBoard, arrangeBoards } from '../src/geo/arrange';
import type { Rect } from '../src/geo/layout';
import { caseLayout, placeBoards } from '../src/geo/layout';
import type { BoardPlacement } from '../src/boards/placement';
import { defaultState, sanitizeState } from '../src/state/schema';
import type { AppState } from '../src/state/schema';

const GAP = 5;

function stateWith(boards: unknown[]): AppState {
  return sanitizeState({ ...defaultState(), boards });
}

const mixed = stateWith([
  { board: 'raspberry-pi-4b', x: 0, y: 0 },
  { board: 'esp32-devkitc-v4', x: 120, y: 40, rot: 90 },
  { board: 'arduino-uno', x: 30, y: 90 },
  { board: 'raspberry-pi-zero-2-w', x: 200, y: 10, rot: 180 },
]);

function rects(state: AppState, boards: BoardPlacement[]): { outline: Rect; footprint: Rect }[] {
  return placeBoards({ ...state, boards });
}

function separated(a: Rect, b: Rect, gap: number): boolean {
  const eps = 2e-3;
  return a.x1 + gap <= b.x0 + eps || b.x1 + gap <= a.x0 + eps || a.y1 + gap <= b.y0 + eps || b.y1 + gap <= a.y0 + eps;
}

function expectNoOverlap(state: AppState, boards: BoardPlacement[]): void {
  const placed = rects(state, boards);
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      expect(separated(placed[i].footprint, placed[j].footprint, GAP), `${i}/${j}`).toBe(true);
    }
  }
  for (const board of placed) {
    expect(board.footprint.x0).toBeGreaterThanOrEqual(-2e-3);
    expect(board.footprint.y0).toBeGreaterThanOrEqual(-2e-3);
  }
}

/** The outer footprint of the case these placements give. */
function area(state: AppState, boards: BoardPlacement[]): number {
  const { dims } = caseLayout({ ...state, boards });
  return dims.w * dims.d;
}

describe('arrangeBoards', () => {
  it('in a row: left to right in order, the gap between footprints, front edges aligned', () => {
    const boards = arrangeBoards(mixed, 'row', GAP);
    expectNoOverlap(mixed, boards);
    const placed = rects(mixed, boards);
    for (let i = 1; i < placed.length; i++) {
      expect(placed[i].footprint.x0).toBeCloseTo(placed[i - 1].footprint.x1 + GAP, 2);
      expect(placed[i].outline.y0).toBeCloseTo(placed[0].outline.y0, 2);
    }
    expect(Math.min(...placed.map((b) => b.footprint.x0))).toBeCloseTo(0, 2);
  });

  it('in a column: front to back in order, left edges aligned', () => {
    const boards = arrangeBoards(mixed, 'column', GAP);
    expectNoOverlap(mixed, boards);
    const placed = rects(mixed, boards);
    for (let i = 1; i < placed.length; i++) {
      expect(placed[i].footprint.y0).toBeCloseTo(placed[i - 1].footprint.y1 + GAP, 2);
      expect(placed[i].outline.x0).toBeCloseTo(placed[0].outline.x0, 2);
    }
  });

  it('compact: never a larger case than a row or a column; four equal boards make a square', () => {
    const boards = arrangeBoards(mixed, 'compact', GAP);
    expectNoOverlap(mixed, boards);
    const compact = area(mixed, boards);
    expect(compact).toBeLessThanOrEqual(area(mixed, arrangeBoards(mixed, 'row', GAP)) + 1e-6);
    expect(compact).toBeLessThanOrEqual(area(mixed, arrangeBoards(mixed, 'column', GAP)) + 1e-6);

    const four = stateWith(Array.from({ length: 4 }, (_, i) => ({ board: 'raspberry-pi-zero-2-w', x: i * 80, y: 0 })));
    const square = rects(four, arrangeBoards(four, 'compact', GAP));
    const xs = new Set(square.map((b) => b.outline.x0.toFixed(3)));
    const ys = new Set(square.map((b) => b.outline.y0.toFixed(3)));
    expect(xs.size).toBe(2);
    expect(ys.size).toBe(2);
  });

  it('keeps rotations, heights and everything else; is idempotent', () => {
    for (const mode of ['row', 'column', 'compact'] as const) {
      const boards = arrangeBoards(mixed, mode, GAP);
      boards.forEach((board, i) => {
        expect({ ...board, x: 0, y: 0 }).toEqual({ ...mixed.boards[i], x: 0, y: 0 });
      });
      expect(arrangeBoards({ ...mixed, boards }, mode, GAP)).toEqual(boards);
      expect(sanitizeState({ ...mixed, boards }).boards).toEqual(boards);
    }
  });

  it('a single board stays where it is', () => {
    const one = stateWith([{ board: 'raspberry-pi-4b', x: 12, y: 7 }]);
    expect(arrangeBoards(one, 'compact', GAP)).toEqual(one.boards);
  });
});

describe('alignBoard', () => {
  const moved = (boards: BoardPlacement[], index: number): void => {
    boards.forEach((board, i) => {
      if (i !== index) expect(board).toEqual(mixed.boards[i]);
    });
  };

  it('edges and centres line up with the other board; only the board moves', () => {
    const ref = rects(mixed, mixed.boards)[0].outline;
    const cases = [
      ['left', (r: Rect) => r.x0, ref.x0], ['right', (r: Rect) => r.x1, ref.x1],
      ['centreX', (r: Rect) => (r.x0 + r.x1) / 2, (ref.x0 + ref.x1) / 2],
      ['front', (r: Rect) => r.y0, ref.y0], ['back', (r: Rect) => r.y1, ref.y1],
      ['centreY', (r: Rect) => (r.y0 + r.y1) / 2, (ref.y0 + ref.y1) / 2],
    ] as const;
    for (const [how, pick, want] of cases) {
      const boards = alignBoard(mixed, 2, 0, how, GAP);
      expect(pick(rects(mixed, boards)[2].outline), how).toBeCloseTo(want, 2);
      moved(boards, 2);
    }
  });

  it('next to it: to the right of / behind the other board, footprints a gap apart', () => {
    const right = rects(mixed, alignBoard(mixed, 2, 0, 'nextX', GAP));
    expect(right[2].footprint.x0).toBeCloseTo(right[0].footprint.x1 + GAP, 2);
    const behind = rects(mixed, alignBoard(mixed, 2, 0, 'nextY', GAP));
    expect(behind[2].footprint.y0).toBeCloseTo(behind[0].footprint.y1 + GAP, 2);
  });

  it('same height: the standoff height of the other board, never below the board\'s own minimum', () => {
    const state = stateWith([{ board: 'raspberry-pi-4b', z: 12 }, { board: 'arduino-uno', x: 100, z: 4 }]);
    expect(alignBoard(state, 1, 0, 'height', GAP)[1].z).toBe(12);
    const low = stateWith([{ board: 'raspberry-pi-zero-2-w', z: 2 }, { board: 'raspberry-pi-4b', x: 100, z: 9 }]);
    const aligned = alignBoard(low, 1, 0, 'height', GAP)[1].z;
    expect(aligned).toBe(sanitizeState({ ...low, boards: [low.boards[0], { ...low.boards[1], z: 2 }] }).boards[1].z);
  });

  it('a position that would go negative shifts the whole layout instead', () => {
    const state = stateWith([{ board: 'arduino-uno', x: 0, y: 0 }, { board: 'raspberry-pi-4b', x: 100, y: 0 }]);
    // the Pi's right edge to the Uno's: the Pi is wider, its x goes below 0
    const boards = alignBoard(state, 1, 0, 'right', GAP);
    const placed = rects(state, boards);
    expect(placed[1].outline.x1).toBeCloseTo(placed[0].outline.x1, 2);
    for (const board of boards) expect(board.x).toBeGreaterThanOrEqual(0);
  });
});
