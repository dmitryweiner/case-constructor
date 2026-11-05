// Through bolts (plans/PLAN-THROUGH-BOLTS.md): the lid's state, where the
// fastening is allowed, the nut's size and the Lid card's controls.

import { caseLayout, effectiveLid } from '../src/geo/layout';
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
