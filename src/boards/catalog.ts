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
import raspberryPiCm5Io from './data/raspberry-pi-cm5-io.json';
import raspberryPiPico from './data/raspberry-pi-pico.json';
import raspberryPiZero2W from './data/raspberry-pi-zero-2-w.json';
import bananaPiM2Zero from './data/banana-pi-m2-zero.json';
import bananaPiM5 from './data/banana-pi-m5.json';
import bananaPiM64 from './data/banana-pi-m64.json';
import bigtreetechPi from './data/bigtreetech-pi.json';
import orangePi3Lts from './data/orange-pi-3-lts.json';
import orangePi4Pro from './data/orange-pi-4-pro.json';
import orangePi5 from './data/orange-pi-5.json';
import orangePi5Max from './data/orange-pi-5-max.json';
import orangePi5Plus from './data/orange-pi-5-plus.json';
import orangePi5Pro from './data/orange-pi-5-pro.json';
import orangePiZero2w from './data/orange-pi-zero-2w.json';
import orangePiZero3 from './data/orange-pi-zero-3.json';
import orangePiZero3w from './data/orange-pi-zero-3w.json';
import radxaDragonQ6a from './data/radxa-dragon-q6a.json';
import radxaRock3a from './data/radxa-rock-3a.json';
import radxaRock4Se from './data/radxa-rock-4-se.json';
import radxaRock4d from './data/radxa-rock-4d.json';
import radxaRock5b from './data/radxa-rock-5b.json';
import radxaRock5bPlus from './data/radxa-rock-5b-plus.json';
import radxaRock5c from './data/radxa-rock-5c.json';
import radxaZero3w from './data/radxa-zero-3w.json';
import repkaPi3 from './data/repka-pi-3.json';
import repkaPi4 from './data/repka-pi-4.json';
import walnutPi1b from './data/walnut-pi-1b.json';
import esp32C3Devkitm1 from './data/esp32-c3-devkitm-1.json';
import esp322432s028r from './data/esp32-2432s028r.json';
import esp32C3Supermini from './data/esp32-c3-supermini.json';
import esp32Cam from './data/esp32-cam.json';
import esp32DevkitcV4 from './data/esp32-devkitc-v4.json';
import esp32DevkitV1 from './data/esp32-devkit-v1.json';
import esp32S3Devkitc1 from './data/esp32-s3-devkitc-1.json';
import wemosD1Mini from './data/wemos-d1-mini.json';
import sunton2432s024 from './data/sunton-esp32-2432s024.json';
import sunton2432s032 from './data/sunton-esp32-2432s032.json';
import sunton3248s035 from './data/sunton-esp32-3248s035.json';
import sunton8048s043 from './data/sunton-esp32-8048s043.json';
import sunton8048s050 from './data/sunton-esp32-8048s050.json';
import sunton8048s070 from './data/sunton-esp32-8048s070.json';
import guitionJc4827w543 from './data/guition-jc4827w543.json';
import lilygoTDisplayS3 from './data/lilygo-t-display-s3.json';
import arduinoLeonardo from './data/arduino-leonardo.json';
import arduinoMega2560 from './data/arduino-mega-2560.json';
import arduinoMicro from './data/arduino-micro.json';
import arduinoNano from './data/arduino-nano.json';
import arduinoProMini from './data/arduino-pro-mini.json';
import arduinoUno from './data/arduino-uno.json';
import arduinoUnoQ from './data/arduino-uno-q.json';
import heltecWifiLora32V3 from './data/heltec-wifi-lora-32-v3.json';
import heltecMeshNodeT114 from './data/heltec-mesh-node-t114.json';
import heltecWifiLora32V4 from './data/heltec-wifi-lora-32-v4.json';
import heltecWirelessStickLiteV3 from './data/heltec-wireless-stick-lite-v3.json';
import heltecWirelessStickV3 from './data/heltec-wireless-stick-v3.json';
import heltecWirelessTracker from './data/heltec-wireless-tracker.json';
import adafruitFeather from './data/adafruit-feather.json';
import adafruitFeatherEsp32S3 from './data/adafruit-feather-esp32-s3.json';
import olimexEsp32PoeIso from './data/olimex-esp32-poe-iso.json';
import quinledDigQuad from './data/quinled-dig-quad.json';
import quinledDigUno from './data/quinled-dig-uno.json';
import rakwirelessRak19007 from './data/rakwireless-rak19007.json';
import seeedXiao from './data/seeed-xiao.json';
import seeedXiaoEsp32s3Sense from './data/seeed-xiao-esp32s3-sense.json';
import waveshareZero from './data/waveshare-zero.json';
import lcdwikiMsp2807 from './data/lcdwiki-msp2807.json';
import lcdwikiMsp1281 from './data/lcdwiki-msp1281.json';
import lcd1602I2c from './data/lcd-1602-i2c.json';
import lcdwikiMsp2401 from './data/lcdwiki-msp2401.json';
import lcdwikiMsp3520 from './data/lcdwiki-msp3520.json';
import lcdwikiMsp4021 from './data/lcdwiki-msp4021.json';
import lcdwikiMsp1901 from './data/lcdwiki-msp1901.json';
import lcdwikiMsp1691 from './data/lcdwiki-msp1691.json';
import lcdwikiMsp1141 from './data/lcdwiki-msp1141.json';
import lcdwikiMsp1308 from './data/lcdwiki-msp1308.json';
import lcdwikiMsp1541 from './data/lcdwiki-msp1541.json';
import lcdwikiMsp2008 from './data/lcdwiki-msp2008.json';
import lcdwikiMc242gx from './data/lcdwiki-mc242gx.json';
import lcdwikiMc130gx from './data/lcdwiki-mc130gx.json';
import genericOled096 from './data/generic-oled-096.json';
import lcd2004I2c from './data/lcd-2004-i2c.json';
import lcd12864St7920 from './data/lcd-12864-st7920.json';
import waveshareEsp32S3TouchLcd43 from './data/waveshare-esp32-s3-touch-lcd-4-3.json';
import mpdBh18650W from './data/mpd-bh-18650-w.json';
import mpdBh2aaW from './data/mpd-bh2aa-w.json';
import mpdBh4aaW from './data/mpd-bh4aa-w.json';
import mpdBh2aaaW from './data/mpd-bh2aaa-w.json';

