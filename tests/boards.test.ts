// Every catalog file is validated strictly: the sanitizer would quietly fix a
// typo, the catalog must not need fixing.

import { RAW_BOARDS, CATALOG, catalogBoard } from '../src/boards/catalog';
import type { PortType } from '../src/boards/schema';
import { PORT_TYPES, isPortType, sanitizeBoard, sanitizePort } from '../src/boards/schema';
import { defaultPlacement, sanitizePlacement, portCut, boardOf, minBoardZ, placementMinZ, pinsDown } from '../src/boards/placement';
import { garbageLike, rng } from './helpers';

function rec(x: unknown): Record<string, unknown> {
  return typeof x === 'object' && x !== null ? Object.fromEntries(Object.entries(x)) : {};
}

describe('board catalog', () => {
  it('ids are unique and kebab-case', () => {
    const ids = CATALOG.map((board) => board.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9.]+)*$/);
  });

  it.each(RAW_BOARDS.map((raw) => [rec(raw).id, raw]))('%s is valid as written', (_id, raw) => {
    const r = rec(raw);
    const board = sanitizeBoard(raw);
    // the sanitizer must not have to change anything that was written
    expect(board.size).toEqual(r.size);
    expect(board.name).toBe(r.name);
    expect(typeof r.source === 'string' && /^https:\/\//.test(r.source)).toBe(true);
    expect(typeof r.verified).toBe('boolean');
    expect(board.topHeight).toBe(r.topHeight);
    expect(board.bottomHeight).toBe(r.bottomHeight);
    const mount = rec(r.mount);
    expect(board.mount.kind).toBe(mount.kind);
    // pins, when written, are written in full and in the edges' order
    expect(board.pins).toEqual(r.pins);
    if (board.pins) expect(board.pins.below, 'pins reach below the bare underside').toBeGreaterThan(board.bottomHeight);
    const { w, d } = board.size;
    for (const hole of board.mount.holes) {
      expect(hole.x - hole.d / 2).toBeGreaterThanOrEqual(0);
      expect(hole.x + hole.d / 2).toBeLessThanOrEqual(w);
      expect(hole.y - hole.d / 2).toBeGreaterThanOrEqual(0);
      expect(hole.y + hole.d / 2).toBeLessThanOrEqual(d);
    }
    const ports = Array.isArray(r.ports) ? r.ports : [];
    expect(board.ports).toHaveLength(ports.length);
    const ids = new Set<string>();
    for (const [i, rawPort] of ports.entries()) {
      const p = rec(rawPort);
      expect(isPortType(p.type), `${String(p.id)} type`).toBe(true);
      expect(typeof p.id === 'string' && !ids.has(p.id), `${String(p.id)} unique`).toBe(true);
      ids.add(String(p.id));
      const port = board.ports[i];
      if (port.edge === 'top') {
        expect(port.x - port.w / 2, port.id).toBeGreaterThanOrEqual(-0.5);
        expect(port.x + port.w / 2, port.id).toBeLessThanOrEqual(w + 0.5);
        expect(port.y - port.d / 2, port.id).toBeGreaterThanOrEqual(-0.5);
        expect(port.y + port.d / 2, port.id).toBeLessThanOrEqual(d + 0.5);
      } else {
        const length = port.edge === 'front' || port.edge === 'back' ? w : d;
        expect(port.along - port.w / 2, port.id).toBeGreaterThanOrEqual(-0.5);
        expect(port.along + port.w / 2, port.id).toBeLessThanOrEqual(length + 0.5);
        expect(p.along, port.id).toBe(port.along);
      }
    }
  });

  it('every port type has sane positive defaults', () => {
    for (const [id, type] of Object.entries(PORT_TYPES)) {
      for (const value of [type.w, type.h, type.d]) expect(value, id).toBeGreaterThan(0);
      expect(type.clearance, id).toBeGreaterThanOrEqual(0);
      const base: PortType = type;
      if (base.cutH !== undefined) expect(base.cutH, id).toBeLessThanOrEqual(type.h);
    }
  });
});

