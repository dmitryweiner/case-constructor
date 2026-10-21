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

describe('console with a bottom lid', () => {
  it('lies on its slope: a large flat face on the bed, not an edge', async () => {
    const { initCSG } = await import('../src/geo/csg');
    const { buildCase } = await import('../src/geo/build');
    const { caseLayout } = await import('../src/geo/layout');
    const { defaultState, sanitizeState } = await import('../src/state/schema');
    const csg = await initCSG();
    const state = sanitizeState({ ...defaultState(), boards: [], shape: { ...defaultState().shape, kind: 'console' }, lid: { ...defaultState().lid, face: 'bottom' } });
    const layout = caseLayout(state);
    const built = buildCase(csg, state, 8);
    const shape = { kind: state.shape.kind, console: layout.console };
    const placed = bodyForPrint(built.body, 'bottom', layout.dims, shape);
    // area of the faces lying on the bed
    const p = placed.positions;
    let area = 0;
    for (let t = 0; t < placed.indices.length; t += 3) {
      const [a, b, c] = [placed.indices[t] * 3, placed.indices[t + 1] * 3, placed.indices[t + 2] * 3];
      if (Math.max(p[a + 2], p[b + 2], p[c + 2]) > 1e-3) continue;
      area += Math.abs((p[b] - p[a]) * (p[c + 1] - p[a + 1]) - (p[b + 1] - p[a + 1]) * (p[c] - p[a])) / 2;
    }
    expect(area).toBeGreaterThan(0.8 * layout.dims.w * layout.dims.d);
  });
});
