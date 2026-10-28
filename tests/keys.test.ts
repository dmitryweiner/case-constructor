// Keyboards (plans/PLAN-KEYBOARDS.md K1): the key field, its rows and
// default opening, parts through the plate, the placement's choice.

import { KEYS_OPEN, PORT_TYPES, keyFields, keysOf, onFace, sanitizeBoard, sanitizePort } from '../src/boards/schema';
import { boardOf, defaultPlacement, frontHeight, hangsByDefault, holdChoices, holesAmongKeys, keysOpen, sanitizePlacement } from '../src/boards/placement';
import { CEILING_GAP } from '../src/boards/placement';
import { RAW_BOARDS, catalogBoard } from '../src/boards/catalog';
import { initCSG, toManifold } from '../src/geo/csg';
import type { CsgApi } from '../src/geo/csg';
import { buildCase } from '../src/geo/build';
import { caseLayout, collisions } from '../src/geo/layout';
import type { Message } from '../src/geo/message';
import { WINDOW_FLARE, cutWarnings, plugNotes, portAxis, keyNotes, keysProud, portCutters, thinnestWeb } from '../src/geo/ports';
import { validateMesh } from '../src/geo/validate';
import { defaultState, sanitizeState } from '../src/state/schema';
import type { AppState } from '../src/state/schema';
import { garbageLike, KEYPAD, boxMesh, rng } from './helpers';
import { CAP_FIT, CAP_FLANGE_T, CAP_HOLD, CAP_R_MIN, capSizeRange, CAP_GAP, CAP_GROW, CAP_LIP, CAP_PROUD, capSizes } from '../src/geo/capSize';
import { capMesh, capsInCase, keyCaps, withCaps } from '../src/geo/caps';
import { rimsOf } from '../src/geo/rim';
import { clampHold, clampPads } from '../src/geo/clamp';
import { REST_MAX, caseRests, restWarnings, restsOf } from '../src/geo/rests';
import { applyAffine, meshBounds } from '../src/geo/surface';

function rec(x: unknown): Record<string, unknown> {
  return typeof x === 'object' && x !== null ? Object.fromEntries(Object.entries(x)) : {};
}

const size = { w: 64, d: 84 };
const field = { id: 'keys', type: 'keys', edge: 'top', x: 32, y: 40, w: 60, d: 70, h: 4 };

describe('a key field', () => {
  it('keeps its rows and its default opening; the keys come from the rows', () => {
    const port = sanitizePort({ ...field, base: 1, open: 'holes', rows: [{ y: 10, x: 8, n: 3, pitch: 6, w: 4, d: 3 }] }, size, 0);
    expect(port).toMatchObject({ base: 1, open: 'holes', rows: [{ y: 10, x: 8, n: 3, pitch: 6, w: 4, d: 3, shape: 'rect' }] });
    if (!port || !('rows' in port)) throw new Error('a field');
    expect(keysOf(port).map((key) => key.x)).toEqual([8, 14, 20]);
    // a round key gives its diameter once
    const round = sanitizePort({ ...field, rows: [{ y: 10, x: 8, n: 1, pitch: 6, w: 4, shape: 'round' }] }, size, 0);
    expect(round).toMatchObject({ rows: [{ w: 4, d: 4, shape: 'round' }] });
  });

  it('drops a row that leaves the field; holes need rows', () => {
    const port = sanitizePort({ ...field, open: 'holes', rows: [{ y: 10, x: 8, n: 12, pitch: 6, w: 4, d: 3 }] }, size, 0);
    expect(port).not.toHaveProperty('rows');
    expect(port).not.toHaveProperty('open');
    // only a field on top has rows; any part on top may go through the plate
    expect(sanitizePort({ ...field, type: 'generic', rows: [{ y: 10, x: 8, n: 1 }] }, size, 0)).not.toHaveProperty('rows');
    expect(sanitizePort({ ...field, edge: 'bottom', base: 1 }, size, 0)).not.toHaveProperty('base');
    expect(sanitizePort({ ...field, base: 9 }, size, 0)).toMatchObject({ base: 4 });
  });

  it('port types: a field and a knob open the lid by default', () => {
    expect(PORT_TYPES.keys).toMatchObject({ top: true, cut: true });
    expect(PORT_TYPES.knob).toMatchObject({ top: true, cut: true, shape: 'round' });
    expect(KEYS_OPEN).toEqual(['window', 'holes', 'caps']);
  });

  it('fuzz with a key field: never throws and is idempotent', () => {
    const random = rng(21);
    for (let i = 0; i < 500; i++) {
      const once = sanitizeBoard(garbageLike(KEYPAD, random));
      expect(sanitizeBoard(once)).toEqual(once);
      expect(sanitizeBoard(JSON.parse(JSON.stringify(once)))).toEqual(once);
    }
  });
});

