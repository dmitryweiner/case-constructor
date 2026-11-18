import { signedVolume, validateMesh } from 'maker-kit/3d/validate';
import { assessPart, MAX_PART_MM } from '../src/geo/validate';
import { transformMesh } from '../src/geo/surface';
import { boxMesh } from './helpers';

describe('assessPart: the kit’s export gate and the largest part', () => {
  it('a closed box passes', () => {
    const report = validateMesh(boxMesh(10, 8, 6));
    expect(report.watertight).toBe(true);
    expect(report.volume).toBeCloseTo(480);
    expect(report.extents).toEqual([10, 8, 6]);
    expect(assessPart(report)).toEqual({ blockers: [], warnings: [] });
  });

  it('a missing triangle opens it, a mirrored copy turns it inside out: the kit’s codes', () => {
    const open = boxMesh();
    expect(assessPart(validateMesh({ ...open, indices: open.indices.slice(3) })).blockers.map((m) => m.code)).toContain('kit.mesh.open');
    const box = boxMesh();
    const flipped = new Uint32Array(box.indices);
    for (let t = 0; t < flipped.length; t += 3) [flipped[t + 1], flipped[t + 2]] = [flipped[t + 2], flipped[t + 1]];
    expect(signedVolume(box.positions, flipped)).toBeLessThan(0);
    expect(assessPart(validateMesh({ ...box, indices: flipped })).blockers.map((m) => m.code)).toContain('kit.mesh.inverted');
  });

  it('a part larger than the bed is blocked, by the app’s own code', () => {
    const big = assessPart(validateMesh(boxMesh(MAX_PART_MM + 1, 10, 10)));
    expect(big.blockers).toEqual([{ code: 'mesh.tooLarge', params: { max: MAX_PART_MM } }]);
    expect(assessPart(validateMesh(boxMesh(MAX_PART_MM, 10, 10))).blockers).toEqual([]);
  });

  it('transformMesh with a mirror keeps the winding outward', () => {
    const mirrored = transformMesh(boxMesh(), [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]);
    expect(validateMesh(mirrored).volume).toBeGreaterThan(0);
  });
});
