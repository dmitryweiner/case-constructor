// Board ghosts: the PCB slab with its mounting holes, a pad ring around
// each hole, port blocks. Closed meshes, no slivers.

import { GHOST_CIRCLE, ghostHoles, boardGhost } from '../src/geo/ghost';
import { caseLayout } from '../src/geo/layout';
import { validateMesh } from '../src/geo/validate';
import { catalogBoard, CATALOG } from '../src/boards/catalog';
import { defaultState, sanitizeState } from '../src/state/schema';

/** Area of the regular polygon a circle of radius r is drawn as. */
const ngon = (r: number): number => (GHOST_CIRCLE / 2) * r * r * Math.sin((2 * Math.PI) / GHOST_CIRCLE);

function placed(id: string, rot = 0) {
  const state = sanitizeState({ ...defaultState(), boards: [{ board: id, rot }] });
  return caseLayout(state).boards[0];
}

describe('board ghosts', () => {
  it('the PCB of a board with holes is a closed slab with the holes through it', () => {
    for (const rot of [0, 90]) {
      const board = placed('raspberry-pi-4b', rot);
      const { w, d, t } = board.def.size;
      const holes = ghostHoles(board.def);
      expect(holes.length).toBe(4);
      const { pcb } = boardGhost(board);
      const report = validateMesh(pcb);
      expect(report.watertight).toBe(true);
      expect(report.degenerateTriangles).toBe(0);
      const expected = (w * d - holes.reduce((sum, hole) => sum + ngon(hole.r + hole.pad), 0)) * t;
      expect(report.volume).toBeCloseTo(expected, 3);
    }
  });

  it('every hole gets a pad ring, closed, in the ports mesh', () => {
    const board = placed('raspberry-pi-4b');
    const holes = ghostHoles(board.def);
    const plain = { ...board, def: { ...board.def, ports: [] } };
    const { ports } = boardGhost(plain);
    expect(ports).not.toBeNull();
    if (!ports) return;
    const report = validateMesh(ports);
    expect(report.watertight).toBe(true);
    expect(report.degenerateTriangles).toBe(0);
    const h = board.def.size.t + 2 * 0.05;
    const expected = holes.reduce((sum, hole) => sum + (ngon(hole.r + hole.pad) - ngon(hole.r)) * h, 0);
    expect(report.volume).toBeCloseTo(expected, 3);
  });

  it('a hole on the board edge stays inside the outline (its pad shrinks or it is left out)', () => {
    const def = catalogBoard('raspberry-pi-4b') ?? CATALOG[0];
    const edgy = { ...def, mount: { ...def.mount, holes: [{ x: 1, y: 10, d: 2.7 }, { x: 5, y: 10, d: 2.7 }, { x: 30, y: 30, d: 3 }] } };
    const holes = ghostHoles(edgy);
    for (const hole of holes) {
      expect(hole.x - hole.r - hole.pad).toBeGreaterThan(0);
      expect(hole.x + hole.r + hole.pad).toBeLessThan(edgy.size.w);
    }
    // x = 1 with r = 1.35 crosses the edge: left out
    expect(holes.map((hole) => hole.x)).toEqual([5, 30]);
  });

  it('a board on rails is a plain slab', () => {
    const board = placed('esp32-devkitc-v4');
    expect(board.def.mount.kind).toBe('rails');
    const { pcb } = boardGhost(board);
    const { w, d, t } = board.def.size;
    expect(pcb.indices.length).toBe(36);
    expect(validateMesh(pcb).volume).toBeCloseTo(w * d * t, 2);
  });
});
