// Supports in the built case: a standoff is solid around its hole, the hole
// is open from the top and closed at the bottom skin; a nut pocket and an
// insert hole are where they should be; rails grip the board edge.

import { initCSG, toManifold } from '../src/geo/csg';
import type { CsgApi } from '../src/geo/csg';
import type { Manifold } from 'manifold-3d';
import { buildCase } from '../src/geo/build';
import { caseLayout, standoffColumns, PIN_SPACER, RAIL_GRIP } from '../src/geo/layout';
import { SCREWS, NUT_CLEARANCE } from '../src/geo/fasteners';
import { HOLE_SKIN, NUT_LIFT } from '../src/geo/standoffs';
import { validateMesh } from '../src/geo/validate';
import { defaultState, sanitizeState } from '../src/state/schema';
import type { AppState } from '../src/state/schema';
import { applyAffine } from '../src/geo/surface';
import { shapeSpec } from '../src/geo/shape';
import { sectionAt } from '../src/geo/loft';

let csg: CsgApi;
beforeAll(async () => {
  csg = await initCSG();
});

/** Is there material in a tiny cube around the point? */
function solidAt(part: Manifold, x: number, y: number, z: number): boolean {
  const probe = csg.Manifold.cube([0.1, 0.1, 0.1], true).translate([x, y, z]);
  const common = part.intersect(probe);
  const filled = common.volume() > 0.0009;
  probe.delete();
  common.delete();
  return filled;
}

function withMount(hole: 'tap' | 'insert' | 'nut', z = 8): AppState {
  return sanitizeState({ ...defaultState(), boards: [{ board: 'raspberry-pi-4b', z, mount: { size: 'M2.5', hole } }] });
}

describe('standoffs', () => {
  it.each(['tap', 'insert', 'nut'] as const)('%s: watertight, hole open on top, skin below', (hole) => {
    const state = withMount(hole);
    const built = buildCase(csg, state, 8);
    expect(validateMesh(built.body).watertight).toBe(true);
    const body = toManifold(csg, built.body);
    const layout = caseLayout(state);
    const [column] = standoffColumns(layout.boards[0]);
    const top = layout.boards[0].z0;
    // material in the standoff wall, air in the hole, the skin under it
    expect(solidAt(body, column.x + column.r - 0.3, column.y, top - 1)).toBe(true);
    expect(solidAt(body, column.x, column.y, top - 0.5)).toBe(false);
    expect(solidAt(body, column.x, column.y, HOLE_SKIN / 2)).toBe(true);
    expect(solidAt(body, column.x, column.y, top + 0.5)).toBe(false);
    if (hole === 'nut') {
      // the pocket: air beside the bore at nut height, the slot reaching the outside
      const af = SCREWS['M2.5'].nutAF + NUT_CLEARANCE;
      const z = state.shape.floor + NUT_LIFT + 0.5;
      expect(solidAt(body, column.x + af / 2 - 0.4, column.y, z) || solidAt(body, column.x - af / 2 + 0.4, column.y, z)).toBe(false);
      // the slots never cut the walls: on the ray from every standoff away from
      // the board's centre, the wall just behind its inner surface is solid
      const { wall } = state.shape;
      const spec = shapeSpec(state.shape, layout.dims).outer;
      const inside = (px: number, py: number): boolean => {
        const sec = sectionAt(spec, z);
        const qx = Math.max(0, Math.abs(px - spec.cx) - (sec.hw - sec.r));
        const qy = Math.max(0, Math.abs(py - spec.cy) - (sec.hd - sec.r));
        return Math.abs(px - spec.cx) <= sec.hw && Math.abs(py - spec.cy) <= sec.hd && Math.hypot(qx, qy) <= sec.r;
      };
      const mid = applyAffine(layout.boards[0].toCase, [layout.boards[0].def.size.w / 2, layout.boards[0].def.size.d / 2, 0]);
      for (const c of standoffColumns(layout.boards[0])) {
        const len = Math.hypot(c.x - mid[0], c.y - mid[1]);
        const [dx, dy] = [(c.x - mid[0]) / len, (c.y - mid[1]) / len];
        let t = 0;
        while (inside(c.x + dx * (t + 0.05), c.y + dy * (t + 0.05))) t += 0.05;
        const back = t - wall + 0.25;
        expect(solidAt(body, c.x + dx * back, c.y + dy * back, z), `wall behind ${c.x.toFixed(1)},${c.y.toFixed(1)}`).toBe(true);
      }
    }
    body.delete();
  });

  it('with a bottom lid the standoffs stand on the lid', () => {
    const state = sanitizeState({ ...withMount('tap'), lid: { ...defaultState().lid, face: 'bottom' } });
    const built = buildCase(csg, state, 8);
    const lid = toManifold(csg, built.lid);
    const body = toManifold(csg, built.body);
    const [column] = standoffColumns(caseLayout(state).boards[0]);
    const z = caseLayout(state).boards[0].z0 - 1;
    expect(solidAt(lid, column.x + column.r - 0.3, column.y, z)).toBe(true);
    expect(solidAt(body, column.x + column.r - 0.3, column.y, z)).toBe(false);
    lid.delete();
    body.delete();
  });
});

