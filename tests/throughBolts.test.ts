// Through bolts (plans/PLAN-THROUGH-BOLTS.md): the lid's state, where the
// fastening is allowed, the nut's size and the Lid card's controls; the
// bolt's length and the pocket; the built columns, holes and pockets.

import type { Manifold } from 'manifold-3d';
import { BOLT_LENGTHS, throughBolt } from '../src/geo/bolts';
import { buildCase } from '../src/geo/build';
import type { CsgApi } from '../src/geo/csg';
import { initCSG, toManifold } from '../src/geo/csg';
import { caseLayout, effectiveLid } from '../src/geo/layout';
import { lidPosts } from '../src/geo/lidPosts';
import { applyAffine } from '../src/geo/surface';
import { validateMesh } from '../src/geo/validate';
import { NUT_AF_MAX, NUT_AF_MIN, NUT_H_MAX, NUT_H_MIN, defaultLid, nutSize, postDiameter, sanitizeLid, throughAllowed } from '../src/geo/lidSpec';
import { BOSS_WALL, NUT_CLEARANCE, SCREWS, THROUGH_CLEARANCE } from '../src/geo/fasteners';
import { defaultState, sanitizeState } from '../src/state/schema';
import type { AppState } from '../src/state/schema';
import { lidControls } from '../src/ui/lidCard';

function through(extra: Record<string, unknown> = {}, shape: Record<string, unknown> = {}): AppState {
  const base = defaultState();
  return sanitizeState({ ...base, shape: { ...base.shape, ...shape }, lid: { ...base.lid, fastening: 'through', ...extra } });
}

describe('the lid state', () => {
  it('keeps through bolts and the nut', () => {
    const lid = sanitizeLid({ fastening: 'through', nut: { kind: 'nyloc', place: 'surface', af: 6, h: 4.5 } }, 'box');
    expect(lid.fastening).toBe('through');
    expect(lid.nut).toEqual({ kind: 'nyloc', place: 'surface', af: 6, h: 4.5 });
  });

  it('an old file has no nut: a recessed hex nut from the table', () => {
    expect(sanitizeLid({ fastening: 'screws' }, 'box').nut).toEqual({ kind: 'hex', place: 'recessed', af: null, h: null });
    expect(defaultLid().nut).toEqual({ kind: 'hex', place: 'recessed', af: null, h: null });
  });

  it('garbage in the nut falls back field by field, numbers are clamped', () => {
    const lid = sanitizeLid({ nut: { kind: 'wing', place: 'inside', af: 99, h: -1 } }, 'box');
    expect(lid.nut).toEqual({ kind: 'hex', place: 'recessed', af: NUT_AF_MAX, h: NUT_H_MIN });
    expect(sanitizeLid({ nut: { af: 'big', h: null } }, 'box').nut.af).toBeNull();
    expect(sanitizeLid({ nut: { af: 0 } }, 'box').nut.af).toBe(NUT_AF_MIN);
    expect(sanitizeLid({ nut: { h: 100 } }, 'box').nut.h).toBe(NUT_H_MAX);
  });
});

describe('the nut size', () => {
  it('a hex nut (DIN 934) from the screw table', () => {
    const lid = sanitizeLid({ fastening: 'through', screw: { size: 'M3' } }, 'box');
    expect(nutSize(lid)).toEqual({ af: SCREWS.M3.nutAF, h: SCREWS.M3.nutH });
  });

  it('a nyloc nut (DIN 985) is taller, as wide', () => {
    for (const [size, h] of [['M3', 4], ['M4', 5]] as const) {
      const lid = sanitizeLid({ fastening: 'through', screw: { size }, nut: { kind: 'nyloc' } }, 'box');
      expect(nutSize(lid)).toEqual({ af: SCREWS[size].nutAF, h });
    }
  });

  it('the user’s numbers win over the table', () => {
    const lid = sanitizeLid({ fastening: 'through', screw: { size: 'M3' }, nut: { af: 6, h: 3 } }, 'box');
    expect(nutSize(lid)).toEqual({ af: 6, h: 3 });
  });
});

