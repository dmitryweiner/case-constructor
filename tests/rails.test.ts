// Rails on screws (plans/PLAN-IMPROVEMENTS-2026-10-29.md, N2): the rail is
// printed apart with an ear at each end and screwed onto posts of the case.
// The placement keeps the choice only for a board held by rails; the ears
// widen the board's footprint where they are; the rails and the case never
// share volume, the board sits in their grooves, and they print top down.

import { initCSG, toManifold } from '../src/geo/csg';
import type { CsgApi } from '../src/geo/csg';
import { buildCase } from '../src/geo/build';
import { RAIL_GAP, RAIL_GRIP, RAIL_THICK, caseLayout } from '../src/geo/layout';
import { RAIL_EAR_CLEAR, RAIL_SEAT, earCentres, earReach, railEarR, railScrewSpec } from '../src/geo/rails';
import { meshBounds } from '../src/geo/surface';
import type { SurfaceMesh } from '../src/geo/surface';
import { validateMesh } from '../src/geo/validate';
import { sanitizePlacement } from '../src/boards/placement';
import { defaultState, sanitizeState } from '../src/state/schema';
import type { AppState } from '../src/state/schema';

let csg: CsgApi;
beforeAll(async () => {
  csg = await initCSG();
});

const HELTEC = 'heltec-wifi-lora-32-v4';

function state(board: Record<string, unknown>, patch: Partial<AppState> = {}): AppState {
  return sanitizeState({ ...defaultState(), ...patch, boards: [{ board: HELTEC, railScrews: true, ...board }] });
}

/** The volume two meshes share. */
function shared(a: SurfaceMesh, b: SurfaceMesh): number {
  const ma = toManifold(csg, a);
  const mb = toManifold(csg, b);
  const common = ma.intersect(mb);
  const volume = common.volume();
  for (const solid of [ma, mb, common]) solid.delete();
  return volume;
}

describe('the placement', () => {
  it('keeps rails on screws only for a board held by rails, and the ears only along', () => {
    expect(sanitizePlacement({ board: HELTEC, railScrews: true, railEars: 'along' })).toMatchObject({ railScrews: true, railEars: 'along' });
    expect(sanitizePlacement({ board: HELTEC, railScrews: true, railEars: 'out' })).not.toHaveProperty('railEars');
    expect(sanitizePlacement({ board: HELTEC, railScrews: 'yes' })).not.toHaveProperty('railScrews');
    expect(sanitizePlacement({ board: HELTEC, railEars: 'along' })).not.toHaveProperty('railEars');
    expect(sanitizePlacement({ board: 'raspberry-pi-4b', railScrews: true })).not.toHaveProperty('railScrews');
    expect(sanitizePlacement({ board: 'battery', railScrews: true })).not.toHaveProperty('railScrews');
    const once = sanitizePlacement({ board: HELTEC, railScrews: true, railEars: 'along' });
    expect(sanitizePlacement(once)).toEqual(once);
  });

  it('an M1.6 holds no rail: the rails take an M2', () => {
    expect(railScrewSpec({ size: 'M1.6', hole: 'tap', head: 'none' }).size).toBe('M2');
    expect(railScrewSpec({ size: 'M3', hole: 'nut', head: 'none' }).size).toBe('M3');
  });
});

