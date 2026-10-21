import { assessExport, signedVolume, validateMesh, MAX_PART_MM } from '../src/geo/validate';
import { transformMesh } from '../src/geo/surface';
import { boxMesh } from './helpers';

describe('validateMesh', () => {
  it('a closed box is watertight with a positive volume', () => {
    const report = validateMesh(boxMesh(10, 8, 6));
    expect(report.watertight).toBe(true);
    expect(report.volume).toBeCloseTo(480);
    expect(report.extents).toEqual([10, 8, 6]);
    expect(assessExport(report, true).blocking).toEqual([]);
  });

  it('a missing triangle opens it, a mirrored copy turns it inside out', () => {
    const open = boxMesh();
    const report = validateMesh({ ...open, indices: open.indices.slice(3) });
    expect(report.watertight).toBe(false);
    expect(assessExport(report, true).blocking.map((m) => m.code)).toContain('mesh.open');
    const box = boxMesh();
    const flipped = new Uint32Array(box.indices);
    for (let t = 0; t < flipped.length; t += 3) [flipped[t + 1], flipped[t + 2]] = [flipped[t + 2], flipped[t + 1]];
    expect(signedVolume(box.positions, flipped)).toBeLessThan(0);
    expect(assessExport(validateMesh({ ...box, indices: flipped }), true).blocking.map((m) => m.code)).toContain('mesh.inverted');
  });

  it('a part larger than the bed is blocked', () => {
    const big = validateMesh(boxMesh(MAX_PART_MM + 1, 10, 10));
    expect(assessExport(big, true).blocking.map((m) => m.code)).toContain('mesh.tooLarge');
  });

  it('transformMesh with a mirror keeps the winding outward', () => {
    const mirrored = transformMesh(boxMesh(), [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]);
    expect(validateMesh(mirrored).volume).toBeGreaterThan(0);
  });
});
