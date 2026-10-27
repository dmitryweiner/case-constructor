// Golden tests: volume, triangle count and size of the body and the lid pin
// the current geometry of a fixed set of states. They catch an unintended
// change of shape during refactoring — what the invariant tests do not see
// (the mesh stays closed, but the case is a different one). WASM floats are
// deterministic, so the counts are exact across machines.
//
// Regenerate knowingly: UPDATE_GOLDEN=1 npx vitest run tests/golden.test.ts

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initCSG } from '../src/geo/csg';
import { buildCase } from '../src/geo/build';
import { validateMesh } from '../src/geo/validate';
import { defaultState, sanitizeState } from '../src/state/schema';
import type { AppState } from '../src/state/schema';
import type { SurfaceMesh } from '../src/geo/surface';

const GOLDEN_PATH = join(dirname(fileURLToPath(import.meta.url)), 'golden', 'cases.json');
const SEGMENTS = 8;

interface PartEntry {
  triangles: number;
  volume: number;
  extents: number[];
}

type Entry = Record<'body' | 'lid', PartEntry> & { clamp?: PartEntry; lidClamp?: PartEntry };

/** The M0 base: no boards, the manual 100 × 70 × 35 size. */
function base(): AppState {
  const state = defaultState();
  return { ...state, boards: [], shape: { ...state.shape, auto: false, size: { w: 100, d: 70, h: 35 } } };
}

function variant(patch: (base: AppState) => unknown): AppState {
  return sanitizeState(patch(base()));
}