describe('a keyboard entry', () => {
  const keypad = sanitizeBoard(KEYPAD);

  it('is its own kind and hangs from the lid when added', () => {
    expect(keypad.kind).toBe('keyboard');
    expect(keyFields(keypad)).toHaveLength(1);
    expect(hangsByDefault(keypad)).toBe(true);
    expect(defaultPlacement(keypad).on).toBe('ceiling');
    // a board with a key field hangs too, whatever its kind
    expect(hangsByDefault(sanitizeBoard({ ...KEYPAD, kind: 'mcu' }))).toBe(true);
  });

  it('under holes the plate lies on the keys’ base; over a window the field rises into it', () => {
    expect(keysOpen(keypad, {})).toBe('holes');
    expect(frontHeight(keypad, {})).toBe(5);
    expect(frontHeight(keypad, { keys: 'window' })).toBe(4);
    // without rows there are no holes to choose
    const bare = sanitizeBoard({ ...KEYPAD, ports: [{ ...KEYPAD.ports[0], rows: undefined }] });
    expect(keysOpen(bare, { keys: 'holes' })).toBe('window');
    expect(frontHeight(bare, { keys: 'holes' })).toBe(4);
    // a closed field stays under the plate whole
    expect(frontHeight(keypad, { cuts: { keys: false } })).toBe(11.6);
  });

  it('the placement keeps a choice that differs from the entry, and a fit', () => {
    const custom = { ...keypad, id: 'custom' };
    expect(sanitizePlacement({ board: 'custom', custom, keys: 'holes' })).not.toHaveProperty('keys');
    expect(sanitizePlacement({ board: 'custom', custom, keys: 'window' }).keys).toBe('window');
    expect(sanitizePlacement({ board: 'custom', custom, keyFit: 9 }).keyFit).toBe(3);
    expect(sanitizePlacement({ board: 'raspberry-pi-4b', keys: 'window', keyFit: 1 })).not.toHaveProperty('keys');
    expect(sanitizePlacement({ board: 'raspberry-pi-4b', keyFit: 1 })).not.toHaveProperty('keyFit');
  });

  it('fuzz on a keyboard placement: never throws and is idempotent', () => {
    const random = rng(22);
    const custom = { ...keypad, id: 'custom' };
    for (let i = 0; i < 300; i++) {
      const once = sanitizePlacement(garbageLike({ ...defaultPlacement(custom), board: 'custom', custom, keys: 'window', keyFit: 1 }, random));
      expect(sanitizePlacement(once)).toEqual(once);
      expect(sanitizePlacement(JSON.parse(JSON.stringify(once)))).toEqual(once);
    }
  });
});

describe('keyboards in the catalog', () => {
  const keyboards = RAW_BOARDS.filter((raw) => rec(raw).kind === 'keyboard' || JSON.stringify(raw).includes('"keys"'));

  it('rows as written, what stays under the plate within topHeight', () => {
    for (const raw of keyboards) checkKeyboard(raw);
  });
});

/** A catalog keyboard: its rows and default opening as written, what stays under the plate within its topHeight. */
function checkKeyboard(raw: unknown): void {
  const board = sanitizeBoard(raw);
  const ports = rec(raw).ports;
  for (const [i, rawPort] of (Array.isArray(ports) ? ports : []).entries()) {
    const p = rec(rawPort);
    const port = board.ports[i];
    const where = `${board.id}: ${port.id}`;
    if (p.rows !== undefined) expect('rows' in port ? port.rows?.length : 0, `${where} rows`).toBe(Array.isArray(p.rows) ? p.rows.length : 0);
    if (p.open !== undefined) expect('open' in port ? port.open : undefined, `${where} open`).toBe(p.open);
    // a key field stands out of the plate; anything else stays under it, a part through it with its base
    if (port.edge === 'top' && port.type !== 'keys') expect(port.base ?? port.h, `${where} under the plate`).toBeLessThanOrEqual(board.topHeight);
  }
}

describe('a keyboard hung from the lid (K2)', () => {
  let csg: CsgApi;
  beforeAll(async () => {
    csg = await initCSG();
  });

  const keypad = { ...sanitizeBoard(KEYPAD), id: 'custom' };
  function state(board: Record<string, unknown> = {}, patch: Partial<AppState> = {}): AppState {
    return sanitizeState({
      ...defaultState(), ...patch,
      boards: [{ ...defaultPlacement(keypad), board: 'custom', custom: keypad, mount: { size: 'M3', hole: 'tap' }, ...board }],
    });
  }
  const notes = (s: AppState): Message[] => {
    const layout = caseLayout(s);
    const shape = { ...s.shape, console: layout.console };
    return keyNotes(layout, shape);
  };

  it('under holes the plate lies on the keys’ base, the gap above it; over a window on topHeight', () => {
    const s = state();
    const layout = caseLayout(s);
    const [board] = layout.boards;
    expect(board.hung).toBe(true);
    const ceiling = layout.dims.h - s.shape.floor;
    expect(board.z0).toBeCloseTo(ceiling - CEILING_GAP - 5 - 1.6, 6);
    const window = caseLayout(state({ keys: 'window' })).boards[0];
    expect(window.z0 - board.z0).toBeCloseTo(1, 6);
  });

  it('the key tops stand out of the plate by h − front − gap − plate', () => {
    const s = state();
    expect(keysProud(caseLayout(s).boards[0], keyFields(keypad)[0], s.shape, caseLayout(s).dims, 0, 0))
      .toBeCloseTo(11.6 - 5 - CEILING_GAP - s.shape.floor, 6);
    const [note] = notes(s);
    expect(note).toMatchObject({ code: 'info.keysProud', params: { port: 'keys', mm: (11.6 - 5 - CEILING_GAP - s.shape.floor).toFixed(1) } });
    expect(note.spot?.holder).toEqual({ board: 0 });
  });

  it('key tops under the face: a warning under holes, a word over a window', () => {
    const low = { ...keypad, ports: [{ ...keypad.ports[0], h: 6 }, ...keypad.ports.slice(1)] };
    expect(notes(state({ custom: low }))[0].code).toBe('warn.keysUnderFace');
    expect(notes(state({ custom: low, keys: 'window' }))[0].code).toBe('info.keysSunk');
    // closed, nothing to say
    expect(notes(state({ custom: low, cuts: { keys: false } }))).toEqual([]);
  });

  it('on the console’s slope it stands out as much, along the slope’s normal', () => {
    const s = state({}, { shape: { ...defaultState().shape, kind: 'console' } });
    const [note] = notes(s);
    expect(note.params?.mm).toBe((11.6 - 5 - CEILING_GAP - s.shape.floor).toFixed(1));
  });

  it('its supports go between the keys: no layout warnings', () => {
    expect(collisions(caseLayout(state()))).toEqual([]);
  });

  it('builds closed and sliver-free under a top lid', () => {
    const built = buildCase(csg, state(), 8);
    for (const mesh of [built.body, built.lid]) {
      const report = validateMesh(mesh);
      expect(report.watertight).toBe(true);
      expect(report.degenerateTriangles).toBe(0);
    }
  });
});

