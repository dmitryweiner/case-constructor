// A hung display's window and glass seat (plans/PLAN-DISPLAYS.md D3): the
// window widens 45° outwards through the top, a rim around the glass
// locates it and steps aside for the board's other parts, the board's own
// standoffs step aside for the glass.

import { initCSG, toManifold } from '../src/geo/csg';
import type { CsgApi } from '../src/geo/csg';
import type { Manifold } from 'manifold-3d';
import { buildCase } from '../src/geo/build';
import { caseLayout, collisions } from '../src/geo/layout';
import { cutterContains } from '../src/geo/cutters';
import type { CutterSpec } from '../src/geo/cutters';
import { cutWarnings, cutterCorners, portCutters } from '../src/geo/ports';
import { RIM_FIT, RIM_W, rimsOf } from '../src/geo/rim';
import { validateMesh } from '../src/geo/validate';
import { applyAffine } from '../src/geo/surface';
import { defaultState, sanitizeState } from '../src/state/schema';
import type { AppState } from '../src/state/schema';
import { sanitizePlacement } from '../src/boards/placement';

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

function hung(board: string, patch: Record<string, unknown> = {}, shape: Record<string, unknown> = {}): AppState {
  const base = defaultState();
  return sanitizeState({ ...base, shape: { ...base.shape, ...shape }, boards: [{ board, on: 'ceiling', z: 0.3, ...patch }] });
}

function windowOf(state: AppState): CutterSpec {
  const cutter = portCutters(caseLayout(state), state.shape).find((one) => one.source.kind === 'port' && one.source.port === 'display');
  if (!cutter) throw new Error('no window');
  return cutter;
}

describe('the window', () => {
  it('a hung display\'s window flares from the inside of the top; unchamfered, or on the floor, it does not', () => {
    const state = hung('lcdwiki-msp2807');
    const layout = caseLayout(state);
    const cutter = windowOf(state);
    expect(cutter.flare).toEqual({ from: layout.dims.h - state.shape.floor, rate: 1 });
    expect(windowOf(hung('lcdwiki-msp2807', { bevel: false })).flare).toBeUndefined();
    const floor = sanitizeState({ ...defaultState(), boards: [{ board: 'lcdwiki-msp2807' }] });
    expect(windowOf(floor).flare).toBeUndefined();
  });

  it('flared, the cutter contains more at its far end, and its corners say so', () => {
    const cutter = windowOf(hung('lcdwiki-msp2807'));
    const [x, y] = cutter.origin;
    const edge = x + cutter.w / 2 + 1;
    expect(cutterContains(cutter, [edge, y, cutter.s1 - 0.1])).toBe(true);
    expect(cutterContains(cutter, [edge, y, cutter.flare?.from ?? 0])).toBe(false);
    const xs = cutterCorners(cutter).map((p) => p[0]);
    expect(Math.max(...xs) - x).toBeCloseTo(cutter.w / 2 + (cutter.s1 - (cutter.flare?.from ?? 0)), 6);
  });

  it('built: the opening is wider outside than inside, 45° through the plate', () => {
    const state = hung('lcdwiki-msp2807');
    const built = buildCase(csg, state, 8);
    expect(validateMesh(built.lid).watertight).toBe(true);
    expect(validateMesh(built.lid).degenerateTriangles).toBe(0);
    const lid = toManifold(csg, built.lid);
    const cutter = windowOf(state);
    const { h } = caseLayout(state).dims;
    const [x, y] = cutter.origin;
    const side = x + cutter.w / 2 + 1;
    expect(solidAt(lid, side, y, h - state.shape.floor + 0.3)).toBe(true);
    expect(solidAt(lid, side, y, h - 0.3)).toBe(false);
    lid.delete();
  });

  it('a window over a rounded edge of the top is warned about: only a board against a wall can get there', () => {
    const codes = (state: AppState): string[] => {
      const layout = caseLayout(state);
      return cutWarnings(layout, state.shape, state.lid, portCutters(layout, state.shape), []).map((m) => m.code);
    };
    // a hung board keeps to the flat part of the top by itself
    expect(codes(hung('lcdwiki-msp2807', {}, { edgeR: 8 }))).not.toContain('warn.windowInCorner');
    expect(codes(hung('lcdwiki-msp2807', { walls: ['left'] }, { edgeR: 8 }))).toContain('warn.windowInCorner');
  });
});

