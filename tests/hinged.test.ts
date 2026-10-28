// A hinged case (plans/PLAN-HINGED.md): two halves, each an ordinary case
// seen through `halfState`, written back by `withHalf`; the upper half posed
// about the hinge axis.

import { CsgScope, fromManifold, initCSG, toManifold } from '../src/geo/csg';
import type { CsgApi } from '../src/geo/csg';
import type { CaseBuild } from '../src/geo/build';
import type { SurfaceMesh } from '../src/geo/surface';
import { mergeMeshes, transformMesh } from '../src/geo/surface';
import { buildCase } from '../src/geo/build';
import { validateMesh } from '../src/geo/validate';
import { caseDims } from '../src/geo/layout';
import { lidFaces } from '../src/geo/lidSpec';
import { GAP_DEFAULT, MAGNET_SKIN, axleHoles, barrelMin, cableSlot, gapFor, defaultCable, defaultHingeSpec, foldOf, hingeScrews, knuckleRuns, sanitizeHingeSpec, upperPose } from '../src/geo/hinge';
import { applyAffine, rotateVec } from '../src/geo/surface';
import { catalogBoard } from '../src/boards/catalog';
import { defaultPlacement } from '../src/boards/placement';
import { defaultState, sanitizeState, withShapeKind } from '../src/state/schema';
import type { AppState } from '../src/state/schema';
import { casesOf, foldOfState, gapOf, halfHinge, halfState, hingeNotes, innerProtrusion, withHalf } from '../src/state/hinged';

function hinged(patch: Partial<AppState> = {}): AppState {
  return sanitizeState({ ...withShapeKind(defaultState(), 'hinged'), ...patch });
}

function board(id: string) {
  const def = catalogBoard(id);
  if (!def) throw new Error(`no board ${id}`);
  return defaultPlacement(def);
}

describe('a hinged state', () => {
  it('keeps the box\'s contents in the lower half and the upper half for later', () => {
    const box = defaultState();
    const state = sanitizeState(withShapeKind(box, 'hinged'));
    expect(state.boards).toEqual(box.boards);
    expect(state.hinge.b.boards).toEqual([]);
    const withB = { ...state, hinge: { ...state.hinge, b: { ...state.hinge.b, boards: [board('esp32-devkitc-v4')] } } };
    const back = sanitizeState(withShapeKind(sanitizeState(withShapeKind(withB, 'box')), 'hinged'));
    expect(back.hinge.b.boards).toHaveLength(1);
  });

  it('a half\'s lid is on its top or its bottom', () => {
    expect(lidFaces('hinged')).toEqual(['top', 'bottom']);
    const state = sanitizeState({ shape: { kind: 'hinged' }, lid: { face: 'front' }, hinge: { b: { lid: { face: 'left' } } } });
    expect(state.lid.face).toBe('top');
    expect(state.hinge.b.lid.face).toBe('top');
  });

  it('sanitizes garbage in the upper half and is idempotent', () => {
    const state = sanitizeState({ shape: { kind: 'hinged' }, hinge: { gap: -3, b: { h: 'x', boards: 'no', lid: 7 } } });
    expect(state.hinge.gap).toBe(0);
    expect(state.hinge.b.boards).toEqual([]);
    expect(sanitizeState(state)).toEqual(state);
  });
});