describe('openings over the keys (K3)', () => {
  let csg: CsgApi;
  beforeAll(async () => {
    csg = await initCSG();
  });

  const keypad = { ...sanitizeBoard(KEYPAD), id: 'custom' };
  function state(board: Record<string, unknown> = {}, patch: Partial<AppState> = {}): AppState {
    return sanitizeState({
      ...defaultState(), ...patch,
      boards: [{ ...defaultPlacement(keypad), board: 'custom', custom: keypad, mount: { size: 'M3', hole: 'tap' }, ...board }],
    });
  }
  const keyCutters = (s: AppState) => {
    const layout = caseLayout(s);
    return portCutters(layout, { ...s.shape, console: layout.console }).filter((cutter) => cutter.source.kind === 'port' && cutter.source.port === 'keys');
  };

  it('a hole per key, the key grown by the fit, straight; or one chamfered window', () => {
    const holes = keyCutters(state());
    expect(holes).toHaveLength(12);
    expect(holes.every((cutter) => cutter.flare === undefined)).toBe(true);
    expect(holes[0]).toMatchObject({ w: 14 + 2 * 0.5, h: 14 + 2 * 0.5 });
    expect(keyCutters(state({ keyFit: 2.25 }))[0]).toMatchObject({ w: 18.5, h: 18.5 });
    const window = keyCutters(state({ keys: 'window' }));
    expect(window).toHaveLength(1);
    expect(window[0]).toMatchObject({ w: 57.15 + 1, h: 76.2 + 1, flare: { rate: WINDOW_FLARE } });
    expect(keyCutters(state({ keys: 'window', bevel: false }))[0].flare).toBeUndefined();
    expect(keyCutters(state({ cuts: { keys: false } }))).toEqual([]);
  });

  it('turned on the slope, the holes follow the board', () => {
    const s = state({}, { shape: { ...defaultState().shape, kind: 'console' }, lid: { ...defaultState().lid, face: 'bottom' } });
    const holes = keyCutters(s);
    expect(holes).toHaveLength(12);
    expect(holes[0].ez[2]).toBeLessThan(1 - 1e-6);
  });

  it('a web thinner than KEY_WEB between two holes is a warning', () => {
    expect(thinnestWeb(keyFields(keypad)[0], 0.5)).toBeCloseTo(19.05 - 14 - 1, 6);
    const notes = (s: AppState): string[] => {
      const layout = caseLayout(s);
      return keyNotes(layout, { ...s.shape, console: layout.console }).map((note) => note.code);
    };
    expect(notes(state())).not.toContain('warn.keyWebThin');
    expect(notes(state({ keyFit: 2.25 }))).toContain('warn.keyWebThin');
    expect(notes(state({ keyFit: 2.25, keys: 'window' }))).not.toContain('warn.keyWebThin');
  });

  it.each([['holes', {}], ['window', { keys: 'window' }], ['slope', { shape: 'console' }]])('builds closed and sliver-free: %s', (_name, patch) => {
    const s = 'shape' in patch
      ? state({}, { shape: { ...defaultState().shape, kind: 'console' }, lid: { ...defaultState().lid, face: 'bottom' } })
      : state(patch);
    const built = buildCase(csg, s, 8);
    for (const mesh of [built.body, built.lid]) {
      const report = validateMesh(mesh);
      expect(report.watertight).toBe(true);
      expect(report.degenerateTriangles).toBe(0);
    }
  });
});