describe('where through bolts go', () => {
  it('a top or bottom lid on a box, a cylinder, a hinged half; never a console or a side lid', () => {
    for (const kind of ['box', 'cylinder', 'hinged'] as const) {
      expect(throughAllowed(kind, 'top')).toBe(true);
      expect(throughAllowed(kind, 'bottom')).toBe(true);
    }
    expect(throughAllowed('box', 'front')).toBe(false);
    expect(throughAllowed('box', 'left')).toBe(false);
    expect(throughAllowed('console', 'bottom')).toBe(false);
  });

  it('where not allowed the lid is built on screws, and comes back', () => {
    const box = through({ face: 'top' });
    expect(effectiveLid(box.shape, box.lid, caseLayout(box).dims).fastening).toBe('through');
    const side = through({ face: 'front', chosen: 'front' });
    expect(side.lid.fastening).toBe('through');
    expect(effectiveLid(side.shape, side.lid, caseLayout(side).dims).fastening).toBe('screws');
    const console = through({}, { kind: 'console' });
    const layout = caseLayout(console);
    expect(effectiveLid({ ...console.shape, console: layout.console }, console.lid, layout.dims).fastening).toBe('screws');
  });
});

describe('the column', () => {
  it('around the clearance hole with the nut on the face, around the nut pocket when recessed', () => {
    const surface = sanitizeLid({ fastening: 'through', screw: { size: 'M4' }, nut: { place: 'surface' } }, 'box');
    expect(postDiameter(surface)).toBeCloseTo(SCREWS.M4.d + THROUGH_CLEARANCE + 2 * BOSS_WALL);
    const recessed = sanitizeLid({ fastening: 'through', screw: { size: 'M4' }, nut: { place: 'recessed', af: 8 } }, 'box');
    expect(postDiameter(recessed)).toBeCloseTo(8 + NUT_CLEARANCE + 2 * BOSS_WALL);
  });
});

describe('the Lid card', () => {
  const controls = lidControls();
  const shown = (key: string, state: AppState): boolean => {
    const control = controls.find((one) => one.key === key);
    if (!control) throw new Error(`no control ${key}`);
    return control.when ? control.when(state) : true;
  };

  it('through bolts: the screw and its head, the nut; no hole kind', () => {
    const state = through();
    for (const key of ['screw', 'head', 'headD', 'nut', 'nutAF', 'nutH', 'nutPlace']) expect(shown(key, state)).toBe(true);
    expect(shown('hole', state)).toBe(false);
    expect(shown('nutReset', state)).toBe(false);
    expect(shown('nutReset', through({ nut: { af: 6 } }))).toBe(true);
  });

  it('screws show no nut', () => {
    const state = sanitizeState({ ...defaultState(), lid: { ...defaultState().lid, fastening: 'screws' } });
    for (const key of ['nut', 'nutAF', 'nutH', 'nutPlace', 'nutReset']) expect(shown(key, state)).toBe(false);
    expect(shown('hole', state)).toBe(true);
  });

  it('the option is disabled where through bolts cannot go', () => {
    const fastening = controls.find((one) => one.key === 'fastening');
    if (fastening?.kind !== 'segmented' || !fastening.optionDisabled) throw new Error('no fastening row');
    expect(fastening.optionDisabled(through(), 'through')).toBe(false);
    expect(fastening.optionDisabled(through({ face: 'left' }), 'through')).toBe(true);
    expect(fastening.optionDisabled(through({ face: 'left' }), 'screws')).toBe(false);
  });

  it('another screw size puts the nut back to the table', () => {
    const screw = controls.find((one) => one.key === 'screw');
    if (screw?.kind !== 'select') throw new Error('no screw select');
    const next = screw.set(through({ nut: { af: 6, h: 3, kind: 'nyloc' } }), 'M4');
    expect(next.lid.nut).toEqual({ kind: 'nyloc', place: 'recessed', af: null, h: null });
  });
});