describe('halfState', () => {
  it('both halves share the larger footprint and keep their own heights', () => {
    const state = hinged({ hinge: { ...defaultState().hinge, b: { ...defaultState().hinge.b, boards: [board('arduino-mega-2560')] } } });
    const a = caseDims(halfState(state, 'a'));
    const b = caseDims(halfState(state, 'b'));
    const alone = caseDims(sanitizeState({ ...defaultState(), boards: [board('arduino-mega-2560')] }));
    expect(a.w).toBe(b.w);
    expect(a.d).toBe(b.d);
    expect(b.w).toBeCloseTo(Math.max(alone.w, caseDims(defaultState()).w), 6);
    // the Pi below and the Mega above need different heights
    expect(a.h).toBeCloseTo(caseDims(defaultState()).h, 6);
    expect(b.h).toBeCloseTo(alone.h, 6);
  });

  it('a manual size sets the footprint and each half\'s height, never below what the boards need', () => {
    const base = hinged();
    const manual = sanitizeState({
      ...base, shape: { ...base.shape, auto: false, size: { w: 150, d: 100, h: 60 } }, hinge: { ...base.hinge, b: { ...base.hinge.b, h: 22 } },
    });
    expect(caseDims(halfState(manual, 'a'))).toEqual({ w: 150, d: 100, h: 60 });
    expect(caseDims(halfState(manual, 'b'))).toEqual({ w: 150, d: 100, h: 22 });
  });

  it('a half has no wall mount and stays a hinged shape (its lid faces)', () => {
    const base = hinged();
    const state = sanitizeState({ ...base, wallMount: { ...base.wallMount, kind: 'ears' } });
    expect(halfState(state, 'a').wallMount.kind).toBe('none');
    expect(halfState(state, 'b').shape.kind).toBe('hinged');
  });

  it('withHalf writes back what a card did, and nothing else', () => {
    const state = hinged();
    for (const half of ['a', 'b'] as const) {
      expect(withHalf(state, half, halfState(state, half))).toEqual(state);
    }
    const one = halfState(state, 'b');
    const next = withHalf(state, 'b', { ...one, boards: [board('esp32-devkitc-v4')], lid: { ...one.lid, face: 'bottom' } });
    expect(next.hinge.b.boards).toHaveLength(1);
    expect(next.hinge.b.lid.face).toBe('bottom');
    expect(next.boards).toEqual(state.boards);
    expect(next.lid).toEqual(state.lid);
    expect(next.shape).toEqual(state.shape);
  });

  it('a single case is one case', () => {
    expect(casesOf(defaultState())).toEqual([{ half: null, state: defaultState() }]);
    expect(casesOf(hinged()).map((one) => one.half)).toEqual(['a', 'b']);
  });
});

describe('the fold', () => {
  const d = 70;
  const hA = 30;
  const hB = 20;
  const gap = 1;
  const spec = defaultHingeSpec();
  const fold = foldOf(spec, d, hA, hB, gap);
  const e = spec.barrelD / 2 + spec.clearance;

  it('closed, the upper half lies on the lower one upside down, its inner face the gap above', () => {
    const pose = upperPose(fold, 0);
    // the upper half's inner face (its top) over the lower half's top
    for (const [x, y] of [[0, 0], [100, 0], [0, d], [100, d]]) {
      const p = applyAffine(pose, [x, y, hB]);
      expect(p[2]).toBeCloseTo(hA + gap, 9);
      expect(p[0]).toBeCloseTo(x, 9);
    }
    // its hinge edge (front) over the lower half's hinge edge (back), its far edge over the front
    expect(applyAffine(pose, [0, 0, hB])[1]).toBeCloseTo(d, 9);
    expect(applyAffine(pose, [0, d, hB])[1]).toBeCloseTo(0, 9);
    expect(rotateVec(pose, [0, 0, 1])[2]).toBeCloseTo(-1, 9);
    // its outer face on top
    expect(applyAffine(pose, [0, 0, 0])[2]).toBeCloseTo(hA + gap + hB, 9);
  });

  it('open flat, it lies behind with its inner face up, level with the lower one\'s', () => {
    const pose = upperPose(fold, 180);
    expect(rotateVec(pose, [0, 0, 1])[2]).toBeCloseTo(1, 9);
    expect(applyAffine(pose, [0, 0, hB])).toEqual([0, d + 2 * e, hA].map((value) => expect.closeTo(value, 9)));
  });

  it('the axis is behind the hinge walls, in the gap, at any angle', () => {
    for (const angle of [0, 45, 110, 180]) {
      const pose = upperPose(fold, angle);
      const axis = applyAffine(pose, [0, fold.yB, fold.zB]);
      expect(axis[1]).toBeCloseTo(d + e, 9);
      expect(axis[2]).toBeCloseTo(hA + gap / 2, 9);
    }
  });
});

