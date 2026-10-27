// Boards hung from the console's slope (plans/PLAN-DISPLAYS.md D4): the
// board lies parallel to the slope, its front the gap below its inside; its
// standoffs, rim and window follow the slope's normal; the console's heights
// rise until it clears the floor and the boards under it.

import { initCSG, toManifold } from '../src/geo/csg';
import type { CsgApi } from '../src/geo/csg';
import type { Manifold } from 'manifold-3d';
import { buildCase } from '../src/geo/build';
import { caseLayout, collisions, standoffColumns } from '../src/geo/layout';
import { portCutters, cutWarnings } from '../src/geo/ports';
import { slopePlane } from '../src/geo/shape';
import { validateMesh } from '../src/geo/validate';
import { applyAffine, rotateVec } from '../src/geo/surface';
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

function onSlope(boards: unknown[] = [], board: Record<string, unknown> = {}): AppState {
  const base = defaultState();
  return sanitizeState({
    ...base,
    shape: { ...base.shape, kind: 'console', console: { frontH: 20, backH: 40 } },
    lid: { ...base.lid, face: 'bottom', fastening: 'screws' },
    boards: [{ board: 'lcdwiki-msp3520', on: 'ceiling', z: 0.3, rot: 90, mount: { size: 'M3', hole: 'insert' }, ...board }, ...boards],
  });
}

/** How far below the slope's inside a point is (negative: above it, in the plate). */
function belowInside(state: AppState, p: Vec3): number {
  const layout = caseLayout(state);
  const plane = slopePlane(layout.console.frontH, layout.console.backH, layout.dims.d);
  return plane.n[0] * p[0] + plane.n[1] * p[1] + plane.n[2] * p[2] - (plane.offset + state.shape.floor);
}

describe('a board on the slope', () => {
  it('lies parallel to the slope, its front the gap below the inside', () => {
    const state = onSlope();
    const layout = caseLayout(state);
    const board = layout.boards[0];
    expect(board.hung).toBe(true);
    const plane = slopePlane(layout.console.frontH, layout.console.backH, layout.dims.d);
    const up = rotateVec(board.toCase, [0, 0, 1]);
    // the board's up is the slope's outward normal (the plane's n points inwards)
    for (let k = 0; k < 3; k++) expect(up[k]).toBeCloseTo(-plane.n[k], 9);
    const front = board.def.size.t + board.def.topHeight;
    const { w, d } = board.def.size;
    for (const [x, y] of [[0, 0], [w, 0], [0, d], [w, d]]) {
      expect(belowInside(state, applyAffine(board.toCase, [x, y, front]))).toBeCloseTo(0.3, 6);
    }
  });

  it('the console rises until the board clears the floor, and a board under it, by the top margin', () => {
    const state = onSlope();
    const board = caseLayout(state).boards[0];
    expect(board.zBottom).toBeGreaterThanOrEqual(state.shape.floor + state.shape.margin.top - 1e-6);
    const stacked = onSlope([{ board: 'raspberry-pi-4b', x: 0, y: 0 }]);
    const layout = caseLayout(stacked);
    const [display, pi] = layout.boards;
    expect(display.zBottom).toBeGreaterThanOrEqual(pi.zTop + stacked.shape.margin.top - 1e-6);
    expect(collisions(layout).filter((m) => m.code === 'warn.boardsOverlap')).toEqual([]);
  });

  it('stands against the left or right wall, never the front or back', () => {
    expect(caseLayout(onSlope([], { walls: ['left'] })).boards[0].walls.map((wall) => wall.side)).toEqual(['left']);
    expect(caseLayout(onSlope([], { walls: ['front'] })).boards[0].walls).toEqual([]);
  });

  it('its window goes along the slope\'s normal, chamfered from the inside', () => {
    const state = onSlope();
    const layout = caseLayout(state);
    const board = layout.boards[0];
    const window = portCutters(layout, state.shape).find((c) => c.source.kind === 'port' && c.source.port === 'display');
    if (!window) throw new Error('no window');
    const up = rotateVec(board.toCase, [0, 0, 1]);
    for (let k = 0; k < 3; k++) expect(window.ez[k]).toBeCloseTo(up[k], 9);
    expect(window.flare?.rate).toBe(1);
    // the flare starts at the slope's inside
    const at: Vec3 = [0, 0, 0];
    for (let k = 0; k < 3; k++) at[k] = window.origin[k] + window.ez[k] * (window.flare?.from ?? 0);
    expect(belowInside(state, at)).toBeCloseTo(0, 6);
    expect(cutWarnings(layout, state.shape, state.lid, portCutters(layout, state.shape), [])).toEqual([]);
  });

  it('builds closed: standoffs down from the slope, the window through it', () => {
    const state = onSlope();
    const built = buildCase(csg, state, 8);
    for (const part of [built.body, built.lid]) {
      const report = validateMesh(part);
      expect(report.watertight).toBe(true);
      expect(report.degenerateTriangles).toBe(0);
    }
    const body = toManifold(csg, built.body);
    const board = caseLayout(state).boards[0];
    const t = board.def.size.t;
    // the standoff's wall just above the PCB, along the normal
    const [column] = standoffColumns(board);
    const hole = board.def.mount.holes[0];
    const r = column.r - 0.3;
    expect(solidAt(body, applyAffine(board.toCase, [hole.x + r, hole.y, t + 1]))).toBe(true);
    expect(solidAt(body, applyAffine(board.toCase, [hole.x, hole.y, t + 0.5]))).toBe(false);
    // the window: air at the middle of the display, through the plate
    const port = board.def.ports.find((p) => p.id === 'display');
    if (!port || port.edge !== 'top') throw new Error('no display');
    const front = t + port.h + board.placement.z;
    expect(solidAt(body, applyAffine(board.toCase, [port.x, port.y, front + 1]))).toBe(false);
    // and material just beside the window, inside the plate
    expect(solidAt(body, applyAffine(board.toCase, [port.x + port.w / 2 + 1.5, port.y, front + 0.3]))).toBe(true);
    body.delete();
  });
});
