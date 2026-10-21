// The built-in board catalog: one JSON file per board in ./data, each with
// the URL of the drawing it was transcribed from. Adding a board: the
// add-board skill (.claude/skills/add-board/SKILL.md).

import type { BoardDef } from './schema';
import { sanitizeBoard } from './schema';
import raspberryPi4b from './data/raspberry-pi-4b.json';
import esp32DevkitcV4 from './data/esp32-devkitc-v4.json';
import arduinoUno from './data/arduino-uno.json';
import heltecWifiLora32V3 from './data/heltec-wifi-lora-32-v3.json';

/** Raw entries as they are in the files — the tests validate them strictly. */
export const RAW_BOARDS: readonly unknown[] = [
  raspberryPi4b,
  esp32DevkitcV4,
  arduinoUno,
  heltecWifiLora32V3,
];

export const CATALOG: readonly BoardDef[] = RAW_BOARDS.map((raw) => sanitizeBoard(raw));

export function catalogBoard(id: string): BoardDef | undefined {
  return CATALOG.find((board) => board.id === id);
}

export function isCatalogId(id: unknown): id is string {
  return typeof id === 'string' && CATALOG.some((board) => board.id === id);
}