describe('building a hinged case', () => {
  let csg: CsgApi;
  beforeAll(async () => {
    csg = await initCSG();
  });

  it('both halves build watertight, each with its own lid face', () => {
    const base = hinged();
    const state = sanitizeState({
      ...base,
      hinge: { ...base.hinge, b: { ...base.hinge.b, boards: [board('esp32-devkitc-v4')], lid: { ...base.hinge.b.lid, face: 'bottom' } } },
    });
    for (const { half, state: one } of casesOf(state)) {
      const built = buildCase(csg, one, 8);
      for (const mesh of [built.body, built.lid]) {
        const report = validateMesh(mesh);
        expect(report.watertight, `${half}`).toBe(true);
        expect(report.volume).toBeGreaterThan(0);
      }
      expect(built.dims).toEqual(caseDims(one));
    }
  });
});

describe('the knuckles', () => {
  let csg: CsgApi;
  beforeAll(async () => {
    csg = await initCSG();
  });

  function withLids(a: string, b: string): AppState {
    const base = hinged();
    return sanitizeState({ ...base, lid: { ...base.lid, face: a }, hinge: { ...base.hinge, b: { ...base.hinge.b, lid: { ...base.hinge.b.lid, face: b } } } });
  }

  function build(state: AppState): { a: CaseBuild; b: CaseBuild } {
    const [a, b] = (['a', 'b'] as const).map((half) => buildCase(csg, halfState(state, half), 8, () => {}, null, halfHinge(state, half)));
    return { a, b };
  }

  /** Volume shared by two meshes. */
  function shared(one: SurfaceMesh, other: SurfaceMesh): number {
    const scope = new CsgScope();
    try {
      return scope.keep(scope.keep(toManifold(csg, one)).intersect(scope.keep(toManifold(csg, other)))).volume();
    } finally {
      scope.dispose();
    }
  }

  // P6: the upper half turns from closed to open flat without touching the lower one
  for (const [lidA, lidB] of [['top', 'top'], ['bottom', 'top'], ['top', 'bottom']]) {
    it(`turn from closed to open flat without touching (lids ${lidA}/${lidB})`, () => {
      const state = withLids(lidA, lidB);
      const { a, b } = build(state);
      const lower = mergeMeshes([a.body, a.lid]);
      const upper = mergeMeshes([b.body, b.lid]);
      const fold = foldOfState(state);
      for (let angle = 0; angle <= 180; angle += 15) {
        expect(shared(lower, transformMesh(upper, upperPose(fold, angle))), `${angle}°`).toBeLessThan(1e-6);
      }
    });
  }

  it('each half has its knuckles, and a pin goes through every block at any angle', () => {
    const state = hinged();
    const { a, b } = build(state);
    // the knuckles add to the body
    expect(validateMesh(a.body).volume).toBeGreaterThan(validateMesh(buildCase(csg, halfState(state, 'a'), 8).body).volume + 50);
    const fold = foldOfState(state);
    const hinge = halfHinge(state, 'a');
    if (!hinge) throw new Error('no hinge');
    expect(hinge.blocks).toHaveLength(2);
    // a pin a little thinner than its hole, along the axis through each block
    const pin = (x0: number, x1: number): SurfaceMesh => {
      const r = state.hinge.pinD / 2 - 0.05;
      const points = [x0, x1].flatMap((x) => Array.from({ length: 24 }, (_, i): [number, number, number] => (
        [x, fold.y + r * Math.cos((Math.PI * i) / 12), fold.z + r * Math.sin((Math.PI * i) / 12)])));
      const scope = new CsgScope();
      try {
        return fromManifold(scope.keep(csg.Manifold.hull(points)));
      } finally {
        scope.dispose();
      }
    };
    for (const block of hinge.blocks) {
      const rod = pin(block.x0 - 2, block.x1 + 2);
      expect(shared(rod, a.body)).toBeLessThan(1e-6);
      for (const angle of [0, 90, 180]) {
        const pose = upperPose(fold, angle);
        // the rod stays on the axis: posed with the upper half it is the same rod
        expect(shared(rod, transformMesh(b.body, pose))).toBeLessThan(1e-6);
      }
    }
  });

  it('a screw axle: through every knuckle, its head and its nut sunk in the block\'s ends, and it still turns', () => {
    const base = hinged();
    const state = sanitizeState({ ...base, hinge: { ...base.hinge, axle: 'screw', screw: 'M3' } });
    expect(state.hinge.barrelD).toBeGreaterThanOrEqual(barrelMin(state.hinge));
    const { a, b } = build(state);
    const fold = foldOfState(state);
    const hinge = halfHinge(state, 'a');
    const holes = axleHoles(state.hinge);
    if (!hinge || !holes.screw) throw new Error('no screw');
    const rod = (x0: number, x1: number, r: number): SurfaceMesh => {
      const points = [x0, x1].flatMap((x) => Array.from({ length: 24 }, (_, i): [number, number, number] => (
        [x, fold.y + r * Math.cos((Math.PI * i) / 12), fold.z + r * Math.sin((Math.PI * i) / 12)])));
      const scope = new CsgScope();
      try {
        return fromManifold(scope.keep(csg.Manifold.hull(points)));
      } finally {
        scope.dispose();
      }
    };
    for (const block of hinge.blocks) {
      // the shank through the block, the head in its seat, the nut (its inscribed circle) in its pocket
      const parts = [
        rod(block.x0, block.x1, holes.r - 0.05),
        rod(block.x0 - 1, block.x0 + holes.screw.headDepth - 0.1, holes.screw.headR - 0.1),
        rod(block.x1 - holes.screw.nutDepth + 0.1, block.x1 + 1, holes.screw.nutAF / 2 - 0.1),
      ];
      for (const part of parts) {
        expect(shared(part, a.body)).toBeLessThan(1e-6);
        for (const angle of [0, 110, 180]) expect(shared(part, transformMesh(b.body, upperPose(fold, angle)))).toBeLessThan(1e-6);
      }
    }
    const lower = mergeMeshes([a.body, a.lid]);
    const upper = mergeMeshes([b.body, b.lid]);
    for (let angle = 0; angle <= 180; angle += 30) {
      expect(shared(lower, transformMesh(upper, upperPose(fold, angle))), `${angle}°`).toBeLessThan(1e-6);
    }
    const screws = hingeScrews(state.hinge, hinge.blocks);
    expect(screws?.count).toBe(2);
    expect(screws?.length).toBe(Math.floor(hinge.blocks[0].x1 - hinge.blocks[0].x0 - holes.screw.headDepth));
  });

  it('a snap: the lower half\'s bar through the upper half\'s split rings, turning without touching', () => {
    const base = hinged();
    for (const lids of [['top', 'top'], ['bottom', 'top']] as const) {
      const state = sanitizeState({
        ...base, lid: { ...base.lid, face: lids[0] },
        hinge: { ...base.hinge, axle: 'snap', b: { ...base.hinge.b, lid: { ...base.hinge.b.lid, face: lids[1] } } },
      });
      const holes = axleHoles(state.hinge);
      if (!holes.snap) throw new Error('no snap');
      expect(holes.snap.slit).toBeLessThan(2 * holes.snap.barR);
      const { a, b } = build(state);
      for (const mesh of [a.body, b.body]) expect(validateMesh(mesh).watertight).toBe(true);
      const fold = foldOfState(state);
      const lower = mergeMeshes([a.body, a.lid]);
      const upper = mergeMeshes([b.body, b.lid]);
      for (let angle = 0; angle <= 180; angle += 15) {
        expect(shared(lower, transformMesh(upper, upperPose(fold, angle))), `${lids} ${angle}°`).toBeLessThan(1e-6);
      }
      // the bar is there: the lower body is a closed solid through the upper half's knuckles' x
      const hinge = halfHinge(state, 'b');
      if (!hinge) throw new Error('no hinge');
      const run = hinge.runs[0];
      const probe = (x: number): SurfaceMesh => {
        const r = holes.snap ? holes.snap.barR - 0.1 : 0;
        const points = [x - 0.5, x + 0.5].flatMap((at) => Array.from({ length: 12 }, (_, i): [number, number, number] => (
          [at, fold.y + r * Math.cos((Math.PI * i) / 6), fold.z + r * Math.sin((Math.PI * i) / 6)])));
        const scope = new CsgScope();
        try {
          return fromManifold(scope.keep(csg.Manifold.hull(points)));
        } finally {
          scope.dispose();
        }
      };
      const middle = probe((run.x0 + run.x1) / 2);
      expect(shared(middle, a.body)).toBeGreaterThan(0.9 * validateMesh(middle).volume);
    }
  });

  it('a barrel never thinner than its axle needs', () => {
    expect(sanitizeHingeSpec({ axle: 'screw', screw: 'M3', barrelD: 5 }).barrelD).toBeGreaterThanOrEqual(barrelMin({ ...defaultHingeSpec(), axle: 'screw', screw: 'M3' }));
    expect(sanitizeHingeSpec({ pinD: 4, pinFit: 0.5, barrelD: 5 }).barrelD).toBeGreaterThanOrEqual(4 + 1 + 2.4);
  });

  it('a half that prints on its inner face keeps its knuckles under that face', () => {
    const state = withLids('bottom', 'top');
    const { a, b } = build(state);
    const hA = caseDims(halfState(state, 'a')).h;
    expect(validateMesh(a.body).bbox.max[2]).toBeLessThanOrEqual(hA + 1e-6);
    // the other half's knuckles take the whole gap and both radii
    const hB = caseDims(halfState(state, 'b')).h;
    expect(validateMesh(b.body).bbox.max[2]).toBeCloseTo(hB + state.hinge.gap + state.hinge.barrelD, 1);
    for (const mesh of [a.body, b.body]) expect(validateMesh(mesh).watertight).toBe(true);
  });
});

