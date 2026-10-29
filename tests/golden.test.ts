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
import { KEYPAD } from './helpers';
import { casesOf, halfHinge } from '../src/state/hinged';

const GOLDEN_PATH = join(dirname(fileURLToPath(import.meta.url)), 'golden', 'cases.json');
const SEGMENTS = 8;

interface PartEntry {
  triangles: number;
  volume: number;
  extents: number[];
}

type Entry = Record<'body' | 'lid', PartEntry> & { clamp?: PartEntry; lidClamp?: PartEntry; hinge?: PartEntry; rails?: PartEntry; lidRails?: PartEntry };

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
  }),  // K2: a keyboard hung from the lid (plans/PLAN-KEYBOARDS.md), the test keypad
  'keypad-hung-top-lid': sanitizeState({
    ...defaultState(),
    lid: { ...defaultState().lid, fastening: 'screws' },
    boards: [{ board: 'custom', custom: { ...KEYPAD, id: 'custom' }, on: 'ceiling', z: 0.3, mount: { size: 'M3', hole: 'tap' } }],
  }),
  'keypad-console-slope': sanitizeState({
    ...defaultState(),
    shape: { ...defaultState().shape, kind: 'console', console: { frontH: 20, backH: 40 } },
    lid: { ...defaultState().lid, face: 'bottom', fastening: 'screws' },
    boards: [{ board: 'custom', custom: { ...KEYPAD, id: 'custom' }, on: 'ceiling', z: 0.3, mount: { size: 'M3', hole: 'insert' } }],
  }),  // K3: one chamfered window over the keys (the holes are the keypad's default)
  'keypad-window-top-lid': sanitizeState({
    ...defaultState(),
    boards: [{ board: 'custom', custom: { ...KEYPAD, id: 'custom' }, on: 'ceiling', z: 0.3, keys: 'window', keyFit: 1, mount: { size: 'M3', hole: 'tap' } }],
  }),  // K6a: the CardKB in its window, the Grove plug's slot; the MacroPad on the floor, the ceiling at its switch plate line
  'cardkb-hung-top-lid': sanitizeState({
    ...defaultState(),
    boards: [{ board: 'm5stack-cardkb-v1.1', on: 'ceiling', z: 0.3 }],
  }),
  'macropad-floor-holes': sanitizeState({
    ...defaultState(),
    boards: [{ board: 'adafruit-macropad-rp2040', z: 12, mount: { size: 'M3', hole: 'insert' } }],
  }),
  // K3b: a hole per key for printed caps (the caps themselves are the main thread's meshes)
  'cardkb-caps-top-lid': sanitizeState({
    ...defaultState(),
    boards: [{ board: 'm5stack-cardkb-v1.1', on: 'ceiling', z: 0.3, keys: 'caps' }],
  }),  // K5: rests under the BBQ20KBD's free corners, on the floor and hung from a top lid
  'bbq20kbd-floor-rests': sanitizeState({
    ...defaultState(),
    boards: [{ board: 'solderparty-bbq20kbd', z: 12.8, mount: { size: 'M2.5', hole: 'tap' } }],
  }),
  'bbq20kbd-hung-rests': sanitizeState({
    ...defaultState(),
    boards: [{ board: 'solderparty-bbq20kbd', on: 'ceiling', z: 0.3, mount: { size: 'M2.5', hole: 'insert' } }],
  }),  // K4: the KeebDeck's flange pressed by the plate, a hole per key; K6c: the FeatherWing's two windows
  'keebdeck-hung-flange': sanitizeState({
    ...defaultState(),
    boards: [{ board: 'solderparty-keebdeck-basic', on: 'ceiling', z: 0, mount: { size: 'M2.5', hole: 'insert' } }],
  }),
  'keyboard-featherwing-floor': sanitizeState({
    ...defaultState(),
    boards: [{ board: 'solderparty-keyboard-featherwing', z: 11.69, mount: { size: 'M2.5', hole: 'tap' } }],
  }),  // review: square caps with rounded corners, on the CardKB2
  'cardkb2-square-caps': sanitizeState({
    ...defaultState(),
    boards: [{ board: 'm5stack-cardkb2', on: 'ceiling', z: 0.3, keys: 'caps', capShape: 'square', capR: 0.6, mount: { size: 'M2', hole: 'tap' } }],
  }),
  // review: the CardKB held by clamp bars across its back instead of rails
  'cardkb-clamp-top-lid': sanitizeState({
    ...defaultState(),
    boards: [{ board: 'm5stack-cardkb-v1.1', on: 'ceiling', z: 0, hold: 'clamp', mount: { size: 'M2', hole: 'insert' } }],
  }),
  // review: the widest round caps the CardKB's neighbours leave room for
  'cardkb-caps-widest': sanitizeState({
    ...defaultState(),
    boards: [{ board: 'm5stack-cardkb-v1.1', on: 'ceiling', z: 0.3, keys: 'caps', capSize: 4.4 }],
  }),
  // review: sunk 1.3 mm under the lid on clamp bars, held between them and the pads
  'cardkb2-clamp-pads-caps': sanitizeState({
    ...defaultState(),
    boards: [{ board: 'm5stack-cardkb2', on: 'ceiling', z: 1.3, hold: 'clamp', keys: 'caps', mount: { size: 'M2', hole: 'insert' } }],
  }),
  // H3: a hinged case, knuckles on a pin — both lids on top (the axis in the gap's middle)
  'hinged-knuckles': sanitizeState({
    ...defaultState(),
    shape: { ...defaultState().shape, kind: 'hinged', edgeR: 2 },
    hinge: { b: { boards: [{ board: 'esp32-devkitc-v4' }] } },
  }),
  // H3: the lower half prints on its inner face, its knuckles under it; one block of five
  'hinged-knuckles-bottom-full': sanitizeState({
    ...defaultState(),
    shape: { ...defaultState().shape, kind: 'hinged' },
    lid: { ...defaultState().lid, face: 'bottom', depth: 4 },
    hinge: { layout: 'full', knuckles: 5, barrelD: 7, b: { boards: [] } },
  }),
  // H4: a screw axle, its head and its nut sunk in each block's end knuckles
  'hinged-screw-m3': sanitizeState({
    ...defaultState(),
    shape: { ...defaultState().shape, kind: 'hinged' },
    hinge: { axle: 'screw', screw: 'M3', knuckles: 5, length: 7, b: { boards: [] } },
  }),
  // H5: a snap — the lower half's bars on the axis, the upper half's split rings
  'hinged-snap': sanitizeState({
    ...defaultState(),
    shape: { ...defaultState().shape, kind: 'hinged' },
    hinge: { axle: 'snap', barrelD: 9, b: { boards: [] } },
  }),
  // H6: two cables — a flat one in the middle with its plug, a round one near an end; one block per stretch
  'hinged-cables': sanitizeState({
    ...defaultState(),
    shape: { ...defaultState().shape, kind: 'hinged' },
    hinge: {
      layout: 'full',
      cables: [{ x: 50, kind: 'flat', w: 16, t: 0.3, plugW: 0, plugH: 4 }, { x: 20, kind: 'round', w: 5 }],
      b: { boards: [] },
    },
  }),
  // H7: a printed hinge on screws into nuts, cones printed in place, both lids on the bottom
  'hinged-leaves-cones': sanitizeState({
    ...defaultState(),
    shape: { ...defaultState().shape, kind: 'hinged' },
    lid: { ...defaultState().lid, face: 'bottom' },
    hinge: { kind: 'leaves', axle: 'cones', leafHole: 'nut', b: { boards: [], lid: { face: 'bottom' } } },
  }),
  // H8: magnets inside at the front edge (on the lower half's top lid, in the upper half's body), the gap from printed caps
  'hinged-magnets-caps': sanitizeState({
    ...defaultState(),
    shape: { ...defaultState().shape, kind: 'hinged' },
    boards: [{ board: 'm5stack-cardkb-v1.1', on: 'ceiling', z: 0.3, keys: 'caps' }],
    hinge: { magnets: true, magnet: '8x2', b: { boards: [], lid: { face: 'bottom' } } },
  }),
  // H12: a cable through the inner faces, next to the hinge edge
  'hinged-cable-face': sanitizeState({
    ...defaultState(),
    shape: { ...defaultState().shape, kind: 'hinged' },
    hinge: { cables: [{ x: 50, kind: 'flat', through: 'face', w: 20, t: 0.3 }], b: { boards: [], lid: { face: 'bottom' } } },
  }),
  // H11: pivots on the side walls, printed with the halves, on a screw; and a printed hinge's cheeks there, on a snap
  'hinged-sides-screw': sanitizeState({
    ...defaultState(),
    shape: { ...defaultState().shape, kind: 'hinged' },
    hinge: { place: 'sides', axle: 'screw', b: { boards: [] } },
  }),
  'hinged-sides-leaves-snap': sanitizeState({
    ...defaultState(),
    shape: { ...defaultState().shape, kind: 'hinged' },
    lid: { ...defaultState().lid, face: 'bottom' },
    hinge: { place: 'sides', kind: 'leaves', axle: 'snap', leafHole: 'nut', b: { boards: [], lid: { face: 'bottom' } } },
  }),
  // N1: the Heltec V4 went on rails, so a board on M1.6 screws is a Feather's (plans/PLAN-IMPROVEMENTS-2026-10-29.md)
  'feather-m1.6': sanitizeState({
    ...defaultState(),
    boards: [{ board: 'adafruit-feather-esp32-s3', mount: { size: 'M1.6', hole: 'tap', head: 'none' } }],
  }),
  // N2: rails on screws — ears outwards on the floor, along the edge on a hung board with nut pockets
  'heltec-v4-rails-screwed': sanitizeState({
    ...defaultState(),
    boards: [{ board: 'heltec-wifi-lora-32-v4', railScrews: true, pins: true }],
  }),
  'heltec-v4-rails-along-hung': sanitizeState({
    ...defaultState(),
    boards: [{ board: 'heltec-wifi-lora-32-v4', railScrews: true, railEars: 'along', on: 'ceiling', mount: { size: 'M2', hole: 'nut', head: 'none' } }],
  }),
  // N3: printed caps over a board's buttons (the lid's holes; the caps are not the worker's)
  'heltec-v4-button-caps': sanitizeState({
    ...defaultState(),
    boards: [{ board: 'heltec-wifi-lora-32-v4', on: 'floor', z: 4, buttons: 'caps', capShape: 'square', capR: 0.8 }],
  }),
  // W1: the face against the wall (plans/PLAN-MOUNT-LABELS.md)
  'keyholes-left-wall': sanitizeState({
    ...defaultState(),
    wallMount: { kind: 'keyholes', face: 'left', spacing: 30 },
  }),
  'closed-keyholes-back-top-lid': sanitizeState({
    ...defaultState(),
    wallMount: { kind: 'keyholes', keyhole: 'closed', face: 'back', spacing: 50, screwD: 4 },
  }),
  'keyholes-in-bottom-lid': sanitizeState({
    ...defaultState(),
    lid: { ...defaultState().lid, face: 'bottom', fastening: 'screws' },
    wallMount: { kind: 'keyholes', face: 'bottom', spacing: 58 },
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
    for (const [name, whole] of Object.entries(STATES)) {
      // a hinged case: an entry per half, `<name>:a` and `<name>:b`
      for (const { half, state } of casesOf(whole)) {
        const built = buildCase(csg, state, SEGMENTS, () => {}, null, half ? halfHinge(whole, half) : null);
        actual[half ? `${name}:${half}` : name] = {
          body: part(built.body), lid: part(built.lid),
          ...(built.clamps ? { clamp: part(built.clamps) } : {}), ...(built.lidClamps ? { lidClamp: part(built.lidClamps) } : {}),
          ...(built.hinge ? { hinge: part(built.hinge) } : {}),
          ...(built.railsPrint ? { rails: part(built.railsPrint) } : {}), ...(built.lidRailsPrint ? { lidRails: part(built.lidRailsPrint) } : {}),
        };
      }
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
