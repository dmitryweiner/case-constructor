// Golden tests: volume, triangle count and size of the body and the lid pin
// the current geometry of a fixed set of states. They catch an unintended
// change of shape during refactoring — what the invariant tests do not see
// (the mesh stays closed, but the case is a different one). WASM floats are
// deterministic, so the counts are exact across machines.
//
// Regenerate knowingly: UPDATE_GOLDEN=1 npx vitest run tests/golden.test.ts

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initCSG } from '../src/geo/csg';
import { buildCase } from '../src/geo/build';
import { validateMesh } from '../src/geo/validate';
import { defaultState, sanitizeState } from '../src/state/schema';
import type { AppState } from '../src/state/schema';
import type { SurfaceMesh } from '../src/geo/surface';

const GOLDEN_PATH = join(dirname(fileURLToPath(import.meta.url)), 'golden', 'cases.json');
const SEGMENTS = 8;

interface PartEntry {
  triangles: number;
  volume: number;
  extents: number[];
}

type Entry = Record<'body' | 'lid', PartEntry>;

/** The M0 base: no boards, the manual 100 × 70 × 35 size. */
function base(): AppState {
  const state = defaultState();
  return { ...state, boards: [], shape: { ...state.shape, auto: false, size: { w: 100, d: 70, h: 35 } } };
}

function variant(patch: (base: AppState) => unknown): AppState {
  return sanitizeState(patch(base()));
}

