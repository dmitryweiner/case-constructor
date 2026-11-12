// Built-in presets: one JSON file per preset in ./presets, in the menu's
// order below. A file is `{ id, state }`: `state` is a partial
// state laid over the default — objects merge key by key, anything else
// (a list, a number) replaces — and passed through sanitizeState, so an entry
// only says what makes it different. A whole state (a saved project's
// `state`) works too.
//
// A preset is known by its `id` (maker-kit's core/presets). Its name
// (`preset.<id>.name`) is one, in English, in every dictionary whatever the
// interface language: it is a name, and it travels into file names; the
// note — what the preset is for, in the menu — is translated
// (`preset.<id>.note`).

import type { BuiltInPreset } from 'maker-kit/core/presets';
import { overlay } from 'maker-kit/core/presets';
import type { AppState } from './schema';
import { defaultState, sanitizeState } from './schema';
import pi4Desktop from './presets/pi4-desktop.json';
import esp32SensorBox from './presets/esp32-sensor-box.json';
import esp3218650Box from './presets/esp32-18650-box.json';
import arduinoUnoBox from './presets/arduino-uno-box.json';
import klipperscreenConsole from './presets/klipperscreen-console.json';
import haWallPanel from './presets/ha-wall-panel.json';
import repairStationClamshell from './presets/repair-station-clamshell.json';
import plainBox from './presets/plain-box.json';

export type Preset = BuiltInPreset<AppState>;

interface PresetFile {
  id: string;
  state: object;
}

function fromFile(file: PresetFile): Preset {
  return {
    id: file.id,
    build: () => sanitizeState(overlay(defaultState(), file.state)),
  };
}

export const PRESETS: Preset[] = [
  pi4Desktop,
  esp32SensorBox,
  esp3218650Box,
  arduinoUnoBox,
  klipperscreenConsole,
  haWallPanel,
  repairStationClamshell,
  plainBox,
].map(fromFile);

/**
 * What makes a project the preset it was opened from: everything but how it
 * is viewed and exported (the parts tab, the resolution, the print layout).
 * The presets button and list show a preset as open only while the project's
 * signature is still the preset's: changed, it is no longer that preset.
 */
export function presetSignature(state: AppState): string {
  return JSON.stringify({ ...state, exportMode: null, resolution: null, print: null });
}

export function presetById(id: string): Preset | undefined {
  return PRESETS.find((preset) => preset.id === id);
}