describe('the catalog keyboards (K6a)', () => {
  let csg: CsgApi;
  beforeAll(async () => {
    csg = await initCSG();
  });
  const add = (board: string, patch: Partial<AppState> = {}, extra: Record<string, unknown> = {}): AppState => {
    const entry = catalogBoard(board);
    if (!entry) throw new Error(board);
    return sanitizeState({ ...defaultState(), ...patch, boards: [{ ...defaultPlacement(entry), ...extra }] });
  };

  it('the CardKB hangs, a window over its whole face; its Grove plug gets a slot, not a way through the wall', () => {
    const s = add('m5stack-cardkb-v1.1');
    expect(s.boards[0].on).toBe('ceiling');
    const layout = caseLayout(s);
    const shape = { ...s.shape, console: layout.console };
    const grove = portCutters(layout, shape).find((cutter) => cutter.source.kind === 'port' && cutter.source.port === 'grove');
    expect(grove?.s1).toBe(12);
    // the keys sit just under the face in their window: a word, no warning
    expect(keyNotes(layout, shape).map((note) => note.code)).toEqual(['info.keysSunk']);
    // and its socket stands up out of the window: a word on the gap that sinks it
    expect(cutWarnings(layout, shape, s.lid, portCutters(layout, shape), []).map((note) => note.code)).toEqual(['info.keysSunk', 'info.plugProud']);
    // the slot stays inside the case: the wall stands beyond it
    expect(layout.boards[0].footprint.x0).toBeLessThanOrEqual(layout.boards[0].outline.x0 - 12);
  });

  it('the MacroPad stands on the floor (its holes are among the keys); the ceiling comes down to its switch plate line', () => {
    const entry = catalogBoard('adafruit-macropad-rp2040');
    if (!entry) throw new Error('macropad');
    expect(holesAmongKeys(entry)).toBe(true);
    expect(add('adafruit-macropad-rp2040').boards[0]).not.toHaveProperty('on');
    // tall enough standoffs that the stack, not the case's least height, sets the ceiling
    const s = add('adafruit-macropad-rp2040', {}, { z: 12 });
    const layout = caseLayout(s);
    const [board] = layout.boards;
    const ceiling = layout.dims.h - s.shape.floor;
    expect(ceiling - (board.z0 + entry.size.t + 2.7)).toBeCloseTo(CEILING_GAP, 6);
    // closed, the keys stay under the lid: the ceiling clears their tops by the margin
    const closed = caseLayout(add('adafruit-macropad-rp2040', {}, { z: 12, cuts: { keys: false } }));
    expect(closed.dims.h - s.shape.floor - (closed.boards[0].z0 + entry.size.t + 11.6)).toBeCloseTo(s.shape.margin.top, 6);
  });

  it('on low standoffs under the case’s least height, the lid lies above its switches’ plate line: a warning with the height to raise it to', () => {
    const codes = (s: AppState): Message[] => {
      const layout = caseLayout(s);
      return keyNotes(layout, { ...s.shape, console: layout.console });
    };
    // added, it stands just high enough; lowered to the least its standoffs allow, too low
    expect(codes(add('adafruit-macropad-rp2040')).map((note) => note.code)).not.toContain('warn.keysPlateHigh');
    const low = codes(add('adafruit-macropad-rp2040', {}, { z: 7 }));
    const high = low.find((note) => note.code === 'warn.keysPlateHigh');
    expect(high).toBeDefined();
    const z = Number(high?.params?.z);
    expect(codes(add('adafruit-macropad-rp2040', {}, { z })).map((note) => note.code)).not.toContain('warn.keysPlateHigh');
  });

  it.each(['m5stack-cardkb-v1.1', 'adafruit-macropad-rp2040'])('%s builds closed and sliver-free, no layout warnings', (board) => {
    const s = add(board);
    expect(collisions(caseLayout(s))).toEqual([]);
    const built = buildCase(csg, s, 8);
    for (const mesh of [built.body, built.lid]) {
      const report = validateMesh(mesh);
      expect(report.watertight).toBe(true);
      expect(report.degenerateTriangles).toBe(0);
    }
  });
});

describe('a plug’s slot through the lid', () => {
  let csg: CsgApi;
  beforeAll(async () => {
    csg = await initCSG();
  });

  it('the hung CardKB’s Grove plug passes through the top plate beside the board', () => {
    const s = sanitizeState({ ...defaultState(), boards: [{ board: 'm5stack-cardkb-v1.1', on: 'ceiling', z: CEILING_GAP }] });
    const layout = caseLayout(s);
    const [board] = layout.boards;
    const grove = board.def.ports.find((port) => port.id === 'grove');
    if (!grove || onFace(grove)) throw new Error('grove');
    const { face, dir } = portAxis(board, grove);
    const built = buildCase(csg, s, 8);
    const lid = toManifold(csg, built.lid);
    const at = (s1: number): boolean => {
      const probe = csg.Manifold.cube([0.1, 0.1, 0.1], true).translate([face[0] + dir[0] * s1, face[1] + dir[1] * s1, layout.dims.h - s.shape.floor / 2]);
      const common = lid.intersect(probe);
      const solid = common.volume() > 0.0009;
      probe.delete();
      common.delete();
      return solid;
    };
    expect(at(6)).toBe(false);
    expect(at(14)).toBe(true);
    lid.delete();
  });
});

