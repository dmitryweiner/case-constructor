// Extras: vents thin out where they must, the fan seat and keyholes are
// where they are asked to be, ears and the label change the right part.

import { initCSG, toManifold } from '../src/geo/csg';
import type { CsgApi } from '../src/geo/csg';
import { buildCase } from '../src/geo/build';
import { caseLayout, effectiveLid, standoffColumns } from '../src/geo/layout';
import { portCutters, outerTopAt } from '../src/geo/ports';
import {
  EAR_LENGTH, EAR_WIDTH, FAN_SCREWS, closedKeyholes, earSpecs, extrasCutters, extrasWarnings, fanCuts, flatRegion, keyholeCuts, mountFace, mountFaces,
  earChoice, earSideFaces, earWallChoices, earWalls,
  LABELS_MAX, labelFaces, sanitizeLabel, sanitizeLabels, sanitizeVents, sanitizeWallMount, ventCuts,
} from '../src/geo/extras';
import { faceFrame } from '../src/geo/face';
import { applyAffine } from '../src/geo/surface';
import type { LabelRaster } from '../src/geo/label';
import { labelPlacement, labelSurface, labelWarnings, rasterRuns, sanitizeLabelRaster } from '../src/geo/label';
import { extraCutters } from '../src/geo/cutters';
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

  it('keyholes go through the face against the wall, the bottom by default', () => {
    const state = sanitizeState({ ...defaultState(), boards: [], wallMount: { kind: 'keyholes', spacing: 40, screwD: 4 } });
    const { layout, shape } = context(state);
    expect(state.wallMount.face).toBe('bottom');
    const cuts = keyholeCuts(state.wallMount, shape, layout.dims);
    expect(cuts).toHaveLength(4);
    expect(cuts.every((cut) => cut.face === 'bottom')).toBe(true);
    expect(Math.abs(cuts[0].x - cuts[2].x)).toBeCloseTo(40);
    const left = keyholeCuts({ ...state.wallMount, face: 'left' }, shape, layout.dims);
    expect(left.every((cut) => cut.face === 'left')).toBe(true);
  });

  it('every face but the console\'s slope can hang on the wall; a stale choice builds on the bottom', () => {
    expect(mountFaces('box')).toHaveLength(6);
    expect(mountFaces('cylinder')).toHaveLength(6);
    expect(mountFaces('console')).not.toContain('top');
    const mount = { ...sanitizeWallMount({ kind: 'keyholes' }), face: 'top' as const };
    expect(mountFace(mount, 'box')).toBe('top');
    expect(mountFace(mount, 'console')).toBe('bottom');
  });

  it('an old file with the floor as the lid hangs by its back, as it was built; a new one keeps its face', () => {
    const lid = { ...defaultState().lid, face: 'bottom' };
    const old = sanitizeState({ ...defaultState(), lid, wallMount: { kind: 'keyholes', spacing: 40, screwD: 4 } });
    expect(old.wallMount.face).toBe('back');
    expect(sanitizeState(old).wallMount.face).toBe('back');
    const chosen = sanitizeState({ ...defaultState(), lid, wallMount: { kind: 'keyholes', face: 'bottom' } });
    expect(chosen.wallMount.face).toBe('bottom');
    expect(sanitizeState({ ...defaultState(), wallMount: { kind: 'keyholes' } }).wallMount.face).toBe('bottom');
    expect(sanitizeWallMount({ face: 'sideways' }).face).toBe('bottom');
  });

  it('keyholes on every face of every shape stay on that face\'s flat part, their slots up', () => {
    for (const kind of ['box', 'console', 'cylinder'] as const) {
      const state = sanitizeState({
        ...defaultState(), boards: [],
        shape: { ...defaultState().shape, kind, edgeR: 2, cornerR: 4, auto: false, size: { w: 120, d: 90, h: 50 } },
        wallMount: { kind: 'keyholes', spacing: 40, screwD: 4 },
      });
      const { layout, shape } = context(state);
      for (const face of mountFaces(kind)) {
        const cuts = keyholeCuts({ ...state.wallMount, face }, shape, layout.dims);
        const flat = flatRegion(shape, layout.dims, face, 0);
        for (const cut of cuts) {
          expect(cut.face).toBe(face);
          expect(cut.x - cut.w / 2, `${kind}/${face}`).toBeGreaterThanOrEqual(flat.u0);
          expect(cut.x + cut.w / 2, `${kind}/${face}`).toBeLessThanOrEqual(flat.u1);
          expect(cut.y - cut.h / 2, `${kind}/${face}`).toBeGreaterThanOrEqual(flat.v0);
          expect(cut.y + cut.h / 2, `${kind}/${face}`).toBeLessThanOrEqual(flat.v1);
        }
        // on a wall v is up: the slot above its head hole
        const [head, slot] = cuts;
        expect(slot.y, `${kind}/${face}`).toBeGreaterThan(head.y);
        if (face !== 'top' && face !== 'bottom') {
          const frame = faceFrame(face, layout.dims);
          expect(applyAffine(frame.fromFace, [slot.x, slot.y, 0])[2]).toBeGreaterThan(applyAffine(frame.fromFace, [head.x, head.y, 0])[2]);
        }
      }
    }
  });

  it('a mount on the lid is warned about, more sharply on snaps', () => {
    const base = sanitizeState({ ...defaultState(), boards: [], wallMount: { kind: 'keyholes', face: 'top', spacing: 40, screwD: 4 } });
    const codes = (state: AppState): string[] => {
      const { layout, shape, lid } = context(state);
      return extrasWarnings(state, shape, layout, lid).map((m) => m.code);
    };
    expect(codes(base)).toContain('warn.mountOnSnaps');
    expect(codes(sanitizeState({ ...base, lid: { ...base.lid, fastening: 'screws' } }))).toContain('warn.mountOnLid');
    expect(codes(sanitizeState({ ...base, wallMount: { ...base.wallMount, kind: 'ears' } }))).toContain('warn.mountOnSnaps');
    expect(codes(sanitizeState({ ...base, wallMount: { ...base.wallMount, face: 'bottom' } }))).not.toContain('warn.mountOnSnaps');
  });

  it('a keyhole is through by default; old files load as through', () => {
    expect(sanitizeWallMount({ kind: 'keyholes', spacing: 40, screwD: 4 }).keyhole).toBe('through');
    expect(sanitizeWallMount({ kind: 'keyholes', keyhole: 'closed' }).keyhole).toBe('closed');
    expect(sanitizeWallMount({ kind: 'keyholes', keyhole: 'sideways' }).keyhole).toBe('through');
  });

  it('closed keyholes on the bottom: two pads and two mirrored feet of one height', () => {
    const state = sanitizeState({ ...defaultState(), wallMount: { kind: 'keyholes', keyhole: 'closed', spacing: 40, screwD: 4 } });
    const { layout, shape, lid } = context(state);
    const closed = closedKeyholes(state.wallMount, shape, layout.dims);
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
    const { layout, shape } = context(state);
    const closed = closedKeyholes(state.wallMount, shape, layout.dims);
    expect(closed?.pads).toHaveLength(2);
    expect(closed?.pads.every((pad) => pad.keyhole)).toBe(true);
  });

  it('with the floor as the lid, closed keyholes stand out of the back wall, no feet', () => {
    const state = sanitizeState({
      ...defaultState(), lid: { ...defaultState().lid, face: 'bottom' },
      wallMount: { kind: 'keyholes', keyhole: 'closed', spacing: 40, screwD: 4 },
    });
    const { layout, shape } = context(state);
    const closed = closedKeyholes(state.wallMount, shape, layout.dims);
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
    const { layout, shape } = context(closed);
    const height = closedKeyholes(closed.wallMount, shape, layout.dims)?.height ?? 0;
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

  it('closed keyholes build clean on a chosen face: a wall, the lid, a cylinder\'s top', () => {
    const cases: [string, string, string, string[]][] = [
      ['box', 'top', 'back', []], ['box', 'top', 'left', []], ['box', 'top', 'top', ['warn.mountOnSnaps']],
      ['box', 'bottom', 'top', ['warn.keyholePadsOnBed']], ['console', 'bottom', 'front', []],
      ['cylinder', 'top', 'top', ['warn.mountOnSnaps']], ['cylinder', 'bottom', 'back', ['warn.keyholeClosedRound']],
    ];
    for (const [kind, lidFace, face, expected] of cases) {
      const state = sanitizeState({
        ...defaultState(), boards: [],
        shape: { ...defaultState().shape, kind, edgeR: kind === 'console' ? 0 : 3, auto: false, size: { w: 110, d: 80, h: 45 } },
        lid: { ...defaultState().lid, face: lidFace },
        wallMount: { kind: 'keyholes', keyhole: 'closed', face, spacing: 50, screwD: 4 },
      });
      const built = buildCase(csg, state, 8);
      for (const mesh of [built.body, built.lid]) {
        const report = validateMesh(mesh);
        expect(report.watertight, `${kind}/${lidFace}/${face}`).toBe(true);
        expect(report.degenerateTriangles, `${kind}/${lidFace}/${face}`).toBe(0);
      }
      const { layout, shape, lid } = context(state);
      expect(extrasWarnings(state, shape, layout, lid).map((m) => m.code), `${kind}/${lidFace}/${face}`).toEqual(expected);
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
    const closed = closedKeyholes(state.wallMount, shape, layout.dims);
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
    const { layout, shape, lid } = context(state);
    const ears = earSpecs(state.wallMount, shape, layout.dims, lid);
    expect(ears).toHaveLength(2);
    // an old file: two ears, left and right, in the middle of the walls
    expect(state.wallMount.ears).toEqual({ count: 2, walls: 'leftRight', wall: 'back', along: 'centre' });
    expect(ears.map((ear) => [ear.hole[0], ear.hole[1]])).toEqual([[-EAR_LENGTH / 2, layout.dims.d / 2], [layout.dims.w + EAR_LENGTH / 2, layout.dims.d / 2]]);
    const built = buildCase(csg, state, 8);
    const report = validateMesh(built.body);
    expect(report.watertight).toBe(true);
    expect(report.extents[0]).toBeCloseTo(layout.dims.w + 2 * EAR_LENGTH, 3);
  });

  it('the ears sanitizer: 1…4 ears, known walls and placements', () => {
    expect(sanitizeWallMount({ kind: 'ears', ears: { count: 7, walls: 'up', wall: 'roof', along: 'x' } }).ears)
      .toEqual({ count: 4, walls: 'leftRight', wall: 'back', along: 'centre' });
    expect(sanitizeWallMount({ kind: 'ears', ears: { count: 0.6, walls: 'one', wall: 'left', along: 'ends' } }).ears)
      .toEqual({ count: 1, walls: 'one', wall: 'left', along: 'ends' });
  });

  /** Which wall an ear stands on: its hole beyond the case's box on that side. */
  function wallOf(ear: { hole: readonly number[] }, dims: { w: number; d: number }): string {
    if (ear.hole[0] < 0) return 'left';
    if (ear.hole[0] > dims.w) return 'right';
    if (ear.hole[1] < 0) return 'front';
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
    const { layout, shape, lid } = context(state);
    const { dims } = layout;
    const ears = earSpecs(state.wallMount, shape, dims, lid);
    expect(ears.map((ear) => wallOf(ear, dims))).toEqual(expected);
    for (const ear of ears) {
      const along = wallOf(ear, dims) === 'left' || wallOf(ear, dims) === 'right' ? ear.hole[1] : ear.hole[0];
      const length = wallOf(ear, dims) === 'left' || wallOf(ear, dims) === 'right' ? dims.d : dims.w;
      // clear of the rounded corners
      expect(along - EAR_WIDTH / 2).toBeGreaterThanOrEqual(state.shape.cornerR - 1e-9);
      expect(along + EAR_WIDTH / 2).toBeLessThanOrEqual(length - state.shape.cornerR + 1e-9);
    }
    // ears on one wall never overlap
    for (let i = 0; i < ears.length; i++) {
      for (let j = i + 1; j < ears.length; j++) {
        if (wallOf(ears[i], dims) === wallOf(ears[j], dims)) expect(Math.hypot(ears[i].hole[0] - ears[j].hole[0], ears[i].hole[1] - ears[j].hole[1])).toBeGreaterThan(EAR_WIDTH);
      }
    }
    if (along === 'ends') {
      const front = ears.filter((ear) => wallOf(ear, dims) === 'front').map((ear) => ear.hole[0]);
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
    const { layout, shape, lid } = context(state);
    const { dims } = layout;
    const ears = earSpecs(state.wallMount, shape, dims, lid);
    expect(ears).toHaveLength(3);
    const angles = ears.map((ear) => Math.atan2(ear.hole[1] - dims.d / 2, ear.hole[0] - dims.w / 2)).map((a) => (a * 180) / Math.PI);
    const sorted = [...angles].sort((a, b) => a - b);
    expect(sorted[1] - sorted[0]).toBeCloseTo(120);
    expect(sorted[2] - sorted[1]).toBeCloseTo(120);
    // the first ear on the first wall asked for: the left
    expect(Math.abs(angles[0])).toBeCloseTo(180);
    for (const ear of ears) expect(Math.hypot(ear.hole[0] - dims.w / 2, ear.hole[1] - dims.d / 2)).toBeCloseTo(dims.w / 2 + EAR_LENGTH / 2);
    const built = buildCase(csg, state, 8);
    const report = validateMesh(built.body);
    expect(report.watertight).toBe(true);
    expect(report.degenerateTriangles).toBe(0);
    // one solid: every tab fused with the wall
    const body = toManifold(csg, built.body);
    expect(body.decompose().length).toBe(1);
    body.delete();
  });

  /** Body and lid together: their box, and both closed and clean. */
  function builtBox(state: AppState, name: string): { min: number[]; max: number[] } {
    const built = buildCase(csg, state, 8);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const mesh of [built.body, built.lid]) {
      const report = validateMesh(mesh);
      expect(report.watertight, name).toBe(true);
      expect(report.degenerateTriangles, name).toBe(0);
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], report.bbox.min[k]);
        max[k] = Math.max(max[k], report.bbox.max[k]);
      }
    }
    return { min, max };
  }

  it('ears on every face of a box, every wall choice: out of their walls, flush with the face, clean', () => {
    const base = sanitizeState({
      ...defaultState(), boards: [], shape: { ...defaultState().shape, cornerR: 5, edgeR: 2, auto: false, size: { w: 110, d: 80, h: 60 } },
      lid: { ...defaultState().lid, fastening: 'screws' },
    });
    const axisOf: Record<string, [number, number]> = { left: [0, -1], right: [0, 1], front: [1, -1], back: [1, 1], bottom: [2, -1], top: [2, 1] };
    for (const face of mountFaces('box', 'ears')) {
      for (const walls of earWallChoices(face, 'box')) {
        const state = sanitizeState({ ...base, wallMount: { kind: 'ears', face, screwD: 4, ears: { count: 2, walls, wall: 'top', along: 'centre' } } });
        const name = `${face}/${walls}`;
        const { layout, shape, lid } = context(state);
        const { dims } = layout;
        const size = [dims.w, dims.d, dims.h];
        const box = builtBox(state, name);
        // out of each wall by an ear's length
        for (const side of earWalls(state.wallMount, 'box')) {
          const [k, sign] = axisOf[side];
          if (sign < 0) expect(box.min[k], `${name}: ${side}`).toBeCloseTo(-EAR_LENGTH, 3);
          else expect(box.max[k], `${name}: ${side}`).toBeCloseTo(size[k] + EAR_LENGTH, 3);
        }
        // nothing past the face against the wall
        const [k, sign] = axisOf[face];
        if (sign < 0) expect(box.min[k], name).toBeCloseTo(0, 3);
        else expect(box.max[k], name).toBeCloseTo(size[k], 3);
        // each ear in that face's plate
        for (const ear of earSpecs(state.wallMount, shape, dims, lid)) {
          expect(ear.face).toBe(face);
          expect(ear.hole[k]).toBeCloseTo(sign < 0 ? 0 : size[k]);
        }
      }
    }
  });

  it('a stale wall choice builds on the first pair the face offers', () => {
    const state = sanitizeState({ ...defaultState(), wallMount: { kind: 'ears', face: 'back', ears: { count: 2, walls: 'frontBack' } } });
    expect(earChoice(state.wallMount, 'box')).toBe('leftRight');
    expect(earWalls(state.wallMount, 'box')).toEqual(['left', 'right']);
    expect(earWalls({ ...state.wallMount, ears: { ...state.wallMount.ears, walls: 'one', wall: 'front' } }, 'box')).toEqual(['left']);
    expect(earSideFaces('left', 'console')).toEqual(['front', 'back', 'bottom']);
    expect(mountFaces('cylinder', 'ears')).toEqual(['top', 'bottom']);
  });

  it('an ear hanging in the print pose gets a 45° gusset on its lower side', () => {
    // the back against the wall, the lid on top: the body prints on its bottom, the ears on the side walls stand upright
    const state = sanitizeState({ ...defaultState(), boards: [], wallMount: { kind: 'ears', face: 'back', screwD: 4 } });
    const { layout, shape, lid } = context(state);
    const ears = earSpecs(state.wallMount, shape, layout.dims, lid);
    expect(ears).toHaveLength(2);
    for (const ear of ears) {
      const vs = ear.outline.map((p) => p[1]);
      // on the back face v is up: the gusset reaches an ear's length below the tab
      expect(Math.min(...vs)).toBeCloseTo(ear.hv - EAR_WIDTH / 2 - EAR_LENGTH);
      expect(Math.max(...vs)).toBeCloseTo(ear.hv + EAR_WIDTH / 2);
      expect(ear.onLid).toBe(false);
      expect(ear.onBed).toBe(false);
    }
    // on the bottom (the bed) no gusset
    const flat = sanitizeState({ ...state, wallMount: { ...state.wallMount, face: 'bottom' } });
    for (const ear of earSpecs(flat.wallMount, shape, layout.dims, lid)) expect(ear.outline).toHaveLength(4);
  });

  it('ears below the bed, on the lid, crowded off the body: each is warned about', () => {
    const codes = (state: AppState): string[] => {
      const { layout, shape, lid } = context(state);
      return extrasWarnings(state, shape, layout, lid).map((m) => m.code);
    };
    const base = sanitizeState({
      ...defaultState(), boards: [], shape: { ...defaultState().shape, auto: false, size: { w: 100, d: 70, h: 40 } },
      lid: { ...defaultState().lid, fastening: 'screws' },
    });
    // the lid on the left: the left ear's root is in the lid's wall, and the body prints on its right wall, the right ear under it
    expect(codes(sanitizeState({ ...base, lid: { ...base.lid, face: 'left' }, wallMount: { kind: 'ears' } }))).toEqual(['warn.mountOnLid', 'warn.earOnBed']);
    // the back against the wall, ears on the top and bottom: the top one is the lid's
    const topBottom = sanitizeState({ ...base, wallMount: { kind: 'ears', face: 'back', ears: { count: 2, walls: 'topBottom' } } });
    expect(codes(topBottom)).toContain('warn.mountOnLid');
    expect(codes(topBottom)).toContain('warn.earOnBed');
    // a deep lid leaves the side walls no room for an ear under it
    const deep = sanitizeState({
      ...base, shape: { ...base.shape, auto: false, size: { w: 100, d: 70, h: 24 } }, lid: { ...base.lid, depth: 14 },
      wallMount: { kind: 'ears', face: 'back' },
    });
    expect(codes(deep)).toContain('warn.earsOnParting');
    expect(codes(sanitizeState({ ...base, wallMount: { kind: 'ears', face: 'back' } }))).toEqual([]);
  });

  it('a cylinder hung by its top: the ears go around the top, flush with it', () => {
    const state = sanitizeState({
      ...defaultState(), boards: [], shape: { ...defaultState().shape, kind: 'cylinder' }, lid: { ...defaultState().lid, face: 'bottom', fastening: 'screws' },
      wallMount: { kind: 'ears', face: 'top', screwD: 4, ears: { count: 3, walls: 'leftRight', wall: 'back', along: 'centre' } },
    });
    const { layout, shape, lid } = context(state);
    const ears = earSpecs(state.wallMount, shape, layout.dims, lid);
    expect(ears).toHaveLength(3);
    for (const ear of ears) {
      expect(ear.hole[2]).toBeCloseTo(layout.dims.h);
      expect(ear.onLid).toBe(false);
    }
    const box = builtBox(state, 'cylinder/top');
    expect(box.max[2]).toBeCloseTo(layout.dims.h, 3);
  });

});

