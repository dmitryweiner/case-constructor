// The built-in board catalog: one JSON file per board in ./data, each with
// the URL of the drawing it was transcribed from, grouped by vendor in the
// picker's order. Adding a board: the add-board skill
// (.claude/skills/add-board/SKILL.md).

import type { BoardDef } from './schema';
import { sanitizeBoard } from './schema';
import raspberryPi3aPlus from './data/raspberry-pi-3a-plus.json';
import raspberryPi3bPlus from './data/raspberry-pi-3b-plus.json';
import raspberryPi4b from './data/raspberry-pi-4b.json';
import raspberryPi5 from './data/raspberry-pi-5.json';
import raspberryPiPico from './data/raspberry-pi-pico.json';
import raspberryPiZero2W from './data/raspberry-pi-zero-2-w.json';
import bananaPiM2Zero from './data/banana-pi-m2-zero.json';
import bananaPiM5 from './data/banana-pi-m5.json';
import orangePi3Lts from './data/orange-pi-3-lts.json';
import orangePi4Pro from './data/orange-pi-4-pro.json';
import orangePi5 from './data/orange-pi-5.json';
import orangePiZero2w from './data/orange-pi-zero-2w.json';
import orangePiZero3 from './data/orange-pi-zero-3.json';
import radxaRock3a from './data/radxa-rock-3a.json';
import radxaRock4Se from './data/radxa-rock-4-se.json';
import radxaRock5b from './data/radxa-rock-5b.json';
import radxaZero3w from './data/radxa-zero-3w.json';
import repkaPi3 from './data/repka-pi-3.json';
import repkaPi4 from './data/repka-pi-4.json';
import walnutPi1b from './data/walnut-pi-1b.json';
import esp32C3Devkitm1 from './data/esp32-c3-devkitm-1.json';
import esp32Cam from './data/esp32-cam.json';
import esp32DevkitcV4 from './data/esp32-devkitc-v4.json';
import esp32S3Devkitc1 from './data/esp32-s3-devkitc-1.json';
import wemosD1Mini from './data/wemos-d1-mini.json';
import arduinoLeonardo from './data/arduino-leonardo.json';
import arduinoMega2560 from './data/arduino-mega-2560.json';
import arduinoMicro from './data/arduino-micro.json';
import arduinoNano from './data/arduino-nano.json';
import arduinoProMini from './data/arduino-pro-mini.json';
import arduinoUno from './data/arduino-uno.json';
import heltecWifiLora32V3 from './data/heltec-wifi-lora-32-v3.json';
import heltecWirelessStickLiteV3 from './data/heltec-wireless-stick-lite-v3.json';
import heltecWirelessStickV3 from './data/heltec-wireless-stick-v3.json';
import heltecWirelessTracker from './data/heltec-wireless-tracker.json';

/** Raw entries as they are in the files — the tests validate them strictly. */
export const RAW_BOARDS: readonly unknown[] = [
  raspberryPi3aPlus,
  raspberryPi3bPlus,
  raspberryPi4b,
  raspberryPi5,
  raspberryPiPico,
  raspberryPiZero2W,
  bananaPiM2Zero,
  bananaPiM5,
  orangePi3Lts,
  orangePi4Pro,
  orangePi5,
  orangePiZero2w,
  orangePiZero3,
  radxaRock3a,
  radxaRock4Se,
  radxaRock5b,
  radxaZero3w,
  repkaPi3,
  repkaPi4,
  walnutPi1b,
  esp32C3Devkitm1,
  esp32Cam,
  esp32DevkitcV4,
  esp32S3Devkitc1,
  wemosD1Mini,
  arduinoLeonardo,
  arduinoMega2560,
  arduinoMicro,
  arduinoNano,
  arduinoProMini,
  arduinoUno,
  heltecWifiLora32V3,
  heltecWirelessStickLiteV3,
  heltecWirelessStickV3,
  heltecWirelessTracker,
];

export const CATALOG: readonly BoardDef[] = RAW_BOARDS.map((raw) => sanitizeBoard(raw));

export function catalogBoard(id: string): BoardDef | undefined {
  return CATALOG.find((board) => board.id === id);
}

export function isCatalogId(id: unknown): id is string {
  return typeof id === 'string' && CATALOG.some((board) => board.id === id);
}
