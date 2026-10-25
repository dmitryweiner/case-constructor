// Built-in presets. Each is a partial state laid over the default and passed
// through sanitizeState, so an entry only says what makes it different.
//
// A preset is known by its `id`. Its name is one, in English, whatever the
// interface language (it is a name, and it travels into file names); the
// note — what the preset is for — lives in the dictionaries
// (`preset.<id>.note`).

import type { AppState } from './schema';
import { defaultState, sanitizeState } from './schema';

export interface Preset {
  id: string;
  name: string;
  build(): AppState;
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

  make('plain-box', 'Plain box', (base) => ({ boards: [], shape: { ...base.shape, auto: false, size: { w: 100, d: 70, h: 35 } } })),
];

export function presetById(id: string): Preset | undefined {
  return PRESETS.find((preset) => preset.id === id);
}
