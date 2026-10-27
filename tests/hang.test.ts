// Boards hung from the ceiling (plans/PLAN-DISPLAYS.md D2): the placement,
// the layout (the gap to the ceiling, the case height with stacks from both
// sides), the warnings, and the standoffs built down from the ceiling plate —
// to the lid with a top lid, to the body with a bottom one.

import { initCSG, toManifold } from '../src/geo/csg';
import type { CsgApi } from '../src/geo/csg';
import type { Manifold } from 'manifold-3d';
import { buildCase } from '../src/geo/build';
import { caseLayout, collisions, heldByLid, standoffColumns } from '../src/geo/layout';
import { CEILING_GAP, defaultPlacement, sanitizePlacement, placementMinZ } from '../src/boards/placement';
import { catalogBoard, CATALOG } from '../src/boards/catalog';
import { HOLE_SKIN } from '../src/geo/standoffs';
import { validateMesh } from '../src/geo/validate';
import { defaultState, sanitizeState } from '../src/state/schema';
import type { AppState } from '../src/state/schema';

let csg: CsgApi;
beforeAll(async () => {
  csg = await initCSG();
});

function solidAt(part: Manifold, x: number, y: number, z: number): boolean {
  const probe = csg.Manifold.cube([0.1, 0.1, 0.1], true).translate([x, y, z]);
  const common = part.intersect(probe);
  const filled = common.volume() > 0.0009;
  probe.delete();
  common.delete();
  return filled;
}

const msp = catalogBoard('lcdwiki-msp2807') ?? CATALOG[0];

function hung(patch: Partial<AppState> = {}, board: Record<string, unknown> = {}): AppState {
  return sanitizeState({ ...defaultState(), ...patch, boards: [{ board: 'lcdwiki-msp2807', on: 'ceiling', z: CEILING_GAP, mount: { size: 'M3', hole: 'tap' }, ...board }] });
}

describe('the placement', () => {
  it('a display, or a board with a display on top, hangs when added; the rest stands', () => {
    expect(defaultPlacement(msp)).toMatchObject({ on: 'ceiling', z: CEILING_GAP });
    const cyd = catalogBoard('esp32-2432s028r') ?? CATALOG[0];
    expect(defaultPlacement(cyd)).toMatchObject({ on: 'ceiling', z: CEILING_GAP });
    expect(defaultPlacement(catalogBoard('raspberry-pi-4b') ?? CATALOG[0])).not.toHaveProperty('on');
  });

  it('a file without the field stands on the floor, at the height it always had', () => {
    const old = sanitizePlacement({ board: 'esp32-2432s028r' });
    expect(old).not.toHaveProperty('on');
    expect(old.z).toBeGreaterThanOrEqual(4);
  });

  it('on the ceiling z is the gap, 0 and up; a battery never hangs', () => {
    expect(sanitizePlacement({ board: 'lcdwiki-msp2807', on: 'ceiling', z: 0 })).toMatchObject({ on: 'ceiling', z: 0 });
    expect(sanitizePlacement({ board: 'lcdwiki-msp2807', on: 'ceiling' }).z).toBe(CEILING_GAP);
    expect(placementMinZ(sanitizePlacement({ board: 'lcdwiki-msp2807', on: 'ceiling' }))).toBe(0);
    expect(sanitizePlacement({ board: 'battery', on: 'ceiling' })).not.toHaveProperty('on');
    const once = sanitizePlacement({ board: 'lcdwiki-msp2807', on: 'ceiling', z: 2 });
    expect(sanitizePlacement(once)).toEqual(once);
  });
});

describe('the layout', () => {
  it('the front sits the gap below the inner ceiling', () => {
    const state = hung();
    const layout = caseLayout(state);
    const board = layout.boards[0];
    expect(board.hung).toBe(true);
    expect(board.zTop).toBeCloseTo(layout.dims.h - state.shape.floor - CEILING_GAP, 6);
  });

  it('the case holds the hung stack; a floor board under it adds its own', () => {
    const alone = caseLayout(hung());
    const board = alone.boards[0];
    const { shape } = hung();
    expect(alone.dims.h).toBeCloseTo(2 * shape.floor + CEILING_GAP + board.zTop - board.zBottom + shape.margin.top, 6);
    // a Pi on the floor right under the display
    const stacked = sanitizeState({ ...hung(), boards: [...hung().boards, { board: 'raspberry-pi-4b', x: 0, y: 0, rot: 90 }] });
    const both = caseLayout(stacked);
    const [display, pi] = both.boards;
    expect(both.dims.h).toBeCloseTo(
      2 * shape.floor + (pi.zTop - shape.floor) + shape.margin.top + CEILING_GAP + display.zTop - display.zBottom, 6,
    );
    expect(collisions(both).filter((m) => m.code === 'warn.boardsOverlap')).toEqual([]);
  });

  it('a gap under 0.3 mm is warned about', () => {
    expect(collisions(caseLayout(hung({}, { z: 0.1 }))).map((m) => m.code)).toContain('warn.glassGap');
    expect(collisions(caseLayout(hung())).map((m) => m.code)).not.toContain('warn.glassGap');
  });

  it('held by the lid with a top lid, by the body with a bottom one', () => {
    const top = hung();
    expect(heldByLid(caseLayout(top).boards[0], top.lid.face)).toBe(true);
    const bottom = hung({ lid: { ...defaultState().lid, face: 'bottom' } });
    expect(heldByLid(caseLayout(bottom).boards[0], bottom.lid.face)).toBe(false);
  });
});

