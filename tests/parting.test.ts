// The lid and the body, assembled, must not overlap anywhere (the fit gap is
// real), and the lid must carry a skirt that reaches into the body.

import { initCSG, toManifold } from '../src/geo/csg';
import type { CsgApi } from '../src/geo/csg';
import { buildCase } from '../src/geo/build';
import { faceFrame } from '../src/geo/face';
import { lidFaces } from '../src/geo/lidSpec';
import { caseDims } from '../src/geo/layout';
import { applyAffine, meshBounds } from '../src/geo/surface';
import { defaultState, sanitizeState } from '../src/state/schema';
import type { AppState } from '../src/state/schema';
import type { ShapeKind } from '../src/geo/shape';

let csg: CsgApi;
beforeAll(async () => {
  csg = await initCSG();
});

function stateFor(kind: ShapeKind, face: string, depth: number, edgeR = 3): AppState {
  const base = defaultState();
  return sanitizeState({ ...base, shape: { ...base.shape, kind, edgeR, cornerR: 6 }, lid: { ...base.lid, face, depth } });
}

const CASES: [ShapeKind, string, number][] = [];
for (const kind of ['box', 'cylinder', 'console'] as const) {
  for (const face of lidFaces(kind)) for (const depth of [0, 7]) CASES.push([kind, face, depth]);
}

describe('parting', () => {
  it.each(CASES)('%s, lid %s, depth %d: lid and body do not overlap', (kind, face, depth) => {
    const state = stateFor(kind, face, depth);
    const built = buildCase(csg, state, 8);
    const body = toManifold(csg, built.body);
    const lid = toManifold(csg, built.lid);
    const overlap = body.intersect(lid);
    expect(overlap.volume()).toBeLessThan(1e-3);
    overlap.delete();
    body.delete();
    lid.delete();
  });

  it.each(CASES)('%s, lid %s, depth %d: the skirt drops lip.h below the parting plane', (kind, face, depth) => {
    const state = stateFor(kind, face, depth);
    const built = buildCase(csg, state, 8);
    const frame = faceFrame(state.lid.face, caseDims(state.shape));
    // deepest point of the lid in the face frame
    let deepest = Infinity;
    const p = built.lid.positions;
    for (let i = 0; i < p.length; i += 3) deepest = Math.min(deepest, applyAffine(frame.toFace, [p[i], p[i + 1], p[i + 2]])[2]);
    const plate = state.lid.face === 'top' || state.lid.face === 'bottom' ? state.shape.floor : state.shape.wall;
    expect(deepest).toBeCloseTo(-(plate + depth + state.lid.lip.h), 3);
  });

  it('a deep lid is clamped so the body keeps its plate and the skirt', () => {
    const state = stateFor('box', 'top', 200);
    const built = buildCase(csg, state, 8);
    const body = meshBounds(built.body);
    expect(body.max[2] - body.min[2]).toBeCloseTo(state.shape.floor + state.lid.lip.h + 1, 3);
  });
});
