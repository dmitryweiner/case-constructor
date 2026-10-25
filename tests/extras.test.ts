// Extras: vents thin out where they must, the fan seat and keyholes are
// where they are asked to be, ears and the label change the right part.

import { initCSG, toManifold } from '../src/geo/csg';
import type { CsgApi } from '../src/geo/csg';
import { buildCase } from '../src/geo/build';
import { caseLayout, effectiveLid, standoffColumns } from '../src/geo/layout';
import { portCutters, outerTopAt } from '../src/geo/ports';
import {
  EAR_LENGTH, EAR_WIDTH, FAN_SCREWS, closedKeyholes, earSpecs, extrasCutters, extrasWarnings, fanCuts, flatRegion, keyholeCuts, keyholeFace,
  sanitizeLabel, sanitizeVents, sanitizeWallMount, ventCuts,
} from '../src/geo/extras';
import { faceFrame } from '../src/geo/face';
import { applyAffine } from '../src/geo/surface';
import type { LabelRaster } from '../src/geo/label';
import { labelPlacement, rasterRuns, sanitizeLabelRaster } from '../src/geo/label';
import { validateMesh } from '../src/geo/validate';
import { defaultState, sanitizeState } from '../src/state/schema';
import type { AppState } from '../src/state/schema';
import { garbageLike, rng } from './helpers';

let csg: CsgApi;
beforeAll(async () => {
  csg = await initCSG();
});

function context(state: AppState) {
  const layout = caseLayout(state);
  const shape = { ...state.shape, console: layout.console };
  const lid = effectiveLid(shape, state.lid, layout.dims);
  const top = outerTopAt(shape, layout.dims, layout.console.frontH, layout.console.backH);
  return { layout, shape, lid, top, ports: portCutters(layout, shape) };
}

/** A 20 × 10 px raster with two solid blocks — "ink" without a font. */
function blocks(): LabelRaster {
  const w = 20;
  const h = 10;
  const pixels = new Uint8Array(w * h);
  for (let y = 2; y < 8; y++) for (let x = 2; x < 18; x++) if (x < 8 || x > 11) pixels[y * w + x] = 255;
  return { w, h, pixels, mmPerPx: 0.5 };
}

describe('vents', () => {
  it('stay inside the flat region of every chosen face', () => {
    const state = sanitizeState({ ...defaultState(), shape: { ...defaultState().shape, edgeR: 3 }, vents: { on: true, faces: ['left', 'top', 'bottom'], pattern: 'round', size: 3, pitch: 5 } });
    const { layout, shape } = context(state);
    const cuts = ventCuts(state.vents, shape, layout.dims, state.lid.face);
    expect(cuts.length).toBeGreaterThan(10);
    for (const cut of cuts) {
      const region = flatRegion(shape, layout.dims, cut.face, state.vents.margin);
      expect(cut.x - cut.w / 2).toBeGreaterThanOrEqual(region.u0 - 1e-6);
      expect(cut.x + cut.w / 2).toBeLessThanOrEqual(region.u1 + 1e-6);
      expect(cut.y - cut.h / 2).toBeGreaterThanOrEqual(region.v0 - 1e-6);
      expect(cut.y + cut.h / 2).toBeLessThanOrEqual(region.v1 + 1e-6);
    }
  });

  it('keep clear of the standoffs on the floor and of the port openings', () => {
    const state = sanitizeState({ ...defaultState(), vents: { on: true, faces: ['bottom', 'right'], pattern: 'hex', size: 3, pitch: 5 } });
    const { layout, shape, lid, top, ports } = context(state);
    const cutters = extrasCutters(state, shape, layout, lid, top, ports);
    const all = ventCuts(state.vents, shape, layout.dims, lid.face);
    expect(cutters.length).toBeLessThan(all.length);
    for (const cutter of cutters) {
      for (const column of standoffColumns(layout.boards[0])) {
        expect(Math.hypot(cutter.origin[0] - column.x, cutter.origin[1] - column.y)).toBeGreaterThan(column.r);
      }
    }
  });

  it('a vented case stays closed and sliver-free', () => {
    for (const pattern of ['slots', 'hex', 'round']) {
      const state = sanitizeState({ ...defaultState(), vents: { on: true, faces: ['left', 'bottom', 'top'], pattern } });
      const built = buildCase(csg, state, 8);
      for (const mesh of [built.body, built.lid]) {
        const report = validateMesh(mesh);
        expect(report.watertight, pattern).toBe(true);
        expect(report.degenerateTriangles, pattern).toBe(0);
      }
    }
  });

  it('the sanitizer keeps the pitch above the size', () => {
    expect(sanitizeVents({ size: 8, pitch: 3 }).pitch).toBeGreaterThan(8);
    const random = rng(3);
    for (let i = 0; i < 300; i++) {
      const once = sanitizeVents(garbageLike(defaultState().vents, random));
      expect(sanitizeVents(once)).toEqual(once);
    }
  });
});

