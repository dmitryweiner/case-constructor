// Every catalog file is validated strictly: the sanitizer would quietly fix a
// typo, the catalog must not need fixing.

import { RAW_BOARDS, CATALOG, catalogBoard } from '../src/boards/catalog';
import type { PortType } from '../src/boards/schema';
import { PORT_TYPES, insidePolygon, isPortType, onFace, resolveVariant, sanitizeBoard, sanitizeOutline, sanitizePort, windowInGlass } from '../src/boards/schema';
import { defaultPlacement, sanitizePlacement, portCut, boardOf, entryOf, minBoardZ, placementMinZ, pinsDown } from '../src/boards/placement';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { formatBoard } from '../scripts/lib/boardJson.mjs';
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
    // an outline, when written, is kept as written: inside the size, counter-clockwise, edges not crossing;
    // the holes are in it (parts may overhang it: the RAK4631 module covers the RAK19007's notch)
    expect(board.outline).toEqual(r.outline);
    if (board.outline) {
      const outline = board.outline;
      for (const hole of board.mount.holes) expect(insidePolygon(outline, hole.x, hole.y), `hole ${hole.x},${hole.y}`).toBe(true);
    }
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
      // a glass, when written, is kept as written (defaults filled in) and holds the window
      if (p.glass !== undefined) {
        expect(onFace(port) && port.glass, `${port.id} glass`).toEqual({ r: 0, shape: 'rect', ...rec(p.glass) });
        if (onFace(port) && port.glass) expect(windowInGlass(port, port.glass), `${port.id} window in its glass`).toBe(true);
      }
      if (onFace(port)) {
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
    // every variant as written, and every port of it inside the outline once resolved
    const variants = Array.isArray(r.variants) ? r.variants : [];
    expect(board.variants?.length ?? 0).toBe(variants.length);
    for (const [i, rawVariant] of variants.entries()) {
      const v = rec(rawVariant);
      const variant = board.variants?.[i];
      expect(variant?.id).toBe(v.id);
      expect(Object.keys(variant?.ports ?? {})).toEqual(Object.keys(rec(v.ports)));
      expect(variant?.remove.length ?? 0).toBe(Array.isArray(v.remove) ? v.remove.length : 0);
      for (const port of resolveVariant(board, variant?.id).ports) {
        const where = `${String(v.id)}: ${port.id}`;
        if (onFace(port)) {
          expect(port.x - port.w / 2, where).toBeGreaterThanOrEqual(-0.5);
          expect(port.x + port.w / 2, where).toBeLessThanOrEqual(w + 0.5);
        } else {
          const length = port.edge === 'front' || port.edge === 'back' ? w : d;
          expect(port.along + port.w / 2, where).toBeLessThanOrEqual(length + 0.5);
        }
      }
    }
  });

  it('every file is in the catalog layout (node scripts/board.mjs --format)', () => {
    const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'boards', 'data');
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    expect(files.length).toBe(RAW_BOARDS.length);
    for (const name of files) {
      const text = readFileSync(join(dir, name), 'utf8');
      expect(text, `${name}: run node scripts/board.mjs --format`).toBe(formatBoard(JSON.parse(text)));
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

  it('an outline is clamped into the size and turned counter-clockwise; a crossing one is dropped', () => {
    const size = { w: 10, d: 10 };
    expect(sanitizeOutline([[0, 0], [0, 10], [12, 10], [10, 0]], size)).toEqual([[10, 0], [10, 10], [0, 10], [0, 0]]);
    expect(sanitizeOutline([[0, 0], [10, 10], [10, 0], [0, 10]], size)).toBeUndefined();
    expect(sanitizeOutline([[0, 0], [5, 5]], size)).toBeUndefined();
    expect(sanitizeOutline('nope', size)).toBeUndefined();
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

describe('display entries', () => {
  const size = { w: 50, d: 86 };
  const window = { id: 'display', type: 'display', edge: 'top', x: 25, y: 47.9, w: 43.2, d: 57.6, h: 4 };

  it('a display part may carry its glass: kept, defaults filled in', () => {
    const port = sanitizePort({ ...window, glass: { x: 25, y: 45, w: 50, d: 69.2, t: 3.5 } }, size, 0);
    expect(port).toMatchObject({ glass: { x: 25, y: 45, w: 50, d: 69.2, t: 3.5, r: 0, shape: 'rect' } });
    const round = sanitizePort({ ...window, shape: 'round', w: 32.4, glass: { x: 25, y: 47.9, w: 35.6, t: 1.5, shape: 'round' } }, size, 0);
    // a round glass, like a round part, takes its diameter for both sizes
    expect(round).toMatchObject({ glass: { w: 35.6, d: 35.6, shape: 'round', r: 0 } });
  });

  it('the glass stays inside the board and around the window, else it is dropped', () => {
    // clamped into the board
    const wide = sanitizePort({ ...window, glass: { x: 25, y: 45, w: 60, d: 69.2, t: 3.5 } }, size, 0);
    expect(wide).toMatchObject({ glass: { w: 50 } });
    // not around the window: no glass at all
    expect(sanitizePort({ ...window, glass: { x: 25, y: 45, w: 30, d: 69.2, t: 3.5 } }, size, 0)).not.toHaveProperty('glass');
    // only a display part on top has one
    expect(sanitizePort({ ...window, type: 'generic', glass: { x: 25, y: 45, w: 50, d: 69.2, t: 3.5 } }, size, 0)).not.toHaveProperty('glass');
    expect(sanitizePort({ ...window, edge: 'bottom', glass: { x: 25, y: 45, w: 50, d: 69.2, t: 3.5 } }, size, 0)).not.toHaveProperty('glass');
  });

  it('a display is its own kind, and a panel may be thicker than a PCB', () => {
    const panel = sanitizeBoard({ kind: 'display', size: { w: 120, d: 190, t: 6.4 } });
    expect(panel.kind).toBe('display');
    expect(panel.size.t).toBe(6.4);
    expect(sanitizeBoard({ kind: 'mcu', size: { w: 120, d: 190, t: 6.4 } }).size.t).toBe(5);
  });

  it('fuzz with a glass: never throws and is idempotent', () => {
    const random = rng(13);
    const template = RAW_BOARDS.find((raw) => JSON.stringify(raw).includes('"glass"')) ?? RAW_BOARDS[0];
    for (let i = 0; i < 500; i++) {
      const once = sanitizeBoard(garbageLike(template, random));
      expect(sanitizeBoard(once)).toEqual(once);
    }
  });
});

const FAMILY = {
  id: 'family', name: 'Family', size: { w: 20, d: 20, t: 1 }, mount: { kind: 'rails', holes: [] },
  topHeight: 3, bottomHeight: 1,
  ports: [
    { id: 'usb', type: 'usb-c', edge: 'back', along: 10 },
    { id: 'boot', type: 'button', edge: 'top', x: 4, y: 16, cut: false },
    { id: 'reset', type: 'button', edge: 'top', x: 16, y: 16, cut: false },
  ],
  variants: [
    { id: 'a', name: 'Model A', ports: { boot: { cut: true }, reset: { cut: true } } },
    { id: 'b', name: 'Model B', ports: { reset: { cut: true, x: 10, ghost: 1 }, nope: { cut: true } }, remove: ['boot'],
      add: [{ id: 'display', type: 'display', edge: 'bottom', x: 10, y: 8, w: 12, d: 10, h: 2 }], bottomHeight: 1.5 },
  ],
};

describe('variants', () => {
  it('fuzz: never throws and is idempotent', () => {
    const random = rng(13);
    for (let i = 0; i < 500; i++) {
      const once = sanitizeBoard(garbageLike(FAMILY, random));
      expect(sanitizeBoard(once)).toEqual(once);
      expect(sanitizeBoard(JSON.parse(JSON.stringify(once)))).toEqual(once);
    }
  });

  it('keep overrides of real ports only, with known fields', () => {
    const family = sanitizeBoard(FAMILY);
    expect(family.variants?.map((variant) => variant.id)).toEqual(['a', 'b']);
    expect(family.variants?.[1].ports).toEqual({ reset: { cut: true, x: 10 } });
    expect(family.variants?.[1].remove).toEqual(['boot']);
  });

  it('a variant overrides, removes and adds ports; the first is the default', () => {
    const family = sanitizeBoard(FAMILY);
    const a = resolveVariant(family, 'a');
    expect(a.ports.map((port) => [port.id, port.cut])).toEqual([['usb', true], ['boot', true], ['reset', true]]);
    expect(resolveVariant(family, undefined)).toEqual(a);
    expect(resolveVariant(family, 'zzz')).toEqual(a);
    const b = resolveVariant(family, 'b');
    expect(b.ports.map((port) => port.id)).toEqual(['usb', 'reset', 'display']);
    expect(b.ports.find((port) => port.id === 'reset')).toMatchObject({ x: 10, y: 16, cut: true });
    expect(b.bottomHeight).toBe(1.5);
    expect(resolveVariant(sanitizeBoard({ ...FAMILY, variants: undefined }), 'a').ports.every((port) => port.id === 'usb' || !port.cut)).toBe(true);
  });

  it('the placement keeps a real variant, the board it builds is resolved', () => {
    const custom = sanitizeBoard(FAMILY, 'custom');
    const placement = sanitizePlacement({ board: 'custom', custom, variant: 'b', cuts: { boot: false, display: false } });
    expect(placement.variant).toBe('b');
    expect(boardOf(placement).ports.map((port) => port.id)).toEqual(['usb', 'reset', 'display']);
    expect(entryOf(placement).ports.map((port) => port.id)).toEqual(['usb', 'boot', 'reset']);
    // the cuts follow the variant's ports
    expect(placement.cuts).toEqual({ display: false });
    // the display hangs 2 mm under the board: it stands at least 3 mm up
    expect(placementMinZ(sanitizePlacement({ board: 'custom', custom, variant: 'b', z: 0 }))).toBe(3);
    expect(sanitizePlacement({ board: 'custom', custom, variant: 'zzz' }).variant).toBe('a');
    expect('variant' in sanitizePlacement({ board: 'raspberry-pi-4b', variant: 'a' })).toBe(false);
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
