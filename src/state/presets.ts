// Built-in presets: one JSON file per preset in ./presets, in the menu's
// order below. A file is `{ id, name, state }`: `state` is a partial
// state laid over the default — objects merge key by key, anything else
// (a list, a number) replaces — and passed through sanitizeState, so an entry
// only says what makes it different. A whole state (a saved project's
// `state`) works too.
//
// A preset is known by its `id`. Its name is one, in English, whatever the
// interface language (it is a name, and it travels into file names); the
// note — what the preset is for, in the menu — lives in the dictionaries
// (`preset.<id>.note`).

import type { AppState } from './schema';
import { defaultState, sanitizeState } from './schema';
import pi4Desktop from './presets/pi4-desktop.json';
import esp32SensorBox from './presets/esp32-sensor-box.json';
import esp3218650Box from './presets/esp32-18650-box.json';
import arduinoUnoBox from './presets/arduino-uno-box.json';
import cylinderPuck from './presets/cylinder-puck.json';
import klipperscreenConsole from './presets/klipperscreen-console.json';
import haWallPanel from './presets/ha-wall-panel.json';
import meshtasticCardkb from './presets/meshtastic-cardkb.json';
import meshtasticClamshell from './presets/meshtastic-clamshell.json';
import plainBox from './presets/plain-box.json';

export interface Preset {
  id: string;
  name: string;
  build(): AppState;
}

interface PresetFile {
  id: string;
  name: string;
  state: object;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `over` laid on `base`: objects merge key by key, anything else replaces. */
function overlay(base: unknown, over: unknown): unknown {
  if (!isRecord(base) || !isRecord(over)) return over;
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(over)) out[key] = overlay(base[key], value);
  return out;
}

function fromFile(file: PresetFile): Preset {
  return {
    id: file.id,
    name: file.name,
    build: () => sanitizeState(overlay(defaultState(), file.state)),
  };
}

export const PRESETS: Preset[] = [
  pi4Desktop,
  esp32SensorBox,
  esp3218650Box,
  arduinoUnoBox,
  cylinderPuck,
  klipperscreenConsole,
  haWallPanel,
  meshtasticCardkb,
  meshtasticClamshell,
  plainBox,
].map(fromFile);

export function presetById(id: string): Preset | undefined {
  return PRESETS.find((preset) => preset.id === id);
}