describe('label', () => {
  describe('placement by anchor', () => {
    // a 100 × 60 top, square edges; a 20 × 6 mm raster
    const shape = { ...defaultState().shape, edgeR: 0, cornerR: 0 };
    const dims = { w: 100, d: 60, h: 30 };
    const raster = { w: 200, h: 60, pixels: new Uint8Array(200 * 60), mmPerPx: 0.1 };
    const place = (patch: object) => labelPlacement(sanitizeLabel({ text: 'x', ...patch }), raster, labelSurface('top', shape, dims));

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
      const p = labelPlacement(sanitizeLabel({ anchor: 'left', margin: 2 }), raster, labelSurface('top', { ...shape, edgeR: 4 }, dims));
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
    const base = sanitizeState({ ...defaultState(), labels: [{ text: 'x' }] });
    const plain = validateMesh(buildCase(csg, base, 8).lid).volume;
    const engraved = buildCase(csg, base, 8, () => {}, [blocks()]).lid;
    const raised = buildCase(csg, sanitizeState({ ...base, labels: [{ ...base.labels[0], raised: true }] }), 8, () => {}, [blocks()]).lid;
    const e = validateMesh(engraved);
    const r = validateMesh(raised);
    expect(e.watertight && r.watertight).toBe(true);
    const inkArea = 12 * 6 * 0.25;
    expect(plain - e.volume).toBeCloseTo(inkArea * base.labels[0].depth, 0);
    expect(r.volume - plain).toBeCloseTo(inkArea * base.labels[0].depth, 0);
    // the engraving is on the lid's outer face, not through it
    const lid = toManifold(csg, engraved);
    expect(lid.genus()).toBeGreaterThanOrEqual(0);
    lid.delete();
  });

  it('an old file\'s one label becomes a list of one on its lid; an off one, none', () => {
    const lid = { ...defaultState().lid, face: 'left' };
    // a file from before the list: no `labels`
    const before = Object.fromEntries(Object.entries(defaultState()).filter(([key]) => key !== 'labels'));
    const old = sanitizeState({ ...before, lid, label: { on: true, text: 'Hi', raised: true } });
    expect(old.labels).toHaveLength(1);
    expect(old.labels[0]).toMatchObject({ face: 'left', text: 'Hi', raised: true });
    expect(sanitizeState(old)).toEqual(old);
    expect(sanitizeState({ ...before, label: { on: false, text: 'Hi' } }).labels).toEqual([]);
    // the list wins over an old label, and holds at most LABELS_MAX
    expect(sanitizeState({ ...defaultState(), labels: [], label: { on: true, text: 'Hi' } }).labels).toEqual([]);
    expect(sanitizeState({ ...defaultState(), labels: Array.from({ length: 12 }, () => ({ text: 'x' })) }).labels).toHaveLength(LABELS_MAX);
    expect(sanitizeLabels('garbage', 5, 'top')).toEqual([]);
    expect(sanitizeLabel({ face: 'roof' }, 'back').face).toBe('back');
  });

  it('labels on every face of every shape: placed on that face\'s flat part, built clean on both parts', () => {
    for (const kind of ['box', 'console', 'cylinder'] as const) {
      const base = sanitizeState({
        ...defaultState(), boards: [],
        shape: { ...defaultState().shape, kind, edgeR: kind === 'console' ? 0 : 2, auto: false, size: { w: 110, d: 80, h: 50 } },
        lid: { ...defaultState().lid, face: 'bottom' },
      });
      const faces = labelFaces(kind);
      const state = sanitizeState({ ...base, labels: faces.map((face, i) => ({ face, text: 'x', raised: i % 2 === 0 })) });
      const { layout, shape, lid } = context(state);
      const rasters = faces.map(() => blocks());
      for (const label of state.labels) {
        const surface = labelSurface(label.face, shape, layout.dims);
        const p = labelPlacement(label, blocks(), surface);
        const flat = surface.flat(0);
        expect(p.u, `${kind}/${label.face}`).toBeGreaterThan(flat.u0);
        expect(p.u, `${kind}/${label.face}`).toBeLessThan(flat.u1);
        expect(p.v, `${kind}/${label.face}`).toBeGreaterThan(flat.v0);
        expect(p.v, `${kind}/${label.face}`).toBeLessThan(flat.v1);
        // the face's centre is on the case's outer surface
        const centre = applyAffine(surface.fromFace, [surface.extent.w / 2, surface.extent.h / 2, 0]);
        const inside = [centre[0] / layout.dims.w, centre[1] / layout.dims.d, centre[2] / layout.dims.h];
        expect(inside.every((x) => x > -1e-6 && x < 1 + 1e-6), `${kind}/${label.face}`).toBe(true);
      }
      const built = buildCase(csg, state, 8, () => {}, rasters);
      for (const mesh of [built.body, built.lid]) {
        const report = validateMesh(mesh);
        expect(report.watertight, kind).toBe(true);
        expect(report.degenerateTriangles, kind).toBe(0);
      }
      const plain = buildCase(csg, state, 8);
      expect(validateMesh(built.body).volume, kind).not.toBeCloseTo(validateMesh(plain.body).volume, 1);
      // nothing but the labels' own warnings about the lid's bed
      const codes = labelWarnings(state.labels, rasters, shape, layout.dims, lid, [], []).map((m) => m.code);
      expect(codes.filter((code) => code !== 'warn.labelOnBed'), kind).toEqual([]);
    }
  });

  it('a raised label across the parting: each part takes its piece, apart, and the panel says so', () => {
    // a 10 mm deep top lid: the front wall's top 12 mm are the lid's
    const state = sanitizeState({
      ...defaultState(), boards: [], shape: { ...defaultState().shape, auto: false, size: { w: 100, d: 70, h: 40 } },
      lid: { ...defaultState().lid, depth: 10 },
      labels: [{ face: 'front', text: 'x', raised: true, anchor: 'top', margin: 9 }],
    });
    const raster: LabelRaster = { w: 40, h: 40, pixels: new Uint8Array(40 * 40).fill(255), mmPerPx: 0.25 };
    const built = buildCase(csg, state, 8, () => {}, [raster]);
    const plain = buildCase(csg, state, 8);
    const grown = (part: 'body' | 'lid'): number => validateMesh(built[part]).volume - validateMesh(plain[part]).volume;
    expect(grown('body')).toBeGreaterThan(1);
    expect(grown('lid')).toBeGreaterThan(1);
    for (const mesh of [built.body, built.lid]) expect(validateMesh(mesh).degenerateTriangles).toBe(0);
    const { layout, shape, lid } = context(state);
    expect(labelWarnings(state.labels, [raster], shape, layout.dims, lid, [], []).map((m) => m.code)).toEqual(['warn.labelOnParting']);
  });

  it('the labels\' warnings: too big, over an opening, raised on the bed, two over each other', () => {
    const state = sanitizeState({
      ...defaultState(), boards: [], shape: { ...defaultState().shape, auto: false, size: { w: 100, d: 70, h: 40 } },
      labels: [{ face: 'top', text: 'a', raised: true }, { face: 'top', text: 'b', x: 2 }, { face: 'bottom', text: 'c', raised: true }, { face: 'left', text: 'd', sizeMm: 30 }],
    });
    const { layout, shape, lid } = context(state);
    const huge: LabelRaster = { w: 1200, h: 100, pixels: new Uint8Array(1200 * 100).fill(255), mmPerPx: 0.1 };
    const rasters = [blocks(), blocks(), blocks(), huge];
    const vent = extraCutters([{ face: 'top', shape: 'round', x: 50, y: 35, w: 4, h: 4, r: 0 }], shape, layout.dims, () => layout.dims.h);
    const messages = labelWarnings(state.labels, rasters, shape, layout.dims, lid, vent, []);
    const of = (n: number): string[] => messages.filter((m) => m.params?.n === n).map((m) => m.code);
    // the lid prints on its top: a raised label there is the first layer; the body on its bottom, the same
    expect(of(1)).toEqual(['warn.labelOverOpening', 'warn.labelOnBed']);
    expect(of(2)).toEqual(['warn.labelOverOpening']);
    expect(of(3)).toEqual(['warn.labelOnBed']);
    expect(of(4)).toEqual(['warn.labelTooBig']);
    expect(messages.filter((m) => m.code === 'warn.labelsOverlap').map((m) => m.params)).toEqual([{ a: 1, b: 2 }]);
  });

  it('the sanitizer keeps one line of at most 40 characters', () => {
    const label = sanitizeLabel({ text: `a\nb${'x'.repeat(100)}` });
    expect(label.text).not.toContain('\n');
    expect([...label.text].length).toBeLessThanOrEqual(40);
    expect([...sanitizeLabel({ text: 'שלום עולם' }).text].length).toBe(9);
  });
});
