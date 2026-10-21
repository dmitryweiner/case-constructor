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

function variant(patch: (base: AppState) => unknown): AppState {
  return sanitizeState(patch(defaultState()));
}

/** The fixed set; add a state when a feature lands, never edit an old one. */
const STATES: Record<string, AppState> = {
  'default-box': defaultState(),
  'box-fillet': variant((s) => ({ ...s, shape: { ...s.shape, cornerR: 8, edgeR: 5 } })),
  'cylinder': variant((s) => ({ ...s, shape: { ...s.shape, kind: 'cylinder', edgeR: 3 } })),
  'console': variant((s) => ({ ...s, shape: { ...s.shape, kind: 'console' }, lid: { ...s.lid, face: 'bottom' } })),
  'bottom-lid': variant((s) => ({ ...s, lid: { ...s.lid, face: 'bottom', depth: 5 } })),
  'side-lid-deep': variant((s) => ({ ...s, shape: { ...s.shape, edgeR: 3 }, lid: { ...s.lid, face: 'right', depth: 12 } })),
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