describe('printed caps over the keys (K3b)', () => {
  let csg: CsgApi;
  beforeAll(async () => {
    csg = await initCSG();
  });
  const cardkb = (extra: Record<string, unknown> = {}, patch: Partial<AppState> = {}): AppState => sanitizeState({
    ...defaultState(), ...patch, boards: [{ board: 'm5stack-cardkb-v1.1', on: 'ceiling', z: CEILING_GAP, keys: 'caps', ...extra }],
  });

  it('a stem over each key, a flange as wide as the neighbours leave room for', () => {
    const entry = catalogBoard('m5stack-cardkb-v1.1');
    if (!entry) throw new Error('cardkb');
    const sizes = capSizes(keyFields(entry)[0]);
    expect(sizes).toHaveLength(50);
    expect(sizes[0].stemR).toBeCloseTo(2.1 / 2 + CAP_GROW, 6);
    // 6 mm apart: the flanges keep CAP_GAP between them
    expect(sizes[0].flangeR).toBeCloseTo(Math.min(sizes[0].stemR + CAP_LIP, (6 - CAP_GAP) / 2), 6);
  });

  it('a cap is a closed solid', () => {
    for (const corner of [1.8, 0.3, 1]) {
      const report = validateMesh(capMesh({ stemR: 1.8, flangeR: 2.8, corner, length: 4 }));
      expect(report.watertight, `corner ${corner}`).toBe(true);
      expect(report.degenerateTriangles).toBe(0);
      expect(report.volume).toBeGreaterThan(0);
    }
    // a square stem with rounded corners holds more than a round one
    const square = validateMesh(capMesh({ stemR: 1.8, flangeR: 2.8, corner: 0.3, length: 4 })).volume;
    expect(square).toBeGreaterThan(validateMesh(capMesh({ stemR: 1.8, flangeR: 2.8, corner: 1.8, length: 4 })).volume);
  });

  it('the plate lies the gap over the flanges; each cap stands CAP_PROUD out of the lid through its hole', () => {
    const s = cardkb();
    const layout = caseLayout(s);
    const shape = { ...s.shape, console: layout.console };
    const [board] = layout.boards;
    expect(board.z0).toBeCloseTo(layout.dims.h - s.shape.floor - CEILING_GAP - (1.75 + CAP_FLANGE_T) - 1, 6);
    const caps = keyCaps(layout, shape);
    expect(caps).toHaveLength(50);
    expect(caps[0].length).toBeCloseTo(CAP_FLANGE_T + CEILING_GAP + s.shape.floor + CAP_PROUD, 6);
    const holes = portCutters(layout, shape).filter((cutter) => cutter.source.kind === 'port' && cutter.source.port === 'keys');
    expect(holes).toHaveLength(50);
    expect(holes[0]).toMatchObject({ shape: 'round', w: 2 * caps[0].stemR + 2 * CAP_FIT });
    expect(keyNotes(layout, shape).map((note) => note.code)).toEqual(['info.keyCaps']);
  });

  it('square caps: rounded corners never under CAP_R_MIN, their holes rounded alike', () => {
    expect(sanitizePlacement({ ...cardkb().boards[0], capShape: 'square', capR: 0 })).toMatchObject({ capShape: 'square', capR: CAP_R_MIN });
    expect(sanitizePlacement({ ...cardkb().boards[0], capShape: 'round' })).not.toHaveProperty('capShape');
    const s = cardkb({ capShape: 'square', capR: 0.5 });
    const layout = caseLayout(s);
    const shape = { ...s.shape, console: layout.console };
    const [cap] = keyCaps(layout, shape);
    expect(cap.corner).toBeCloseTo(0.5, 6);
    const [hole] = portCutters(layout, shape).filter((cutter) => cutter.source.kind === 'port' && cutter.source.port === 'keys');
    expect(hole).toMatchObject({ shape: 'rect', w: 2 * cap.stemR + 2 * CAP_FIT });
    expect(hole.r).toBeCloseTo(0.5 + CAP_FIT, 6);
    const built = buildCase(csg, s, 8);
    const report = validateMesh(built.lid);
    expect(report.watertight).toBe(true);
    expect(report.degenerateTriangles).toBe(0);
    // a corner larger than the stem is the stem's half: round
    expect(keyCaps(caseLayout(cardkb({ capShape: 'square', capR: 5 })), shape)[0].corner).toBeCloseTo(cap.stemR, 6);
  });

  it('a chosen cap size stays between the button and the room the neighbours leave', () => {
    const entry = catalogBoard('m5stack-cardkb-v1.1');
    if (!entry) throw new Error('cardkb');
    const field = keyFields(entry)[0];
    const range = capSizeRange(field, CAP_FIT);
    expect(range?.min).toBeCloseTo(2.1, 6);
    // 6 mm apart: the flanges keep CAP_GAP, each still CAP_HOLD past its hole
    expect(range?.max).toBeCloseTo(2 * ((6 - CAP_GAP) / 2 - CAP_HOLD - CAP_FIT), 6);
    expect(capSizes(field, { size: 99, fit: CAP_FIT })[0].stemR * 2).toBeCloseTo(range?.max ?? 0, 6);
    expect(capSizes(field, { size: 0.5, fit: CAP_FIT })[0].stemR * 2).toBeCloseTo(2.1, 6);
    // at the widest the case is clean: no thin web, flanges that hold, closed and sliver-free
    const s = cardkb({ capSize: 99 });
    const layout = caseLayout(s);
    const codes = keyNotes(layout, { ...s.shape, console: layout.console }).map((note) => note.code);
    expect(codes).not.toContain('warn.capFlangeSmall');
    expect(codes).not.toContain('warn.keyWebThin');
    const built = buildCase(csg, s, 8);
    const report = validateMesh(built.lid);
    expect(report.watertight).toBe(true);
    expect(report.degenerateTriangles).toBe(0);
    const caps = capsInCase(keyCaps(layout, { ...s.shape, console: layout.console }));
    if (!caps) throw new Error('caps');
    expect(validateMesh(caps).watertight).toBe(true);
  });

  it('a fit so loose the flanges no longer hold is a warning', () => {
    const s = cardkb({ keyFit: 1 });
    const layout = caseLayout(s);
    expect(keyNotes(layout, { ...s.shape, console: layout.console }).map((note) => note.code)).toContain('warn.capFlangeSmall');
  });

  it('the case builds clean, the caps sit in their holes without touching the lid, and the Grove socket is clear of the plate', () => {
    const s = cardkb();
    const layout = caseLayout(s);
    const built = buildCase(csg, s, 8);
    for (const mesh of [built.body, built.lid]) {
      const report = validateMesh(mesh);
      expect(report.watertight).toBe(true);
      expect(report.degenerateTriangles).toBe(0);
    }
    const caps = capsInCase(keyCaps(layout, { ...s.shape, console: layout.console }));
    if (!caps) throw new Error('caps');
    const lid = toManifold(csg, built.lid);
    const solid = toManifold(csg, caps);
    const common = lid.intersect(solid);
    expect(common.volume()).toBeLessThan(1e-3);
    // the Grove socket's body under the plate: an opening over it
    const [board] = layout.boards;
    const [x, y, z] = [...applyAffine(board.toCase, [5, 38.85, 0]).slice(0, 2), layout.dims.h - s.shape.floor / 2];
    const probe = csg.Manifold.cube([0.1, 0.1, 0.1], true).translate([x, y, z]);
    const hit = lid.intersect(probe);
    expect(hit.volume()).toBeLessThan(1e-6);
    for (const one of [lid, solid, common, probe, hit]) one.delete();
  });

  it('the Lid STL and Both lay the caps out flange down next to the lid', () => {
    const caps = keyCaps(caseLayout(cardkb()), { ...cardkb().shape, console: caseLayout(cardkb()).console });
    const placed = withCaps([boxMesh(50, 40, 3)], caps, 10);
    expect(placed).toHaveLength(2);
    const bounds = meshBounds(placed[1]);
    expect(bounds.min[0]).toBeGreaterThanOrEqual(60 - 1e-6);
    expect(bounds.min[2]).toBeCloseTo(0, 6);
  });
});