describe('cables', () => {
  let csg: CsgApi;
  beforeAll(async () => {
    csg = await initCSG();
  });

  it('the knuckles step aside from a cable\'s slot', () => {
    const spec = defaultHingeSpec();
    const zone = { x0: 40, x1: 60 };
    const ends = knuckleRuns(spec, 100, 4, [zone]);
    expect(ends.blocks).toHaveLength(2);
    const full = knuckleRuns({ ...spec, layout: 'full' }, 100, 4, [zone]);
    expect(full.blocks).toHaveLength(2);
    for (const { runs } of [ends, full]) {
      for (const run of runs) expect(run.x1 <= zone.x0 || run.x0 >= zone.x1).toBe(true);
    }
    // a cable near one end pushes that block inwards
    const near = knuckleRuns(spec, 100, 4, [{ x0: 4, x1: 12 }]);
    expect(Math.min(...near.runs.map((run) => run.x0))).toBeGreaterThanOrEqual(12);
  });

  it('a slot through each half\'s hinge wall, and the halves still turn clear', () => {
    const base = hinged();
    const cable = { ...defaultCable(49), plugH: 4 };
    const state = sanitizeState({ ...base, hinge: { ...base.hinge, cables: [cable] } });
    const slot = cableSlot(state.hinge.cables[0]);
    const [a, b] = (['a', 'b'] as const).map((half) => buildCase(csg, halfState(state, half), 8, () => {}, null, halfHinge(state, half)));
    const plainA = buildCase(csg, halfState(state, 'a'), 8, () => {}, null, halfHinge(sanitizeState({ ...state, hinge: { ...state.hinge, cables: [] } }), 'a'));
    // the slot takes wall away (a little less than its full prism: the knuckles moved too)
    expect(validateMesh(a.body).volume).toBeLessThan(validateMesh(plainA.body).volume);
    for (const [half, built] of [['a', a], ['b', b]] as const) {
      const hinge = halfHinge(state, half);
      if (!hinge) throw new Error('no hinge');
      const { z } = hinge.slots[0];
      const dims = caseDims(halfState(state, half));
      const y = half === 'a' ? dims.d - state.shape.wall / 2 : state.shape.wall / 2;
      // a probe in the middle of the slot, through the wall
      const scope = new CsgScope();
      try {
        // inside the slot's straight part: its ends are half circles
        const probe = fromManifold(scope.keep(csg.Manifold.cube([slot.w - slot.h - 1, state.shape.wall + 0.4, slot.h - 1], true).translate([49, y, z])));
        expect(shared(probe, built.body), half).toBeLessThan(1e-6);
        expect(shared(probe, built.lid), half).toBeLessThan(1e-6);
      } finally {
        scope.dispose();
      }
    }
    const fold = foldOfState(state);
    for (let angle = 0; angle <= 180; angle += 30) {
      expect(shared(mergeMeshes([a.body, a.lid]), transformMesh(mergeMeshes([b.body, b.lid]), upperPose(fold, angle)))).toBeLessThan(1e-6);
    }
  });

  it('says how long a cable runs between its slots, and when a slot meets a corner or another', () => {
    const base = hinged();
    const state = sanitizeState({ ...base, hinge: { ...base.hinge, cables: [defaultCable(49), defaultCable(2), defaultCable(55)] } });
    const notes = hingeNotes(state);
    const length = notes.find((note) => note.code === 'info.cableLength' && note.params?.n === 1);
    expect(Number(length?.params?.min)).toBeGreaterThan(0);
    expect(Number(length?.params?.max)).toBeGreaterThanOrEqual(Number(length?.params?.min));
    expect(notes.some((note) => note.code === 'warn.cableAtCorner' && note.params?.n === 2)).toBe(true);
    expect(notes.some((note) => note.code === 'warn.cablesOverlap' && note.params?.n === 1 && note.params?.m === 3)).toBe(true);
    expect(notes.some((note) => note.code === 'warn.cableAtCorner' && note.params?.n === 1)).toBe(false);
  });

  function shared(one: SurfaceMesh, other: SurfaceMesh): number {
    const scope = new CsgScope();
    try {
      return scope.keep(scope.keep(toManifold(csg, one)).intersect(scope.keep(toManifold(csg, other)))).volume();
    } finally {
      scope.dispose();
    }
  }
});

