// Built-in presets. Each is a partial state laid over the default and passed
// through sanitizeState, so an entry only says what makes it different.
//
// A preset is known by its `id`; the name and the note live in the UI
// dictionaries (`preset.<id>`, `preset.<id>.note`).

import type { AppState } from './schema';
import { defaultState, sanitizeState } from './schema';

export interface Preset {
  id: string;
  build(): AppState;
}

function make(id: string, extra: (base: AppState) => Record<string, unknown>): Preset {
  return {
    id,
    build: () => {
      const base = defaultState();
      return sanitizeState({ ...base, ...extra(base) });
    },
  };
}

export const PRESETS: Preset[] = [
  // A desktop case for the Pi 4: vents on both sides, the lid on four screws
  // into heat-set inserts, a label on top.
  make('pi4-desktop', (base) => ({
    shape: { ...base.shape, cornerR: 6, edgeR: 2 },
    boards: [{ board: 'raspberry-pi-4b', z: 5, mount: { size: 'M2.5', hole: 'insert' } }],
    lid: { ...base.lid, fastening: 'screws', screw: { size: 'M2.5', hole: 'insert', head: 'counterbore' } },
    vents: { on: true, faces: ['left', 'back'], pattern: 'slots', size: 2, pitch: 4, margin: 4, along: 'y' },
    label: { on: true, text: 'Raspberry Pi 4', sizeMm: 5, depth: 0.6, raised: false },
  })),

  // A flat case for the Pi Zero with the GPIO header reachable through the lid.
  make('pi-zero-gpio', (base) => ({
    shape: { ...base.shape, cornerR: 3, margin: { side: 2, top: 9 } },
    boards: [{ board: 'raspberry-pi-zero-2-w', z: 3, cuts: { gpio: true } }],
  })),

  // A small box for an ESP32 sensor: hex vents front and back, keyholes for
  // the wall, the board slid into rails.
  make('esp32-sensor-box', (base) => ({
    shape: { ...base.shape, cornerR: 4, margin: { side: 3, top: 6 } },
    boards: [{ board: 'esp32-devkitc-v4' }],
    vents: { on: true, faces: ['front', 'back'], pattern: 'hex', size: 3, pitch: 5, margin: 3, along: 'y' },
    wallMount: { kind: 'keyholes', spacing: 30, screwD: 3.5 },
    label: { on: true, text: 'SENSOR', font: 'oswald', sizeMm: 5, depth: 0.6, raised: true },
  })),

  // An Arduino Uno box with the headers open for jumper wires.
  make('arduino-uno-box', (base) => ({
    shape: { ...base.shape, cornerR: 5 },
    boards: [{ board: 'arduino-uno', z: 5, mount: { size: 'M3', hole: 'tap' } }],
    lid: { ...base.lid, fastening: 'screws', screw: { size: 'M3', hole: 'tap', head: 'counterbore' } },
  })),

  // A round puck for a LoRa node: the display shows through the lid, round
  // vents on the bottom, ears for screwing it down.
  make('cylinder-puck', (base) => ({
    shape: { ...base.shape, kind: 'cylinder', edgeR: 3, margin: { side: 3, top: 2 } },
    boards: [{ board: 'heltec-wifi-lora-32-v3', z: 4 }],
    vents: { on: true, faces: ['bottom'], pattern: 'round', size: 3, pitch: 6, margin: 3, along: 'y' },
    wallMount: { kind: 'ears', spacing: 40, screwD: 3.5 },
  })),

  make('plain-box', (base) => ({ boards: [], shape: { ...base.shape, auto: false, size: { w: 100, d: 70, h: 35 } } })),
];

export function presetById(id: string): Preset | undefined {
  return PRESETS.find((preset) => preset.id === id);
}
