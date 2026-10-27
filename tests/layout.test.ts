import { WALL_GAP, boardTransform, caseLayout, collisions, minimumDims, sideMargin, standoffColumns, railEdges } from '../src/geo/layout';
import { portAxis } from '../src/geo/ports';
import { catalogBoard, CATALOG } from '../src/boards/catalog';
import { defaultState, sanitizeState } from '../src/state/schema';
import { applyAffine } from '../src/geo/surface';
import { readFileSync } from 'node:fs';
import { setLang, tm } from '../src/i18n';

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

describe('a board against a wall', () => {
  const base = defaultState();
  const withWall = (wall: string, extra: Record<string, unknown> = {}, shape: Record<string, unknown> = {}) => sanitizeState({
    ...base,
    shape: { ...base.shape, ...shape },
    boards: [{ ...base.boards[0], walls: [wall], ...extra }],
  });
  /** The faces of the board's connectors on its edge facing the case's `side`, as the case frame's coordinate along it. */
  const faces = (state: ReturnType<typeof withWall>, side: 'right' | 'front') => {
    const layout = caseLayout(state);
    const board = layout.boards[0];
    return board.def.ports.flatMap((port) => {
      if (port.edge !== side) return [];
      const { face } = portAxis(board, { ...port, edge: port.edge });
      return [side === 'right' ? face[0] : face[1]];
    });
  };

  it('the most protruding connector is flush with the outer surface (Ethernet on the right)', () => {
    const state = withWall('right');
    const layout = caseLayout(state);
    expect(Math.max(...faces(state, 'right'))).toBeCloseTo(layout.dims.w, 6);
    expect(collisions(layout)).toEqual([]);
  });

  it('the front: the audio jack flush, the smaller connectors a little inside', () => {
    const state = withWall('front');
    const front = faces(state, 'front');
    expect(Math.min(...front)).toBeCloseTo(0, 6);
    expect(Math.max(...front)).toBeLessThan(2);
  });

  it('an offset: recessed (negative) or proud (positive)', () => {
    const layout = caseLayout(withWall('right', { wallOffset: -1 }));
    expect(Math.max(...faces(withWall('right', { wallOffset: -1 }), 'right'))).toBeCloseTo(layout.dims.w - 1, 6);
    const proud = withWall('right', { wallOffset: 0.5 });
    expect(Math.max(...faces(proud, 'right'))).toBeCloseTo(caseLayout(proud).dims.w + 0.5, 6);
  });

  it('two walls at once: the Pi 4 flush on the front and on the right', () => {
    const state = sanitizeState({ ...base, boards: [{ ...base.boards[0], walls: ['front', 'right'] }] });
    const layout = caseLayout(state);
    expect(Math.max(...faces(state, 'right'))).toBeCloseTo(layout.dims.w, 6);
    expect(Math.min(...faces(state, 'front'))).toBeCloseTo(0, 6);
    expect(collisions(layout)).toEqual([]);
  });

  it('a manual size pushes the board to its wall instead of centring it', () => {
    const state = withWall('right', {}, { auto: false, size: { w: 140, d: 90, h: 40 } });
    const layout = caseLayout(state);
    expect(layout.dims.w).toBe(140);
    expect(Math.max(...faces(state, 'right'))).toBeCloseTo(140, 6);
  });

  it('connectors shorter than the wall: the board stops just short of the inner wall, and the panel says how deep they sit', () => {
    const state = withWall('front', {}, { wall: 4 });
    const layout = caseLayout(state);
    expect(layout.boards[0].outline.y0).toBeCloseTo(4 + WALL_GAP, 6);
    expect(collisions(layout).some((m) => m.code.startsWith('info.portsRecessed'))).toBe(true);
  });

  it('the side and the offset survive a file; garbage falls back to none', () => {
    const state = withWall('right', { wallOffset: -0.5 });
    expect(state.boards[0].walls).toEqual(['right']);
    expect(state.boards[0].wallOffset).toBe(-0.5);
    expect(sanitizeState(JSON.parse(JSON.stringify(state)))).toEqual(state);
    expect(withWall('ceiling').boards[0].walls).toBeUndefined();
  });

  it('two boards against one wall at different depths: the one further in is warned about', () => {
    const state = sanitizeState({
      ...base,
      boards: [
        { ...base.boards[0], walls: ['right'] },
        { ...base.boards[0], y: 70, x: 10, walls: ['right'] },
      ],
    });
    // the second board reaches 10 mm further right: it takes the wall, the first is left short of it
    const codes = collisions(caseLayout(state));
    const pushed = codes.filter((m) => m.code === 'warn.notAgainstWall').map((m) => m.params);
    expect(pushed).toEqual([{ board: 1, boardName: 'Raspberry Pi 4 Model B', side: 'right', other: 2, otherName: 'Raspberry Pi 4 Model B' }]);
  });

  it('a cylinder, a rail edge and the side lid\'s own face ignore the wall', () => {
    const cylinder = withWall('right', {}, { kind: 'cylinder' });
    expect(caseLayout(cylinder).boards[0].walls).toEqual([]);
    const sideLid = sanitizeState({ ...withWall('right'), lid: { ...base.lid, face: 'right', chosen: 'right' } });
    expect(caseLayout(sideLid).boards[0].walls).toEqual([]);
    const nano = sanitizeState({ ...base, boards: [{ board: 'arduino-nano', walls: ['front'] }] });
    const edges = railEdges(caseLayout(nano).boards[0].def);
    expect(edges).toContain('front');
    expect(caseLayout(nano).boards[0].walls).toEqual([]);
  });
});

