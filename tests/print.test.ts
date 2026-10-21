import { bodyForPrint, lidForPrint, printLayout, PRINT_GAP_MM } from '../src/geo/print';
import { FACES } from '../src/geo/face';
import { meshBounds } from '../src/geo/surface';
import { validateMesh } from '../src/geo/validate';
import { boxMesh } from './helpers';

const dims = { w: 10, d: 8, h: 6 };

describe('print layout', () => {
  it('every part sits on the bed at the origin, still closed and outward', () => {
    for (const face of FACES) {
      for (const mesh of [bodyForPrint(boxMesh(), face, dims), lidForPrint(boxMesh(), face, dims)]) {
        const { min } = meshBounds(mesh);
        expect(min.map((x) => +x.toFixed(6)), face).toEqual([0, 0, 0]);
        const report = validateMesh(mesh);
        expect(report.watertight).toBe(true);
        expect(report.volume).toBeGreaterThan(0);
      }
    }
  });

  it('a side lid face turns up for the body: its extent along the normal becomes the height', () => {
    const body = bodyForPrint(boxMesh(10, 8, 6), 'left', dims);
    expect(meshBounds(body).max[2]).toBeCloseTo(10);
  });

  it('the lid goes to the right of the body with a gap', () => {
    const [body, lid] = printLayout(boxMesh(), boxMesh(), 'top', dims);
    expect(meshBounds(lid).min[0]).toBeCloseTo(meshBounds(body).max[0] + PRINT_GAP_MM);
  });
});
