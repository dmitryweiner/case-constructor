// Clamp bars for panels with no holes in front of their glass (plans/
// PLAN-DISPLAYS.md D5): posts from the plate beside the panel, bars across
// its back along the short side — screwed to the panel's own back holes, or
// pressing it through foam.

import { initCSG, toManifold } from '../src/geo/csg';
import type { CsgApi } from '../src/geo/csg';
import type { Manifold } from 'manifold-3d';
import { buildCase } from '../src/geo/build';
import { caseLayout, collisions } from '../src/geo/layout';
import { CLAMP_BAR_T, CLAMP_BAR_W, clampHold, postReach } from '../src/geo/clamp';
import { defaultPlacement, sanitizePlacement } from '../src/boards/placement';
import { catalogBoard, CATALOG } from '../src/boards/catalog';
import { sanitizeBoard } from '../src/boards/schema';
import { validateMesh } from '../src/geo/validate';
import { applyAffine } from '../src/geo/surface';
import type { Vec3 } from '../src/geo/surface';
import { defaultState, sanitizeState } from '../src/state/schema';
import type { AppState } from '../src/state/schema';

let csg: CsgApi;
beforeAll(async () => {
  csg = await initCSG();
});

function solidAt(part: Manifold, p: Vec3): boolean {
  const probe = csg.Manifold.cube([0.1, 0.1, 0.1], true).translate(p);
  const common = part.intersect(probe);
  const filled = common.volume() > 0.0009;
  probe.delete();
  common.delete();
  return filled;
}

const td2 = catalogBoard('raspberry-pi-touch-display-2-7') ?? CATALOG[0];
const epaper = catalogBoard('waveshare-epaper-7.5-v2') ?? CATALOG[0];

function hung(board: string, patch: Partial<AppState> = {}, extra: Record<string, unknown> = {}): AppState {
  return sanitizeState({ ...defaultState(), ...patch, boards: [{ board, on: 'ceiling', z: 0, mount: { size: 'M3', hole: 'insert' }, ...extra }] });
}

describe('clamp entries', () => {
  it('a clamped panel keeps its kind of mount, with or without holes on its back', () => {
    expect(sanitizeBoard({ size: { w: 100, d: 60 }, mount: { kind: 'clamp', holes: [] } }).mount.kind).toBe('clamp');
    expect(sanitizeBoard({ size: { w: 100, d: 60 }, mount: { kind: 'clamp', holes: [{ x: 10, y: 10, d: 2.5 }] } }).mount.holes).toHaveLength(1);
    expect(td2.mount.kind).toBe('clamp');
    expect(epaper.mount.kind).toBe('clamp');
  });

  it('hangs against the plate when added: no gap; screwed to its back it is not pressed, otherwise it leaves room for foam', () => {
    expect(defaultPlacement(td2)).toMatchObject({ on: 'ceiling', z: 0, press: 0 });
    expect(defaultPlacement(epaper)).toMatchObject({ on: 'ceiling', z: 0, press: -1 });
    expect(sanitizePlacement({ board: epaper.id, on: 'ceiling', press: -2.5 }).press).toBe(-2.5);
    expect(sanitizePlacement({ board: epaper.id, on: 'ceiling', press: 9 }).press).toBe(1);
    expect(sanitizePlacement({ board: 'raspberry-pi-4b', press: -1 })).not.toHaveProperty('press');
  });
});

