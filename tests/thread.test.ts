// Printed screws: the thread's section, its hand, the screw as a solid, and
// the screw in its hole — turned to the right angle it goes in without
// touching the post.

import { initCSG, toManifold } from '../src/geo/csg';
import type { CsgApi } from '../src/geo/csg';
import { CsgScope } from '../src/geo/csg';
import { buildCase } from '../src/geo/build';
import { caseLayout, effectiveLid } from '../src/geo/layout';
import { faceFrame } from '../src/geo/face';
import { openingPolygon } from '../src/geo/opening';
import { postSpots } from '../src/geo/fastening';
import { plateOf, shapeSpec } from '../src/geo/shape';
import { screwsInCase } from '../src/geo/print';
import { threadSolid } from '../src/geo/screwSolids';
import { THREADS, THREAD_SIZES, minorRadius, screwShape, threadEngagement, threadSection } from '../src/geo/thread';
import { transformMesh } from '../src/geo/surface';
import { validateMesh } from '../src/geo/validate';
import { defaultState, sanitizeState } from '../src/state/schema';
import type { AppState } from '../src/state/schema';

let csg: CsgApi;
beforeAll(async () => {
  csg = await initCSG();
});

function printedState(face: string, size: string): AppState {
  const base = defaultState();
  return sanitizeState({
    ...base, boards: [],
    shape: { ...base.shape, auto: false, size: { w: 90, d: 70, h: 40 } },
    lid: { ...base.lid, face, fastening: 'printed', thread: { size, fit: 0.2 } },
  });
}

describe('thread section', () => {
  it('runs between the minor and the major radius, grown by the fit, counter-clockwise', () => {
    for (const size of THREAD_SIZES) {
      const points = threadSection(size, 0.2, 48);
      const radii = points.map(([x, y]) => Math.hypot(x, y));
      expect(Math.max(...radii)).toBeCloseTo(THREADS[size].d / 2 + 0.2, 6);
      expect(Math.min(...radii)).toBeCloseTo(minorRadius(size) + 0.2, 6);
      let area = 0;
      points.forEach(([x0, y0], i) => {
        const [x1, y1] = points[(i + 1) % points.length];
        area += x0 * y1 - x1 * y0;
      });
      expect(area).toBeGreaterThan(0);
    }
  });

  it('is a right-hand thread: going up, the crest turns counter-clockwise', () => {
    const scope = new CsgScope();
    try {
      const { pitch, d } = THREADS.P8;
      const rod = threadSolid(csg, scope, 'P8', 0, 0, 4 * pitch, 32);
      // the crest at z = 0 spans angles just below 0; a quarter pitch up it has turned by +90°
      const radiusAt = (z: number, degrees: number): number => {
        const a = (degrees * Math.PI) / 180;
        const probe = scope.keep(scope.keep(csg.Manifold.cube([0.05, 0.05, 0.05], true))
          .translate([(d / 2 - 0.15) * Math.cos(a), (d / 2 - 0.15) * Math.sin(a), z]));
        return scope.keep(rod.intersect(probe)).volume();
      };
      const z = pitch + pitch / 4;
      expect(radiusAt(z, 90 - 20)).toBeGreaterThan(0);
      expect(radiusAt(z, -90 - 20)).toBe(0);
    } finally {
      scope.dispose();
    }
  });
});

describe('printed screws', () => {
  it.each(THREAD_SIZES)('%s: the screw is closed, sliver-free, head below z = 0, the shank as long as planned', (size) => {
    const state = printedState('top', size);
    const built = buildCase(csg, state, 8);
    expect(built.screw).not.toBeNull();
    if (!built.screw) return;
    const report = validateMesh(built.screw);
    expect(report.watertight).toBe(true);
    expect(report.degenerateTriangles).toBe(0);
    const shape = screwShape(size, plateOf(state.shape, 'top'), state.lid.fit);
    expect(report.bbox.min[2]).toBeCloseTo(-shape.headH, 3);
    expect(report.bbox.max[2]).toBeCloseTo(shape.shank, 3);
    expect(report.extents[0]).toBeCloseTo(shape.headD, 1);
  });

  it.each([['top', 'P6'], ['right', 'P8'], ['bottom', 'P10']] as const)(
    'lid %s, %s: turned to the right angle, the screw goes through the lid and into the post without touching either',
    (face, size) => {
      const state = printedState(face, size);
      const built = buildCase(csg, state, 8);
      if (!built.screw) throw new Error('no screw');
      const layout = caseLayout(state);
      const lid = effectiveLid(state.shape, state.lid, layout.dims);
      const frame = faceFrame(lid.face, layout.dims);
      const plate = plateOf(state.shape, lid.face);
      const opening = openingPolygon(shapeSpec(state.shape, layout.dims), frame, -(plate + lid.depth), lid.lip.h, 8);
      const spot = postSpots(opening, lid, state.shape.wall)[0];
      const body = toManifold(csg, built.body);
      const lidSolid = toManifold(csg, built.lid);
      let best = Infinity;
      let worst = 0;
      for (let step = 0; step < 48; step++) {
        const a = (2 * Math.PI * step) / 48;
        const turned = transformMesh(built.screw, [Math.cos(a), -Math.sin(a), 0, 0, Math.sin(a), Math.cos(a), 0, 0, 0, 0, 1, 0]);
        const placed = screwsInCase(turned, [spot.centre], lid.face, layout.dims);
        if (!placed) throw new Error('no screw placed');
        const screw = toManifold(csg, placed);
        const inBody = body.intersect(screw);
        best = Math.min(best, inBody.volume());
        worst = Math.max(worst, inBody.volume());
        inBody.delete();
        if (step === 0) {
          const inLid = lidSolid.intersect(screw);
          expect(inLid.volume(), 'through the lid').toBeLessThan(1e-3);
          inLid.delete();
          // the screw does go into the post: its core reaches the engagement depth inside the body
          const hull = body.hull();
          const inside = hull.intersect(screw);
          expect(inside.volume()).toBeGreaterThan(0.8 * Math.PI * minorRadius(size) ** 2 * threadEngagement(size));
          inside.delete();
          hull.delete();
        }
        screw.delete();
      }
      expect(best).toBeLessThan(1e-3);
      // and the thread is real: turned wrong, the screw runs into the post's thread
      expect(worst).toBeGreaterThan(1);
      body.delete();
      lidSolid.delete();
    },
  );
});
