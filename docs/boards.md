# Boards

The **Boards** card lists the boards in the case. **+ Add board** opens the
catalog: type to search, boards are grouped by vendor; a **≈** mark means the
dimensions have not yet been checked against an official drawing.

Each board has:

| Control | Range | Notes |
|---|---|---|
| X, Y | 0–300 mm | position relative to the other boards; the layout as a whole is centred in the case, so with one board these do nothing |
| Standoff height | the board's underside parts + 1 mm … 60 mm | PCB underside above the floor |
| Rotation | 0° / 90° / 180° / 270° | |
| Screw | M2 / M2.5 / M3 / M4 | boards with mounting holes; the default comes from the board |
| Hole | tap / insert / nut | see below |

Up to 8 boards; boards that overlap, or a standoff that runs into another
board, are reported under the export button. In the view a board is drawn
see-through: the PCB green with its mounting holes through it and a pad
around each (so a standoff visibly lines up with its hole), connectors and
parts amber.

## Several boards

With two boards or more the card offers:

- **Arrange** — places all the boards anew, in their order: **In a row**
  (left to right, front edges aligned), **In a column** (front to back, left
  edges aligned), **Compact** (the order split into rows so that the case
  comes out smallest: the outer area, or the diameter of a cylinder).
  **Gap** is kept between the boards — ports that stick out and rails
  included. Rotations never change: they decide which wall a connector
  faces. Arranging does not look at where a port points: a port facing a
  neighbour is yours to rotate.
