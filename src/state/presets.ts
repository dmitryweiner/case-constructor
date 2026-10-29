// Built-in presets. Each is a partial state laid over the default and passed
// through sanitizeState, so an entry only says what makes it different.
//
// A preset is known by its `id`. Its name is one, in English, whatever the
// interface language (it is a name, and it travels into file names); the
// note — what the preset is for — lives in the dictionaries
// (`preset.<id>.note`).

import type { AppState } from './schema';
import { defaultState, sanitizeState } from './schema';
import { catalogBoard } from '../boards/catalog';
import { onFace } from '../boards/schema';

export interface Preset {
  id: string;
  name: string;
  build(): AppState;
}

/** A board's edge ports all closed: on a display's back they are far from every wall; a cable goes in through a hole instead. */
function edgePortsClosed(id: string): Record<string, boolean> {
  return Object.fromEntries((catalogBoard(id)?.ports ?? []).filter((port) => !onFace(port)).map((port) => [port.id, false]));
}

function make(id: string, name: string, extra: (base: AppState) => Record<string, unknown>): Preset {
  return {
    id,
    name,
    build: () => {
      const base = defaultState();
      return sanitizeState({ ...base, ...extra(base) });
    },
  };
}

export const PRESETS: Preset[] = [
  // A desktop case for the Pi 4: vents on both sides, the lid on four screws
  // into heat-set inserts, a label on top.
  make('pi4-desktop', 'Pi 4 desktop case', (base) => ({
    shape: { ...base.shape, cornerR: 6, edgeR: 2 },
    boards: [{ board: 'raspberry-pi-4b', z: 5, mount: { size: 'M2.5', hole: 'insert' } }],
    lid: { ...base.lid, fastening: 'screws', screw: { size: 'M2.5', hole: 'insert', head: 'counterbore' } },
    vents: { on: true, faces: ['left', 'back'], pattern: 'slots', size: 2, pitch: 4, margin: 4, along: 'y' },
    label: { on: true, text: 'Raspberry Pi 4', sizeMm: 5, depth: 0.6, raised: false },
  })),

  // A flat case for the Pi Zero with the GPIO header reachable through the lid.
  make('pi-zero-gpio', 'Pi Zero with GPIO access', (base) => ({
    shape: { ...base.shape, cornerR: 3, margin: { side: 2, top: 9 } },
    boards: [{ board: 'raspberry-pi-zero-2-w', z: 3, cuts: { gpio: true } }],
  })),

  // A small box for an ESP32 sensor: hex vents front and back, keyholes for
  // the wall, the board slid into rails.
  make('esp32-sensor-box', 'ESP32 sensor box', (base) => ({
    shape: { ...base.shape, cornerR: 4, margin: { side: 3, top: 6 } },
    boards: [{ board: 'esp32-devkitc-v4' }],
    vents: { on: true, faces: ['front', 'back'], pattern: 'hex', size: 3, pitch: 5, margin: 3, along: 'y' },
    wallMount: { kind: 'keyholes', spacing: 30, screwD: 3.5 },
    label: { on: true, text: 'SENSOR', font: 'oswald', sizeMm: 5, depth: 0.6, raised: true },
  })),

  // A battery-powered ESP32: two 18650 cells in cradles behind the board,
  // held by printed clamps on M3 screws.
  make('esp32-18650-box', 'ESP32 on 18650 cells', (base) => ({
    shape: { ...base.shape, cornerR: 4 },
    boards: [
      { board: 'esp32-devkitc-v4' },
      { board: 'battery', battery: { kind: '18650', count: 2, press: 0.3 }, x: 0, y: 43, z: 1, mount: { size: 'M3', hole: 'tap' } },
    ],
    lid: { ...base.lid, fastening: 'screws', screw: { size: 'M3', hole: 'tap', head: 'countersunk' } },
  })),

  // An Arduino Uno box with the headers open for jumper wires.
  make('arduino-uno-box', 'Arduino Uno box', (base) => ({
    shape: { ...base.shape, cornerR: 5 },
    boards: [{ board: 'arduino-uno', z: 5, mount: { size: 'M3', hole: 'tap' } }],
    lid: { ...base.lid, fastening: 'screws', screw: { size: 'M3', hole: 'tap', head: 'counterbore' } },
  })),

  // A round puck for a LoRa node: the display shows through the lid, round
  // vents on the bottom, ears for screwing it down.
  make('cylinder-puck', 'Cylinder sensor puck', (base) => ({
    shape: { ...base.shape, kind: 'cylinder', edgeR: 3, margin: { side: 3, top: 2 } },
    boards: [{ board: 'heltec-wifi-lora-32-v3', z: 4 }],
    vents: { on: true, faces: ['bottom'], pattern: 'round', size: 3, pitch: 6, margin: 3, along: 'y' },
    wallMount: { kind: 'ears', spacing: 40, screwD: 3.5 },
  })),

  // A KlipperScreen console: the BTT Pi TFT50 on the slope on clamp tabs,
  // a Pi 4 on its back, the lid underneath on screws, vents at the back.
  make('klipperscreen-console', 'KlipperScreen console', (base) => ({
    shape: { ...base.shape, kind: 'console', cornerR: 4, console: { frontH: 25, backH: 55 } },
    lid: { ...base.lid, face: 'bottom', chosen: 'bottom', fastening: 'screws', screw: { size: 'M3', hole: 'insert', head: 'counterbore' } },
    boards: [{
      board: 'btt-pi-tft50-v2', on: 'ceiling', z: 0, mount: { size: 'M3', hole: 'insert' },
      back: { board: 'raspberry-pi-4b', cuts: edgePortsClosed('raspberry-pi-4b') },
    }],
    // the cables (power, the printer's USB) leave through one hole in the back
    extraCuts: [{ face: 'back', shape: 'round', x: 30, y: 22, w: 12, h: 12, r: 0 }],
    // sparse slots: a big case's dense vents would take the preview past its budget
    vents: { on: true, faces: ['back'], pattern: 'slots', size: 3, pitch: 10, margin: 10, along: 'x' },
  })),

  // A Home Assistant wall panel: Touch Display 2 7-inch held by the lid, a Pi
  // 5 on its back, vents on the sides, keyholes on the back for the wall.
  make('ha-wall-panel', 'Home Assistant wall panel', (base) => ({
    shape: { ...base.shape, cornerR: 8 },
    lid: { ...base.lid, fastening: 'screws', screw: { size: 'M3', hole: 'insert', head: 'countersunk' } },
    boards: [{
      board: 'raspberry-pi-touch-display-2-7', on: 'ceiling', z: 0, mount: { size: 'M3', hole: 'insert' },
      back: { board: 'raspberry-pi-5', cuts: edgePortsClosed('raspberry-pi-5') },
    }],
    // the power cable comes out of the wall straight into the back of the case
    extraCuts: [{ face: 'bottom', shape: 'round', x: 60, y: 140, w: 14, h: 14, r: 0 }],
    vents: { on: true, faces: ['left', 'right'], pattern: 'slots', size: 2, pitch: 8, margin: 10, along: 'y' },
    wallMount: { kind: 'keyholes', spacing: 80, screwD: 4 },
  })),

  // A Meshtastic node with a keyboard: the Heltec V3 and an M5Stack CardKB
  // hung side by side from the lid, its screen and the keys in their
  // windows, the CardKB's Grove cable inside, the LoRa antenna through the
  // back wall.
  make('meshtastic-cardkb', 'Meshtastic node with CardKB', (base) => ({
    shape: { ...base.shape, cornerR: 6 },
    // deep enough that the Heltec's USB-C, right under the top, opens in the lid's wall, clear of its skirt
    lid: { ...base.lid, depth: 9, fastening: 'screws', screw: { size: 'M3', hole: 'insert', head: 'counterbore' } },
    boards: [
      // its Grove plug's slot reaches 12 mm left of it: the Heltec's edge lines up with the slot's
      { board: 'm5stack-cardkb-v1.1', on: 'ceiling', z: 0.3, x: 12, y: 0 },
      { board: 'heltec-wifi-lora-32-v3', on: 'ceiling', z: 0.3, x: 0, y: 60 },
    ],
    extraCuts: [{ face: 'back', shape: 'round', x: 70, y: 14, w: 6.6, h: 6.6, r: 0 }],
  })),

  // The same pair folding like a laptop (plans/PLAN-HINGED.md): the CardKB
  // under the lower half's top, the Heltec V3's screen in the upper half's,
  // the Grove cable between them through a slot in each hinge wall, the LoRa
  // antenna out of the screen half's far edge. Both
  // lids underneath, so the hinge is a printed one on screws — screw axles
  // that hold the screen at an angle — and magnets keep it closed.
  make('meshtastic-clamshell', 'Meshtastic clamshell', (base) => ({
    // deep enough that the magnets at the front edge clear the CardKB
    shape: { ...base.shape, kind: 'hinged', cornerR: 6, auto: false, size: { w: 115, d: 86, h: 20 } },
    lid: { ...base.lid, face: 'bottom', fastening: 'screws', screw: { size: 'M3', hole: 'insert', head: 'counterbore' } },
    boards: [{ board: 'm5stack-cardkb-v1.1', on: 'ceiling', z: 0.3 }],
    hinge: {
      kind: 'leaves', axle: 'screw', screw: 'M2.5', magnets: true, magnet: '6x2',
      cables: [{ x: 45, kind: 'round', w: 4, plugW: 9, plugH: 5 }],
      b: {
        // against the left wall: its USB-C opens there, sunk in the wall's thickness (it ends at the board's edge)
        boards: [{ board: 'heltec-wifi-lora-32-v3', on: 'ceiling', z: 0.3, walls: ['left'], wallOffset: -1.5 }],
        h: 20,
        // the LoRa antenna out of the screen half's far edge
        extraCuts: [{ face: 'back', shape: 'round', x: 57, y: 10, w: 6.6, h: 6.6, r: 0 }],
        lid: { ...base.lid, face: 'bottom', fastening: 'screws', screw: { size: 'M3', hole: 'insert', head: 'counterbore' } },
      },
    },
  })),

  make('plain-box', 'Plain box', (base) => ({ boards: [], shape: { ...base.shape, auto: false, size: { w: 100, d: 70, h: 35 } } })),
];

export function presetById(id: string): Preset | undefined {
  return PRESETS.find((preset) => preset.id === id);
}