describe('standoffs from the ceiling', () => {
  it('with a top lid they hang from the lid: material to the PCB top, the hole open from below, skin above', () => {
    const state = hung();
    const built = buildCase(csg, state, 8);
    expect(validateMesh(built.body).watertight).toBe(true);
    expect(validateMesh(built.lid).watertight).toBe(true);
    const lid = toManifold(csg, built.lid);
    const body = toManifold(csg, built.body);
    const layout = caseLayout(state);
    const board = layout.boards[0];
    const pcbTop = board.z0 + board.def.size.t;
    const [column] = standoffColumns(board);
    expect(solidAt(lid, column.x + column.r - 0.3, column.y, pcbTop + 1)).toBe(true);
    expect(solidAt(body, column.x + column.r - 0.3, column.y, pcbTop + 1)).toBe(false);
    expect(solidAt(lid, column.x, column.y, pcbTop + 0.5)).toBe(false);
    expect(solidAt(lid, column.x, column.y, layout.dims.h - HOLE_SKIN / 2)).toBe(true);
    expect(solidAt(lid, column.x, column.y, pcbTop - 0.5)).toBe(false);
    lid.delete();
    body.delete();
  });

  it('with a bottom lid they hang from the body', () => {
    const state = hung({ lid: { ...defaultState().lid, face: 'bottom' } });
    const built = buildCase(csg, state, 8);
    expect(validateMesh(built.body).watertight).toBe(true);
    const body = toManifold(csg, built.body);
    const board = caseLayout(state).boards[0];
    const [column] = standoffColumns(board);
    expect(solidAt(body, column.x + column.r - 0.3, column.y, board.z0 + board.def.size.t + 1)).toBe(true);
    body.delete();
  });

  it.each(['insert', 'nut'] as const)('%s holes build closed', (hole) => {
    const built = buildCase(csg, hung({}, { mount: { size: 'M3', hole } }), 8);
    expect(validateMesh(built.lid).watertight).toBe(true);
    expect(validateMesh(built.lid).degenerateTriangles).toBe(0);
  });

  it('a board on rails hangs in mirrored rails', () => {
    const state = sanitizeState({ ...defaultState(), boards: [{ board: 'heltec-wifi-lora-32-v3', on: 'ceiling', z: 1 }] });
    const built = buildCase(csg, state, 8);
    expect(validateMesh(built.lid).watertight).toBe(true);
    const lid = toManifold(csg, built.lid);
    const board = caseLayout(state).boards[0];
    const { w, t } = board.def.size;
    const [x, y] = [board.toCase[3] + w / 2, board.toCase[7] + 0.6];
    expect(solidAt(lid, x, y, board.z0 + t / 2)).toBe(false); // the groove
    expect(solidAt(lid, x, y, board.z0 - 0.6)).toBe(true); // the lip under the board
    expect(solidAt(lid, x, y, board.z0 + t + 0.6)).toBe(true); // the rail above it
    lid.delete();
  });
});

describe('the skirt band', () => {
  it('a hung board\'s bosses overhanging its edge stay off a top lid\'s skirt', () => {
    // M3 inserts: the boss reaches 0.6 mm past the MSP2807's edge
    const state = hung({}, { mount: { size: 'M3', hole: 'insert' } });
    const board = caseLayout(state).boards[0];
    for (const column of standoffColumns(board)) {
      expect(column.x - column.r).toBeGreaterThanOrEqual(board.footprint.x0 - 1e-9);
      expect(column.y + column.r).toBeLessThanOrEqual(board.footprint.y1 + 1e-9);
    }
  });
});