describe('the bolt’s length', () => {
  // a 40 mm high case, 4 mm plates, an M3 under a 2 mm counterbore: 38 mm from under the head to the far face
  const lidWith = (nut: object, head = 'counterbore') =>
    sanitizeLid({ fastening: 'through', screw: { size: 'M3', head }, head: { depth: 2 }, nut }, 'box');

  it('a recessed nut: the longest standard bolt that does not stick out, the pocket as deep as it needs', () => {
    const bolt = throughBolt(lidWith({ place: 'recessed' }), 4, 40);
    expect(bolt).toMatchObject({ length: 35, standard: true, underHead: -2, out: 0 });
    // the nut's outer face is at the bolt's end: 3 mm in from the far face, the nut 2.4 above it
    expect(bolt.pocket).toBeCloseTo(38 - 35 + SCREWS.M3.nutH);
  });

  it('a recessed nut never sits shallower than its height and the clearance', () => {
    // 40 mm from under a flat head: a 40 mm bolt ends flush, the pocket holds the nut whole
    const bolt = throughBolt(lidWith({ place: 'recessed' }, 'none'), 4, 40);
    expect(bolt.length).toBe(40);
    expect(bolt.pocket).toBeCloseTo(SCREWS.M3.nutH + NUT_CLEARANCE);
  });

  it('a nut on the face: the shortest standard bolt through it, and how far it stands out', () => {
    const bolt = throughBolt(lidWith({ place: 'surface' }), 4, 40);
    expect(bolt).toMatchObject({ length: 45, standard: true, pocket: 0 });
    expect(bolt.out).toBeCloseTo(45 - 38 - SCREWS.M3.nutH);
  });

  it('a counterbore never deeper than the plate less its floor', () => {
    expect(throughBolt(lidWith({ place: 'surface' }), 2, 40).underHead).toBeCloseTo(-(2 - 0.6));
  });

  it('a countersunk bolt is measured with its head, from the lid’s face', () => {
    expect(throughBolt(lidWith({ place: 'surface' }, 'countersunk'), 4, 40)).toMatchObject({ underHead: 0, length: 45 });
  });

  it('past the longest standard bolt: the length it needs, not standard', () => {
    const bolt = throughBolt(lidWith({ place: 'surface' }), 4, 150);
    expect(bolt.standard).toBe(false);
    expect(bolt.length).toBeGreaterThanOrEqual(148 + SCREWS.M3.nutH);
    expect(BOLT_LENGTHS[BOLT_LENGTHS.length - 1]).toBeLessThan(bolt.length);
  });
});

describe('the built case', () => {
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

  function caseWith(face: 'top' | 'bottom', kind: 'box' | 'cylinder', place: 'recessed' | 'surface'): AppState {
    const base = defaultState();
    return sanitizeState({
      ...base,
      boards: [],
      shape: { ...base.shape, kind, edgeR: 2, cornerR: 6, auto: false, size: { w: 90, d: 70, h: 40 } },
      lid: { ...base.lid, face, fastening: 'through', screw: { size: 'M3', head: 'counterbore' }, nut: { place } },
    });
  }

  it.each([
    ['top', 'box', 'recessed'], ['bottom', 'box', 'surface'], ['top', 'cylinder', 'surface'], ['bottom', 'cylinder', 'recessed'],
  ] as const)('lid %s on a %s, nut %s: a clear line through each column, the pocket empty, plastic around', (face, kind, place) => {
    const state = caseWith(face, kind, place);
    const { frame, plate, spots, lid } = lidPosts(state);
    expect(spots).toHaveLength(4);
    const built = buildCase(csg, state, 8);
    const body = toManifold(csg, built.body);
    const lidPart = toManifold(csg, built.lid);
    const bolt = throughBolt(lid, plate, frame.depth);
    const r = (SCREWS.M3.d + THROUGH_CLEARANCE) / 2;
    const af = nutSize(lid).af + NUT_CLEARANCE;
    for (const spot of spots) {
      const [u, v] = spot.centre;
      const at = (du: number, z: number) => applyAffine(frame.fromFace, [u + du, v, z]);
      // the bolt's path, lid face to far face
      for (let z = -0.3; z > -frame.depth + 0.3; z -= 1.5) {
        expect(solidAt(body, at(0, z)), `body at ${z.toFixed(1)}`).toBe(false);
        expect(solidAt(lidPart, at(0, z)), `lid at ${z.toFixed(1)}`).toBe(false);
      }
      // the column's plastic beside the hole, halfway down
      expect(solidAt(body, at(r + 0.5, -frame.depth / 2)), 'column').toBe(true);
      // the far face: a hex pocket, or a plain hole with plastic just beside it
      const beside = at(r + 0.6, -frame.depth + 0.3);
      expect(solidAt(body, beside), 'beside the hole on the far face').toBe(place === 'surface');
      if (place === 'recessed') {
        expect(solidAt(body, at(af / 2 - 0.3, -frame.depth + bolt.pocket - 0.3)), 'pocket top').toBe(false);
        expect(solidAt(body, at(af / 2 - 0.3, -frame.depth + bolt.pocket + 0.4)), 'above the pocket').toBe(true);
      }
    }
    for (const [name, mesh] of [['body', built.body], ['lid', built.lid]] as const) {
      const report = validateMesh(mesh);
      expect(report.watertight, name).toBe(true);
      expect(report.degenerateTriangles, name).toBe(0);
    }
    body.delete();
    lidPart.delete();
  });
});