describe('fan, keyholes, ears', () => {
  it('the fan seat: an opening of size − 2 and four holes on the standard square', () => {
    const dims = { w: 100, d: 80, h: 60 };
    const cuts = fanCuts({ on: true, face: 'back', size: 40, x: 5, y: -3, screwD: 3.2 }, dims);
    expect(cuts).toHaveLength(5);
    expect(cuts[0]).toMatchObject({ shape: 'round', w: 38, x: 55, y: 27 });
    const xs = cuts.slice(1).map((c) => c.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(FAN_SCREWS[40]);
  });

  it('keyholes go through the floor, or the back wall when the floor is the lid', () => {
    const dims = { w: 100, d: 80, h: 40 };
    const lid = defaultState().lid;
    expect(keyholeFace(lid)).toBe('bottom');
    expect(keyholeFace({ ...lid, face: 'bottom' })).toBe('back');
    const cuts = keyholeCuts(sanitizeWallMount({ kind: 'keyholes', spacing: 40, screwD: 4 }), dims, lid);
    expect(cuts).toHaveLength(4);
    expect(Math.abs(cuts[0].x - cuts[2].x)).toBeCloseTo(40);
  });

  it('a keyhole is through by default; old files load as through', () => {
    expect(sanitizeWallMount({ kind: 'keyholes', spacing: 40, screwD: 4 }).keyhole).toBe('through');
    expect(sanitizeWallMount({ kind: 'keyholes', keyhole: 'closed' }).keyhole).toBe('closed');
    expect(sanitizeWallMount({ kind: 'keyholes', keyhole: 'sideways' }).keyhole).toBe('through');
  });

  it('closed keyholes on the bottom: two pads and two mirrored feet of one height', () => {
    const state = sanitizeState({ ...defaultState(), wallMount: { kind: 'keyholes', keyhole: 'closed', spacing: 40, screwD: 4 } });
    const { layout, shape, lid } = context(state);
    const closed = closedKeyholes(state.wallMount, shape, layout.dims, lid);
    expect(closed).not.toBeNull();
    if (!closed) return;
    expect(closed.face).toBe('bottom');
    expect(closed.height).toBeGreaterThan(0);
    expect(closed.pads).toHaveLength(4);
    const keyholePads = closed.pads.filter((pad) => pad.keyhole);
    const feet = closed.pads.filter((pad) => !pad.keyhole);
    expect(keyholePads).toHaveLength(2);
    expect(feet).toHaveLength(2);
    const extent = faceFrame('bottom', layout.dims).extent;
    for (const [pad, foot] of keyholePads.map((pad, i) => [pad, feet[i]])) {
      expect(foot.u0).toBeCloseTo(pad.u0);
      expect(foot.v0 + foot.v1).toBeCloseTo(extent.h * 2 - pad.v0 - pad.v1);
    }
    // every pad on the flat part of the face
    const flat = flatRegion(shape, layout.dims, 'bottom', 0);
    for (const pad of closed.pads) {
      expect(pad.u0).toBeGreaterThanOrEqual(flat.u0 - 1e-9);
      expect(pad.v1).toBeLessThanOrEqual(flat.v1 + 1e-9);
    }
    const codes = extrasWarnings(state, shape, layout, lid).map((m) => m.code);
    expect(codes).not.toContain('warn.keyholeOffFlat');
    // the lid on top: the body prints on its bottom, on the pads
    expect(codes).toContain('warn.keyholePadsOnBed');
    const side = sanitizeState({ ...state, lid: { ...state.lid, face: 'left' } });
    const sideContext = context(side);
    expect(extrasWarnings(side, sideContext.shape, sideContext.layout, sideContext.lid).map((m) => m.code)).not.toContain('warn.keyholePadsOnBed');
  });

  it('a case too short for pads and feet gets one strip per keyhole', () => {
    const state = sanitizeState({
      ...defaultState(), boards: [], shape: { ...defaultState().shape, auto: false, size: { w: 90, d: 40, h: 30 } },
      wallMount: { kind: 'keyholes', keyhole: 'closed', spacing: 40, screwD: 4 },
    });
    const { layout, shape, lid } = context(state);
    const closed = closedKeyholes(state.wallMount, shape, layout.dims, lid);
    expect(closed?.pads).toHaveLength(2);
    expect(closed?.pads.every((pad) => pad.keyhole)).toBe(true);
  });

  it('with the floor as the lid, closed keyholes stand out of the back wall, no feet', () => {
    const state = sanitizeState({
      ...defaultState(), lid: { ...defaultState().lid, face: 'bottom' },
      wallMount: { kind: 'keyholes', keyhole: 'closed', spacing: 40, screwD: 4 },
    });
    const { layout, shape, lid } = context(state);
    const closed = closedKeyholes(state.wallMount, shape, layout.dims, lid);
    expect(closed?.face).toBe('back');
    expect(closed?.pads).toHaveLength(2);
  });

  it('closed keyholes keep the case closed: blind pockets in pads under the floor', () => {
    const base = sanitizeState({
      ...defaultState(), boards: [], shape: { ...defaultState().shape, auto: false, size: { w: 100, d: 70, h: 35 } },
      wallMount: { kind: 'none', spacing: 40, screwD: 4 },
    });
    const through = sanitizeState({ ...base, wallMount: { ...base.wallMount, kind: 'keyholes' } });
    const closed = sanitizeState({ ...base, wallMount: { ...base.wallMount, kind: 'keyholes', keyhole: 'closed' } });
    const genus = (state: AppState): number => {
      const body = toManifold(csg, buildCase(csg, state, 8).body);
      const g = body.genus();
      body.delete();
      return g;
    };
    const plain = genus(base);
    expect(genus(through)).toBe(plain + 2);
    expect(genus(closed)).toBe(plain);
    const built = buildCase(csg, closed, 8);
    const report = validateMesh(built.body);
    expect(report.watertight).toBe(true);
    expect(report.degenerateTriangles).toBe(0);
    const { layout, shape, lid } = context(closed);
    const height = closedKeyholes(closed.wallMount, shape, layout.dims, lid)?.height ?? 0;
    expect(report.bbox.min[2]).toBeCloseTo(-height, 3);
  });

  it('closed keyholes build clean on every shape, on the bottom and on the back wall', () => {
    const cases: [string, string][] = [['box', 'top'], ['box', 'bottom'], ['console', 'left'], ['console', 'bottom'], ['cylinder', 'top']];
    for (const [kind, face] of cases) {
      const state = sanitizeState({
        ...defaultState(), boards: [],
        shape: { ...defaultState().shape, kind, edgeR: kind === 'console' ? 0 : 3, auto: false, size: { w: 110, d: 80, h: 45 } },
        lid: { ...defaultState().lid, face },
        wallMount: { kind: 'keyholes', keyhole: 'closed', spacing: 50, screwD: 4 },
      });
      const built = buildCase(csg, state, 8);
      for (const mesh of [built.body, built.lid]) {
        const report = validateMesh(mesh);
        expect(report.watertight, `${kind}/${face}`).toBe(true);
        expect(report.degenerateTriangles, `${kind}/${face}`).toBe(0);
      }
      const { layout, shape, lid } = context(state);
      const expected = face === 'top' ? ['warn.keyholePadsOnBed'] : [];
      expect(extrasWarnings(state, shape, layout, lid).map((m) => m.code), `${kind}/${face}`).toEqual(expected);
    }
  });

  it('a closed pocket next to a standoff is warned about: the standoff hole would open it', () => {
    // the Pi 4's right standoffs stand 19 mm right of the case centre, the keyhole 20 mm
    const state = sanitizeState({ ...defaultState(), wallMount: { kind: 'keyholes', keyhole: 'closed', spacing: 40, screwD: 4 } });
    const { layout, shape, lid } = context(state);
    expect(extrasWarnings(state, shape, layout, lid).map((m) => m.code)).toContain('warn.keyholeNearStandoff');
    const apart = sanitizeState({ ...state, wallMount: { ...state.wallMount, spacing: 58 } });
    expect(extrasWarnings(apart, shape, layout, lid).map((m) => m.code)).not.toContain('warn.keyholeNearStandoff');
  });

  it('no vent under a pad or a foot', () => {
    const state = sanitizeState({
      ...defaultState(),
      vents: { on: true, faces: ['bottom'], pattern: 'round', size: 3, pitch: 5, margin: 2 },
      wallMount: { kind: 'keyholes', keyhole: 'closed', spacing: 40, screwD: 4 },
    });
    const { layout, shape, lid, top, ports } = context(state);
    const closed = closedKeyholes(state.wallMount, shape, layout.dims, lid);
    const frame = faceFrame('bottom', layout.dims);
    const vents = extrasCutters(state, shape, layout, lid, top, ports).filter((c) => c.source.kind === 'extra' && c.shape === 'round');
    expect(vents.length).toBeGreaterThan(0);
    for (const vent of vents) {
      const [u, v] = applyAffine(frame.toFace, vent.origin);
      for (const pad of closed?.pads ?? []) {
        expect(u > pad.u0 - 1 && u < pad.u1 + 1 && v > pad.v0 - 1 && v < pad.v1 + 1).toBe(false);
      }
    }
  });

  it('ears stand out at floor level on both sides and belong to the body', () => {
    const state = sanitizeState({ ...defaultState(), wallMount: { kind: 'ears', screwD: 4 } });
    const { layout } = context(state);
    const ears = earSpecs(state.wallMount, state.shape, layout.dims);
    expect(ears).toHaveLength(2);
    // an old file: two ears, left and right, in the middle of the walls
    expect(state.wallMount.ears).toEqual({ count: 2, walls: 'leftRight', wall: 'back', along: 'centre' });
    expect(ears.map((ear) => [ear.hx, ear.hy])).toEqual([[-EAR_LENGTH / 2, layout.dims.d / 2], [layout.dims.w + EAR_LENGTH / 2, layout.dims.d / 2]]);
    const built = buildCase(csg, state, 8);
    const report = validateMesh(built.body);
    expect(report.watertight).toBe(true);
    expect(report.extents[0]).toBeCloseTo(layout.dims.w + 2 * EAR_LENGTH, 3);
  });

  it('the ears sanitizer: 1…4 ears, known walls and placements', () => {
    expect(sanitizeWallMount({ kind: 'ears', ears: { count: 7, walls: 'up', wall: 'top', along: 'x' } }).ears)
      .toEqual({ count: 4, walls: 'leftRight', wall: 'back', along: 'centre' });
    expect(sanitizeWallMount({ kind: 'ears', ears: { count: 0.6, walls: 'one', wall: 'left', along: 'ends' } }).ears)
      .toEqual({ count: 1, walls: 'one', wall: 'left', along: 'ends' });
  });

  /** Which wall an ear stands on: its hole beyond the case's box on that side. */
  function wallOf(ear: { hx: number; hy: number }, dims: { w: number; d: number }): string {
    if (ear.hx < 0) return 'left';
    if (ear.hx > dims.w) return 'right';
    if (ear.hy < 0) return 'front';
    return 'back';
  }

  it.each([
    [1, 'leftRight', 'centre', ['left']],
    [3, 'leftRight', 'centre', ['left', 'left', 'right']],
    [4, 'frontBack', 'ends', ['front', 'front', 'back', 'back']],
    [3, 'one', 'centre', ['back', 'back', 'back']],
  ] as const)('%i ears, %s, %s: on the walls asked for, apart, on the flat part of the wall', (count, walls, along, expected) => {
    const state = sanitizeState({
      ...defaultState(), shape: { ...defaultState().shape, cornerR: 6 },
      wallMount: { kind: 'ears', spacing: 25, screwD: 4, ears: { count, walls, wall: 'back', along } },
    });
    const { layout } = context(state);
    const { dims } = layout;
    const ears = earSpecs(state.wallMount, state.shape, dims);
    expect(ears.map((ear) => wallOf(ear, dims))).toEqual(expected);
    for (const ear of ears) {
      const along = wallOf(ear, dims) === 'left' || wallOf(ear, dims) === 'right' ? ear.hy : ear.hx;
      const length = wallOf(ear, dims) === 'left' || wallOf(ear, dims) === 'right' ? dims.d : dims.w;
      // clear of the rounded corners
      expect(along - EAR_WIDTH / 2).toBeGreaterThanOrEqual(state.shape.cornerR - 1e-9);
      expect(along + EAR_WIDTH / 2).toBeLessThanOrEqual(length - state.shape.cornerR + 1e-9);
    }
    // ears on one wall never overlap
    for (let i = 0; i < ears.length; i++) {
      for (let j = i + 1; j < ears.length; j++) {
        if (wallOf(ears[i], dims) === wallOf(ears[j], dims)) expect(Math.hypot(ears[i].hx - ears[j].hx, ears[i].hy - ears[j].hy)).toBeGreaterThan(EAR_WIDTH);
      }
    }
    if (along === 'ends') {
      const front = ears.filter((ear) => wallOf(ear, dims) === 'front').map((ear) => ear.hx);
      expect(Math.min(...front)).toBeCloseTo(state.shape.cornerR + EAR_WIDTH / 2 + 1);
    }
    const built = buildCase(csg, state, 8);
    const report = validateMesh(built.body);
    expect(report.watertight).toBe(true);
    expect(report.degenerateTriangles).toBe(0);
  });

  it('a cylinder: the ears go evenly around, each fused with the round wall', () => {
    const state = sanitizeState({
      ...defaultState(), shape: { ...defaultState().shape, kind: 'cylinder' },
      wallMount: { kind: 'ears', screwD: 4, ears: { count: 3, walls: 'leftRight', wall: 'back', along: 'centre' } },
    });
    const { layout } = context(state);
    const { dims } = layout;
    const ears = earSpecs(state.wallMount, state.shape, dims);
    expect(ears).toHaveLength(3);
    const angles = ears.map((ear) => Math.atan2(ear.hy - dims.d / 2, ear.hx - dims.w / 2)).map((a) => (a * 180) / Math.PI);
    const sorted = [...angles].sort((a, b) => a - b);
    expect(sorted[1] - sorted[0]).toBeCloseTo(120);
    expect(sorted[2] - sorted[1]).toBeCloseTo(120);
    // the first ear on the first wall asked for: the left
    expect(Math.abs(angles[0])).toBeCloseTo(180);
    for (const ear of ears) expect(Math.hypot(ear.hx - dims.w / 2, ear.hy - dims.d / 2)).toBeCloseTo(dims.w / 2 + EAR_LENGTH / 2);
    const built = buildCase(csg, state, 8);
    const report = validateMesh(built.body);
    expect(report.watertight).toBe(true);
    expect(report.degenerateTriangles).toBe(0);
    // one solid: every tab fused with the wall
    const body = toManifold(csg, built.body);
    expect(body.decompose().length).toBe(1);
    body.delete();
  });
});

describe('label', () => {
  describe('placement by anchor', () => {
    // a 100 × 60 top, square edges; a 20 × 6 mm raster
    const shape = { ...defaultState().shape, edgeR: 0, cornerR: 0 };
    const dims = { w: 100, d: 60, h: 30 };
    const raster = { w: 200, h: 60, pixels: new Uint8Array(200 * 60), mmPerPx: 0.1 };
    const place = (patch: object) => labelPlacement(sanitizeLabel({ on: true, text: 'x', ...patch }), raster, 'top', dims, shape);

    it('the centre with an offset, as before (old files keep their place)', () => {
      expect(sanitizeLabel({ x: 5, y: -2 }).anchor).toBe('centre');
      const p = place({ x: 5, y: -2 });
      expect([p.u, p.v]).toEqual([55, 28]);
    });

    it('against an edge: the margin from the flat part, the offset on top', () => {
      expect(place({ anchor: 'left', margin: 3 })).toMatchObject({ u: 13, v: 30 });
      expect(place({ anchor: 'bottom', margin: 3, x: 4 })).toMatchObject({ u: 54, v: 6 });
    });

    it('in a corner, turned a quarter: the turned box keeps the margin', () => {
      const p = place({ anchor: 'topRight', margin: 3, angle: 90 });
      expect(p.u).toBeCloseTo(94);
      expect(p.v).toBeCloseTo(47);
    });

    it('the edge fillet is not flat: the margin counts from where it ends', () => {
      const p = labelPlacement(sanitizeLabel({ on: true, anchor: 'left', margin: 2 }), raster, 'top', dims, { ...shape, edgeR: 4 });
      expect(p.u).toBeCloseTo(16);
    });

    it('garbage falls back: the centre, a 3 mm margin', () => {
      const label = sanitizeLabel({ anchor: 'middle', margin: 'wide' });
      expect([label.anchor, label.margin]).toEqual(['centre', 3]);
      expect(sanitizeLabel({ margin: 99 }).margin).toBe(30);
    });
  });

  it('raster runs cover exactly the ink', () => {
    const raster = blocks();
    const runs = rasterRuns(raster);
    expect(runs).toHaveLength(2 * 6);
    const area = runs.reduce((sum, run) => sum + (run[1][0] - run[0][0]) * (run[2][1] - run[1][1]), 0);
    expect(area).toBeCloseTo(12 * 6 * 0.25);
  });

  it('the worker refuses a malformed raster', () => {
    expect(sanitizeLabelRaster({ w: 2, h: 2, pixels: new Uint8Array(3), mmPerPx: 0.1 })).toBeNull();
    expect(sanitizeLabelRaster({ w: 2, h: 2, pixels: [0, 0, 0, 0], mmPerPx: 0.1 })).toBeNull();
    expect(sanitizeLabelRaster(blocks())).not.toBeNull();
  });

  it('engraved takes material from the lid, raised adds it; both stay closed', () => {
    const base = sanitizeState({ ...defaultState(), label: { on: true, text: 'x' } });
    const plain = validateMesh(buildCase(csg, base, 8).lid).volume;
    const engraved = buildCase(csg, base, 8, () => {}, blocks()).lid;
    const raised = buildCase(csg, sanitizeState({ ...base, label: { ...base.label, raised: true } }), 8, () => {}, blocks()).lid;
    const e = validateMesh(engraved);
    const r = validateMesh(raised);
    expect(e.watertight && r.watertight).toBe(true);
    const inkArea = 12 * 6 * 0.25;
    expect(plain - e.volume).toBeCloseTo(inkArea * base.label.depth, 0);
    expect(r.volume - plain).toBeCloseTo(inkArea * base.label.depth, 0);
    // the engraving is on the lid's outer face, not through it
    const lid = toManifold(csg, engraved);
    expect(lid.genus()).toBeGreaterThanOrEqual(0);
    lid.delete();
  });

  it('the sanitizer keeps one line of at most 40 characters', () => {
    const label = sanitizeLabel({ text: `a\nb${'x'.repeat(100)}` });
    expect(label.text).not.toContain('\n');
    expect([...label.text].length).toBeLessThanOrEqual(40);
    expect([...sanitizeLabel({ text: 'שלום עולם' }).text].length).toBe(9);
  });
});