/** The fixed set; add a state when a feature lands, never edit an old one. */
const STATES: Record<string, AppState> = {
  'default-box': base(),
  'box-fillet': variant((s) => ({ ...s, shape: { ...s.shape, cornerR: 8, edgeR: 5 } })),
  'cylinder': variant((s) => ({ ...s, shape: { ...s.shape, kind: 'cylinder', edgeR: 3 } })),
  'console': variant((s) => ({ ...s, shape: { ...s.shape, kind: 'console' }, lid: { ...s.lid, face: 'bottom' } })),
  'bottom-lid': variant((s) => ({ ...s, lid: { ...s.lid, face: 'bottom', depth: 5 } })),
  'side-lid-deep': variant((s) => ({ ...s, shape: { ...s.shape, edgeR: 3 }, lid: { ...s.lid, face: 'right', depth: 12 } })),
  // M2: boards
  'pi4-default': defaultState(),
  'uno-nuts-bottom-lid': sanitizeState({
    ...defaultState(),
    boards: [{ board: 'arduino-uno', z: 6, rot: 90, mount: { size: 'M3', hole: 'nut' } }],
    lid: { ...defaultState().lid, face: 'bottom' },
  }),
  'esp32-rails-cylinder': sanitizeState({
    ...defaultState(),
    shape: { ...defaultState().shape, kind: 'cylinder' },
    boards: [{ board: 'esp32-devkitc-v4' }],
  }),
  'two-boards-inserts': sanitizeState({
    ...defaultState(),
    boards: [
      { board: 'raspberry-pi-4b', mount: { size: 'M2.5', hole: 'insert' } },
      { board: 'heltec-wifi-lora-32-v3', x: 95, y: 10 },
    ],
  }),
  // M3: openings
  'extra-cuts-console': sanitizeState({
    ...defaultState(),
    shape: { ...defaultState().shape, kind: 'console' },
    lid: { ...defaultState().lid, face: 'bottom' },
    boards: [{ board: 'raspberry-pi-4b', cuts: { gpio: false } }],
    extraCuts: [
      { face: 'top', shape: 'rect', x: 40, y: 30, w: 20, h: 10, r: 2 },
      { face: 'left', shape: 'round', x: 30, y: 15, w: 8 },
    ],
  }),
  // M4: lid fastening
  'screws-counterbore-top': sanitizeState({
    ...defaultState(),
    lid: { ...defaultState().lid, fastening: 'screws', screw: { size: 'M3', hole: 'insert', head: 'counterbore' } },
  }),
  'screws-nut-countersunk-side': sanitizeState({
    ...defaultState(),
    shape: { ...defaultState().shape, edgeR: 3, cornerR: 6 },
    lid: { ...defaultState().lid, face: 'left', depth: 4, fastening: 'screws', screw: { size: 'M2.5', hole: 'nut', head: 'countersunk' } },
  }),
  'snaps-cylinder-fillet': sanitizeState({
    ...defaultState(),
    shape: { ...defaultState().shape, kind: 'cylinder', edgeR: 4 },
  }),
  // M6: extras (the label needs fonts and is covered by tests/extras.test.ts)
  'vents-fan-ears': sanitizeState({
    ...defaultState(),
    vents: { on: true, faces: ['left', 'bottom'], pattern: 'hex', size: 3, pitch: 5 },
    fan: { on: true, face: 'top', size: 30 },
    wallMount: { kind: 'ears' },
  }),
  'slots-keyholes-bottom-lid': sanitizeState({
    ...defaultState(),
    lid: { ...defaultState().lid, face: 'bottom' },
    vents: { on: true, faces: ['right', 'top'], pattern: 'slots', along: 'x' },
    wallMount: { kind: 'keyholes', spacing: 50 },
  }),
  // I9: ears, count and placement (PLAN-IMPROVEMENTS.md)
  'ears-four-ends': sanitizeState({
    ...defaultState(),
    shape: { ...defaultState().shape, cornerR: 6 },
    wallMount: { kind: 'ears', ears: { count: 4, walls: 'frontBack', along: 'ends' } },
  }),
  'ears-three-cylinder': sanitizeState({
    ...defaultState(),
    shape: { ...defaultState().shape, kind: 'cylinder' },
    wallMount: { kind: 'ears', ears: { count: 3, walls: 'frontBack' } },
  }),
  // I7: printed screws, threads in the posts (PLAN-IMPROVEMENTS.md)
  'printed-screws-top': sanitizeState({
    ...defaultState(),
    lid: { ...defaultState().lid, fastening: 'printed', thread: { size: 'P6', fit: 0.2 } },
  }),
  'printed-screws-p4': sanitizeState({
    ...defaultState(),
    lid: { ...defaultState().lid, fastening: 'printed', thread: { size: 'P4', fit: 0.2 } },
  }),
  // I8: magnets, a lid boss under a thin plate (PLAN-IMPROVEMENTS.md)
  'magnets-top': sanitizeState({
    ...defaultState(),
    lid: { ...defaultState().lid, fastening: 'magnets', magnet: { size: '8x3', fit: 0.2 } },
  }),
  // I6: closed keyholes, pads and feet (PLAN-IMPROVEMENTS.md)
  'closed-keyholes-feet': sanitizeState({
    ...defaultState(),
    wallMount: { kind: 'keyholes', keyhole: 'closed', spacing: 58, screwD: 4 },
  }),
};

function part(mesh: SurfaceMesh): PartEntry {
  const report = validateMesh(mesh);
  return {
    triangles: report.triangleCount,
    volume: Math.round(report.volume * 100) / 100,
    extents: report.extents.map((value) => Math.round(value * 1000) / 1000),
  };
}

describe('golden cases', () => {
  it('match the pinned geometry', async () => {
    const csg = await initCSG();
    const actual: Record<string, Entry> = {};
    for (const [name, state] of Object.entries(STATES)) {
      const built = buildCase(csg, state, SEGMENTS);
      actual[name] = { body: part(built.body), lid: part(built.lid) };
    }
    if (process.env.UPDATE_GOLDEN || !existsSync(GOLDEN_PATH)) {
      writeFileSync(GOLDEN_PATH, `${JSON.stringify(actual, null, 2)}\n`);
      return;
    }
    const golden: Record<string, Entry> = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8'));
    expect(Object.keys(actual).sort()).toEqual(Object.keys(golden).sort());
    for (const name of Object.keys(golden)) expect(actual[name], name).toEqual(golden[name]);
  });
});
