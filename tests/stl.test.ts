import { encodeSTL } from '../src/geo/stl';
import { boxMesh, decodeSTL } from './helpers';

describe('encodeSTL', () => {
  const mesh = boxMesh(10, 8, 6);

  it('buffer size = 84 + 50·triangles; header and count are right', () => {
    const buf = encodeSTL(mesh, { name: 'body' });
    expect(buf.byteLength).toBe(84 + 12 * 50);
    const parsed = decodeSTL(buf);
    expect(parsed.triCount).toBe(12);
    expect(parsed.header).toContain('Case Constructor');
    expect(parsed.header).toContain('body');
  });

  it('vertices are the positions in millimetres, in triangle order', () => {
    const parsed = decodeSTL(encodeSTL(mesh));
    for (let t = 0; t < 12; t++) {
      for (let v = 0; v < 3; v++) {
        const src = mesh.indices[t * 3 + v] * 3;
        for (let c = 0; c < 3; c++) expect(parsed.vertices[t][v][c]).toBeCloseTo(mesh.positions[src + c], 5);
      }
    }
  });

  it('normals are unit and agree with the winding', () => {
    const parsed = decodeSTL(encodeSTL(mesh));
    for (let t = 0; t < parsed.triCount; t++) {
      const [n, tri] = [parsed.normals[t], parsed.vertices[t]];
      expect(Math.hypot(n[0], n[1], n[2])).toBeCloseTo(1, 4);
      const ab = tri[1].map((x, c) => x - tri[0][c]);
      const ac = tri[2].map((x, c) => x - tri[0][c]);
      const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
      const dot = (n[0] * cross[0] + n[1] * cross[1] + n[2] * cross[2]) / Math.hypot(...cross);
      expect(dot).toBeGreaterThan(0.999);
    }
  });
});