/** The fixed set; add a state when a feature lands, never edit an old one. */
const STATES: Record<string, AppState> = {
  'default-box': base(),
  'box-fillet': variant((s) => ({ ...s, shape: { ...s.shape, cornerR: 8, edgeR: 5 } })),
  'cylinder': variant((s) => ({ ...s, shape: { ...s.shape, kind: 'cylinder', edgeR: 3 } })),
  'console': variant((s) => ({ ...s, shape: { ...s.shape, kind: 'console' }, lid: { ...s.lid, face: 'bottom' } })),
  'bottom-lid': variant((s) => ({ ...s, lid: { ...s.lid, face: 'bottom', depth: 5 } })),
  'side-lid-deep': variant((s) => ({ ...s, shape: { ...s.shape, edgeR: 3 }, lid: { ...s.lid, face: 'right', depth: 12 } })),
  // M2: boards
  'pi4-default': defaultState(),
  'uno-nuts-bottom-lid': sanitizeState({
    ...defaultState(),
    boards: [{ board: 'arduino-uno', z: 6, rot: 90, mount: { size: 'M3', hole: 'nut' } }],
    lid: { ...defaultState().lid, face: 'bottom' },
  }),
  'esp32-rails-cylinder': sanitizeState({
    ...defaultState(),
    shape: { ...defaultState().shape, kind: 'cylinder' },
    boards: [{ board: 'esp32-devkitc-v4' }],
  }),
  'two-boards-inserts': sanitizeState({
    ...defaultState(),
    boards: [
      { board: 'raspberry-pi-4b', mount: { size: 'M2.5', hole: 'insert' } },
      { board: 'heltec-wifi-lora-32-v3', x: 95, y: 10 },
    ],
  }),
  // M3: openings
  'extra-cuts-console': sanitizeState({
    ...defaultState(),
    shape: { ...defaultState().shape, kind: 'console' },
    lid: { ...defaultState().lid, face: 'bottom' },
    boards: [{ board: 'raspberry-pi-4b', cuts: { gpio: false } }],
    extraCuts: [
      { face: 'top', shape: 'rect', x: 40, y: 30, w: 20, h: 10, r: 2 },
      { face: 'left', shape: 'round', x: 30, y: 15, w: 8 },
    ],
  }),
  // M4: lid fastening
  'screws-counterbore-top': sanitizeState({
    ...defaultState(),
    lid: { ...defaultState().lid, fastening: 'screws', screw: { size: 'M3', hole: 'insert', head: 'counterbore' } },
  }),
  'screws-nut-countersunk-side': sanitizeState({
    ...defaultState(),
    shape: { ...defaultState().shape, edgeR: 3, cornerR: 6 },
    lid: { ...defaultState().lid, face: 'left', depth: 4, fastening: 'screws', screw: { size: 'M2.5', hole: 'nut', head: 'countersunk' } },
  }),
  'snaps-cylinder-fillet': sanitizeState({
    ...defaultState(),
    shape: { ...defaultState().shape, kind: 'cylinder', edgeR: 4 },
  }),
  // M6: extras (the label needs fonts and is covered by tests/extras.test.ts)
  'vents-fan-ears': sanitizeState({
    ...defaultState(),
    vents: { on: true, faces: ['left', 'bottom'], pattern: 'hex', size: 3, pitch: 5 },
    fan: { on: true, face: 'top', size: 30 },
    wallMount: { kind: 'ears' },
  }),
  'slots-keyholes-bottom-lid': sanitizeState({
    ...defaultState(),
    lid: { ...defaultState().lid, face: 'bottom' },
    vents: { on: true, faces: ['right', 'top'], pattern: 'slots', along: 'x' },
    wallMount: { kind: 'keyholes', spacing: 50 },
  }),
  // I9: ears, count and placement (plans/PLAN-IMPROVEMENTS.md)
  'ears-four-ends': sanitizeState({
    ...defaultState(),
    shape: { ...defaultState().shape, cornerR: 6 },
    wallMount: { kind: 'ears', ears: { count: 4, walls: 'frontBack', along: 'ends' } },
  }),
  'ears-three-cylinder': sanitizeState({
    ...defaultState(),
    shape: { ...defaultState().shape, kind: 'cylinder' },
    wallMount: { kind: 'ears', ears: { count: 3, walls: 'frontBack' } },
  }),
  // I7: printed screws, threads in the posts (plans/PLAN-IMPROVEMENTS.md)
  'printed-screws-top': sanitizeState({
    ...defaultState(),
    lid: { ...defaultState().lid, fastening: 'printed', thread: { size: 'P6', fit: 0.2 } },
  }),
  'printed-screws-p4': sanitizeState({
    ...defaultState(),
    lid: { ...defaultState().lid, fastening: 'printed', thread: { size: 'P4', fit: 0.2 } },
  }),
  // I8: magnets, a lid boss under a thin plate (plans/PLAN-IMPROVEMENTS.md)
  'magnets-top': sanitizeState({
    ...defaultState(),
    lid: { ...defaultState().lid, fastening: 'magnets', magnet: { size: '8x3', fit: 0.2 } },
  }),
  // I6: closed keyholes, pads and feet (plans/PLAN-IMPROVEMENTS.md)
  'closed-keyholes-feet': sanitizeState({
    ...defaultState(),
    wallMount: { kind: 'keyholes', keyhole: 'closed', spacing: 58, screwD: 4 },
  }),
  // B1: header pins soldered downwards, a pin bed on the rails (plans/PLAN-IMPROVEMENTS-NEW-BOARDS.md)
  'nano-pin-bed': sanitizeState({
    ...defaultState(),
    boards: [{ board: 'arduino-nano', pins: true }],
  }),
  // B2: a board on M1.6 screws (plans/PLAN-IMPROVEMENTS-NEW-BOARDS.md)
  'heltec-v4-m1.6': sanitizeState({
    ...defaultState(),
    boards: [{ board: 'heltec-wifi-lora-32-v4' }],
  }),
  // B4: parts on the underside, columns through a bottom lid (plans/PLAN-IMPROVEMENTS-NEW-BOARDS.md)
  'cyd-bottom-parts': sanitizeState({
    ...defaultState(),
    lid: { ...defaultState().lid, face: 'bottom' },
    boards: [{ board: 'esp32-2432s028r' }],
  }),
  // B6: a family entry in a variant that is not the default (plans/PLAN-IMPROVEMENTS-NEW-BOARDS.md)
  'feather-reverse-tft': sanitizeState({
    ...defaultState(),
    boards: [{ board: 'adafruit-feather-esp32-s3', variant: 'reverse-tft' }],
  }),
  // R7: a board against walls, its connectors flush (plans/PLAN-IMPROVEMENTS-2026-10-25.md)
  'pi4-flush-front-right': sanitizeState({
    ...defaultState(),
    boards: [{ ...defaultState().boards[0], walls: ['front', 'right'] }],
  }),
  'pi4-recessed-right-screws': sanitizeState({
    ...defaultState(),
    lid: { ...defaultState().lid, fastening: 'screws' },
    boards: [{ ...defaultState().boards[0], walls: ['right'], wallOffset: -0.5 }],
  }),
  // R8: batteries in cradles under printed clamps (plans/PLAN-IMPROVEMENTS-2026-10-25.md)
  'battery-2x18650-clamps': sanitizeState({
    ...defaultState(),
    boards: [{ board: 'battery', battery: { kind: '18650', count: 2, press: 0.3 }, mount: { size: 'M3', hole: 'insert' } }],
  }),
  'battery-lipo-pack-raised': sanitizeState({
    ...defaultState(),
    boards: [{ board: 'battery', battery: { kind: 'pack', pack: { w: 50, d: 34, h: 6 }, press: -1 }, z: 3, rot: 90, mount: { size: 'M2.5', hole: 'nut' } }],
  }),
  'holder-bh2aaa-beside-pi': sanitizeState({
    ...defaultState(),
    boards: [defaultState().boards[0], { board: 'mpd-bh2aaa-w', x: 0, y: 70 }],
  }),
  // R3: the head seat set by the user (plans/PLAN-IMPROVEMENTS-2026-10-25.md)
  'countersunk-head-6.5': sanitizeState({
    ...defaultState(),
    shape: { ...defaultState().shape, floor: 3 },
    lid: { ...defaultState().lid, fastening: 'screws', screw: { size: 'M3', hole: 'tap', head: 'countersunk' }, head: { d: 6.5, depth: null } },
  }),
  'counterbore-deep': sanitizeState({
    ...defaultState(),
    shape: { ...defaultState().shape, floor: 4 },
    lid: { ...defaultState().lid, fastening: 'screws', screw: { size: 'M3', hole: 'insert', head: 'counterbore' }, head: { d: 6, depth: 3 } },
  }),
  // D2: a display hung from the lid (plans/PLAN-DISPLAYS.md)
  'msp2807-hung-top-lid-inserts': sanitizeState({
    ...defaultState(),
    lid: { ...defaultState().lid, fastening: 'screws', screw: { size: 'M3', hole: 'insert', head: 'none' } },
    boards: [{ board: 'lcdwiki-msp2807', on: 'ceiling', z: 0.3, mount: { size: 'M3', hole: 'insert' } }],
  }),
  // D3: the chamfered window and the glass rim
  'msp1281-cylinder': sanitizeState({
    ...defaultState(),
    shape: { ...defaultState().shape, kind: 'cylinder' },
    boards: [{ board: 'lcdwiki-msp1281', on: 'ceiling', z: 0.3, mount: { size: 'M2', hole: 'tap' } }],
  }),
  // D4: a display on the console's slope
  'msp3520-console-slope': sanitizeState({
    ...defaultState(),
    shape: { ...defaultState().shape, kind: 'console', console: { frontH: 20, backH: 40 } },
    lid: { ...defaultState().lid, face: 'bottom', fastening: 'screws' },
    boards: [{ board: 'lcdwiki-msp3520', on: 'ceiling', z: 0.3, rot: 90, mount: { size: 'M3', hole: 'insert' } }],
  }),
  // D5: clamp bars
  'td2-7-top-lid-clamped': sanitizeState({
    ...defaultState(),
    lid: { ...defaultState().lid, fastening: 'screws' },
    boards: [{ board: 'raspberry-pi-touch-display-2-7', on: 'ceiling', z: 0, mount: { size: 'M3', hole: 'insert' } }],
  }),
  'epaper-7.5-bottom-lid-pressed': sanitizeState({
    ...defaultState(),
    lid: { ...defaultState().lid, face: 'bottom' },
    boards: [{ board: 'waveshare-epaper-7.5-v2', on: 'ceiling', z: 0, press: -1, mount: { size: 'M3', hole: 'nut' } }],
  }),
  // D6: a Pi on the display's back
  'td2-7-pi5-back': sanitizeState({
    ...defaultState(),
    lid: { ...defaultState().lid, fastening: 'screws' },
    boards: [{ board: 'raspberry-pi-touch-display-2-7', on: 'ceiling', z: 0, mount: { size: 'M3', hole: 'insert' }, back: { board: 'raspberry-pi-5', rot: 90 } }],
  }),
  // D9: a HAT display carried by the board under it
  'hyperpixel-on-pi4-top-lid': sanitizeState({
    ...defaultState(),
    boards: [{ board: 'raspberry-pi-4b', z: 5, mount: { size: 'M2.5', hole: 'insert' }, top: { board: 'pimoroni-hyperpixel-4' } }],
  }),
  'lcd1602-box': sanitizeState({
    ...defaultState(),
    boards: [{ board: 'lcd-1602-i2c', on: 'ceiling', z: 0.3, mount: { size: 'M2.5', hole: 'nut' } }],
  }),
};