describe('sanitizeBoard', () => {
  it('fuzz: never throws and is idempotent', () => {
    const random = rng(11);
    const template = RAW_BOARDS[0];
    for (let i = 0; i < 500; i++) {
      const once = sanitizeBoard(garbageLike(template, random));
      expect(sanitizeBoard(once)).toEqual(once);
    }
  });

  it('fuzz with header pins: never throws and is idempotent', () => {
    const random = rng(12);
    const template = RAW_BOARDS.find((raw) => rec(raw).pins !== undefined) ?? RAW_BOARDS[0];
    for (let i = 0; i < 500; i++) {
      const once = sanitizeBoard(garbageLike(template, random));
      expect(sanitizeBoard(once)).toEqual(once);
    }
  });

  it('pins need an edge; the rest takes defaults', () => {
    expect(sanitizeBoard({ pins: { below: 8 } }).pins).toBeUndefined();
    expect(sanitizeBoard({ pins: { edges: ['back', 'front', 'top'] } }).pins)
      .toEqual({ below: 8.5, edges: ['front', 'back'], inset: 1.27, soldered: false });
  });

  it('a board without holes is held by rails; duplicate port ids are renamed', () => {
    const board = sanitizeBoard({ size: { w: 40, d: 20 }, mount: { kind: 'holes', holes: [] },
      ports: [{ id: 'a', type: 'usb-c', edge: 'left' }, { id: 'a', type: 'led', edge: 'top' }] });
    expect(board.mount.kind).toBe('rails');
    expect(board.ports.map((port) => port.id)).toEqual(['a', 'a-2']);
  });

  it('port defaults come from the type; a round element takes its diameter from d', () => {
    const led = sanitizePort({ id: 'l', type: 'led', edge: 'top', x: 3, y: 4, d: 1.5 }, { w: 10, d: 10 }, 0);
    expect(led).toMatchObject({ shape: 'round', w: 1.5, d: 1.5, h: 1.5, cut: true });
    const usb = sanitizePort({ id: 'u', type: 'usb-c', edge: 'front', along: 5 }, { w: 10, d: 10 }, 0);
    expect(usb).toMatchObject({ w: PORT_TYPES['usb-c'].w, h: PORT_TYPES['usb-c'].h, z: 0, protrude: 0 });
    expect(sanitizePort({ type: 'usb-c' }, { w: 10, d: 10 }, 0)).toBeNull();
  });

  it('a terminal opens only its wire entries; cutH never exceeds the part', () => {
    const terminal = sanitizePort({ id: 't', type: 'terminal', edge: 'front', along: 10 }, { w: 30, d: 20 }, 0);
    expect(terminal).toMatchObject({ h: PORT_TYPES.terminal.h, cutH: PORT_TYPES.terminal.cutH });
    expect(sanitizePort({ id: 't', type: 'terminal', edge: 'front', h: 4 }, { w: 30, d: 20 }, 0)).toMatchObject({ h: 4, cutH: 4 });
    expect(sanitizePort({ id: 'u', type: 'usb-c', edge: 'front' }, { w: 30, d: 20 }, 0)).not.toHaveProperty('cutH');
  });
});

describe('placements', () => {
  it('fuzz: never throws and is idempotent', () => {
    const random = rng(5);
    for (let i = 0; i < 500; i++) {
      const once = sanitizePlacement(garbageLike(defaultPlacement(CATALOG[0]), random));
      expect(sanitizePlacement(once)).toEqual(once);
      expect(sanitizePlacement(JSON.parse(JSON.stringify(once)))).toEqual(once);
    }
  });

  it('an unknown board falls back to the first catalog board; z never goes below the parts underneath', () => {
    const placement = sanitizePlacement({ board: 'nope', z: 0 });
    expect(placement.board).toBe(CATALOG[0].id);
    const esp = catalogBoard('esp32-2432s028r');
    expect(sanitizePlacement({ board: 'esp32-2432s028r', z: 1 }).z).toBe((esp?.bottomHeight ?? 0) + 1);
  });

  it('fuzz on a board with pins: never throws and is idempotent', () => {
    const random = rng(6);
    const def = CATALOG.find((board) => board.pins) ?? CATALOG[0];
    for (let i = 0; i < 500; i++) {
      const once = sanitizePlacement(garbageLike(defaultPlacement(def), random));
      expect(sanitizePlacement(once)).toEqual(once);
      expect(sanitizePlacement(JSON.parse(JSON.stringify(once)))).toEqual(once);
    }
  });

  it('pins: the default is how the board ships; only boards with pins keep the field', () => {
    const nano = sanitizePlacement({ board: 'arduino-nano' });
    expect(nano.pins).toBe(true);
    const pico = sanitizePlacement({ board: 'raspberry-pi-pico' });
    expect(pico.pins).toBe(false);
    expect(sanitizePlacement({ board: 'raspberry-pi-pico', pins: true }).pins).toBe(true);
    expect('pins' in sanitizePlacement({ board: 'raspberry-pi-4b', pins: true })).toBe(false);
  });

  it('the lowest standoff follows the pins', () => {
    const def = catalogBoard('arduino-nano');
    if (!def?.pins) throw new Error('the Nano has pins');
    expect(minBoardZ(def, true)).toBe(def.pins.below + 1);
    expect(minBoardZ(def, false)).toBe(def.bottomHeight + 1);
    expect(sanitizePlacement({ board: 'arduino-nano', pins: true, z: 0 }).z).toBe(def.pins.below + 1);
    expect(sanitizePlacement({ board: 'arduino-nano', pins: false, z: 0 }).z).toBe(def.bottomHeight + 1);
    const bare = sanitizePlacement({ board: 'arduino-nano', pins: false });
    expect(pinsDown(def, bare)).toBe(false);
    expect(placementMinZ(bare)).toBe(def.bottomHeight + 1);
  });

  it('cut toggles keep only real ports that differ from the default', () => {
    const placement = sanitizePlacement({ board: 'raspberry-pi-4b', cuts: { gpio: false, 'usb-c': true, ghost: true } });
    expect(placement.cuts).toEqual({ gpio: false });
    expect(portCut(placement, 'gpio', true)).toBe(false);
    expect(portCut(placement, 'usb-c', true)).toBe(true);
  });

  it('a custom board travels inside the placement', () => {
    const placement = sanitizePlacement({ board: 'custom', custom: { name: 'Mine', size: { w: 30, d: 20, t: 1 } } });
    expect(placement.board).toBe('custom');
    expect(boardOf(placement).name).toBe('Mine');
  });
});