describe('a printed hinge', () => {
  let csg: CsgApi;
  beforeAll(async () => {
    csg = await initCSG();
  });

  function shared(one: SurfaceMesh, other: SurfaceMesh): number {
    const scope = new CsgScope();
    try {
      return scope.keep(scope.keep(toManifold(csg, one)).intersect(scope.keep(toManifold(csg, other)))).volume();
    } finally {
      scope.dispose();
    }
  }

  for (const [lidA, lidB, axle] of [['bottom', 'bottom', 'cones'], ['top', 'bottom', 'pin'], ['top', 'top', 'screw']] as const) {
    it(`leaves on the walls turn clear, ${axle}, lids ${lidA}/${lidB}`, () => {
      const base = hinged();
      const state = sanitizeState({
        ...base,
        lid: { ...base.lid, face: lidA },
        hinge: { ...base.hinge, kind: 'leaves', axle, leafHole: 'nut', b: { ...base.hinge.b, lid: { ...base.hinge.b.lid, face: lidB } } },
      });
      // both lids on the bottom are fine: the hinge prints on its own
      expect(hingeNotes(state).some((note) => note.code === 'warn.hingeUnprintable')).toBe(false);
      const [a, b] = (['a', 'b'] as const).map((half) => buildCase(csg, halfState(state, half), 8, () => {}, null, halfHinge(state, half)));
      if (!a.hinge || !b.hinge) throw new Error('no leaves');
      for (const built of [a, b]) {
        for (const mesh of [built.body, built.lid, built.hinge]) if (mesh) expect(validateMesh(mesh).watertight).toBe(true);
        expect(shared(built.body, built.lid)).toBeLessThan(1e-6);
      }
      const fold = foldOfState(state);
      const d = caseDims(halfState(state, 'a')).d;
      // closed, both leaves lie on one plane: the walls' (the faces that print on the bed)
      expect(validateMesh(a.hinge).bbox.min[1]).toBeCloseTo(d, 6);
      expect(validateMesh(transformMesh(b.hinge, upperPose(fold, 0))).bbox.min[1]).toBeCloseTo(d, 6);
      const lower = mergeMeshes([a.body, a.lid, a.hinge]);
      const upper = mergeMeshes([b.body, b.lid, b.hinge]);
      for (let angle = 0; angle <= 180; angle += 15) {
        expect(shared(lower, transformMesh(upper, upperPose(fold, angle))), `${angle}°`).toBeLessThan(1e-6);
      }
      // the leaves sit on their walls without entering them
      expect(shared(a.hinge, a.body)).toBeLessThan(1e-6);
      expect(shared(b.hinge, b.body)).toBeLessThan(1e-6);
    });
  }

  it('a knuckle hinge takes no cones', () => {
    expect(sanitizeHingeSpec({ kind: 'knuckles', axle: 'cones' }).axle).toBe('pin');
    expect(sanitizeHingeSpec({ kind: 'leaves', axle: 'cones' }).axle).toBe('cones');
  });
});