function part(mesh: SurfaceMesh): PartEntry {
  const report = validateMesh(mesh);
  return {
    triangles: report.triangleCount,
    volume: Math.round(report.volume * 100) / 100,
    extents: report.extents.map((value) => Math.round(value * 1000) / 1000),
  };
}

describe('golden cases', () => {
  it('match the pinned geometry', async () => {
    const csg = await initCSG();
    const actual: Record<string, Entry> = {};
    for (const [name, state] of Object.entries(STATES)) {
      const built = buildCase(csg, state, SEGMENTS);
      actual[name] = {
        body: part(built.body), lid: part(built.lid),
        ...(built.clamps ? { clamp: part(built.clamps) } : {}), ...(built.lidClamps ? { lidClamp: part(built.lidClamps) } : {}),
      };
    }
    if (process.env.UPDATE_GOLDEN || !existsSync(GOLDEN_PATH)) {
      // say what moved, so a regeneration is a decision and not a blind overwrite
      const before: Record<string, Entry> = existsSync(GOLDEN_PATH) ? JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) : {};
      const changed = Object.keys(actual).filter((name) => before[name] && JSON.stringify(before[name]) !== JSON.stringify(actual[name]));
      const added = Object.keys(actual).filter((name) => !before[name]);
      const removed = Object.keys(before).filter((name) => !actual[name]);
      // vitest hides a passing test's console output; the terminal gets it directly
      process.stdout.write(`golden: ${changed.length} changed${changed.length ? ` (${changed.join(', ')})` : ''}, ${added.length} added${added.length ? ` (${added.join(', ')})` : ''}, ${removed.length} removed${removed.length ? ` (${removed.join(', ')})` : ''}\n`);
      writeFileSync(GOLDEN_PATH, `${JSON.stringify(actual, null, 2)}\n`);
      return;
    }
    const golden: Record<string, Entry> = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8'));
    expect(Object.keys(actual).sort()).toEqual(Object.keys(golden).sort());
    for (const name of Object.keys(golden)) expect(actual[name], name).toEqual(golden[name]);
  });
});
