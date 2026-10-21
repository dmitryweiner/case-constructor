import { FACES, faceFrame } from '../src/geo/face';
import { applyAffine, composeAffine } from '../src/geo/surface';

const dims = { w: 100, d: 70, h: 30 };

describe('face frames', () => {
  it('the face plane is z = 0 and the case lies below it', () => {
    for (const face of FACES) {
      const frame = faceFrame(face, dims);
      let maxZ = -Infinity;
      for (const x of [0, dims.w]) for (const y of [0, dims.d]) for (const z of [0, dims.h]) {
        maxZ = Math.max(maxZ, applyAffine(frame.toFace, [x, y, z])[2]);
      }
      expect(maxZ, face).toBeCloseTo(0);
      expect(applyAffine(frame.toFace, [dims.w / 2, dims.d / 2, dims.h / 2])[2], face).toBeLessThan(0);
    }
  });

  it('the face rectangle spans [0, w] × [0, h] in (u, v)', () => {
    for (const face of FACES) {
      const frame = faceFrame(face, dims);
      const us: number[] = [];
      const vs: number[] = [];
      for (const x of [0, dims.w]) for (const y of [0, dims.d]) for (const z of [0, dims.h]) {
        const p = applyAffine(frame.toFace, [x, y, z]);
        if (Math.abs(p[2]) > 1e-9) continue;
        us.push(p[0]);
        vs.push(p[1]);
      }
      expect(Math.min(...us), face).toBeCloseTo(0);
      expect(Math.max(...us), face).toBeCloseTo(frame.extent.w);
      expect(Math.min(...vs), face).toBeCloseTo(0);
      expect(Math.max(...vs), face).toBeCloseTo(frame.extent.h);
    }
  });

  it('the frames are right-handed rotations and fromFace inverts toFace', () => {
    for (const face of FACES) {
      const { toFace, fromFace } = faceFrame(face, dims);
      const det = toFace[0] * (toFace[5] * toFace[10] - toFace[6] * toFace[9])
        - toFace[1] * (toFace[4] * toFace[10] - toFace[6] * toFace[8])
        + toFace[2] * (toFace[4] * toFace[9] - toFace[5] * toFace[8]);
      expect(det, face).toBeCloseTo(1);
      const id = composeAffine(fromFace, toFace);
      expect([...id], face).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0].map((v) => expect.closeTo(v, 9)));
    }
  });

  it('normals point out of the named face', () => {
    expect(faceFrame('top', dims).n).toEqual([0, 0, 1]);
    expect(faceFrame('bottom', dims).n).toEqual([0, 0, -1]);
    expect(faceFrame('front', dims).n).toEqual([0, -1, 0]);
    expect(faceFrame('back', dims).n).toEqual([0, 1, 0]);
    expect(faceFrame('left', dims).n).toEqual([-1, 0, 0]);
    expect(faceFrame('right', dims).n).toEqual([1, 0, 0]);
  });
});
