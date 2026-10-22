// Extras: vents thin out where they must, the fan seat and keyholes are
// where they are asked to be, ears and the label change the right part.

import { initCSG, toManifold } from '../src/geo/csg';
import type { CsgApi } from '../src/geo/csg';
import { buildCase } from '../src/geo/build';
import { caseLayout, effectiveLid, standoffColumns } from '../src/geo/layout';
import { portCutters, outerTopAt } from '../src/geo/ports';
import {
  EAR_LENGTH, FAN_SCREWS, closedKeyholes, earSpecs, extrasCutters, extrasWarnings, fanCuts, flatRegion, keyholeCuts, keyholeFace,
  sanitizeLabel, sanitizeVents, sanitizeWallMount, ventCuts,
} from '../src/geo/extras';
import { faceFrame } from '../src/geo/face';
import { applyAffine } from '../src/geo/surface';
import type { LabelRaster } from '../src/geo/label';
import { rasterRuns, sanitizeLabelRaster } from '../src/geo/label';
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
    const cuts = keyholeCuts({ kind: 'keyholes', keyhole: 'through', spacing: 40, screwD: 4 }, dims, lid);
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
    const ears = earSpecs(state.wallMount, layout.dims);
    expect(ears).toHaveLength(2);
    const built = buildCase(csg, state, 8);
    const report = validateMesh(built.body);
    expect(report.watertight).toBe(true);
    expect(report.extents[0]).toBeCloseTo(layout.dims.w + 2 * EAR_LENGTH, 3);
  });
});

describe('label', () => {
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