describe('the rim', () => {
  it('holds the glass: material just outside it, the glass\'s place empty, to the lid with a top lid', () => {
    const state = hung('lcd-1602-i2c');
    const built = buildCase(csg, state, 8);
    expect(validateMesh(built.lid).watertight).toBe(true);
    expect(validateMesh(built.lid).degenerateTriangles).toBe(0);
    const lid = toManifold(csg, built.lid);
    const board = caseLayout(state).boards[0];
    const [rim] = rimsOf(board);
    const mid = (rim.z0 + rim.z1) / 2;
    const at = (bx: number, by: number): [number, number, number] => applyAffine(board.toCase, [bx, by, mid]);
    const right = rim.glass.x + rim.glass.w / 2;
    expect(solidAt(lid, ...at(right + RIM_FIT + RIM_W / 2, rim.glass.y))).toBe(true);
    expect(solidAt(lid, ...at(right - 0.5, rim.glass.y))).toBe(false);
    lid.delete();
  });

  it('steps aside for a part on top: the round panel\'s FPC tail', () => {
    const state = hung('lcdwiki-msp1281', {}, { kind: 'cylinder' });
    const built = buildCase(csg, state, 8);
    expect(validateMesh(built.lid).watertight).toBe(true);
    const lid = toManifold(csg, built.lid);
    const board = caseLayout(state).boards[0];
    const [rim] = rimsOf(board);
    const ring = rim.glass.w / 2 + RIM_FIT + RIM_W / 2;
    const z = rim.z0 + 0.3;
    // round the rim: material at its top, none over the tail at its bottom
    expect(solidAt(lid, ...applyAffine(board.toCase, [rim.glass.x, rim.glass.y + ring, z]))).toBe(true);
    expect(solidAt(lid, ...applyAffine(board.toCase, [rim.glass.x, rim.glass.y - ring, z]))).toBe(false);
    lid.delete();
  });

  it('only a hung board has one; its reach past the board edge widens the footprint', () => {
    const floor = caseLayout(sanitizeState({ ...defaultState(), boards: [{ board: 'lcdwiki-msp2807' }] })).boards[0];
    expect(rimsOf(floor)).toEqual([]);
    // the MSP2807's glass is as wide as its PCB: the rim stands 1.4 mm past both long edges
    const board = caseLayout(hung('lcdwiki-msp2807')).boards[0];
    expect(board.outline.x0 - board.footprint.x0).toBeGreaterThanOrEqual(RIM_FIT + RIM_W - 1e-9);
  });
});

describe('standoffs and the glass', () => {
  it('a 1602\'s standoffs step aside for its bezel, and nothing is warned about', () => {
    const state = hung('lcd-1602-i2c');
    expect(collisions(caseLayout(state))).toEqual([]);
    const built = buildCase(csg, state, 8);
    const lid = toManifold(csg, built.lid);
    const board = caseLayout(state).boards[0];
    // inside the bezel's corner, within the boss's reach: air; beside the hole, away from the bezel: material
    expect(solidAt(lid, ...applyAffine(board.toCase, [4.8, 3.8, board.def.size.t + 2]))).toBe(false);
    expect(solidAt(lid, ...applyAffine(board.toCase, [0.3, 2.5, board.def.size.t + 2]))).toBe(true);
    lid.delete();
  });

  it('a chamfer off survives a file', () => {
    expect(sanitizePlacement({ board: 'lcdwiki-msp2807', on: 'ceiling', bevel: false })).toMatchObject({ bevel: false });
    expect(sanitizePlacement({ board: 'lcdwiki-msp2807', on: 'ceiling', bevel: true })).not.toHaveProperty('bevel');
  });
});

describe('under a rounded top', () => {
  const displays = ['lcdwiki-msp2807', 'lcdwiki-msp1281', 'lcd-1602-i2c'];
  it.each(displays.flatMap((id) => [[id, 'box', 10], [id, 'box', 20], [id, 'cylinder', 8]] as const))(
    '%s in a %s with a %s mm edge: on the flat ceiling, clear of the skirt, no slivers', (id, kind, edgeR) => {
      const state = hung(id, {}, { kind, edgeR });
      const built = buildCase(csg, state, 12);
      for (const part of [built.body, built.lid]) {
        const report = validateMesh(part);
        expect(report.watertight).toBe(true);
        expect(report.degenerateTriangles).toBe(0);
      }
    },
  );
});
