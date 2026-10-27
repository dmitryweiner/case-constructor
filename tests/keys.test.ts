// Keyboards (plans/PLAN-KEYBOARDS.md K1): the key field, its rows and
// default opening, parts through the plate, the placement's choice.

import { KEYS_OPEN, PORT_TYPES, keyFields, keysOf, sanitizeBoard, sanitizePort } from '../src/boards/schema';
import { defaultPlacement, frontHeight, hangsByDefault, keysOpen, sanitizePlacement } from '../src/boards/placement';
import { CEILING_GAP } from '../src/boards/placement';
import { RAW_BOARDS } from '../src/boards/catalog';
import { initCSG } from '../src/geo/csg';
import type { CsgApi } from '../src/geo/csg';
import { buildCase } from '../src/geo/build';
import { caseLayout, collisions } from '../src/geo/layout';
import type { Message } from '../src/geo/message';
import { keyNotes, keysProud } from '../src/geo/ports';
import { validateMesh } from '../src/geo/validate';
import { defaultState, sanitizeState } from '../src/state/schema';
import type { AppState } from '../src/state/schema';
import { garbageLike, KEYPAD, rng } from './helpers';

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
    expect(KEYS_OPEN).toEqual(['window', 'holes']);
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