describe('the gap and the magnets', () => {
  let csg: CsgApi;
  beforeAll(async () => {
    csg = await initCSG();
  });

  it('the gap takes what stands out of both inner faces', () => {
    expect(gapFor(0, 0)).toBe(GAP_DEFAULT);
    expect(gapFor(1, 0.4)).toBe(1.9);
    const base = hinged();
    // printed caps on a CardKB hung under the lower half's top
    const caps = sanitizeState({ ...base, boards: [{ board: 'm5stack-cardkb-v1.1', on: 'ceiling', z: 0.3, keys: 'caps' }] });
    expect(innerProtrusion(caps, 'a')).toBeGreaterThan(0.5);
    expect(gapOf(caps)).toBeCloseTo(gapFor(innerProtrusion(caps, 'a'), 0), 9);
    expect(hingeNotes(caps).some((note) => note.code === 'info.gapAuto')).toBe(true);
    const tight = sanitizeState({ ...caps, hinge: { ...caps.hinge, gapAuto: false, gap: 0.3 } });
    expect(gapOf(tight)).toBe(0.3);
    expect(hingeNotes(tight).some((note) => note.code === 'warn.gapSmall')).toBe(true);
    // a raised label on a lid on top stands out too
    const label = sanitizeState({ ...base, boards: [], label: { ...base.label, on: true, raised: true, depth: 0.8 } });
    expect(innerProtrusion(label, 'a')).toBeCloseTo(0.8, 9);
  });

  it('magnets inside, meeting through the inner faces when closed', () => {
    const base = hinged();
    const state = sanitizeState({
      ...base, hinge: { ...base.hinge, magnets: true, magnet: '6x3', b: { ...base.hinge.b, lid: { ...base.hinge.b.lid, face: 'bottom' } } },
    });
    const fold = foldOfState(state);
    const [a, b] = (['a', 'b'] as const).map((half) => buildCase(csg, halfState(state, half), 8, () => {}, null, halfHinge(state, half)));
    const ma = halfHinge(state, 'a')?.magnets;
    const mb = halfHinge(state, 'b')?.magnets;
    if (!ma || !mb) throw new Error('no magnets');
    const hA = caseDims(halfState(state, 'a')).h;
    const hB = caseDims(halfState(state, 'b')).h;
    const shared = (one: SurfaceMesh, other: SurfaceMesh): number => {
      const scope = new CsgScope();
      try {
        return scope.keep(scope.keep(toManifold(csg, one)).intersect(scope.keep(toManifold(csg, other)))).volume();
      } finally {
        scope.dispose();
      }
    };
    const disc = (x: number, y: number, z0: number, z1: number, r: number): SurfaceMesh => {
      const scope = new CsgScope();
      try {
        return fromManifold(scope.keep(csg.Manifold.cylinder(z1 - z0, r, r, 24).translate([x, y, z0])));
      } finally {
        scope.dispose();
      }
    };
    for (const [m, built, h] of [[ma, a, hA], [mb, b, hB]] as const) {
      const parts = mergeMeshes([built.body, built.lid]);
      for (const spot of m.spots) {
        // the pocket is empty, the skin over it is there
        expect(shared(disc(spot.x, spot.y, m.bottom + 0.1, m.top - 0.1, m.pocketR - 0.1), parts)).toBeLessThan(1e-6);
        expect(shared(disc(spot.x, spot.y, h - MAGNET_SKIN + 0.1, h - 0.1, m.pocketR - 0.1), parts)).toBeGreaterThan(0);
      }
    }
    // the lower half's magnets under the upper half's, closed
    for (const [i, spot] of ma.spots.entries()) {
      const over = applyAffine(upperPose(fold, 0), [mb.spots[i].x, mb.spots[i].y, mb.top]);
      expect(over[0]).toBeCloseTo(spot.x, 6);
      expect(over[1]).toBeCloseTo(spot.y, 6);
    }
    for (let angle = 0; angle <= 180; angle += 30) {
      expect(shared(mergeMeshes([a.body, a.lid]), transformMesh(mergeMeshes([b.body, b.lid]), upperPose(fold, angle)))).toBeLessThan(1e-6);
    }
  });
});