describe('the hold', () => {
  it('Touch Display 2: a tab from the nearer post to each of its bracket holes, across the short side', () => {
    const hold = clampHold(td2, defaultPlacement(td2));
    expect(hold.across).toBe('x');
    expect(hold.bars).toHaveLength(4);
    for (const bar of hold.bars) {
      expect([31.11, 171.11]).toContain(bar.at);
      expect(bar.holes).toHaveLength(1);
      // the nearer post: the back between the two holes stays free
      expect(bar.posts).toEqual([bar.holes[0] < td2.size.w / 2 ? hold.posts[0] : hold.posts[1]]);
    }
    expect(hold.face).toBe(0);
    // the posts stand beyond the long edges
    expect(hold.posts[0]).toBeLessThan(0);
    expect(hold.posts[1]).toBeGreaterThan(td2.size.w);
    expect(hold.blocked).toBe(false);
  });

  it('a bare e-paper panel: two pressing bars, a foam gap below its back, clear of its FPC', () => {
    const hold = clampHold(epaper, defaultPlacement(epaper));
    expect(hold.across).toBe('y');
    expect(hold.bars).toHaveLength(2);
    expect(hold.face).toBe(-1);
    for (const bar of hold.bars) expect(bar.holes).toEqual([]);
    expect(hold.blocked).toBe(false);
  });

  it('a bar steps aside for a part on the back; with nowhere to go it is reported', () => {
    const blocked = sanitizeBoard({
      kind: 'display', size: { w: 100, d: 50, t: 2 }, mount: { kind: 'clamp', holes: [] },
      ports: [{ id: 'board', type: 'generic', edge: 'bottom', x: 50, y: 25, w: 100, d: 50, h: 5 }],
    });
    expect(clampHold(blocked, defaultPlacement(blocked)).blocked).toBe(true);
    const side = sanitizeBoard({
      kind: 'display', size: { w: 100, d: 50, t: 2 }, mount: { kind: 'clamp', holes: [] },
      ports: [{ id: 'driver', type: 'generic', edge: 'bottom', x: 20, y: 25, w: 12, d: 30, h: 5 }],
    });
    const hold = clampHold(side, defaultPlacement(side));
    expect(hold.blocked).toBe(false);
    for (const bar of hold.bars) expect(Math.abs(bar.at - 20)).toBeGreaterThanOrEqual(6 + CLAMP_BAR_W / 2 - 1e-9);
  });
});

describe('the layout', () => {
  it('the posts widen the footprint beyond the long edges; the bars go below the back', () => {
    const state = hung(td2.id);
    const board = caseLayout(state).boards[0];
    const reach = postReach(board.placement);
    expect(board.outline.x0 - board.footprint.x0).toBeCloseTo(reach, 6);
    expect(board.footprint.x1 - board.outline.x1).toBeCloseTo(reach, 6);
    expect(board.z0 - board.zBottom).toBeGreaterThanOrEqual(CLAMP_BAR_T - 1e-9);
    expect(collisions(caseLayout(state))).toEqual([]);
  });
});

describe('built', () => {
  it('Touch Display 2 under a top lid: posts on the lid, bars go with the lid', () => {
    const state = hung(td2.id);
    const built = buildCase(csg, state, 8);
    for (const part of [built.body, built.lid]) {
      expect(validateMesh(part).watertight).toBe(true);
      expect(validateMesh(part).degenerateTriangles).toBe(0);
    }
    expect(built.clamps).toBeNull();
    expect(built.lidClamps).not.toBeNull();
    if (!built.lidClamps) return;
    expect(validateMesh(built.lidClamps).watertight).toBe(true);
    const board = caseLayout(state).boards[0];
    const hold = clampHold(board.def, board.placement);
    const lid = toManifold(csg, built.lid);
    // a post's wall halfway down to the bar, beside the panel
    // the wall of the post, between its insert's hole and its outside
    const post = applyAffine(board.toCase, [hold.bars[0].posts[0] + 3.2, hold.bars[0].at, board.def.size.t / 2]);
    expect(solidAt(lid, post)).toBe(true);
    lid.delete();
    const bars = toManifold(csg, built.lidClamps);
    // a tab between its post and its bracket, its hole at the bracket, nothing under the panel's middle
    const tab = hold.bars[0];
    const between = (tab.posts[0] + tab.holes[0]) / 2;
    expect(solidAt(bars, applyAffine(board.toCase, [between, tab.at, hold.face - CLAMP_BAR_T / 2]))).toBe(true);
    expect(solidAt(bars, applyAffine(board.toCase, [tab.holes[0], tab.at, hold.face - CLAMP_BAR_T / 2]))).toBe(false);
    expect(solidAt(bars, applyAffine(board.toCase, [board.def.size.w / 2, tab.at, hold.face - CLAMP_BAR_T / 2]))).toBe(false);
    bars.delete();
  });

  it('a pressing e-paper under a bottom lid: posts and bars with the body', () => {
    const state = hung(epaper.id, { lid: { ...defaultState().lid, face: 'bottom' } });
    const built = buildCase(csg, state, 8);
    expect(validateMesh(built.body).watertight).toBe(true);
    expect(validateMesh(built.body).degenerateTriangles).toBe(0);
    expect(built.clamps).not.toBeNull();
    expect(built.lidClamps).toBeNull();
  });
});
