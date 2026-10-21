import { initCSG } from '../src/geo/csg';
import type { CsgApi } from '../src/geo/csg';
import { buildCase } from '../src/geo/build';
import { validateMesh } from '../src/geo/validate';
import { defaultState, sanitizeState } from '../src/state/schema';
import type { AppState } from '../src/state/schema';

let csg: CsgApi;
beforeAll(async () => {
  csg = await initCSG();
});

function check(state: AppState) {
  const built = buildCase(csg, state, 8);
  const body = validateMesh(built.body);
  const lid = validateMesh(built.lid);
  return { built, body, lid };
}

describe('buildCase', () => {
  it('the default box gives a watertight body and lid', () => {
    const { body, lid } = check(defaultState());
    expect(body.watertight).toBe(true);
    expect(lid.watertight).toBe(true);
    expect(body.volume).toBeGreaterThan(0);
    expect(lid.volume).toBeGreaterThan(0);
    // body: an open cup up to the ceiling's inner surface
    expect(body.bbox.max[2]).toBeCloseTo(33, 3);
    // lid: the plate plus a skirt 3 mm down
    expect(lid.bbox.max[2]).toBeCloseTo(35, 3);
    expect(lid.bbox.min[2]).toBeCloseTo(30, 3);
  });

  it('every lid face and depth builds watertight parts', () => {
    for (const face of ['top', 'bottom', 'front', 'back', 'left', 'right']) {
      for (const depth of [0, 8]) {
        const state = sanitizeState({ ...defaultState(), shape: { ...defaultState().shape, edgeR: 3 }, lid: { ...defaultState().lid, face, depth } });
        const { body, lid } = check(state);
        expect(body.watertight, `${face}/${depth} body`).toBe(true);
        expect(lid.watertight, `${face}/${depth} lid`).toBe(true);
        expect(body.volume, `${face}/${depth}`).toBeGreaterThan(0);
        expect(lid.volume, `${face}/${depth}`).toBeGreaterThan(0);
      }
    }
  });
});
