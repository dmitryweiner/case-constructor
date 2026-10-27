// A display carried by the board under it (plans/PLAN-DISPLAYS.md D9): a HAT
// display on a Pi that stands on the floor, the window flush above it.

import { initCSG, toManifold } from '../src/geo/csg';
import type { CsgApi } from '../src/geo/csg';
import type { Manifold } from 'manifold-3d';
import { buildCase } from '../src/geo/build';
import { caseLayout, collisions } from '../src/geo/layout';
import { attachTransform } from '../src/geo/attach';
import { portCutters } from '../src/geo/ports';
import { rimsOf } from '../src/geo/rim';
import { CEILING_GAP, sanitizePlacement } from '../src/boards/placement';
import { catalogBoard, CATALOG } from '../src/boards/catalog';
import { validateMesh } from '../src/geo/validate';
import { applyAffine, composeAffine } from '../src/geo/surface';
import type { Vec3 } from '../src/geo/surface';
import { defaultState, sanitizeState } from '../src/state/schema';
import type { AppState } from '../src/state/schema';

let csg: CsgApi;
beforeAll(async () => {
  csg = await initCSG();
});

function solidAt(part: Manifold, p: Vec3): boolean {
  const probe = csg.Manifold.cube([0.1, 0.1, 0.1], true).translate(p);
  const common = part.intersect(probe);
  const filled = common.volume() > 0.0009;
  probe.delete();
  common.delete();
  return filled;
}

const hyper = catalogBoard('pimoroni-hyperpixel-4') ?? CATALOG[0];
const pi4 = catalogBoard('raspberry-pi-4b') ?? CATALOG[0];

function carried(top: Record<string, unknown> = {}): AppState {
  return sanitizeState({ ...defaultState(), boards: [{ board: pi4.id, z: 5, top: { board: hyper.id, ...top } }] });
}

describe('the placement', () => {
  it('a floor board carries a HAT display whose pattern fits; a hung one, or one that does not fit, carries nothing', () => {
    expect(sanitizePlacement({ board: pi4.id, top: { board: hyper.id } }).top).toMatchObject({ board: hyper.id, standoff: hyper.back?.standoff });
    expect(sanitizePlacement({ board: pi4.id, on: 'ceiling', top: { board: hyper.id } })).not.toHaveProperty('top');
    expect(sanitizePlacement({ board: 'arduino-uno', top: { board: hyper.id } })).not.toHaveProperty('top');
    expect(sanitizePlacement({ board: pi4.id, top: { board: 'lcdwiki-msp2807' } })).not.toHaveProperty('top');
    const once = sanitizePlacement({ board: pi4.id, top: { board: hyper.id, standoff: 12, cuts: { display: false } } });
    expect(sanitizePlacement(once)).toEqual(once);
  });
});

describe('the layout', () => {
  it('the display rides on the Pi by the HAT pattern, the ceiling the gap above its front', () => {
    const state = carried();
    const layout = caseLayout(state);
    expect(layout.boards).toHaveLength(2);
    const display = layout.boards[1];
    expect(display.attached).toBe(0);
    expect(display.carried).toBe(true);
    const turn = state.boards[0].top?.rot ?? 0;
    const back = attachTransform(hyper, pi4, turn, state.boards[0].top?.standoff ?? 0);
    // the Pi's holes, carried into the display's frame by the inverse, land on the pattern
    const toDisplay = composeAffine(back, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]);
    for (const hole of pi4.mount.holes) {
      const p = applyAffine(toDisplay, [hole.x, hole.y, pi4.size.t]);
      expect(hyper.back?.holes.some((h) => Math.hypot(h.x - p[0], h.y - p[1]) < 0.3)).toBe(true);
    }
    expect(layout.dims.h - state.shape.floor - display.zTop).toBeCloseTo(CEILING_GAP, 6);
    expect(collisions(layout)).toEqual([]);
  });

  it('its window is chamfered and its glass gets a rim', () => {
    const state = carried();
    const layout = caseLayout(state);
    const display = layout.boards[1];
    const window = portCutters(layout, state.shape).find((c) => c.source.kind === 'port' && c.source.port === 'display');
    expect(window?.flare?.rate).toBe(1);
    expect(rimsOf(display)).toHaveLength(1);
  });
});

describe('built', () => {
  it('builds closed: the rim from the lid, the window through it, no supports for the display', () => {
    const state = carried();
    const built = buildCase(csg, state, 8);
    for (const part of [built.body, built.lid]) {
      expect(validateMesh(part).watertight).toBe(true);
      expect(validateMesh(part).degenerateTriangles).toBe(0);
    }
    const lid = toManifold(csg, built.lid);
    const display = caseLayout(state).boards[1];
    const port = display.def.ports.find((p) => p.id === 'display');
    if (!port || port.edge !== 'top') throw new Error('no window');
    expect(solidAt(lid, applyAffine(display.toCase, [port.x, port.y, display.def.size.t + port.h + 1]))).toBe(false);
    lid.delete();
  });
});

describe('the parts under it', () => {
  it('a display on standoffs lower than the Pi\'s USB and Ethernet is reported', () => {
    const codes = collisions(caseLayout(carried({ standoff: 11 }))).map((m) => m.code);
    expect(codes).toContain('warn.carriedOnParts');
  });
});

describe('every HAT display in the catalog', () => {
  it.each(CATALOG.filter((def) => def.back?.facing === 'top').map((def) => [def.id]))('%s rides on a Pi 4 and builds closed', (id) => {
    const state = sanitizeState({ ...defaultState(), boards: [{ board: pi4.id, z: 5, top: { board: id, standoff: 16.5 } }] });
    const layout = caseLayout(state);
    expect(layout.boards).toHaveLength(2);
    expect(collisions(layout)).toEqual([]);
    const built = buildCase(csg, state, 8);
    for (const part of [built.body, built.lid]) {
      expect(validateMesh(part).watertight).toBe(true);
      expect(validateMesh(part).degenerateTriangles).toBe(0);
    }
  });
});

describe('the board under it', () => {
  it('keeps its top parts closed by default (the GPIO header under the display); a toggle still opens them', () => {
    const ids = (state: AppState): string[] => portCutters(caseLayout(state), state.shape).map((c) => (c.source.kind === 'port' ? `${c.source.board}:${c.source.port}` : ''));
    expect(ids(carried())).not.toContain('0:gpio');
    expect(ids(carried())).toContain('0:usb-c');
    const opened = sanitizeState({ ...defaultState(), boards: [{ board: pi4.id, z: 5, cuts: { gpio: true }, top: { board: hyper.id } }] });
    expect(ids(opened)).toContain('0:gpio');
  });
});

