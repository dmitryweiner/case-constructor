// Printed caps over a board's top buttons (plans/PLAN-IMPROVEMENTS-2026-10-29.md,
// N3): the keyboards' caps — the flange on the button, the stem up through
// its hole and CAP_PROUD out of the plate — sized among the board's buttons,
// printed with the part that has the top.

import { initCSG, toManifold } from '../src/geo/csg';
import type { CsgApi } from '../src/geo/csg';
import { buildCase } from '../src/geo/build';
import { caseLayout } from '../src/geo/layout';
import { keyNotes, portCutters } from '../src/geo/ports';
import { CAP_FIT, CAP_GROW, CAP_LIP, CAP_PROUD } from '../src/geo/capSize';
import { capsInCase, capsWithLid, keyCaps } from '../src/geo/caps';
import { validateMesh } from '../src/geo/validate';
import { applyAffine } from '../src/geo/surface';
import { buttonsOpen, capButtons, sanitizePlacement, topButtons } from '../src/boards/placement';
import { catalogBoard } from '../src/boards/catalog';
import { defaultState, sanitizeState } from '../src/state/schema';
import type { AppState } from '../src/state/schema';

let csg: CsgApi;
beforeAll(async () => {
  csg = await initCSG();
});

const HELTEC = 'heltec-wifi-lora-32-v4';

function state(board: Record<string, unknown> = {}, patch: Partial<AppState> = {}): AppState {
  return sanitizeState({ ...defaultState(), ...patch, boards: [{ board: HELTEC, buttons: 'caps', ...board }] });
}

describe('the placement', () => {
  it('keeps caps over the buttons only on a board with top buttons, and the caps’ shape with them', () => {
    const kept = sanitizePlacement({ board: HELTEC, buttons: 'caps', capShape: 'square', capR: 1, capSize: 5, keyFit: 0.3 });
    expect(kept).toMatchObject({ buttons: 'caps', capShape: 'square', capR: 1, capSize: 5, keyFit: 0.3 });
    expect(sanitizePlacement(kept)).toEqual(kept);
    expect(sanitizePlacement({ board: HELTEC, buttons: 'hole', capShape: 'square' })).not.toHaveProperty('capShape');
    expect(sanitizePlacement({ board: HELTEC, buttons: true })).not.toHaveProperty('buttons');
    expect(sanitizePlacement({ board: 'raspberry-pi-4b', buttons: 'caps' })).not.toHaveProperty('buttons');
  });

  it('only top buttons, and only those whose opening is on', () => {
    const entry = catalogBoard(HELTEC);
    if (!entry) throw new Error(HELTEC);
    expect(topButtons(entry).map((port) => port.id)).toEqual(['prg', 'rst']);
    const placement = sanitizePlacement({ board: HELTEC, buttons: 'caps', cuts: { rst: false } });
    expect(buttonsOpen(entry, placement)).toBe('caps');
    expect(capButtons(entry, placement).map((button) => button.port.id)).toEqual(['prg']);
  });
});

describe('the caps', () => {
  it('a stem over each button, the button plus CAP_GROW a side; a flange CAP_LIP wider; a hole the stem plus the fit', () => {
    const s = state();
    const layout = caseLayout(s);
    const shape = { ...s.shape, console: layout.console };
    const caps = keyCaps(layout, shape);
    expect(caps.map((cap) => cap.port)).toEqual(['prg', 'rst']);
    expect(caps[0].stemR).toBeCloseTo(3 / 2 + CAP_GROW, 6);
    expect(caps[0].flangeR).toBeCloseTo(caps[0].stemR + CAP_LIP, 6);
    const holes = portCutters(layout, shape).filter((cutter) => cutter.source.kind === 'port' && ['prg', 'rst'].includes(cutter.source.port));
    expect(holes).toHaveLength(2);
    expect(holes[0]).toMatchObject({ shape: 'round', w: 2 * caps[0].stemR + 2 * CAP_FIT });
    // bare holes: the button grown by its clearance
    const bare = caseLayout(state({ buttons: 'hole' }));
    const plain = portCutters(bare, shape).filter((cutter) => cutter.source.kind === 'port' && cutter.source.port === 'prg');
    expect(plain[0].w).toBeCloseTo(3 + 2 * 0.6, 6);
  });

  it('the flange lies on its button, the stem reaches CAP_PROUD out of the top — on the floor, deep under the lid, and hung', () => {
    for (const board of [{ on: 'floor', z: 4 }, { on: 'ceiling' }]) {
      const s = state(board);
      const layout = caseLayout(s);
      const [placed] = layout.boards;
      const [cap] = keyCaps(layout, { ...s.shape, console: layout.console });
      const button = placed.def.ports.find((port) => port.id === 'prg');
      if (!button) throw new Error('prg');
      const z = applyAffine(cap.frame, [0, 0, 0])[2];
      expect(z).toBeCloseTo(placed.z0 + placed.def.size.t + button.h, 6);
      expect(z + cap.length).toBeCloseTo(layout.dims.h + CAP_PROUD, 6);
    }
  });

  it('a word on the caps; a flange over a taller part next to its button is a warning', () => {
    const notes = (s: AppState): string[] => {
      const layout = caseLayout(s);
      return keyNotes(layout, { ...s.shape, console: layout.console }).map((note) => note.code);
    };
    expect(notes(state())).toEqual(['info.buttonCaps']);
    // as wide as the two buttons allow, the flanges run into the USB-C beside them
    expect(notes(state({ capSize: 99 }))).toContain('warn.capOverPart');
  });

  it('they print with the lid when it is the top, else with the body', () => {
    expect(capsWithLid('top')).toBe(true);
    expect(capsWithLid('bottom')).toBe(false);
    expect(capsWithLid('front')).toBe(false);
  });
});

describe('the build', () => {
  const CASES: [string, Record<string, unknown>, Partial<AppState>][] = [
    ['on the floor, a top lid', { on: 'floor', z: 4 }, {}],
    ['hung, a top lid', { on: 'ceiling' }, {}],
    ['on the floor, a bottom lid, square caps', { on: 'floor', z: 4, capShape: 'square', capR: 0.6 }, { lid: { ...defaultState().lid, face: 'bottom' } }],
    ['on the console’s slope', { on: 'ceiling' }, { shape: { ...defaultState().shape, kind: 'console' }, lid: { ...defaultState().lid, face: 'bottom' } }],
  ];

  it.each(CASES)('%s: closed and sliver-free, the caps in their holes touch neither part', (_, board, patch) => {
    const s = state(board, patch);
    const layout = caseLayout(s);
    const built = buildCase(csg, s, 8);
    for (const mesh of [built.body, built.lid]) {
      const report = validateMesh(mesh);
      expect(report.watertight).toBe(true);
      expect(report.degenerateTriangles).toBe(0);
    }
    const caps = capsInCase(keyCaps(layout, { ...s.shape, console: layout.console }));
    if (!caps) throw new Error('caps');
    expect(validateMesh(caps).watertight).toBe(true);
    const solid = toManifold(csg, caps);
    for (const mesh of [built.body, built.lid]) {
      const part = toManifold(csg, mesh);
      const common = part.intersect(solid);
      expect(common.volume()).toBeLessThan(1e-3);
      part.delete();
      common.delete();
    }
    solid.delete();
  });
});
