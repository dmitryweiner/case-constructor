// Batteries: the spec and its sanitizer, a battery placed like a board (the
// layout, the walls, the overlap checks), its ghost.

import { CELLS, CLAMP_ABOVE, CLAMP_POST_ZONE, batteryDef, batterySize, cellCentres, defaultBattery, sanitizeBattery } from '../src/boards/battery';
import { boardOf, defaultPlacement } from '../src/boards/placement';
import { WALL_GAP, caseLayout, collisions } from '../src/geo/layout';
import { boardGhost } from '../src/geo/ghost';
import { validateMesh } from '../src/geo/validate';
import { defaultState, sanitizeState } from '../src/state/schema';

describe('battery spec', () => {
  it('cells side by side with ribs between and outside them', () => {
    const spec = sanitizeBattery({ kind: '18650', count: 3 });
    const size = batterySize(spec);
    expect(size.w).toBe(CELLS['18650'].l);
    expect(size.d).toBeCloseTo(3 * (18.6 + 1.2) + 1.2, 6);
    expect(size.h).toBe(18.6);
    const centres = cellCentres(spec);
    expect(centres).toHaveLength(3);
    expect(centres[0] - 18.6 / 2).toBeCloseTo(1.2, 6);
    expect(size.d - centres[2] - 18.6 / 2).toBeCloseTo(1.2, 6);
  });

  it('a pack is one block of the user\'s size; garbage falls back', () => {
    expect(batterySize(sanitizeBattery({ kind: 'pack', pack: { w: 50, d: 30, h: 6 } }))).toEqual({ w: 50, d: 30, h: 6 });
    expect(sanitizeBattery({ kind: 'pack', count: 3 }).count).toBe(1);
    expect(sanitizeBattery({ kind: 'D-cell', count: 9 })).toEqual({ ...defaultBattery('18650'), count: 4 });
    const twice = sanitizeBattery(sanitizeBattery({ kind: '14500', count: 2.6, pack: { w: -1 } }));
    expect(sanitizeBattery(twice)).toEqual(twice);
  });

  it('its board entry: no PCB, no holes, no ports; the clamp\'s room on top', () => {
    const def = batteryDef(defaultBattery('21700'));
    expect(def.size.t).toBe(0);
    expect(def.mount.holes).toEqual([]);
    expect(def.ports).toEqual([]);
    expect(def.topHeight).toBeCloseTo(CELLS['21700'].d + CLAMP_ABOVE, 6);
  });
});

describe('a battery in the case', () => {
  const base = defaultState();
  const battery = (extra: Record<string, unknown> = {}) => ({ ...defaultPlacement(batteryDef(defaultBattery())), ...extra });

  it('survives a file and lies low (1 mm above the floor) by default', () => {
    const state = sanitizeState({ ...base, boards: [battery()] });
    expect(state.boards[0].board).toBe('battery');
    expect(state.boards[0].battery).toEqual(defaultBattery());
    expect(state.boards[0].z).toBe(1);
    expect(sanitizeState(JSON.parse(JSON.stringify(state)))).toEqual(state);
    expect(boardOf(state.boards[0]).battery).toEqual(defaultBattery());
  });

  it('sizes the case: its length, its cells and the clamp posts, its height and the clamp', () => {
    const state = sanitizeState({ ...base, boards: [battery()] });
    const layout = caseLayout(state);
    const placed = layout.boards[0];
    const size = batterySize(defaultBattery());
    expect(placed.footprint.y1 - placed.footprint.y0).toBeCloseTo(size.d + 2 * CLAMP_POST_ZONE, 6);
    expect(placed.zTop - placed.z0).toBeCloseTo(size.h + CLAMP_ABOVE, 6);
    expect(layout.dims.h).toBeGreaterThanOrEqual(placed.zTop + state.shape.margin.top + state.shape.floor - 1e-6);
  });

  it('next to a board: an overlap is reported like any two boards', () => {
    const state = sanitizeState({ ...base, boards: [base.boards[0], battery({ x: 10, y: 10, z: 1 })] });
    expect(collisions(caseLayout(state)).map((m) => m.code)).toContain('warn.boardsOverlap');
    const beside = sanitizeState({ ...base, boards: [base.boards[0], battery({ x: 100, y: 0 })] });
    expect(collisions(caseLayout(beside))).toEqual([]);
  });

  it('against a wall: its end 0.3 mm from the inner wall', () => {
    const state = sanitizeState({ ...base, boards: [battery({ walls: ['left'] })] });
    const layout = caseLayout(state);
    expect(layout.boards[0].outline.x0).toBeCloseTo(state.shape.wall + WALL_GAP, 6);
  });

  it('its ghost: one closed cylinder per cell, or a box for a pack', () => {
    for (const spec of [defaultBattery('18650'), { ...defaultBattery('10440'), count: 4 }, defaultBattery('pack')]) {
      const state = sanitizeState({ ...base, boards: [{ ...battery(), battery: spec }] });
      const ghost = boardGhost(caseLayout(state).boards[0]);
      const report = validateMesh(ghost.pcb);
      expect(report.watertight).toBe(true);
      const size = batterySize(spec);
      const cells = Math.max(1, cellCentres(spec).length);
      const volume = spec.kind === 'pack' ? size.w * size.d * size.h : cells * Math.PI * (size.h / 2) ** 2 * size.w;
      expect(report.volume).toBeGreaterThan(0.95 * volume);
      expect(report.volume).toBeLessThan(1.01 * volume);
    }
  });
});