describe('rails', () => {
  it('grip the board edge: material above and below the PCB, a groove at its level', () => {
    const state = sanitizeState({ ...defaultState(), boards: [{ board: 'heltec-wifi-lora-32-v3', z: 5 }] });
    const built = buildCase(csg, state, 8);
    expect(validateMesh(built.body).watertight).toBe(true);
    const body = toManifold(csg, built.body);
    const board = caseLayout(state).boards[0];
    const { w, t } = board.def.size;
    // the middle of the front edge, inside the outline but within the grip
    const [x, y] = applyAffine(board.toCase, [w / 2, RAIL_GRIP - 0.9, 0]);
    expect(solidAt(body, x, y, board.z0 + t / 2)).toBe(false); // the groove
    expect(solidAt(body, x, y, board.z0 + t + 0.6)).toBe(true); // the upper lip
    expect(solidAt(body, x, y, board.z0 - 0.6)).toBe(true); // below the board
    body.delete();
  });

  it('a soldered board sits on a pin bed: the pins and the header pass, the shelf carries it', () => {
    const state = sanitizeState({ ...defaultState(), boards: [{ board: 'arduino-nano', pins: true }] });
    const built = buildCase(csg, state, 8);
    const report = validateMesh(built.body);
    expect(report.watertight).toBe(true);
    expect(report.degenerateTriangles).toBe(0);
    const body = toManifold(csg, built.body);
    const board = caseLayout(state).boards[0];
    const { w, t } = board.def.size;
    const pins = board.def.pins;
    if (!pins) throw new Error('the Nano has pins');
    const at = (s: number, z: number): boolean => {
      // s: distance inside the front edge, z: above the PCB underside
      const [x, y] = applyAffine(board.toCase, [w / 2, s, 0]);
      return solidAt(body, x, y, board.z0 + z);
    };
    for (const z of [-0.6, -PIN_SPACER / 2, -PIN_SPACER - 1, -pins.below + 0.3]) expect(at(pins.inset, z), `pins at ${z}`).toBe(false);
    expect(at(pins.inset + 1, -1), 'the header plastic').toBe(false);
    expect(at(0.3, -PIN_SPACER - 0.6), 'the shelf outside the slot').toBe(true);
    expect(at(pins.inset + 1.2, -PIN_SPACER - 0.6), 'the shelf inside the slot').toBe(true);
    expect(at(RAIL_GRIP - 0.9, t + 0.6), 'the upper lip').toBe(true);
    expect(at(RAIL_GRIP - 0.9, t / 2), 'the groove').toBe(false);
    body.delete();
  });

  it('bare pins change nothing: the rail keeps its lower lip', () => {
    const state = sanitizeState({ ...defaultState(), boards: [{ board: 'arduino-nano', pins: false, z: 5 }] });
    const body = toManifold(csg, buildCase(csg, state, 8).body);
    const board = caseLayout(state).boards[0];
    const [x, y] = applyAffine(board.toCase, [board.def.size.w / 2, RAIL_GRIP - 0.9, 0]);
    expect(solidAt(body, x, y, board.z0 - 0.6)).toBe(true);
    body.delete();
  });
});
