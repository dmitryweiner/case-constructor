// A board on a display's back (plans/PLAN-DISPLAYS.md D6): positioned by the
// shared hole pattern, held on the display's own standoffs, its room
// reserved and its edge ports opened; no supports of its own.

import { initCSG } from '../src/geo/csg';
import type { CsgApi } from '../src/geo/csg';
import { buildCase } from '../src/geo/build';
import { caseLayout, collisions } from '../src/geo/layout';
import { attachTurns, attachTransform } from '../src/geo/attach';
import { portCutters } from '../src/geo/ports';
import { sanitizePlacement } from '../src/boards/placement';
import { catalogBoard, CATALOG } from '../src/boards/catalog';
import { validateMesh } from '../src/geo/validate';
import { applyAffine, composeAffine } from '../src/geo/surface';
import { defaultState, sanitizeState } from '../src/state/schema';
import type { AppState } from '../src/state/schema';

let csg: CsgApi;
beforeAll(async () => {
  csg = await initCSG();
});

const td2 = catalogBoard('raspberry-pi-touch-display-2-7') ?? CATALOG[0];
const pi5 = catalogBoard('raspberry-pi-5') ?? CATALOG[0];

function withPi(back: Record<string, unknown> = {}): AppState {
  return sanitizeState({
    ...defaultState(),
    boards: [{ board: td2.id, on: 'ceiling', z: 0, mount: { size: 'M3', hole: 'insert' }, back: { board: pi5.id, ...back } }],
  });
}

describe('the pattern', () => {
  it('Touch Display 2 carries the Pi pattern on its back, the Pi facing away', () => {
    expect(td2.back).toMatchObject({ facing: 'bottom' });
    expect(td2.back?.holes).toHaveLength(4);
  });

  it('a Pi fits it turned a quarter either way; a board without the pattern does not', () => {
    expect([...attachTurns(td2, pi5)].sort((a, b) => a - b)).toEqual([90, 270]);
    expect(attachTurns(td2, catalogBoard('arduino-uno') ?? CATALOG[0])).toEqual([]);
  });

  it('turned over, every Pi hole lands on a pattern hole, the standoffs below the back', () => {
    const back = td2.back;
    if (!back) throw new Error('no pattern');
    for (const rot of attachTurns(td2, pi5)) {
      const m = attachTransform(td2, pi5, rot, back.standoff);
      for (const hole of pi5.mount.holes) {
        const p = applyAffine(m, [hole.x, hole.y, 0]);
        expect(back.holes.some((h) => Math.hypot(h.x - p[0], h.y - p[1]) < 0.3)).toBe(true);
        // facing away: the Pi's underside is the side towards the display, the standoffs' length below its back
        expect(p[2]).toBeCloseTo(-back.standoff, 6);
      }
      expect(applyAffine(m, [0, 0, pi5.size.t])[2]).toBeCloseTo(-back.standoff - pi5.size.t, 6);
    }
  });
});

describe('the placement', () => {
  it('keeps a fitting board, its turn and standoff; drops one that does not fit', () => {
    const fit = sanitizePlacement({ board: td2.id, on: 'ceiling', back: { board: pi5.id, rot: 270, standoff: 7 } });
    expect(fit.back).toMatchObject({ board: pi5.id, rot: 270, standoff: 7 });
    expect(sanitizePlacement({ board: td2.id, back: { board: pi5.id, rot: 0 } }).back?.rot).toBe(90);
    expect(sanitizePlacement({ board: td2.id, back: { board: 'arduino-uno' } })).not.toHaveProperty('back');
    expect(sanitizePlacement({ board: 'raspberry-pi-4b', back: { board: pi5.id } })).not.toHaveProperty('back');
    const once = sanitizePlacement({ board: td2.id, on: 'ceiling', back: { board: pi5.id, cuts: { 'usb-c': false } } });
    expect(sanitizePlacement(once)).toEqual(once);
  });
});

describe('the layout', () => {
  it('the attached board follows the display, after every placed board; the case holds both', () => {
    const state = withPi();
    const layout = caseLayout(state);
    expect(layout.boards).toHaveLength(2);
    const [display, pi] = layout.boards;
    expect(pi.attached).toBe(0);
    const expected = composeAffine(display.toCase, attachTransform(td2, pi5, 90, td2.back?.standoff ?? 0));
    for (let k = 0; k < 12; k++) expect(pi.toCase[k]).toBeCloseTo(expected[k], 9);
    // the display's stack reaches down to the Pi's parts, and the floor stays clear of them
    expect(display.zBottom).toBeLessThanOrEqual(pi.zBottom + 1e-9);
    expect(pi.zBottom).toBeGreaterThanOrEqual(state.shape.floor + state.shape.margin.top - 1e-6);
    expect(collisions(layout)).toEqual([]);
  });

  it('opens the Pi\'s edge ports, not its parts on top (turned over, they point at the floor)', () => {
    const state = withPi();
    const layout = caseLayout(state);
    const ports = portCutters(layout, state.shape).filter((cutter) => cutter.source.kind === 'port' && cutter.source.board === 0);
    const ids = ports.map((cutter) => (cutter.source.kind === 'port' ? cutter.source.port : ''));
    expect(ids).toContain('usb-c');
    expect(ids).not.toContain('gpio');
  });
});

describe('built', () => {
  it('builds closed, with no supports for the Pi', () => {
    const built = buildCase(csg, withPi(), 8);
    for (const part of [built.body, built.lid]) {
      expect(validateMesh(part).watertight).toBe(true);
      expect(validateMesh(part).degenerateTriangles).toBe(0);
    }
  });
});
