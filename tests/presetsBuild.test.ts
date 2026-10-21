// Every built-in preset builds a closed, sliver-free case whose lid and body
// do not overlap, and produces no layout warnings a user would have to fix.

import { initCSG, toManifold } from '../src/geo/csg';
import type { CsgApi } from '../src/geo/csg';
import { buildCase } from '../src/geo/build';
import { caseLayout, collisions } from '../src/geo/layout';
import { validateMesh } from '../src/geo/validate';
import { PRESETS } from '../src/state/presets';

let csg: CsgApi;
beforeAll(async () => {
  csg = await initCSG();
});

describe('built-in presets', () => {
  it.each(PRESETS.map((preset) => [preset.id, preset]))('%s builds clean', (_id, preset) => {
    const state = preset.build();
    expect(collisions(caseLayout(state))).toEqual([]);
    const built = buildCase(csg, state, 8);
    for (const mesh of [built.body, built.lid]) {
      const report = validateMesh(mesh);
      expect(report.watertight).toBe(true);
      expect(report.degenerateTriangles).toBe(0);
    }
    const body = toManifold(csg, built.body);
    const lid = toManifold(csg, built.lid);
    const common = body.intersect(lid);
    expect(common.volume()).toBeLessThan(1e-3);
    common.delete();
    body.delete();
    lid.delete();
  });
});
