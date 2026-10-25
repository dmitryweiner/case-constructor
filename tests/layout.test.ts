import { boardTransform, caseLayout, collisions, minimumDims, sideMargin, standoffColumns, railEdges } from '../src/geo/layout';
import { catalogBoard, CATALOG } from '../src/boards/catalog';
import { defaultState, sanitizeState } from '../src/state/schema';
import { applyAffine } from '../src/geo/surface';

const pi = catalogBoard('raspberry-pi-4b') ?? CATALOG[0];

describe('board transforms', () => {
  it('the rotated outline starts at (x, y) for every rotation', () => {
    for (const rot of [0, 90, 180, 270] as const) {
      const m = boardTransform(pi, rot, 10, 20, 0);
      const corners = [[0, 0], [pi.size.w, 0], [0, pi.size.d], [pi.size.w, pi.size.d]]
        .map(([x, y]) => applyAffine(m, [x, y, 0]));
      expect(Math.min(...corners.map((c) => c[0])), `${rot}`).toBeCloseTo(10);
      expect(Math.min(...corners.map((c) => c[1])), `${rot}`).toBeCloseTo(20);
    }
  });
});

describe('caseLayout', () => {
  it('auto size: the Pi 4 plus margins and walls; the board is centred', () => {
    const state = defaultState();
    const layout = caseLayout(state);
    const board = layout.boards[0];
    const margin = sideMargin(state.shape, state.lid);
    const fw = board.footprint.x1 - board.footprint.x0;
    expect(layout.dims.w).toBeCloseTo(fw + 2 * margin + 2 * state.shape.wall);
    expect((board.footprint.x0 + board.footprint.x1) / 2).toBeCloseTo(layout.dims.w / 2);
    expect((board.footprint.y0 + board.footprint.y1) / 2).toBeCloseTo(layout.dims.d / 2);
    // height: floor + standoff + PCB + tallest part + top margin + ceiling
    const { floor } = state.shape;
    expect(layout.dims.h).toBeCloseTo(floor + state.boards[0].z + pi.size.t + pi.topHeight + state.shape.margin.top + floor);
  });

  it('a manual size can grow the case but never shrink it below the minimum', () => {
    const base = defaultState();
    const min = minimumDims(base);
    const small = sanitizeState({ ...base, shape: { ...base.shape, auto: false, size: { w: 20, d: 20, h: 20 } } });
    expect(caseLayout(small).dims).toEqual(min);
    const big = sanitizeState({ ...base, shape: { ...base.shape, auto: false, size: { w: 150, d: 120, h: 60 } } });
    expect(caseLayout(big).dims).toEqual({ w: 150, d: 120, h: 60 });
  });

  it('a cylinder holds the footprint diagonal', () => {
    const state = sanitizeState({ ...defaultState(), shape: { ...defaultState().shape, kind: 'cylinder' } });
    const layout = caseLayout(state);
    const b = layout.boards[0].footprint;
    expect(layout.dims.w).toBe(layout.dims.d);
    expect(layout.dims.w).toBeGreaterThanOrEqual(Math.hypot(b.x1 - b.x0, b.y1 - b.y0) + 2 * state.shape.wall);
  });

  it('a console raises its heights until the slope clears the board', () => {
    const state = sanitizeState({ ...defaultState(), shape: { ...defaultState().shape, kind: 'console', console: { frontH: 10, backH: 12 } } });
    const layout = caseLayout(state);
    expect(layout.console.frontH).toBeGreaterThan(10);
    expect(layout.console.backH - layout.console.frontH).toBeCloseTo(2);
  });

  it('a deep side lid gets its band: the boards move away from it', () => {
    const base = defaultState();
    const plain = caseLayout(base);
    const left = caseLayout(sanitizeState({ ...base, lid: { ...base.lid, face: 'left', depth: 8 } }));
    expect(left.dims.w).toBeCloseTo(plain.dims.w + 8.5);
    expect(left.boards[0].footprint.x0).toBeCloseTo(plain.boards[0].footprint.x0 + 8.5);
  });

  it('rails go along the long edges unless the board asks for the short ones', () => {
    const esp = catalogBoard('esp32-devkitc-v4') ?? CATALOG[0];
    expect(railEdges(esp)).toEqual(['front', 'back']);
    expect(railEdges({ ...esp, mount: { ...esp.mount, rails: 'short' } })).toEqual(['left', 'right']);
  });
});

describe('collisions', () => {
  it('two boards on top of each other are reported; side by side are not', () => {
    const base = defaultState();
    const stacked = sanitizeState({ ...base, boards: [{ board: 'raspberry-pi-4b' }, { board: 'arduino-uno', x: 5, y: 0 }] });
    expect(collisions(caseLayout(stacked)).map((m) => m.code)).toContain('warn.boardsOverlap');
    const apart = sanitizeState({ ...base, boards: [{ board: 'raspberry-pi-4b' }, { board: 'arduino-uno', x: 100, y: 0 }] });
    expect(collisions(caseLayout(apart))).toEqual([]);
  });

  it('a board high above another is not an overlap, but its standoffs run through the lower one', () => {
    const base = defaultState();
    const hat = sanitizeState({ ...base, boards: [{ board: 'raspberry-pi-4b' }, { board: 'raspberry-pi-4b', z: 30 }] });
    const codes = collisions(caseLayout(hat)).map((m) => m.code);
    expect(codes).not.toContain('warn.boardsOverlap');
    expect(codes).toContain('warn.standoffHitsBoard');
  });

  it('a part on the underside landing on a standoff or a rail is reported, and it lifts the board', () => {
    const custom = (mount: object, x: number, y: number) => sanitizeState({
      ...defaultState(),
      boards: [{ board: 'custom', custom: {
        size: { w: 40, d: 30, t: 1.6 }, mount, bottomHeight: 1,
        ports: [{ id: 'led', type: 'led', edge: 'bottom', x, y, w: 2, d: 2, h: 5, shape: 'rect' }],
      }, z: 0 }],
    });
    const holes = { kind: 'holes', holes: [{ x: 3, y: 3, d: 2.7 }, { x: 37, y: 27, d: 2.7 }], screw: 'M2.5' };
    const codes = (state: ReturnType<typeof custom>) => collisions(caseLayout(state)).map((m) => m.code);
    expect(codes(custom(holes, 4, 4))).toContain('warn.bottomPartOnSupport');
    expect(codes(custom(holes, 20, 15))).toEqual([]);
    const rails = { kind: 'rails', holes: [], screw: 'M2', rails: 'long' };
    expect(codes(custom(rails, 20, 0.8))).toContain('warn.bottomPartOnSupport');
    expect(codes(custom(rails, 20, 15))).toEqual([]);
    // the part is 5 mm tall, the entry says 1: the board still stands 6 mm up
    expect(custom(holes, 20, 15).boards[0].z).toBe(6);
    expect(codes(sanitizeState({ ...defaultState(), boards: [{ board: 'esp32-2432s028r' }] }))).toEqual([]);
  });

  it('standoff columns sit at the holes', () => {
    const layout = caseLayout(defaultState());
    const columns = standoffColumns(layout.boards[0]);
    expect(columns).toHaveLength(4);
    const dx = Math.max(...columns.map((c) => c.x)) - Math.min(...columns.map((c) => c.x));
    expect(dx).toBeCloseTo(58);
  });
});
