import { bodyForPrint, bothForPrint, lidForPrint, lidWithScrews, printLayout, PRINT_GAP_MM, sanitizePrint, screwsForPrint, screwsInCase } from '../src/geo/print';
import { SCREW_GAP } from '../src/geo/thread';
import { faceFrame } from '../src/geo/face';
import { applyAffine, transformMesh, translation } from '../src/geo/surface';
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

  it('behind the body: the lid starts a gap past the body\'s back, at x = 0', () => {
    const [body, lid] = printLayout(boxMesh(), boxMesh(), 'top', dims, undefined, { lid: 'behind', gap: 4 });
    expect(meshBounds(lid).min[0]).toBeCloseTo(0);
    expect(meshBounds(lid).min[1]).toBeCloseTo(meshBounds(body).max[1] + 4);
    expect(meshBounds(lid).min[2]).toBeCloseTo(0);
  });

  it('auto: the layout whose longer side is shorter', () => {
    // a long case (the user's 175 × 71): side by side it is 360 long, behind 152
    const long = { w: 175, d: 71, h: 29 };
    const [, lidLong] = printLayout(boxMesh(175, 71, 26), boxMesh(175, 71, 3), 'top', long, undefined, { lid: 'auto', gap: 10 });
    expect(meshBounds(lidLong).min[1]).toBeCloseTo(81);
    // a deep one goes side by side
    const deep = { w: 60, d: 120, h: 29 };
    const [, lidDeep] = printLayout(boxMesh(60, 120, 26), boxMesh(60, 120, 3), 'top', deep, undefined, { lid: 'auto', gap: 10 });
    expect(meshBounds(lidDeep).min[0]).toBeCloseTo(70);
    // a square one: a tie keeps the right
    const [, lidSquare] = printLayout(boxMesh(10, 10, 6), boxMesh(10, 10, 3), 'top', { w: 10, d: 10, h: 6 }, undefined, { lid: 'auto', gap: 10 });
    expect(meshBounds(lidSquare).min[0]).toBeCloseTo(20);
  });

  it('the settings survive a file; garbage falls back to auto and the default gap', () => {
    expect(sanitizePrint(undefined)).toEqual({ lid: 'auto', gap: PRINT_GAP_MM });
    expect(sanitizePrint({ lid: 'behind', gap: 500 })).toEqual({ lid: 'behind', gap: 50 });
    expect(sanitizePrint({ lid: 'under', gap: 'x' })).toEqual({ lid: 'auto', gap: PRINT_GAP_MM });
  });
});

describe('printed screws', () => {
  // a stand-in screw in its own frame: a 4 mm head below z = 0, a 2 × 2 × 8 shank above
  const head = transformMesh(boxMesh(6, 6, 4), translation(-3, -3, -4));
  const screw = { ...head };

  it('print: standing on their heads in a row, a gap apart, closed', () => {
    const row = screwsForPrint(screw, 4, 20);
    expect(row).not.toBeNull();
    if (!row) return;
    const { min, max } = meshBounds(row);
    expect(min.map((x) => +x.toFixed(6))).toEqual([20, 0, 0]);
    expect(max[0]).toBeCloseTo(20 + 4 * 6 + 3 * SCREW_GAP);
    expect(validateMesh(row).volume).toBeGreaterThan(0);
  });

  it('in the case: heads on the lid\'s outer face, outside, over each post', () => {
    for (const face of FACES) {
      const frame = faceFrame(face, dims);
      const placed = screwsInCase(screw, [[3, 2]], face, dims);
      expect(placed).not.toBeNull();
      if (!placed) return;
      // the head (z ∈ [−4, 0] in its frame) ends up outside the face, 0…4 along the normal
      const along = [];
      for (let i = 0; i < placed.positions.length; i += 3) {
        along.push(applyAffine(frame.toFace, [placed.positions[i], placed.positions[i + 1], placed.positions[i + 2]]));
      }
      expect(Math.min(...along.map((p) => p[2])), face).toBeCloseTo(0);
      expect(Math.max(...along.map((p) => p[2])), face).toBeCloseTo(4);
      expect(Math.min(...along.map((p) => p[0])), face).toBeCloseTo(0);
      expect(validateMesh(placed).volume, face).toBeGreaterThan(0);
    }
  });

  it('Both: the screws follow the lid — to its right, or behind it', () => {
    const right = bothForPrint(boxMesh(), boxMesh(), screw, 3, 'top', dims, undefined, { lid: 'right', gap: 5 }).parts;
    expect(meshBounds(right[2]).min[0]).toBeCloseTo(meshBounds(right[1]).max[0] + 5);
    const both = bothForPrint(boxMesh(), boxMesh(), screw, 3, 'top', dims, undefined, { lid: 'behind', gap: 5 });
    expect(both.place).toBe('behind');
    const behind = both.parts;
    expect(meshBounds(behind[2]).min[0]).toBeCloseTo(0);
    expect(meshBounds(behind[2]).min[1]).toBeCloseTo(meshBounds(behind[1]).max[1] + 5);
    expect(bothForPrint(boxMesh(), boxMesh(), null, 0, 'top', dims).parts).toHaveLength(2);
  });

  it('the lid tab and the STL: the lid, then its screws to the right', () => {
    const [lid, screws] = lidWithScrews(boxMesh(), screw, 4, 'top', dims);
    expect(meshBounds(screws).min[0]).toBeCloseTo(meshBounds(lid).max[0] + PRINT_GAP_MM);
    expect(lidWithScrews(boxMesh(), null, 4, 'top', dims)).toHaveLength(1);
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