describe('the footprint', () => {
  it('ears outwards widen it across the rails; along the edge, past the other two edges', () => {
    const plain = caseLayout(sanitizeState({ ...defaultState(), boards: [{ board: HELTEC }] })).boards[0];
    const out = caseLayout(state({})).boards[0];
    const along = caseLayout(state({ railEars: 'along' })).boards[0];
    const r = railEarR(out.placement.mount);
    // the V4's rails run along its long edges, front and back
    expect(out.footprint.y1 - out.outline.y1).toBeCloseTo(Math.max(plain.footprint.y1 - plain.outline.y1, earReach(out.def, out.placement).back ?? 0), 6);
    expect(out.footprint.y1 - out.footprint.y0).toBeGreaterThan(plain.footprint.y1 - plain.footprint.y0 + 2 * r);
    expect(out.footprint.x1 - out.footprint.x0).toBeCloseTo(plain.footprint.x1 - plain.footprint.x0, 6);
    expect(along.footprint.y1 - along.footprint.y0).toBeCloseTo(plain.footprint.y1 - plain.footprint.y0, 6);
    expect(along.outline.x0 - along.footprint.x0).toBeGreaterThanOrEqual(RAIL_EAR_CLEAR + 2 * r - 1e-9);
  });

  it('the ears clear the board: out off the rail with a seat between, along past its ends', () => {
    const r = 2.7;
    const outer = RAIL_GAP - RAIL_GRIP + RAIL_THICK;
    const [a, b] = earCentres('out', 40, r);
    expect(a[1] - r).toBeCloseTo(outer + RAIL_SEAT, 9);
    expect(a[0] - r).toBeGreaterThan(0);
    expect(b[0] + r).toBeLessThan(40);
    const [c, e] = earCentres('along', 40, r);
    // the post's edge past the board's end (the rail starts RAIL_SHORTEN inside it)
    expect(-(c[0] + r)).toBeCloseTo(2 + RAIL_EAR_CLEAR, 9);
    expect(e[0] - r).toBeCloseTo(40 + 2 + RAIL_EAR_CLEAR, 9);
  });

  it('ears along the edge leave no wall on the other two edges; outwards they do', () => {
    expect(caseLayout(state({ walls: ['left'] })).boards[0].walls.map((wall) => wall.side)).toEqual(['left']);
    expect(caseLayout(state({ walls: ['left'], railEars: 'along' })).boards[0].walls).toEqual([]);
  });
});

const CASES: [string, Record<string, unknown>][] = [
  ['out, on the floor', {}],
  ['along, on the floor', { railEars: 'along' }],
  ['out, pins soldered (the pin bed)', { pins: true }],
  ['along, pins soldered, turned', { pins: true, railEars: 'along', rot: 90 }],
  ['out, hung from the lid', { on: 'ceiling' }],
  ['along, hung, nut holes', { on: 'ceiling', railEars: 'along', mount: { size: 'M2.5', hole: 'nut', head: 'none' } }],
  ['out, inserts, M3', { mount: { size: 'M3', hole: 'insert', head: 'none' } }],
];

describe('the build', () => {
  it.each(CASES)('%s: every part closed and sliver-free, the rails share nothing with the case', (_, board) => {
    const s = state(board);
    const built = buildCase(csg, s, 8);
    const hung = board.on === 'ceiling';
    const assembled = hung ? built.lidRails : built.rails;
    const print = hung ? built.lidRailsPrint : built.railsPrint;
    expect(hung ? built.rails : built.lidRails).toBeNull();
    if (!assembled || !print) throw new Error('no rails');
    for (const [name, mesh] of Object.entries({ body: built.body, lid: built.lid, assembled, print })) {
      const report = validateMesh(mesh);
      expect(report.watertight, name).toBe(true);
      expect(report.degenerateTriangles, name).toBe(0);
    }
    expect(shared(assembled, built.body)).toBeLessThan(1e-3);
    expect(shared(assembled, built.lid)).toBeLessThan(1e-3);
    // the same rails, top down on the bed
    expect(validateMesh(print).volume).toBeCloseTo(validateMesh(assembled).volume, 1);
    expect(meshBounds(print).min[2]).toBeCloseTo(0, 6);
  });

  it('the board sits in the grooves: its PCB shares nothing with the rails, and they reach over its edges', () => {
    const s = state({});
    const built = buildCase(csg, s, 8);
    const board = caseLayout(s).boards[0];
    const { x0, y0, x1, y1 } = board.outline;
    const t = board.def.size.t;
    const pcb = csg.Manifold.cube([x1 - x0, y1 - y0, t]).translate([x0, y0, board.z0]);
    const rails = built.rails;
    if (!rails) throw new Error('no rails');
    const solid = toManifold(csg, rails);
    const common = solid.intersect(pcb);
    expect(common.volume()).toBeLessThan(1e-3);
    // the rails' grooves overlap the PCB in plan: they grip its edges
    const { min, max } = meshBounds(rails);
    expect(min[1]).toBeLessThan(y0);
    expect(max[1]).toBeGreaterThan(y1);
    for (const one of [solid, common, pcb]) one.delete();
  });

  it('printed in, nothing changes: no rail parts', () => {
    const built = buildCase(csg, sanitizeState({ ...defaultState(), boards: [{ board: HELTEC }] }), 8);
    expect([built.rails, built.lidRails, built.railsPrint, built.lidRailsPrint]).toEqual([null, null, null, null]);
  });
});
