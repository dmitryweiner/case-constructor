// Board ghosts: the PCB slab with its mounting holes, a pad ring around
// each hole, port blocks. Closed meshes, no slivers.

import { GHOST_CIRCLE, ghostHoles, boardGhost, pinBlocks, portCaptionAnchor } from '../src/geo/ghost';
import { caseLayout } from '../src/geo/layout';
import { validateMesh } from '../src/geo/validate';
import { catalogBoard, CATALOG } from '../src/boards/catalog';
import { signedArea2 } from '../src/boards/schema';
import { defaultState, sanitizeState } from '../src/state/schema';

/** Area of the regular polygon a circle of radius r is drawn as. */
const ngon = (r: number): number => (GHOST_CIRCLE / 2) * r * r * Math.sin((2 * Math.PI) / GHOST_CIRCLE);

function placed(id: string, rot = 0, pins?: boolean) {
  const state = sanitizeState({ ...defaultState(), boards: [{ board: id, rot, pins }] });
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

  it('soldered pins hang under the board along their edges, down to their tips', () => {
    const board = placed('arduino-nano', 0, true);
    const pins = board.def.pins;
    if (!pins) throw new Error('the Nano has pins');
    const blocks = pinBlocks(board);
    expect(blocks).toHaveLength(2 * pins.edges.length);
    expect(Math.min(...blocks.map((block) => block[2]))).toBeCloseTo(-pins.below);
    expect(Math.max(...blocks.map((block) => block[5]))).toBe(0);
    expect(pinBlocks(placed('arduino-nano', 0, false))).toEqual([]);
  });

  it('a board with an outline draws it: a closed slab of the outline less its holes', () => {
    for (const id of ['arduino-uno', 'rakwireless-rak19007', 'heltec-wifi-lora-32-v4']) {
      const board = placed(id);
      const outline = board.def.outline;
      if (!outline) throw new Error(`${id} has an outline`);
      const { pcb } = boardGhost(board);
      const report = validateMesh(pcb);
      expect(report.watertight, id).toBe(true);
      expect(report.degenerateTriangles, id).toBe(0);
      const holes = ghostHoles(board.def).reduce((sum, hole) => sum + ngon(hole.r + hole.pad), 0);
      expect(report.volume, id).toBeCloseTo((signedArea2(outline) / 2 - holes) * board.def.size.t, 2);
    }
  });
});

describe('display ghosts', () => {
  it('a display with a glass draws it as a closed slab of its outline, its front at the window', () => {
    const board = placed('lcdwiki-msp2807');
    const port = board.def.ports.find((item) => item.type === 'display');
    expect(port && 'glass' in port && port.glass).toBeTruthy();
    const { glass } = boardGhost(board);
    expect(glass).not.toBeNull();
    if (!glass || !port || !('glass' in port) || !port.glass) return;
    const report = validateMesh(glass);
    expect(report.watertight).toBe(true);
    expect(report.volume).toBeCloseTo(port.glass.w * port.glass.d * port.glass.t, 1);
    let top = -Infinity;
    for (let i = 2; i < glass.positions.length; i += 3) top = Math.max(top, glass.positions[i]);
    expect(top).toBeCloseTo(board.z0 + board.def.size.t + port.h, 3);
  });

  it('a board without a glass draws none', () => {
    expect(boardGhost(placed('raspberry-pi-4b')).glass).toBeNull();
  });
});

describe('port captions', () => {
  it('hang over the middle of each port: on top of an edge connector, over a top part, under a bottom one', () => {
    const layout = caseLayout(defaultState());
    const board = layout.boards[0];
    const ghost = boardGhost(board).ports;
    if (!ghost) throw new Error('no ports');
    const report = validateMesh(ghost);
    for (const port of board.def.ports) {
      const at = portCaptionAnchor(board, port);
      // inside the ghost's bounding box: on the drawn block, not somewhere else
      for (let k = 0; k < 3; k++) {
        expect(at[k]).toBeGreaterThanOrEqual(report.bbox.min[k] - 1e-6);
        expect(at[k]).toBeLessThanOrEqual(report.bbox.max[k] + 1e-6);
      }
    }
    const ethernet = board.def.ports.find((port) => port.id === 'ethernet');
    if (!ethernet) throw new Error('no ethernet');
    expect(portCaptionAnchor(board, ethernet)[2]).toBeCloseTo(board.z0 + board.def.size.t + 13.5, 0);
  });
});
