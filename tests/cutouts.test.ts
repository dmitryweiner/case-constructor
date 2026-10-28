// Openings in the built case: every enabled port gets air where its plug goes
// through the wall, for every rotation and shape; a top element gets air
// through the ceiling above it; a disabled port leaves the wall whole; a user
// cut opens its face.

import { initCSG, toManifold } from '../src/geo/csg';
import type { CsgApi } from '../src/geo/csg';
import type { Manifold } from 'manifold-3d';
import { buildCase } from '../src/geo/build';
import { caseLayout, collisions } from '../src/geo/layout';
import { onFace } from '../src/boards/schema';
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
      if (onFace(port) || !port.cut) continue;
      const { face, dir } = portAxis(board, port);
      // a plug that stays inside: its slot ends short of the wall, and the wall stays whole
      if (port.reach !== undefined) {
        // a socket standing up out of the window has no wall beside it to keep
        if (face[2] > layout.dims.h - state.shape.floor) {
          checked++;
          continue;
        }
        const wall = portToWall(shape, layout.dims, face, dir) + state.shape.wall / 2;
        expect(solidAt(parts, face[0] + dir[0] * wall, face[1] + dir[1] * wall, face[2]), `${board.def.id}: ${port.id} wall`).toBe(true);
        checked++;
        continue;
      }
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

  it.each([['right', 0], ['front', 0], ['right', 90], ['back', 180]] as const)(
    'a Pi 4 against the %s wall (rotated %d): the wall around each connector on that side is open all through',
    (wall, rot) => {
      const state = sanitizeState({ ...defaultState(), boards: [{ board: 'raspberry-pi-4b', rot, walls: [wall] }] });
      const layout = caseLayout(state);
      const board = layout.boards[0];
      const placed = board.walls[0];
      if (!placed) throw new Error('no wall');
      const parts = built(state);
      const { dims } = layout;
      const t = state.shape.wall;
      let checked = 0;
      for (const port of board.def.ports) {
        if (port.edge !== placed.edge || !port.cut) continue;
        const { face, dir } = portAxis(board, port);
        // through the wall's thickness, from just outside the inner wall to just inside the outer surface
        for (const k of [0.15, 0.5, 0.85]) {
          const depth = wall === 'right' ? dims.w - face[0] : wall === 'back' ? dims.d - face[1] : face[1];
          const s = depth - t * k;
          const [x, y, z] = [face[0] + dir[0] * s, face[1] + dir[1] * s, face[2]];
          expect(solidAt(parts, x, y, z), `${port.id} at ${k} of the wall`).toBe(false);
          checked++;
        }
      }
      expect(checked).toBeGreaterThan(0);
      for (const part of parts) part.delete();
    },
  );

  it('a disabled port leaves the wall whole', () => {
    const state = sanitizeState({ ...defaultState(), boards: [{ board: 'raspberry-pi-4b', cuts: { ethernet: false } }] });
    const parts = built(state);
    const layout = caseLayout(state);
    const board = layout.boards[0];
    const port = board.def.ports.find((p) => p.id === 'ethernet');
    if (!port || onFace(port)) throw new Error('no ethernet');
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

  it('a part on the underside gets a column down through the floor, with either lid', () => {
    for (const face of ['top', 'bottom'] as const) {
      const state = sanitizeState({ ...defaultState(), lid: { ...defaultState().lid, face }, boards: [{ board: 'esp32-2432s028r' }] });
      const parts = buildCase(csg, state, 8);
      for (const mesh of [parts.body, parts.lid]) {
        const report = validateMesh(mesh);
        expect(report.watertight, face).toBe(true);
        expect(report.degenerateTriangles, face).toBe(0);
      }
      const solids = [toManifold(csg, parts.body), toManifold(csg, parts.lid)];
      const layout = caseLayout(state);
      const board = layout.boards[0];
      const reset = board.def.ports.find((port) => port.id === 'reset');
      if (!reset || reset.edge !== 'bottom') throw new Error('the CYD has its reset underneath');
      const [x, y] = applyAffine(board.toCase, [reset.x, reset.y, 0]);
      expect(solidAt(solids, x, y, state.shape.floor / 2), `${face}: the floor under the button`).toBe(false);
      // the column stops below the part: the board and the cavity above stay untouched
      const column = portCutters(layout, state.shape).find((c) => c.source.kind === 'port' && c.source.port === 'reset');
      expect(column?.s0).toBeLessThan(0);
      expect(column?.s1).toBeLessThan(board.z0 - reset.h);
      // beside the button the floor is whole
      const [bx, by] = applyAffine(board.toCase, [reset.x, reset.y + 6, 0]);
      expect(solidAt(solids, bx, by, state.shape.floor / 2), `${face}: the floor beside it`).toBe(true);
      for (const part of solids) part.delete();
    }
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

describe('every variant of a family', () => {
  // the TFT Feather's module is on the underside, next to the right-hand holes: a 5 mm standoff reaches it
  const EXPECTED: Record<string, string[]> = { 'adafruit-feather-esp32-s3:tft': ['warn.bottomPartOnSupport'] };
  const variants = CATALOG.flatMap((board) => (board.variants ?? []).map((variant) => [`${board.id}:${variant.id}`, board.id, variant.id]));
  it.each(variants)('%s: a closed, sliver-free case, its ports open, no layout warnings', (name, board, variant) => {
    const state = sanitizeState({ ...defaultState(), boards: [{ board, variant }] });
    expect(state.boards[0].variant).toBe(variant);
    const built = buildCase(csg, state, 8);
    for (const mesh of [built.body, built.lid]) {
      const report = validateMesh(mesh);
      expect(report.watertight).toBe(true);
      expect(report.degenerateTriangles).toBe(0);
    }
    const layout = caseLayout(state);
    expect(collisions(layout).map((message) => message.code)).toEqual(EXPECTED[name] ?? []);
    if (layout.boards[0].def.ports.some((port) => !onFace(port) && port.cut)) expectEdgePortsOpen(state);
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
    if (caseLayout(state).boards[0].def.ports.some((port) => !onFace(port) && port.cut)) expectEdgePortsOpen(state);
  });
});