describe('a user\'s project: the layout messages say where and what to do', () => {
  const file: unknown = JSON.parse(readFileSync(new URL('./fixtures/korpus-1.json', import.meta.url), 'utf8'));
  const state = sanitizeState(Reflect.get(file ?? {}, 'state'));
  const messages = collisions(caseLayout(state));

  it('one note per board for its recessed connectors, naming the walls', () => {
    const recessed = messages.filter((m) => m.code.startsWith('info.portsRecessed')).map(({ code, params }) => ({ code, params }));
    expect(recessed).toEqual([
      { code: 'info.portsRecessed', params: { board: 1, boardName: 'TPA3118', walls: 'front,back', wall: 2, mm: '2.3' } },
      { code: 'info.portsRecessed', params: { board: 2, boardName: 'DC-DC', walls: 'back', wall: 2, mm: '2.3' } },
    ]);
  });

  it('a board off its wall: which wall, and which board pushes it', () => {
    const pushed = messages.filter((m) => m.code.startsWith('warn.notAgainstWall')).map((m) => m.params);
    expect(pushed).toEqual([
      { board: 1, boardName: 'TPA3118', side: 'right', other: 3, otherName: 'KaRadio ESP32' },
      { board: 2, boardName: 'DC-DC', side: 'left', other: 1, otherName: 'TPA3118' },
      { board: 2, boardName: 'DC-DC', side: 'right', other: 3, otherName: 'KaRadio ESP32' },
    ]);
  });

  it('the text names the board, the walls and the cure', () => {
    setLang('ru');
    const text = messages.map(tm);
    setLang('en');
    expect(text).toContain('Плата 1 «TPA3118», спереди и сзади: разъёмы кончаются у края платы, а стенка 2 мм — их торцы на 2.3 мм глубже, чем просит «Разъёмы от поверхности». Обычно это не мешает: штекер или палец достаёт их через отверстие. Если разъёмы на самом деле выступают за край платы, укажите это в «Выступ» (редактор своей платы).');
    expect(text).toContain('Плата 1 «TPA3118» не у стенки справа: её отодвигает плата 3 «KaRadio ESP32». Выровняйте платы по этой стороне или снимите «справа» в «К стенке».');
  });

  it('connectors that do stick out: how thin a wall brings them flush', () => {
    const thick = sanitizeState({ ...defaultState(), shape: { ...defaultState().shape, wall: 4 }, boards: [{ ...defaultState().boards[0], walls: ['front'] }] });
    const [note] = collisions(caseLayout(thick)).filter((m) => m.code.startsWith('info.portsRecessed'));
    expect(note.code).toBe('info.portsRecessedOut');
    expect(note.params).toMatchObject({ board: 1, walls: 'front', wall: 4 });
  });
});