- **Align to another board** (in each board's box) — moves that board only:
  its left, centre or right (X), front, centre or back (Y) lines up with the
  chosen board; **Beside** and **Behind** put it right next to it, the gap
  apart; **The same** standoff height.

Each button is one undo step.

## Your own board

**+ Custom board** adds a board you describe yourself; its card gets an
editor:

- name, width, depth and thickness of the PCB, the tallest part above and
  below it;
- **Held by** — mounting holes (with the screw size and a table of holes:
  X, Y from the board's lower-left corner in its top view, Ø) or rails
  (along the long or the short edges);
- **Ports and parts** — a type (USB-C, HDMI, display, button, …; sizes come
  from the type) and where it is: on an edge (front, back, left, right — Along
  is the centre along that edge from its start, Z its bottom above the PCB,
  W × H its size, Out how far it sticks out) or on top (X, Y of its centre,
  W × D × H);
- **Save as catalog JSON** downloads the board in the catalog's format —
  keep it, or contribute it to the catalog (`.claude/skills/add-board`).

The custom board is part of the project and travels with the project file.

## Standoffs

A board with mounting holes stands on a standoff per hole. The standoff
diameter follows the screw (hole + 2 × 1.6 mm, at least 5 mm):

- **tap** — a pilot hole for a self-tapping screw (M2 1.7, M2.5 2.2, M3 2.6,
  M4 3.5 mm).
- **insert** — a hole for a heat-set insert (M2 3.2, M2.5 3.5, M3 4.0, M4
  5.6 mm), as deep as the insert, with a 0.5 mm chamfer.
- **nut** — a hexagonal pocket for a nut, 2 mm above the floor (lower if the
  standoff is short), with a slot towards the board's centre to slide the nut
  in before the board goes on; the screw goes through a clearance hole.

Every hole stops 0.8 mm above the outer bottom, so the floor stays closed.
With a bottom lid the floor is the lid, and the standoffs stand on it.

## Rails

A board without mounting holes (ESP32-DevKitC, Heltec) is held by two rails
along its long edges: bars 3 mm thick with a groove the board's thickness +
0.3 mm wide that grips the edge 1.5 mm deep. The rails are open at both ends
and 2 mm shorter than the edge at each end: put the board in at an angle and
click it into both grooves.

Boards with soldered pin headers along the gripped edges (the
ESP32-DevKitC as shipped) collide with the lower rail lip — remove the
headers or mount the board another way. This is open for a printed test
(PLAN.md §11).

## Catalog

"Checked" means the outline, holes and connectors were transcribed from the
vendor's drawing; **≈** means some of it comes from the vendor's
specification or a typical layout and waits for a measurement (the picker
shows the same mark). New boards: the add-board skill
(`.claude/skills/add-board/SKILL.md`).

| Board | Vendor | Size, mm | Mount | Source | Checked |
|---|---|---|---|---|---|
| Raspberry Pi 3 Model A+ | Raspberry Pi | 65 × 56 | 4 × M2.5 | [source](https://datasheets.raspberrypi.com/rpi3/raspberry-pi-3-a-plus-mechanical-drawing.pdf) | yes |
| Raspberry Pi 3 Model B+ | Raspberry Pi | 85 × 56 | 4 × M2.5 | [source](https://datasheets.raspberrypi.com/rpi3/raspberry-pi-3-b-plus-mechanical-drawing.pdf) | yes |
| Raspberry Pi 4 Model B | Raspberry Pi | 85 × 56 | 4 × M2.5 | [source](https://datasheets.raspberrypi.com/rpi4/raspberry-pi-4-mechanical-drawing.pdf) | yes |
| Raspberry Pi 5 | Raspberry Pi | 85 × 56 | 4 × M2.5 | [source](https://datasheets.raspberrypi.com/rpi5/raspberry-pi-5-mechanical-drawing.pdf) | yes |
| Raspberry Pi Pico / Pico W / Pico 2 / Pico 2 W | Raspberry Pi | 21 × 51 | 4 × M2 | [source](https://datasheets.raspberrypi.com/pico/pico-2-datasheet.pdf) | yes |
| Raspberry Pi Zero 2 W / Zero W | Raspberry Pi | 65 × 30 | 4 × M2.5 | [source](https://datasheets.raspberrypi.com/rpizero2/raspberry-pi-zero-2-w-mechanical-drawing.pdf) | yes |
| Banana Pi BPI-M2 Zero | Banana Pi | 65 × 30 | 4 × M2.5 | [source](https://wiki.banana-pi.org/Banana_Pi_BPI-M2_ZERO) | ≈ |
| Banana Pi BPI-M5 | Banana Pi | 85 × 56 | 4 × M2.5 | [source](https://wiki.banana-pi.org/Banana_Pi_BPI-M5) | ≈ |
| Banana Pi BPI-M64 | Banana Pi | 91.4 × 59.9 | 4 × M2.5 | [source](https://drive.google.com/drive/folders/0B4PAo2nW2Kfnfkd0QmxaU3F2bHBWdkFiS09vT3VoZkVyNW93OXFjM0dHRVdGazhRWmFzZDQ) | ≈ |
| Orange Pi 3 LTS | Orange Pi | 85 × 56 | 4 × M2.5 | [source](https://www.orangepi.org/html/hardWare/computerAndMicrocontrollers/details/orange-pi-3-LTS.html) | ≈ |
| Orange Pi 4 Pro | Orange Pi | 89.06 × 56 | 4 × M2.5 | [source](https://drive.google.com/drive/folders/1eb7S3xMriPHYjE6dfLSS5q-cSjVXvbQw) | ≈ |
| Orange Pi 5 | Orange Pi | 100 × 62 | 4 × M2.5 | [source](https://www.orangepi.org/html/hardWare/computerAndMicrocontrollers/details/Orange-Pi-5.html) | ≈ |
| Orange Pi Zero 2W | Orange Pi | 65 × 30 | 4 × M2.5 | [source](https://www.orangepi.org/html/hardWare/computerAndMicrocontrollers/details/Orange-Pi-Zero-2W.html) | ≈ |
| Orange Pi Zero 3 | Orange Pi | 50 × 55 | 4 × M2.5 | [source](https://www.orangepi.org/html/hardWare/computerAndMicrocontrollers/details/Orange-Pi-Zero-3.html) | ≈ |
| Radxa ROCK 3A | Radxa | 85 × 54 | 4 × M2.5 | [source](https://dl.radxa.com/rock3/docs/hw/3a/radxa_rock_3a_v1310_2d_dxf.zip) | ≈ |
| Radxa ROCK 4 SE | Radxa | 85 × 54 | 4 × M2.5 | [source](https://docs.radxa.com/en/rock4/rock4se) | ≈ |
| Radxa ROCK 5B | Radxa | 100.2 × 74.25 | 6 × M2.5 | [source](https://dl.radxa.com/rock5/5b/docs/hw/radxa_rock5b_v141_dimension_20220728_pdf.zip) | ≈ |
| Radxa ZERO 3W | Radxa | 65 × 30 | 4 × M2.5 | [source](https://dl.radxa.com/zero3/docs/hw/3w/radxa_zero_3w_2d_dxf.zip) | ≈ |
| Repka Pi 3 | Repka Pi | 85 × 56 | 4 × M2.5 | [source](https://repka-pi.ru/) | ≈ |
| Repka Pi 4 | Repka Pi | 85 × 56 | 4 × M2.5 | [source](https://repka-pi.ru/) | ≈ |
| Walnut Pi 1B | Walnut Pi | 85 × 56 | 4 × M2.5 | [source](https://www.walnutpi.com/) | ≈ |
| ESP32-C3-DevKitM-1 | Espressif | 25.4 × 44.3 | rails (long) | [source](https://dl.espressif.com/dl/schematics/DIMENSION_ESP32-C3-DEVKITM-1_V1_20200915AA.pdf) | yes |
| ESP32-CAM (AI-Thinker) | Espressif | 27 × 40.5 | rails (long) | [source](https://docs.ai-thinker.com/en/esp32-cam) | ≈ |
| ESP32-DevKitC V4 | Espressif | 54.4 × 27.9 | rails (long) | [source](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/hw-reference/esp32/get-started-devkitc.html) | ≈ |
| ESP32-S3-DevKitC-1 | Espressif | 25.4 × 62.74 | rails (long) | [source](https://dl.espressif.com/dl/schematics/esp_idf/DXF_ESP32-S3-DevKitC-1_V1.1_20220429.pdf) | yes |
| Wemos D1 mini (ESP8266 / ESP32) | Espressif | 34.2 × 25.6 | rails (short) | [source](https://www.wemos.cc/en/latest/d1/d1_mini.html) | ≈ |
| Arduino Leonardo | Arduino | 68.58 × 53.34 | 4 × M3 | [source](https://docs.arduino.cc/hardware/leonardo/) | ≈ |
| Arduino Mega 2560 | Arduino | 101.6 × 53.34 | 6 × M3 | [source](https://docs.arduino.cc/resources/datasheets/A000067-datasheet.pdf) | ≈ |
| Arduino Micro | Arduino | 48 × 18 | rails (long) | [source](https://docs.arduino.cc/hardware/micro/) | ≈ |
| Arduino Nano / Nano Every | Arduino | 43.18 × 17.78 | rails (long) | [source](https://docs.arduino.cc/resources/datasheets/ABX00028-datasheet.pdf) | yes |
| Arduino Pro Mini | Arduino | 33 × 18 | rails (long) | [source](https://docs.arduino.cc/retired/boards/arduino-pro-mini/) | ≈ |
| Arduino Uno R3 / R4 | Arduino | 68.58 × 53.34 | 4 × M3 | [source](https://docs.arduino.cc/resources/datasheets/A000066-datasheet.pdf) | ≈ |
| Heltec WiFi LoRa 32 V3 | Heltec | 50.2 × 25.5 | rails (long) | [source](https://resource.heltec.cn/download/WiFi_LoRa_32_V3/HTIT-WB32LA_V3.2.pdf) | yes |
| Heltec Wireless Stick Lite V3 | Heltec | 58.08 × 22.6 | rails (long) | [source](https://resource.heltec.cn/download/Wireless_Stick_Lite_V3/HTIT-WSL_V3(Rev1.1).pdf) | yes |
| Heltec Wireless Stick V3 | Heltec | 58.08 × 22.6 | rails (long) | [source](https://resource.heltec.cn/download/Wireless_Stick_V3/HTIT-WS_V3(Rev1.0).pdf) | yes |
| Heltec Wireless Tracker | Heltec | 63.64 × 28 | rails (long) | [source](https://resource.heltec.cn/download/Wireless_Tracker/Wireless%20Tracker1.1.pdf) | yes |
