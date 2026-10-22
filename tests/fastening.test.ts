// Lid fastening in the built case: snap bumps on the skirt sit in grooves of
// the body; screw posts stand under the lid's holes; every variant stays
// closed, free of slivers and of overlaps between the parts.

import { initCSG, toManifold } from '../src/geo/csg';
import type { CsgApi } from '../src/geo/csg';
import type { Manifold } from 'manifold-3d';
import { buildCase } from '../src/geo/build';
import { caseLayout, effectiveLid } from '../src/geo/layout';
import { faceFrame } from '../src/geo/face';
import { lidFaces } from '../src/geo/lidSpec';
import { openingPolygon } from '../src/geo/opening';
import { MAGNET_SKIN, POST_LEN, SNAP_R, magnetPockets, postCollisions, postSpots, postsInOpenings, snapSpots } from '../src/geo/fastening';
import { portCutters } from '../src/geo/ports';
import { cutterContains } from '../src/geo/cutters';
import { MAGNETS, SCREWS } from '../src/geo/fasteners';
import { sanitizeLid } from '../src/geo/lidSpec';
import { plateOf, shapeSpec } from '../src/geo/shape';
import { validateMesh } from '../src/geo/validate';
import { applyAffine } from '../src/geo/surface';
import { defaultState, sanitizeState } from '../src/state/schema';
import type { AppState } from '../src/state/schema';
import type { ShapeKind } from '../src/geo/shape';
import type { Fastening } from '../src/geo/lidSpec';

let csg: CsgApi;
beforeAll(async () => {
  csg = await initCSG();
});

function solidAt(part: Manifold, p: readonly number[]): boolean {
  const probe = csg.Manifold.cube([0.1, 0.1, 0.1], true).translate([p[0], p[1], p[2]]);
  const common = part.intersect(probe);
  const filled = common.volume() > 0.0005;
  probe.delete();
  common.delete();
  return filled;
}

/** Mechanics are tested on an empty case: ports cutting through a snap or post are a separate matter. */
function stateFor(kind: ShapeKind, face: string, fastening: Fastening, extra: Record<string, unknown> = {}, boards = false): AppState {
  const base = defaultState();
  return sanitizeState({
    ...base,
    boards: boards ? base.boards : [],
    shape: { ...base.shape, kind, edgeR: 2, cornerR: 6, auto: false, size: { w: 90, d: 70, h: 40 } },
    lid: { ...base.lid, face, fastening, ...extra },
  });
}

/** Geometry of the lid in its frame: opening, parting depth, plate. */
function lidGeometry(state: AppState) {
  const layout = caseLayout(state);
  const shape = { ...state.shape, console: layout.console };
  const lid = effectiveLid(shape, state.lid, layout.dims);
  const frame = faceFrame(lid.face, layout.dims);
  const plate = plateOf(shape, lid.face);
  const zp = -(plate + lid.depth);
  const opening = openingPolygon(shapeSpec(shape, layout.dims), frame, zp, lid.lip.h, 8);
  return { layout, shape, lid, frame, plate, zp, opening };
}

const VARIANTS: [ShapeKind, string, Fastening][] = [];
for (const kind of ['box', 'cylinder', 'console'] as const) {
  for (const face of lidFaces(kind)) for (const fastening of ['snaps', 'screws', 'magnets', 'printed'] as const) VARIANTS.push([kind, face, fastening]);
}

describe('fastening variants', () => {
  it.each(VARIANTS)('%s, lid %s, %s: closed, no slivers, no overlap (with the Pi inside)', (kind, face, fastening) => {
    const built = buildCase(csg, stateFor(kind, face, fastening, {}, true), 8);
    for (const [name, mesh] of [['body', built.body], ['lid', built.lid]] as const) {
      const report = validateMesh(mesh);
      expect(report.watertight, name).toBe(true);
      expect(report.degenerateTriangles, name).toBe(0);
    }
    const body = toManifold(csg, built.body);
    const lid = toManifold(csg, built.lid);
    const common = body.intersect(lid);
    expect(common.volume()).toBeLessThan(1e-3);
    common.delete();
    body.delete();
    lid.delete();
  });
});