describe('rests under a keyboard that rocks (K5)', () => {
  let csg: CsgApi;
  beforeAll(async () => {
    csg = await initCSG();
  });
  const bbq = (extra: Record<string, unknown> = {}, patch: Partial<AppState> = {}): AppState => {
    const entry = catalogBoard('solderparty-bbq20kbd');
    if (!entry) throw new Error('bbq20kbd');
    return sanitizeState({ ...defaultState(), ...patch, boards: [{ ...defaultPlacement(entry), ...extra }] });
  };
  const solid = (part: ReturnType<typeof toManifold>, x: number, y: number, z: number): boolean => {
    const probe = csg.Manifold.cube([0.1, 0.1, 0.1], true).translate([x, y, z]);
    const common = part.intersect(probe);
    const filled = common.volume() > 0.0009;
    probe.delete();
    common.delete();
    return filled;
  };

  it('the BBQ20KBD stands on the floor: one hole is under its keyboard', () => {
    const entry = catalogBoard('solderparty-bbq20kbd');
    if (!entry) throw new Error('bbq20kbd');
    expect(holesAmongKeys(entry)).toBe(true);
    expect(bbq().boards[0]).not.toHaveProperty('on');
  });

  it('a rest under each free corner, none by a hole; clear of the parts underneath', () => {
    const s = bbq();
    const layout = caseLayout(s);
    const rests = restsOf(layout.boards[0], layout, s.shape.floor);
    expect(rests.map((rest) => [Math.round(rest.x), Math.round(rest.y)])).toEqual([[71, 3], [3, 50]]);
    expect(rests.every((rest) => rest.problem === undefined)).toBe(true);
    // on the floor a rest touches the PCB
    expect(rests[0].top).toBeCloseTo(layout.boards[0].z0, 6);
    // no keyboard, no rests: an ESP32 on two holes is not pressed
    expect(caseRests(caseLayout(defaultState()), 2)).toEqual([]);
  });

  it('built into the body under a top lid, up to the PCB; hung, from the floor to just short of it', () => {
    for (const s of [bbq(), bbq({ on: 'ceiling', z: CEILING_GAP })]) {
      const layout = caseLayout(s);
      const [rest] = restsOf(layout.boards[0], layout, s.shape.floor);
      const built = buildCase(csg, s, 8);
      for (const mesh of [built.body, built.lid]) {
        const report = validateMesh(mesh);
        expect(report.watertight).toBe(true);
        expect(report.degenerateTriangles).toBe(0);
      }
      const body = toManifold(csg, built.body);
      expect(solid(body, rest.cx, rest.cy, rest.top - 0.2)).toBe(true);
      expect(solid(body, rest.cx, rest.cy, rest.top + 0.1)).toBe(false);
      body.delete();
    }
  });

  it('a rest longer than REST_MAX is not built, and says so', () => {
    const s = bbq({ on: 'ceiling', z: CEILING_GAP }, { shape: { ...defaultState().shape, auto: false, size: { w: 100, d: 80, h: 60 } } });
    const layout = caseLayout(s);
    expect(caseRests(layout, s.shape.floor)).toEqual([]);
    expect(restWarnings(layout, s.shape.floor).map((note) => note.code)).toEqual(['warn.restTooLong']);
    expect(REST_MAX).toBe(40);
  });
});