/** Raw entries as they are in the files — the tests validate them strictly. */
export const RAW_BOARDS: readonly unknown[] = [
  raspberryPi3aPlus,
  raspberryPi3bPlus,
  raspberryPi4b,
  raspberryPi5,
  raspberryPiCm5Io,
  raspberryPiPico,
  raspberryPiZero2W,
  bananaPiM2Zero,
  bananaPiM5,
  bananaPiM64,
  bigtreetechPi,
  orangePi3Lts,
  orangePi4Pro,
  orangePi5,
  orangePi5Max,
  orangePi5Plus,
  orangePi5Pro,
  orangePiZero2w,
  orangePiZero3,
  orangePiZero3w,
  radxaDragonQ6a,
  radxaRock3a,
  radxaRock4Se,
  radxaRock4d,
  radxaRock5b,
  radxaRock5bPlus,
  radxaRock5c,
  radxaZero3w,
  repkaPi3,
  repkaPi4,
  walnutPi1b,
  esp32C3Devkitm1,
  esp322432s028r,
  esp32C3Supermini,
  esp32Cam,
  esp32DevkitcV4,
  esp32DevkitV1,
  esp32S3Devkitc1,
  wemosD1Mini,
  sunton2432s024,
  sunton2432s032,
  sunton3248s035,
  sunton8048s043,
  sunton8048s050,
  sunton8048s070,
  guitionJc4827w543,
  lilygoTDisplayS3,
  arduinoLeonardo,
  arduinoMega2560,
  arduinoMicro,
  arduinoNano,
  arduinoProMini,
  arduinoUno,
  arduinoUnoQ,
  heltecWifiLora32V3,
  heltecMeshNodeT114,
  heltecWifiLora32V4,
  heltecWirelessStickLiteV3,
  heltecWirelessStickV3,
  heltecWirelessTracker,
  adafruitFeather,
  adafruitFeatherEsp32S3,
  olimexEsp32PoeIso,
  quinledDigQuad,
  quinledDigUno,
  rakwirelessRak19007,
  seeedXiao,
  seeedXiaoEsp32s3Sense,
  waveshareZero,
  waveshareEsp32S3TouchLcd43,
  // displays sold on their own (their own group in the picker)
  lcdwikiMsp2807,
  lcdwikiMsp1281,
  lcd1602I2c,
  lcdwikiMsp2401,
  lcdwikiMsp3520,
  lcdwikiMsp4021,
  lcdwikiMsp1901,
  lcdwikiMsp1691,
  lcdwikiMsp1141,
  lcdwikiMsp1308,
  lcdwikiMsp1541,
  lcdwikiMsp2008,
  lcdwikiMc242gx,
  lcdwikiMc130gx,
  genericOled096,
  lcd2004I2c,
  lcd12864St7920,
  // battery holders, screwed down like boards (their own group in the picker)
  mpdBh18650W,
  mpdBh2aaW,
  mpdBh4aaW,
  mpdBh2aaaW,
];

export const CATALOG: readonly BoardDef[] = RAW_BOARDS.map((raw) => sanitizeBoard(raw));

export function catalogBoard(id: string): BoardDef | undefined {
  return CATALOG.find((board) => board.id === id);
}

export function isCatalogId(id: unknown): id is string {
  return typeof id === 'string' && CATALOG.some((board) => board.id === id);
}
