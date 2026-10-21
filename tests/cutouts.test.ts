// Openings in the built case: every enabled port gets air where its plug goes
// through the wall, for every rotation and shape; a top element gets air
// through the ceiling above it; a disabled port leaves the wall whole; a user
// cut opens its face.

import { initCSG, toManifold } from '../src/geo/csg';
import type { CsgApi } from '../src/geo/csg';
import type { Manifold } from 'manifold-3d';
import { buildCase } from '../src/geo/build';
import { caseLayout } from '../src/geo/layout';
import { portAxis, portCutters, portToWall } from '../src/geo/ports';
import { extraCutters } from '../src/geo/cutters';
import { defaultState, sanitizeState } from '../src/state/schema';
import type { AppState } from '../src/state/schema';
import { applyAffine } from '../src/geo/surface';
import { FACES, faceFrame } from '../src/geo/face';
import { CATALOG } from '../src/boards/catalog';
import { validateMesh } from '../src/geo/validate';

let csg: CsgApi;
beforeAll(async () => {
  csg = await initCSG();
});

function solidAt(parts: Manifold[], x: number, y: number, z: number): boolean {
  const probe = csg.Manifold.cube([0.2, 0.2, 0.2], true).translate([x, y, z]);
  let filled = false;
  for (const part of parts) {
    const common = part.intersect(probe);
    if (common.volume() > 0.004) filled = true;
    common.delete();
  }
  probe.delete();
  return filled;
}

function built(state: AppState): Manifold[] {
  const parts = buildCase(csg, state, 8);
  return [toManifold(csg, parts.body), toManifold(csg, parts.lid)];
}

/** For every enabled edge port, the point in the middle of the wall on its axis must be air. */
function expectEdgePortsOpen(state: AppState): void {
  const parts = built(state);
  const layout = caseLayout(state);
  const shape = { ...state.shape, console: layout.console };
  let checked = 0;
  for (const board of layout.boards) {
    for (const port of board.def.ports) {
      if (port.edge === 'top' || !port.cut) continue;
      const { face, dir } = portAxis(board, port);
      const s = portToWall(shape, layout.dims, face, dir) + state.shape.wall / 2;
      const [x, y, z] = [face[0] + dir[0] * s, face[1] + dir[1] * s, face[2]];
      expect(solidAt(parts, x, y, z), `${board.def.id} rot ${board.placement.rot}: ${port.id}`).toBe(false);
      checked++;
    }
  }
  expect(checked).toBeGreaterThan(0);
  for (const part of parts) part.delete();
}

describe('port openings', () => {
  it.each([0, 90, 180, 270])('Pi 4 rotated %d: every edge port opens its wall', (rot) => {
    expectEdgePortsOpen(sanitizeState({ ...defaultState(), boards: [{ board: 'raspberry-pi-4b', rot }] }));
  });

  it.each(['cylinder', 'console'])('%s: every edge port opens its wall', (kind) => {
    expectEdgePortsOpen(sanitizeState({ ...defaultState(), shape: { ...defaultState().shape, kind } }));
  });

  it('every catalog board: ports open in a box with a front lid', () => {
    for (const board of ['esp32-devkitc-v4', 'arduino-uno', 'heltec-wifi-lora-32-v3']) {
      expectEdgePortsOpen(sanitizeState({ ...defaultState(), boards: [{ board }], lid: { ...defaultState().lid, face: 'front' } }));
    }
  });

  it('a disabled port leaves the wall whole', () => {
    const state = sanitizeState({ ...defaultState(), boards: [{ board: 'raspberry-pi-4b', cuts: { ethernet: false } }] });
    const parts = built(state);
    const layout = caseLayout(state);
    const board = layout.boards[0];
    const port = board.def.ports.find((p) => p.id === 'ethernet');
    if (!port || port.edge === 'top') throw new Error('no ethernet');
    const { face, dir } = portAxis(board, port);
    const s = portToWall(state.shape, layout.dims, face, dir) + state.shape.wall / 2;
    expect(solidAt(parts, face[0] + dir[0] * s, face[1] + dir[1] * s, face[2])).toBe(true);
    for (const part of parts) part.delete();
  });

  it('the GPIO header gets an opening through the lid above it, the board below stays untouched', () => {
    const state = defaultState();
    const parts = built(state);
    const layout = caseLayout(state);
    const board = layout.boards[0];
    const [x, y] = applyAffine(board.toCase, [32.5, 52.5, 0]);
    expect(solidAt(parts, x, y, layout.dims.h - state.shape.floor / 2)).toBe(false);
    // the column starts above the header, so it never reaches the standoffs or the floor
    const gpio = portCutters(layout, state.shape).find((c) => c.source.kind === 'port' && c.source.port === 'gpio');
    expect(gpio?.s0).toBeGreaterThan(board.z0 + board.def.size.t + 8.5);
    for (const part of parts) part.delete();
  });
});

describe('user openings', () => {
  it.each(FACES.map((face) => [face]))('a cut on the %s opens that face', (face) => {
    const base = sanitizeState({ ...defaultState(), boards: [] });
    const dims = caseLayout(base).dims;
    const extent = faceFrame(face, dims).extent;
    const state = sanitizeState({ ...base, extraCuts: [{ face, shape: 'round', x: extent.w / 2, y: extent.h / 2, w: 6 }] });
    const parts = built(state);
    const [cutter] = extraCutters(state.extraCuts, state.shape, dims, () => dims.h);
    const plate = face === 'top' || face === 'bottom' ? state.shape.floor : state.shape.wall;
    const p = cutter.origin.map((v, k) => v - cutter.ez[k] * plate / 2);
    expect(solidAt(parts, p[0], p[1], p[2])).toBe(false);
    for (const part of parts) part.delete();
  });
});

describe('every catalog board', () => {
  it.each(CATALOG.map((board) => [board.id]))('%s: a closed, sliver-free case with every edge port open', (board) => {
    const state = sanitizeState({ ...defaultState(), boards: [{ board }] });
    const built = buildCase(csg, state, 8);
    for (const mesh of [built.body, built.lid]) {
      const report = validateMesh(mesh);
      expect(report.watertight).toBe(true);
      expect(report.degenerateTriangles).toBe(0);
    }
    if (caseLayout(state).boards[0].def.ports.some((port) => port.edge !== 'top' && port.cut)) expectEdgePortsOpen(state);
  });
});