describe('a keypad’s flange under the plate (K4) and the last two keyboards', () => {
  let csg: CsgApi;
  beforeAll(async () => {
    csg = await initCSG();
  });
  const add = (board: string, extra: Record<string, unknown> = {}): AppState => {
    const entry = catalogBoard(board);
    if (!entry) throw new Error(board);
    return sanitizeState({ ...defaultState(), boards: [{ ...defaultPlacement(entry), ...extra }] });
  };

  it('the KeebDeck hangs pressed on its flange: the plate on the flange’s front, a rim around it, no gap warning', () => {
    const s = add('solderparty-keebdeck-basic');
    expect(s.boards[0]).toMatchObject({ on: 'ceiling', z: 0 });
    const layout = caseLayout(s);
    const [board] = layout.boards;
    expect(board.z0).toBeCloseTo(layout.dims.h - s.shape.floor - 1.5 - 1.6, 6);
    const [rim] = rimsOf(board);
    expect(rim).toMatchObject({ port: 'keys', z1: 1.6 + 1.5 });
    expect(rim.z0).toBeCloseTo(1.6 + 1.5 - 0.7, 6);
    expect(collisions(layout)).toEqual([]);
    // over a window the flange still lies under the plate
    expect(frontHeight(board.def, { keys: 'window' })).toBe(1.5);
  });

  it('its USB-C stands taller than the flange: its opening starts behind its body, through the plate', () => {
    const s = add('solderparty-keebdeck-basic');
    const layout = caseLayout(s);
    const usb = portCutters(layout, { ...s.shape, console: layout.console }).find((cutter) => cutter.source.kind === 'port' && cutter.source.port === 'usb-c');
    expect(usb?.s0).toBeLessThan(-7);
  });

  it('the Keyboard FeatherWing stands on the floor (two holes under its keyboard), two windows in one lid', () => {
    const s = add('solderparty-keyboard-featherwing');
    expect(s.boards[0]).not.toHaveProperty('on');
    const layout = caseLayout(s);
    const openings = portCutters(layout, { ...s.shape, console: layout.console }).filter((cutter) => cutter.source.kind === 'port' && cutter.ez[2] === 1);
    expect(openings.map((cutter) => cutter.source.kind === 'port' && cutter.source.port).sort()).toEqual(['display', 'keys']);
  });

  it.each(['solderparty-bbq20kbd', 'solderparty-keebdeck-basic', 'solderparty-keyboard-featherwing'])('%s builds closed and sliver-free, no layout warnings', (board) => {
    const s = add(board);
    expect(collisions(caseLayout(s))).toEqual([]);
    const built = buildCase(csg, s, 8);
    for (const mesh of [built.body, built.lid]) {
      const report = validateMesh(mesh);
      expect(report.watertight).toBe(true);
      expect(report.degenerateTriangles).toBe(0);
    }
  });
});

describe('the CardKB2', () => {
  let csg: CsgApi;
  beforeAll(async () => {
    csg = await initCSG();
  });

  it('hangs on its four M2 holes, its keys in two fields clear of the corner posts', () => {
    const entry = catalogBoard('m5stack-cardkb2');
    if (!entry) throw new Error('cardkb2');
    expect(holesAmongKeys(entry)).toBe(false);
    expect(keyFields(entry).flatMap((field) => keysOf(field))).toHaveLength(42);
    expect(defaultPlacement(entry).on).toBe('ceiling');
  });

  it.each([['window', {}], ['holes', { keys: 'holes' }], ['round caps', { keys: 'caps' }], ['square caps', { keys: 'caps', capShape: 'square', capR: 0.6 }]])(
    'builds closed and sliver-free, no layout warnings: %s', (_name, extra) => {
      const entry = catalogBoard('m5stack-cardkb2');
      if (!entry) throw new Error('cardkb2');
      const s = sanitizeState({ ...defaultState(), boards: [{ ...defaultPlacement(entry), ...extra }] });
      expect(collisions(caseLayout(s))).toEqual([]);
      const built = buildCase(csg, s, 8);
      for (const mesh of [built.body, built.lid]) {
        const report = validateMesh(mesh);
        expect(report.watertight).toBe(true);
        expect(report.degenerateTriangles).toBe(0);
      }
    },
  );
});

