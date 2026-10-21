import { loftSlice, polygonArea, clipHalfPlane } from '../src/geo/section';
import type { Vec2 } from '../src/geo/section';
import { faceFrame } from '../src/geo/face';
import { shapeSpec, defaultShape } from '../src/geo/shape';
import type { LoftSpec } from '../src/geo/loft';

const dims = { w: 100, d: 70, h: 30 };
const box: LoftSpec = {
  cx: 50, cy: 35, hw: 48, hd: 33, cornerR: 2, z0: 2, z1: 28, edgeR: 0, filletBottom: true, filletTop: true,
};

function bounds(poly: Vec2[]): [number, number, number, number] {
  const us = poly.map((p) => p[0]);
  const vs = poly.map((p) => p[1]);
  return [Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)];
}

describe('loftSlice', () => {
  it('a top slice is the section, counter-clockwise in face coordinates', () => {
    const poly = loftSlice(box, null, faceFrame('top', dims), -2, 4);
    expect(polygonArea(poly)).toBeGreaterThan(0);
    const [u0, u1, v0, v1] = bounds(poly);
    expect([u0, u1, v0, v1].map((x) => +x.toFixed(6))).toEqual([2, 98, 2, 68]);
  });

  it('a bottom slice is counter-clockwise too (its frame mirrors y)', () => {
    const poly = loftSlice(box, null, faceFrame('bottom', dims), -2, 4);
    expect(polygonArea(poly)).toBeGreaterThan(0);
  });

  it('a slice through the rounded corner zone is narrower than one through the middle', () => {
    const frame = faceFrame('left', dims);
    const deep = loftSlice(box, null, frame, -10, 6);
    const corner = loftSlice(box, null, frame, -2.5, 6);
    const [a0, a1] = bounds(deep);
    const [b0, b1] = bounds(corner);
    expect(a1 - a0).toBeCloseTo(66);
    expect(b1 - b0).toBeLessThan(66);
    expect(b1 - b0).toBeGreaterThan(60);
  });

  it('a filleted top slice at the ceiling is the fully inset section', () => {
    const spec = { ...box, edgeR: 2 };
    const poly = loftSlice(spec, null, faceFrame('top', dims), -2, 4);
    const [u0, u1] = bounds(poly);
    expect(u1 - u0).toBeCloseTo(92);
  });

  it('misses give an empty polygon', () => {
    expect(loftSlice(box, null, faceFrame('top', dims), -1, 4)).toEqual([]);
    expect(loftSlice(box, null, faceFrame('right', dims), -0.5, 4)).toEqual([]);
  });

  it('the console slope clips a side slice', () => {
    const shape = { ...defaultShape(), kind: 'console' as const, console: { frontH: 20, backH: 40 } };
    const cdims = { w: 100, d: 70, h: 40 };
    const spec = shapeSpec(shape, cdims);
    const poly = loftSlice(spec.inner, spec.innerCut, faceFrame('left', cdims), -2, 4);
    const vs = poly.map((p) => p[1]);
    // the front of the cavity is lower than the back
    const front = poly.filter((p) => p[0] > 60).map((p) => p[1]);
    const back = poly.filter((p) => p[0] < 10).map((p) => p[1]);
    expect(Math.max(...front)).toBeLessThan(Math.max(...back));
    expect(Math.max(...vs)).toBeLessThan(40);
  });
});

describe('clipHalfPlane', () => {
  it('cuts a square in half', () => {
    const square: Vec2[] = [[0, 0], [2, 0], [2, 2], [0, 2]];
    expect(polygonArea(clipHalfPlane(square, 1, 0, -1))).toBeCloseTo(2);
    expect(clipHalfPlane(square, 1, 0, -5)).toEqual([]);
  });
});