describe('snaps', () => {
  it.each([['box', 'top'], ['box', 'front'], ['cylinder', 'top'], ['console', 'left']] as const)(
    '%s, lid %s: each bump stands out of the skirt into a groove in the body',
    (kind, face) => {
      const state = stateFor(kind, face, 'snaps');
      const g = lidGeometry(state);
      const spots = snapSpots(g.opening, g.frame, g.zp, g.lid, kind === 'cylinder');
      expect(spots.length).toBeGreaterThanOrEqual(kind === 'cylinder' ? 4 : 3);
      const built = buildCase(csg, state, 8);
      const body = toManifold(csg, built.body);
      const lid = toManifold(csg, built.lid);
      for (const spot of spots) {
        const { origin, ex } = spot.bump;
        // ex is the outward normal; the rod's axis sits SNAP_SINK inside the skirt
        const at = (d: number) => [0, 1, 2].map((k) => origin[k] + ex[k] * d);
        const tip = SNAP_R + 0.1 - 0.15; // just inside the bump's outer edge
        expect(solidAt(lid, at(tip)), 'bump').toBe(true);
        expect(solidAt(body, at(tip)), 'groove').toBe(false);
        // the wall goes on beyond the groove
        expect(solidAt(body, at(SNAP_R + 0.1 + g.lid.fit + 0.4)), 'wall behind').toBe(true);
      }
      body.delete();
      lid.delete();
    },
  );
});

describe('screw posts', () => {
  it.each([['box', 'top'], ['box', 'bottom'], ['box', 'right'], ['cylinder', 'top'], ['console', 'back']] as const)(
    '%s, lid %s: a post under every lid hole, its hole open, the lid hole through',
    (kind, face) => {
      const state = stateFor(kind, face, 'screws', { screw: { size: 'M3', hole: 'tap', head: 'counterbore' } });
      const g = lidGeometry(state);
      const spots = postSpots(g.opening, g.lid, state.shape.wall);
      expect(spots).toHaveLength(4);
      const built = buildCase(csg, state, 8);
      const body = toManifold(csg, built.body);
      const lid = toManifold(csg, built.lid);
      const toCase = (u: number, v: number, z: number) => applyAffine(g.frame.fromFace, [u, v, z]);
      for (const spot of spots) {
        const [u, v] = spot.centre;
        // post material beside the hole, air in the hole (below the rim, where the post is whole)
        expect(solidAt(body, toCase(u + spot.r - 0.4, v, g.zp - 1)), 'post').toBe(true);
        expect(solidAt(body, toCase(u, v, g.zp - 1)), 'post hole').toBe(false);
        // the lid: a through hole above the post, plate around it, the counterbore
        expect(solidAt(lid, toCase(u, v, -g.plate / 2)), 'lid hole').toBe(false);
        const head = (SCREWS.M3.headD + 0.4) / 2;
        // towards the middle of the face, away from the rounded corner
        const inward = Math.sign(g.opening.reduce((sum, p) => sum + p[0], 0) / g.opening.length - u) || 1;
        expect(solidAt(lid, toCase(u + inward * (head - 0.3), v, -0.3)), 'counterbore').toBe(false);
        expect(solidAt(lid, toCase(u + inward * (head + 0.4), v, -g.plate + 0.3)), 'plate around').toBe(true);
        // the post's bottom is POST_LEN below the plane (plus the taper towards the corner)
        expect(solidAt(body, toCase(u, v, g.zp - POST_LEN + 0.5)), 'post bottom').toBe(true);
      }
      body.delete();
      lid.delete();
    },
  );

  it('the auto size keeps the posts clear of the default Pi', () => {
    for (const face of ['top', 'bottom', 'left', 'front']) {
      const base = defaultState();
      const g = lidGeometry(sanitizeState({ ...base, lid: { ...base.lid, face, fastening: 'screws' } }));
      const spots = postSpots(g.opening, g.lid, 2);
      expect(postCollisions(spots, g.frame, g.zp, g.plate, g.lid, g.layout.boards), face).toEqual([]);
    }
  });

  it('a manual layout that pushes a board into a corner gets a warning', () => {
    const base = defaultState();
    const g = lidGeometry(sanitizeState({ ...base, lid: { ...base.lid, fastening: 'screws' } }));
    // squeeze: the same posts, a board moved right into the corner
    const board = { ...g.layout.boards[0], outline: { x0: 1, y0: 1, x1: 50, y1: 50 } };
    const spots = postSpots(g.opening, g.lid, 2);
    expect(postCollisions(spots, g.frame, g.zp, g.plate, g.lid, [board]).map((m) => m.code)).toContain('warn.postHitsBoard');
  });
});

