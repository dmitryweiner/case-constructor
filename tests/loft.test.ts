import { effectiveRadii, insetAt, loftLevels, loftPoints, offsetLoft, ringPoints, sectionAt } from '../src/geo/loft';
import type { LoftSpec } from '../src/geo/loft';

const box: LoftSpec = {
  cx: 50, cy: 35, hw: 50, hd: 35, cornerR: 4, z0: 0, z1: 30, edgeR: 0, filletBottom: true, filletTop: true,
};

describe('loft', () => {
  it('without a fillet the loft is a plain extrusion: two levels, full sections', () => {
    expect(loftLevels(box, 8)).toEqual([0, 30]);
    expect(sectionAt(box, 0)).toEqual({ hw: 50, hd: 35, r: 4 });
    expect(sectionAt(box, 30)).toEqual({ hw: 50, hd: 35, r: 4 });
  });

  it('a fillet insets the ends along a quarter circle', () => {
    const spec = { ...box, edgeR: 3 };
    expect(insetAt(spec, 0)).toBeCloseTo(3);
    expect(insetAt(spec, 3)).toBeCloseTo(0);
    expect(insetAt(spec, 15)).toBe(0);
    expect(insetAt(spec, 30)).toBeCloseTo(3);
    // at 45° along the arc
    const z = 3 - 3 * Math.cos(Math.PI / 4);
    expect(insetAt(spec, z)).toBeCloseTo(3 - 3 * Math.sin(Math.PI / 4));
    expect(sectionAt(spec, 0)).toEqual({ hw: 47, hd: 32, r: 1 });
  });

  it('clamps radii: the corner to the half-size, the fillet to the corner and half the height', () => {
    expect(effectiveRadii({ ...box, cornerR: 80 }).cornerR).toBe(35);
    expect(effectiveRadii({ ...box, edgeR: 10 }).edgeR).toBe(4);
    expect(effectiveRadii({ ...box, cornerR: 30, edgeR: 25 }).edgeR).toBe(15);
    expect(effectiveRadii({ ...box, edgeR: 3, filletBottom: false, filletTop: false }).edgeR).toBe(0);
  });

  it('a ring has four arcs of segments + 1 points, all on the rounded rectangle', () => {
    const ring = ringPoints(0, 0, { hw: 10, hd: 5, r: 2 }, 7, 6);
    expect(ring).toHaveLength(4 * 7);
    for (const [x, y, z] of ring) {
      expect(z).toBe(7);
      expect(Math.abs(x)).toBeLessThanOrEqual(10 + 1e-9);
      expect(Math.abs(y)).toBeLessThanOrEqual(5 + 1e-9);
    }
    expect(ring[0][0]).toBeCloseTo(10);
  });

  it('levels are sorted and unique; points cover every level', () => {
    const spec = { ...box, edgeR: 3 };
    const levels = loftLevels(spec, 4);
    expect(levels).toHaveLength(2 * 5);
    for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeGreaterThan(levels[i - 1]);
    expect(loftPoints(spec, 4)).toHaveLength(levels.length * 4 * 5);
  });

  it('offset shrinks every side', () => {
    const spec = offsetLoft({ ...box, edgeR: 3 }, 1);
    expect(spec).toMatchObject({ hw: 49, hd: 34, cornerR: 3, edgeR: 2, z0: 1, z1: 29 });
  });
});