describe('holding a keyboard: screws, rails or clamp bars (review)', () => {
  let csg: CsgApi;
  beforeAll(async () => {
    csg = await initCSG();
  });
  const add = (board: string, extra: Record<string, unknown> = {}): AppState => {
    const entry = catalogBoard(board);
    if (!entry) throw new Error(board);
    return sanitizeState({ ...defaultState(), boards: [{ ...defaultPlacement(entry), ...extra }] });
  };

  it('a keyboard that hangs offers its own way and the others; the rest of the catalog keeps its own', () => {
    const choices = (id: string): string[] => {
      const entry = catalogBoard(id);
      if (!entry) throw new Error(id);
      return holdChoices(entry);
    };
    expect(choices('m5stack-cardkb-v1.1')).toEqual(['rails', 'clamp']);
    expect(choices('m5stack-cardkb2')).toEqual(['holes', 'rails', 'clamp']);
    expect(choices('adafruit-macropad-rp2040')).toEqual(['holes']);
    expect(choices('raspberry-pi-4b')).toEqual(['holes']);
    expect(choices('raspberry-pi-touch-display-2-7')).toEqual(['clamp']);
  });

  it('the choice is kept only where it is one, and the board is built held that way', () => {
    expect(sanitizePlacement({ board: 'm5stack-cardkb-v1.1', on: 'ceiling', hold: 'rails' })).not.toHaveProperty('hold');
    expect(sanitizePlacement({ board: 'raspberry-pi-4b', hold: 'clamp' })).not.toHaveProperty('hold');
    const clamped = sanitizePlacement({ board: 'm5stack-cardkb2', on: 'ceiling', hold: 'clamp' });
    expect(clamped).toMatchObject({ hold: 'clamp', on: 'ceiling', z: 0 });
    expect(boardOf(clamped).mount).toMatchObject({ kind: 'clamp', holes: [] });
    expect(boardOf(sanitizePlacement({ board: 'm5stack-cardkb2', on: 'ceiling', hold: 'rails' })).mount).toMatchObject({ kind: 'rails', holes: [], rails: 'long' });
    const once = sanitizePlacement({ board: 'm5stack-cardkb-v1.1', on: 'ceiling', hold: 'clamp', press: -0.5 });
    expect(sanitizePlacement(once)).toEqual(once);
  });

  it.each([
    ['m5stack-cardkb-v1.1', 'rails'], ['m5stack-cardkb-v1.1', 'clamp'],
    ['m5stack-cardkb2', 'holes'], ['m5stack-cardkb2', 'rails'], ['m5stack-cardkb2', 'clamp'],
  ])('%s on %s: closed, sliver-free, no layout warnings', (board, hold) => {
    const s = add(board, { hold, ...(hold === 'clamp' ? { z: 0 } : {}) });
    expect(collisions(caseLayout(s))).toEqual([]);
    const built = buildCase(csg, s, 8);
    for (const mesh of [built.body, built.lid, ...(built.lidClamps ? [built.lidClamps] : [])]) {
      const report = validateMesh(mesh);
      expect(report.watertight).toBe(true);
      expect(report.degenerateTriangles).toBe(0);
    }
    // a top lid holds the bars of a board it holds: they print with it
    if (hold === 'clamp') expect(built.lidClamps).toBeTruthy();
  });
});

describe('pads between a clamped keyboard and the lid (review)', () => {
  let csg: CsgApi;
  beforeAll(async () => {
    csg = await initCSG();
  });
  const add = (board: string, extra: Record<string, unknown> = {}): AppState => {
    const entry = catalogBoard(board);
    if (!entry) throw new Error(board);
    return sanitizeState({ ...defaultState(), boards: [{ ...defaultPlacement(entry), hold: 'clamp', ...extra }] });
  };

  it('a pad opposite each bar end, on both long edges, clear of the parts there', () => {
    const s = add('m5stack-cardkb2');
    const [board] = caseLayout(s).boards;
    const pads = clampPads(board.def, board.placement);
    const bars = clampHold(board.def, board.placement).bars;
    expect(pads).toHaveLength(2 * bars.length);
    for (const pad of pads) expect(bars.some((bar) => Math.abs(bar.at - pad.at) <= 8)).toBe(true);
    // a panel whose glass has its rim needs none
    const td2 = catalogBoard('raspberry-pi-touch-display-2-7');
    if (!td2) throw new Error('td2');
    expect(clampPads(td2, defaultPlacement(td2))).toEqual([]);
  });

  it.each([0, 0.8, 1.3])('gap %d: the board is held between the pads and the bars; the case closed and sliver-free', (z) => {
    for (const board of ['m5stack-cardkb-v1.1', 'm5stack-cardkb2']) {
      const s = add(board, { z });
      expect(collisions(caseLayout(s))).toEqual([]);
      const built = buildCase(csg, s, 8);
      for (const mesh of [built.body, built.lid, ...(built.lidClamps ? [built.lidClamps] : [])]) {
        const report = validateMesh(mesh);
        expect(report.watertight, `${board} gap ${z}`).toBe(true);
        expect(report.degenerateTriangles, `${board} gap ${z}`).toBe(0);
      }
      // a pad's under the board's front, in the lid
      const layout = caseLayout(s);
      const [placed] = layout.boards;
      const [pad] = clampPads(placed.def, placed.placement);
      const hold = clampHold(placed.def, placed.placement);
      const across = pad.side === 0 ? 0.5 : (hold.across === 'x' ? placed.def.size.w : placed.def.size.d) - 0.5;
      const [bx, by] = hold.across === 'x' ? [across, pad.at] : [pad.at, across];
      const top = placed.def.size.t;
      const at = applyAffine(placed.toCase, [bx, by, top + Math.max(z, 0.3) / 2]);
      const lid = toManifold(csg, built.lid);
      const probe = csg.Manifold.cube([0.1, 0.1, 0.1], true).translate(at);
      const common = lid.intersect(probe);
      if (z > 0) expect(common.volume(), `${board} pad`).toBeGreaterThan(0.0009);
      for (const one of [lid, probe, common]) one.delete();
    }
  });
});

describe('a plug’s socket out of the lid (review)', () => {
  it('says how far it stands out, and the gap that sinks it', () => {
    const entry = catalogBoard('m5stack-cardkb-v1.1');
    if (!entry) throw new Error('cardkb');
    const notes = (extra: Record<string, unknown>): Message[] => plugNotes(caseLayout(sanitizeState({ ...defaultState(), boards: [{ ...defaultPlacement(entry), ...extra }] })));
    const [note] = notes({ hold: 'clamp', keys: 'caps', z: 0 });
    expect(note).toMatchObject({ code: 'info.plugProud', params: { port: 'grove' } });
    expect(notes({ hold: 'clamp', keys: 'caps', z: Number(note.params?.gap) })).toEqual([]);
  });
});