describe('magnets', () => {
  it('a lid from an old file holds on snaps or screws as before and gets the default magnet', () => {
    const lid = sanitizeLid({ face: 'top', fastening: 'screws' }, 'box');
    expect(lid.fastening).toBe('screws');
    expect(lid.magnet).toEqual({ size: '6x3', fit: 0.2 });
    expect(sanitizeLid({ fastening: 'magnets', magnet: { size: '9x9', fit: 3 } }, 'box').magnet).toEqual({ size: '6x3', fit: 0.5 });
  });

  it.each([['box', 'top', '6x3'], ['box', 'right', '8x2'], ['cylinder', 'top', '10x3'], ['console', 'back', '5x2'], ['box', 'bottom', '6x2']] as const)(
    '%s, lid %s, %s: a pocket in every post and one facing it in the lid, flush, the lid closed over it',
    (kind, face, size) => {
      const state = stateFor(kind, face, 'magnets', { magnet: { size, fit: 0.2 } });
      const g = lidGeometry(state);
      const spots = postSpots(g.opening, g.lid, state.shape.wall);
      expect(spots).toHaveLength(4);
      const pockets = magnetPockets(g.lid, g.plate);
      const magnet = MAGNETS[size];
      expect(pockets.r).toBeCloseTo((magnet.d + 0.2) / 2);
      // a magnet sits flush: its pocket is as deep as it is high; the faces meet across the fit
      expect(pockets.lidMouth - pockets.postTop).toBeCloseTo(g.lid.fit);
      // the lid keeps a skin over its pocket
      expect(pockets.lidMouth + magnet.h).toBeCloseTo(Math.min(-MAGNET_SKIN, -g.plate + magnet.h));
      const built = buildCase(csg, state, 8);
      const body = toManifold(csg, built.body);
      const lid = toManifold(csg, built.lid);
      const at = (u: number, v: number, z: number) => applyAffine(g.frame.fromFace, [u, v, z]);
      for (const spot of spots) {
        const [u, v] = spot.centre;
        const inward = Math.sign(g.opening.reduce((sum, p) => sum + p[0], 0) / g.opening.length - u) || 1;
        expect(solidAt(body, at(u, v, pockets.postTop - magnet.h / 2)), 'post pocket').toBe(false);
        expect(solidAt(body, at(u, v, pockets.postTop - magnet.h - 0.3)), 'post pocket bottom').toBe(true);
        expect(solidAt(body, at(u + inward * (pockets.r + 0.6), v, pockets.postTop - magnet.h + 0.3)), 'post wall').toBe(true);
        expect(solidAt(lid, at(u, v, pockets.lidMouth + magnet.h / 2)), 'lid pocket').toBe(false);
        expect(solidAt(lid, at(u, v, -0.3)), 'lid skin').toBe(true);
        expect(solidAt(lid, at(u + inward * (pockets.r + 0.6), v, pockets.lidMouth + magnet.h - 0.3)), 'lid boss').toBe(true);
      }
      body.delete();
      lid.delete();
    },
  );

  it('magnet posts are thicker than screw posts, and the auto size makes room for them', () => {
    const base = defaultState();
    const screws = caseLayout(sanitizeState({ ...base, lid: { ...base.lid, fastening: 'screws' } })).dims;
    const magnets = caseLayout(sanitizeState({ ...base, lid: { ...base.lid, fastening: 'magnets', magnet: { size: '10x3', fit: 0.2 } } })).dims;
    expect(magnets.w).toBeGreaterThan(screws.w);
    const g = lidGeometry(sanitizeState({ ...base, lid: { ...base.lid, fastening: 'magnets', magnet: { size: '10x3', fit: 0.2 } } }));
    const spots = postSpots(g.opening, g.lid, base.shape.wall);
    expect(postCollisions(spots, g.frame, g.zp, g.plate, g.lid, g.layout.boards)).toEqual([]);
  });
});

describe('fastening around openings', () => {
  it('a snap that would land in a port opening is left out', () => {
    const base = defaultState();
    const front = sanitizeState({ ...base, lid: { ...base.lid, face: 'front' } });
    const g = lidGeometry(front);
    const cutters = portCutters(g.layout, g.shape);
    const all = snapSpots(g.opening, g.frame, g.zp, g.lid, false);
    const kept = snapSpots(g.opening, g.frame, g.zp, g.lid, false, cutters);
    expect(kept.length).toBeLessThanOrEqual(all.length);
    for (const spot of kept) {
      expect(cutters.some((c) => cutterContains(c, spot.bump.origin, 0.7))).toBe(false);
    }
  });

  it('a post in the path of a port is reported', () => {
    const base = defaultState();
    const right = sanitizeState({ ...base, lid: { ...base.lid, face: 'right', fastening: 'screws' } });
    const g = lidGeometry(right);
    const spots = postSpots(g.opening, g.lid, 2);
    const messages = postsInOpenings(spots, g.frame, g.zp, g.plate, g.lid, portCutters(g.layout, g.shape));
    expect(messages.length).toBeGreaterThan(0);
  });
});
