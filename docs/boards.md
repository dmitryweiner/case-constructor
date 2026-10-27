# Boards

The **Boards** card lists the boards in the case. **+ Add board** opens the
catalog: type to search, boards are grouped by vendor; a **≈** mark means the
dimensions have not yet been checked against an official drawing.

Each board has:

| Control | Range | Notes |
|---|---|---|
| Model | the family's models | entries for a family on one outline (XIAO, Feather, Waveshare Zero): where its buttons and parts are, and which openings it gets |
| X, Y | 0–300 mm | position relative to the other boards; the layout as a whole is centred in the case, so with one board these do nothing |
| Held | on the floor / from the ceiling | a display, or a board with a screen on top, hangs from the ceiling when added (see [Displays](displays.md)); on a console, from its slope |
| Standoff height | the board's underside parts + 1 mm … 60 mm | on the floor: PCB underside above the floor |
| Gap to the ceiling | 0 … 60 mm (default 0.3) | from the ceiling: from the board's front (its glass) to the inside of the top; under 0.3 mm the panel warns |
| Pins soldered downwards | on / off | boards with header rows; the default is how the board ships; the board goes up with its pins (8.5 mm with the plastic) |
| Rotation | 0° / 90° / 180° / 270° | |
| Against the wall | front / back / left / right, any of them | not on a cylinder; see below |
| Connectors from the surface | −10 … 3 mm (default 0) | with a wall: 0 — flush, negative — inside the wall, positive — standing out |
| Screw | M1.6 / M2 / M2.5 / M3 / M4 | boards with mounting holes; the default comes from the board (M1.6 is for boards only: the lid takes M2 and up) |
| Hole | tap / insert / nut | see below |

Up to 8 boards; boards that overlap, or a standoff that runs into another
board, are reported under the export button. In the view a board is drawn
see-through: the PCB green with its mounting holes through it and a pad
around each (so a standoff visibly lines up with its hole), connectors and
parts amber.

## Against the wall

By default the boards sit in the middle of the case with the side margin all
around, so a plug has to reach through the margin and the wall. **Against
the wall** moves the case's wall to the board instead: on that side the
board's most protruding connector ends at the case's outer surface (or
*Connectors from the surface* away from it), and the wall around each
connector is opened all the way through, from the board edge out. Several
walls at once are fine — a Raspberry Pi 4 against the front and the right has
both its HDMI and its USB/Ethernet sides flush.

- A side with no connectors, or with connectors shorter than the wall, puts
  the board 0.3 mm from the inner wall; with connectors a note (grey, ℹ)
  names the board and the walls and says how much deeper their faces sit
  than asked — and, when they do stick out past the board's edge, which
  wall would bring them flush. Connectors that end at the board's edge
  (a custom board's default Out of 0) are usually fine: a plug reaches them
  through the opening.
- With a manual size the board is pushed to its wall rather than centred.
- When another board reaches further towards the same wall, the wall goes
  there and the panel says which board is not against which wall and which
  board takes it (align them, or untick that wall).
- Not offered: on a cylinder, on an edge held by rails, and on the side
  where a side lid is.
- The lid's skirt and corner posts still run along the walls: a post next to
  the board is reported as for any layout.

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
  from the type; a new port is named after its type, `led-1`, `button-2`,
  and the name follows a type change) and where it is: on an edge (front,
  back, left, right — Along is the centre along that edge from its start, Z
  its bottom above the PCB's top, W × H its size, Out how far it sticks out;
  the opening goes through the wall), on top (the opening through the
  ceiling) or underneath (through the floor) — X, Y of its centre, W × D × H.
  A connector on an edge **under the board** (a double-sided board) is an
  edge port with a negative Z: −thickness − H puts it right under the PCB.
  A line under each port's fields says the same;
- **Save as catalog JSON** downloads the board in the catalog's format —
  keep it, or contribute it to the catalog (`.claude/skills/add-board`).

The custom board is part of the project and travels with the project file.

## Standoffs

A board with mounting holes stands on a standoff per hole. The standoff
diameter follows the screw (hole + 2 × 1.6 mm, at least 5 mm):

- **tap** — a pilot hole for a self-tapping screw (M1.6 1.3, M2 1.7, M2.5
  2.2, M3 2.6, M4 3.5 mm).
- **insert** — a hole for a heat-set insert (M1.6 2.4, M2 3.2, M2.5 3.5, M3
  4.0, M4 5.6 mm), as deep as the insert, with a 0.5 mm chamfer. The M1.6
  insert is an estimate until a real one is measured.
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

With **Pins soldered downwards** on, a rail along an edge with a pin row
has no lower lip: it becomes a **pin bed**. The header's plastic rests on
a shelf 2.5 mm below the PCB, the pins go into a slot along the row, and
the upper lip still clicks over the edge. Without pins the rail is the plain
one, gripping the edge from both sides.

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
| Raspberry Pi CM5 IO Board (with CM5) | Raspberry Pi | 160 × 90 | 4 × M2.5 | [source](https://datasheets.raspberrypi.com/cm5/cm5io-datasheet.pdf) | yes |
| Raspberry Pi Pico / Pico W / Pico 2 / Pico 2 W | Raspberry Pi | 21 × 51 | 4 × M2 | [source](https://datasheets.raspberrypi.com/pico/pico-2-datasheet.pdf) | yes |
| Raspberry Pi Zero 2 W / Zero W | Raspberry Pi | 65 × 30 | 4 × M2.5 | [source](https://datasheets.raspberrypi.com/rpizero2/raspberry-pi-zero-2-w-mechanical-drawing.pdf) | yes |
| Banana Pi BPI-M2 Zero | Banana Pi | 65 × 30 | 4 × M2.5 | [source](https://wiki.banana-pi.org/Banana_Pi_BPI-M2_ZERO) | ≈ |
| Banana Pi BPI-M5 | Banana Pi | 85 × 56 | 4 × M2.5 | [source](https://wiki.banana-pi.org/Banana_Pi_BPI-M5) | ≈ |
| Banana Pi BPI-M64 | Banana Pi | 91.4 × 59.9 | 4 × M2.5 | [source](https://drive.google.com/drive/folders/0B4PAo2nW2Kfnfkd0QmxaU3F2bHBWdkFiS09vT3VoZkVyNW93OXFjM0dHRVdGazhRWmFzZDQ) | ≈ |
| BIGTREETECH Pi V1.2 / BTT Pi (CB1) | BIGTREETECH | 85 × 56 | 4 × M2.5 | [source](https://github.com/bigtreetech/BTT-Pi/blob/master/3D/BIGTREETECH_Pi_V1.2.zip) | yes |
| Orange Pi 3 LTS | Orange Pi | 85 × 56 | 4 × M2.5 | [source](https://www.orangepi.org/html/hardWare/computerAndMicrocontrollers/details/orange-pi-3-LTS.html) | ≈ |
| Orange Pi 4 Pro | Orange Pi | 89.06 × 56 | 4 × M2.5 | [source](https://drive.google.com/drive/folders/1eb7S3xMriPHYjE6dfLSS5q-cSjVXvbQw) | ≈ |
| Orange Pi 5 | Orange Pi | 100 × 62 | 4 × M2.5 | [source](https://www.orangepi.org/html/hardWare/computerAndMicrocontrollers/details/Orange-Pi-5.html) | ≈ |
| Orange Pi 5 Max | Orange Pi | 89 × 57 | 4 × M2.5 | [source](https://drive.google.com/file/d/1HTPhgRq5EuVlTSzSiLY6-X320II8eArF/view) | yes |
| Orange Pi 5 Plus | Orange Pi | 100 × 75 | 4 × M3 | [source](https://drive.google.com/file/d/1rW0tlabPHQ-_rhFcBBpHRGK9TQmT1JEP/view) | yes |
| Orange Pi 5 Pro | Orange Pi | 89.07 × 56 | 4 × M2.5 | [source](https://drive.google.com/file/d/10j5W9Dki9KfirN4JE5pp6X2RujavGOyS/view) | yes |
| Orange Pi Zero 2W | Orange Pi | 65 × 30 | 4 × M2.5 | [source](https://www.orangepi.org/html/hardWare/computerAndMicrocontrollers/details/Orange-Pi-Zero-2W.html) | ≈ |
| Orange Pi Zero 3 | Orange Pi | 50 × 55 | 4 × M2.5 | [source](https://www.orangepi.org/html/hardWare/computerAndMicrocontrollers/details/Orange-Pi-Zero-3.html) | ≈ |
| Orange Pi Zero 3W | Orange Pi | 65 × 32 | 4 × M2.5 | [source](https://drive.google.com/drive/folders/199S7SkbqVDjMpPT7tkcbBX6kmbfnz94r) | yes |
| Radxa Dragon Q6A | Radxa | 85 × 56 | 4 × M2.5 | [source](https://dl.radxa.com/dragon/q6a/hw/radxa_dragon_q6a_2d_dimensions_v1.21.pdf) | yes |
| Radxa ROCK 3A | Radxa | 85 × 54 | 4 × M2.5 | [source](https://dl.radxa.com/rock3/docs/hw/3a/radxa_rock_3a_v1310_2d_dxf.zip) | ≈ |
| Radxa ROCK 4 SE | Radxa | 85 × 54 | 4 × M2.5 | [source](https://docs.radxa.com/en/rock4/rock4se) | ≈ |
| Radxa ROCK 4D | Radxa | 85 × 56 | 4 × M2.5 | [source](https://dl.radxa.com/rock4/4d/docs/hw/Radxa_ROCK_4D_2D_DXF_V1.11_20250328.zip) | yes |
| Radxa ROCK 5B | Radxa | 100.2 × 74.25 | 5 × M2.5 | [source](https://dl.radxa.com/rock5/5b/docs/hw/radxa_rock5b_v141_dimension_20220728_pdf.zip) | yes |
| Radxa ROCK 5B+ | Radxa | 100.2 × 74.24 | 5 × M2.5 | [source](https://dl.radxa.com/rock5/5b+/docs/hw/radxa_rock5bp_v12_2d.zip) | yes |
| Radxa ROCK 5C / ROCK 5C Lite | Radxa | 85 × 56 | 4 × M2.5 | [source](https://dl.radxa.com/rock5/5c/docs/radxa_rock_5c_2d_top_v2.10.dxf.zip) | yes |
| Radxa ZERO 3W | Radxa | 65 × 30 | 4 × M2.5 | [source](https://dl.radxa.com/zero3/docs/hw/3w/radxa_zero_3w_2d_dxf.zip) | ≈ |
| Repka Pi 3 | Repka Pi | 85 × 56 | 4 × M2.5 | [source](https://repka-pi.ru/) | ≈ |
| Repka Pi 4 | Repka Pi | 85 × 56 | 4 × M2.5 | [source](https://repka-pi.ru/) | ≈ |
| Walnut Pi 1B | Walnut Pi | 85 × 56 | 4 × M2.5 | [source](https://www.walnutpi.com/) | ≈ |
| ESP32-C3-DevKitM-1 | Espressif | 25.4 × 44.3 | rails (long) | [source](https://dl.espressif.com/dl/schematics/DIMENSION_ESP32-C3-DEVKITM-1_V1_20200915AA.pdf) | yes |
| ESP32-2432S028R (Cheap Yellow Display) / Guition JC2432W328 | Espressif | 86 × 50 | 4 × M3 | [source](https://github.com/witnessmenow/ESP32-Cheap-Yellow-Display/blob/main/OriginalDocumentation/3-Structure_Diagram/Dimensions.png) | ≈ |
| ESP32-C3 SuperMini | Espressif | 18 × 22.5 | rails (long) | [source](https://mischianti.org/wp-content/uploads/2025/07/ESP32-C3-SuperMini-Size.jpg) | ≈ |
| ESP32-CAM (AI-Thinker) | Espressif | 27 × 40.5 | rails (long) | [source](https://docs.ai-thinker.com/en/esp32-cam) | ≈ |
| ESP32-DevKitC V4 | Espressif | 48.2 × 27.9 | rails (long) | [source](https://dl.espressif.com/dl/schematics/esp32_devkitc_v4_pcb_layout.pdf) | yes |
| ESP32 DevKit V1, 30-pin (DOIT and clones) | Espressif | 51.8 × 28.2 | 4 × M2.5 | [source](https://forum.fritzing.org/t/doit-esp32-devkit-v1/6158) | ≈ |
| ESP32-S3-DevKitC-1 | Espressif | 25.4 × 62.74 | rails (long) | [source](https://dl.espressif.com/dl/schematics/esp_idf/DXF_ESP32-S3-DevKitC-1_V1.1_20220429.pdf) | yes |
| Wemos D1 mini (ESP8266 / ESP32) | Espressif | 34.3 × 25.4 | 2 × M1.6 | [source](https://www.wemos.cc/en/latest/_static/files/dim_d1_mini_v4.0.0.pdf) | yes |
| ESP32-2432S024R / C / N (2.4-inch) | Sunton | 74.4 × 42.9 | 4 × M3 | [source](https://github.com/NoosaHydro/2.4inch_ESP32-2432S024/blob/main/3-Structure_Diagram/Dimensions.png) | ≈ |
| ESP32-2432S032R / C / N (3.2-inch) | Sunton | 93.7 × 55 | 4 × M3 | [source](https://github.com/kpeeem/3.2inch_ESP32-2432S032/blob/main/3-Structure_Diagram/3.2.jpg) | ≈ |
| ESP32-3248S035R / C (3.5-inch CYD) | Sunton | 101.5 × 54.9 | 4 × M3 | [source](https://github.com/wegi1/ESP32-3248S035-3-5INCH-LCD/blob/main/3-Structure_Diagram/Dimensions.jpg) | ≈ |
| ESP32-8048S043 / ESP32-4827S043 (4.3-inch) | Sunton | 123 × 74 | 4 × M3 | [source](https://github.com/wegi1/ESP32-4827S043-4INCH-LCD/blob/main/3-Structure_Diagram/Dimensions.png) | ≈ |
| ESP32-8048S050C / R / N (5-inch) | Sunton | 137 × 84 | 4 × M3 | [source](https://github.com/wegi1/ESP32-8048S050-5INCH-LCD/blob/main/3-Structure_Diagram/Dimensions.png) | ≈ |
| ESP32-8048S070C / R / N (7-inch) | Sunton | 181 × 108 | 4 × M3 | [source](https://github.com/wegi1/ESP32-8048S070-7INCH-LCD/blob/main/3-Structure_Diagram/Dimensions.png) | ≈ |
| JC4827W543 C / R / N (4.3-inch) | Guition | 120 × 70.2 | 4 × M3 | [source](https://github.com/profi-max/JC4827W543_4.3inch_ESP32S3_board/blob/main/Docs/JC4827W543%20Specifications-EN.pdf) | ≈ |
| T-Display S3 (incl. Touch) | LilyGO | 26.09 × 61.98 | rails (long) | [source](https://github.com/Xinyuan-LilyGO/T-Display-S3/tree/main/dimensions) | ≈ |
| Arduino Leonardo | Arduino | 68.58 × 53.34 | 4 × M3 | [source](https://docs.arduino.cc/static/fd50e8f3be44a3217bbfd5d123295bdf/A000057-cad-files.zip) | yes |
| Arduino Mega 2560 | Arduino | 101.6 × 53.34 | 6 × M3 | [source](https://docs.arduino.cc/static/00ab83283ad8f7aae17832d0fe1b1d51/A000067-cad-files.zip) | yes |
| Arduino Micro | Arduino | 48 × 18 | rails (long) | [source](https://docs.arduino.cc/hardware/micro/) | ≈ |
| Arduino Nano / Nano Every | Arduino | 43.18 × 17.78 | rails (long) | [source](https://docs.arduino.cc/resources/datasheets/ABX00028-datasheet.pdf) | yes |
| Arduino Pro Mini | Arduino | 33 × 18 | rails (long) | [source](https://docs.arduino.cc/retired/boards/arduino-pro-mini/) | ≈ |
| Arduino Uno R3 / R4 | Arduino | 68.58 × 53.34 | 4 × M3 | [source](https://docs.arduino.cc/static/6bb7a3ca51ebee82a252f60c0b418787/A000066-cad-files.zip) | yes |
| Arduino UNO Q | Arduino | 68.58 × 53.34 | 4 × M3 | [source](https://docs.arduino.cc/resources/datasheets/ABX00162-datasheet.pdf) | yes |
| Heltec WiFi LoRa 32 V3 | Heltec | 50.2 × 25.5 | rails (long) | [source](https://resource.heltec.cn/download/WiFi_LoRa_32_V3/HTIT-WB32LA_V3.2.pdf) | yes |
| Heltec Mesh Node T114 | Heltec | 50.8 × 22.86 | rails (long) | [source](https://resource.heltec.cn/download/Mesh_Node_T114/Datasheet.pdf) | yes |
| Heltec WiFi LoRa 32 V4 | Heltec | 51.69 × 25.4 | 4 × M1.6 | [source](https://resource.heltec.cn/download/WiFi_LoRa_32_V4/datasheet/WiFi_LoRa_32_V4.3.1_Datasheet.pdf) | yes |
| Heltec Wireless Stick Lite V3 | Heltec | 58.08 × 22.6 | rails (long) | [source](https://resource.heltec.cn/download/Wireless_Stick_Lite_V3/HTIT-WSL_V3(Rev1.1).pdf) | yes |
| Heltec Wireless Stick V3 | Heltec | 58.08 × 22.6 | rails (long) | [source](https://resource.heltec.cn/download/Wireless_Stick_V3/HTIT-WS_V3(Rev1.0).pdf) | yes |
| Heltec Wireless Tracker | Heltec | 63.64 × 28 | rails (long) | [source](https://resource.heltec.cn/download/Wireless_Tracker/Wireless%20Tracker1.1.pdf) | yes |
| Adafruit Feather (RP2040 / RP2350 / ESP32 V2 / nRF52840 / M4 / M0) | Adafruit | 50.8 × 22.86 | 4 × M2.5 | [source](https://github.com/adafruit/Adafruit-Feather-RP2040-PCB) | yes |
| Adafruit Feather ESP32-S3 / S2 / C6 (incl. TFT, Reverse TFT) | Adafruit | 50.8 × 22.86 | 4 × M2 | [source](https://github.com/adafruit/Adafruit-Feather-ESP32-S3-PCB) | yes |
| Olimex ESP32-POE-ISO (rev K and later) | Olimex | 28 × 98.15 | 3 × M2 | [source](https://github.com/OLIMEX/ESP32-POE-ISO/blob/master/HARDWARE/Dimensions/Revision%20J%20and%20newer/ESP32-POE-ISO-revision-J-dimensions.pdf) | yes |
| QuinLED Dig-Quad v3 | QuinLED | 48.2 × 100.4 | 4 × M2.5 | [source](https://quinled.info/quinled-dig-quad-board-dimensions/) | yes |
| QuinLED Dig-Uno v3 / v2 | QuinLED | 48.5 × 39.4 | 4 × M2 | [source](https://quinled.info/2020/08/02/quinled-dig-uno-board-dimensions/) | yes |
| RAKwireless RAK19007 + RAK4631 / RAK3401 (WisBlock) | RAKwireless | 60 × 30 | 4 × M2.5 | [source](https://docs.rakwireless.com/product-categories/wisblock/rak19007/datasheet/) | yes |
| Seeed XIAO (ESP32-S3/C3/C6, RP2040/RP2350, nRF52840, SAMD21, MG24) | Seeed | 17.78 × 21.14 | rails (long) | [source](https://files.seeedstudio.com/wiki/SeeedStudio-XIAO-ESP32S3/res/XIAO_ESP32S3_v1.1_Dimensioning.dxf) | yes |
| Seeed XIAO ESP32-S3 Sense (with camera board) | Seeed | 17.78 × 21.14 | rails (long) | [source](https://files.seeedstudio.com/wiki/SeeedStudio-XIAO-ESP32S3/res/seeed-studio-xiao-esp32s3-sense-3d_model.zip) | yes |
| Waveshare RP2040-Zero / RP2350-Zero / ESP32-S3-Zero | Waveshare | 18 × 23.5 | rails (long) | [source](https://files.waveshare.com/wiki/RP2350-Zero/RP2350_Zero_step.zip) | yes |
| ESP32-S3-Touch-LCD-4.3 | Waveshare | 106 × 68 | 4 × M2.5 | [source](https://www.waveshare.com/w/upload/7/7f/Esp32-s3-touch-lcd-4.3-003.jpg) | yes |
| e-Paper Driver HAT (Rev 2.3) | Waveshare | 65 × 30.5 | 4 × M2.5 | [source](https://www.waveshare.com/img/devkit/LCD/7.5inch-e-Paper-HAT/7.5inch-e-Paper-HAT-details-size-2.jpg) | yes |

### Displays

Screens sold on their own have a group of their own in the picker
(*Displays*; search finds them by "display" or "screen" too). An entry gives
the window — the active area of a TFT or OLED, the visible area of a
character LCD — and the glass around it (the lens, the LCD module or the
bezel: its outline and thickness), drawn dark under the window in the view.

| Display | Vendor | Size, mm | Mount | Source | Checked |
|---|---|---|---|---|---|
| 2.8-inch SPI TFT, touch (MSP2807) | LCDwiki | 50 × 86 | 4 × M3 | [source](https://www.lcdwiki.com/res/MSP2807/MSP2807_Size.pdf) | yes |
| 1.28-inch round IPS, GC9A01 (MSP1281) | LCDwiki | 38.03 × 45.8 | 2 × M2 | [source](https://www.lcdwiki.com/res/MSP1281/MSP1281_Size.pdf) | yes |
| 1602 character LCD, PCF8574 I2C backpack | Generic | 80 × 36 | 4 × M2.5 | [source](https://cdn-shop.adafruit.com/datasheets/TC1602A-01T.pdf) | ≈ (Tinsharp's drawing; the backpack estimated) |
| 2.4-inch SPI TFT (MSP2401 / MSP2402) | LCDwiki | 42.72 × 77.18 | 4 × M3 | [source](https://www.lcdwiki.com/res/MSP2402/MSP2401_Size.pdf) | yes |
| 3.5-inch SPI TFT, touch, ILI9488 (MSP3520) | LCDwiki | 56.34 × 98 | 4 × M3 | [source](https://www.lcdwiki.com/res/MSP3520/MSP3520_Size.pdf) | yes |
| 4.0-inch SPI TFT, touch, ST7796S (MSP4021) | LCDwiki | 61.74 × 108.04 | 4 × M3 | [source](https://www.lcdwiki.com/res/MSP4021/MSP4021_Size.pdf) | yes |
| 1.9-inch IPS 170×320, ST7789 (MSP1901) | LCDwiki | 29 × 62 | 4 × M2 | [source](https://www.lcdwiki.com/res/MSP1901/MSP1901_Size.pdf) | ≈ |
| 1.69-inch IPS 240×280, ST7789 (MSP1691) | LCDwiki | 31 × 48 | 4 × M2 | [source](https://www.lcdwiki.com/res/MSP1691/MSP1691_Size.pdf) | ≈ |
| 1.14-inch IPS 135×240, ST7789 (MSP1141) | LCDwiki | 31.4 × 28 | 4 × M2 | [source](https://www.lcdwiki.com/zh/images/6/62/1.14inch_IPS_size.png) | ≈ |
| 1.3-inch IPS 240×240, ST7789 (MSP1308) | LCDwiki | 27.78 × 39.22 | 4 × M2 | [source](https://www.lcdwiki.com/zh/images/c/cb/1.3inch_IPS_Size.jpg) | ≈ |
| 1.54-inch IPS 240×240, ST7789 (MSP1541) | LCDwiki | 32 × 43.72 | 4 × M2 | [source](https://www.lcdwiki.com/zh/images/b/b5/MSP1541-size.png) | ≈ |
| 2.0-inch IPS 240×320, ST7789 (MSP2008) | LCDwiki | 36.48 × 61.12 | 4 × M2 | [source](https://www.lcdwiki.com/zh/images/c/c1/MSP2008_Size.png) | ≈ |
| 2.42-inch I2C OLED, SSD1309 (MC242GX) | LCDwiki | 72 × 43 | 4 × M2.5 | [source](https://www.lcdwiki.com/res/MC242GX/2.42inch_IIC_Module_MC242GX_Size.pdf) | yes |
| 1.3-inch I2C OLED, SH1106 (MC130GX) | LCDwiki | 35.4 × 33.5 | 4 × M2.5 | [source](https://www.lcdwiki.com/zh/images/d/d5/1.3OLED_Size.png) | ≈ |
| 0.96-inch I2C OLED, SSD1306 (128×64) | Generic | 27.3 × 27.8 | 4 × M2 | [source](https://www.lcdwiki.com/images/1/19/MC096-015.jpg) | ≈ |
| 2004 character LCD, PCF8574 I2C backpack | Generic | 98 × 60 | 4 × M2.5 | [source](https://cdn-shop.adafruit.com/datasheets/WH2004A-CFH-JT%23.pdf) | ≈ |
| 12864 graphic LCD, ST7920 (128×64) | Generic | 93 × 70 | 4 × M2.5 | [source](https://endrich.com/Datenbl%C3%A4tter/Displays%20%26%20Embedded%20Systems/Monochrome%20LCD/Grafische%20LC-Module/RG12864A2-datasheet.pdf) | ≈ |
| 2inch LCD Module, ST7789 (240×320) | Waveshare | 58 × 35 | 4 × M2 | [source](https://files.waveshare.com/upload/6/6d/2inch_LCD_Module_2D_Drawing.pdf) | ≈ |
| 1.54inch LCD Module, ST7789 (240×240) | Waveshare | 35 × 50 | 4 × M2.5 | [source](https://files.waveshare.com/wiki/1.54inch_LCD_Module/1_54inch_lcd_module_2d.zip) | yes |
| 2.0-inch 320×240 IPS TFT, ST7789 (4311) | Adafruit | 35.56 × 59.06 | 4 × M2.5 | [source](https://github.com/adafruit/Adafruit_CAD_Parts/tree/main/4311%202in%20TFT%20IPS%20Display) | ≈ |
| 1.54-inch 240×240 TFT, ST7789 (3787) | Adafruit | 43.82 × 41.91 | 4 × M2.5 | [source](https://github.com/adafruit/Adafruit_CAD_Parts/tree/main/3787%201.5in%20TFT%20Display) | ≈ |
| 1.3-inch 240×240 IPS TFT, ST7789 (4313) | Adafruit | 35.56 × 38.1 | 4 × M2.5 | [source](https://github.com/adafruit/Adafruit_CAD_Parts/tree/main/4313%201.3in%20TFT%20IPS%20Display) | ≈ |
| 1.14-inch 240×135 TFT, ST7789 (4383) | Adafruit | 31.75 × 27.81 | 4 × M2.5 | [source](https://github.com/adafruit/Adafruit_CAD_Parts/tree/main/4383%201.14in%20TFT%20Display) | ≈ |
| 1.9-inch 320×170 IPS TFT, ST7789 (5394) | Adafruit | 57.15 × 36.83 | 4 × M2.5 | [source](https://github.com/adafruit/Adafruit_CAD_Parts/tree/main/5394%201.9in%20TFT%20Display) | ≈ |
| Touch Display 2, 7-inch / Waveshare 7inch DSI LCD (H) | Raspberry Pi | 120.24 × 189.32 | clamp tabs, 4 × M2.5 on the back, Pi on its back | [source](https://pip-assets.raspberrypi.com/categories/1083-raspberry-pi-touch-display-2/documents/RP-010429-MM-3-touch-display-2-7-inch-product-brief.pdf) | yes |
| 7.5inch e-Paper V2 (800×480) panel | Waveshare | 170.2 × 111.2 | clamp bars, pressing | [source](https://files.waveshare.com/upload/6/60/7.5inch_e-Paper_V2_Specification.pdf) | yes |
| 1.69inch LCD Module, ST7789 (240×280) | Waveshare | 31.5 × 39 | clamp tabs, 4 × M2 on the back | [source](https://files.waveshare.com/upload/4/41/1.69inch_LCD_Module_2Ddrawing.pdf) | ≈ (the LCM's place on the PCB taken as centred) |
| 7-inch Touch Display (original) | Raspberry Pi | 192.96 × 110.76 | clamp tabs, 4 × M3 on the back, Pi on its back | [source](https://datasheets.raspberrypi.com/display/7-inch-display-mechanical-drawing.pdf) | ≈ |
| HDMI5 V1.2 (5-inch HDMI, 800×480) | BIGTREETECH | 121 × 76 | clamp tabs, 4 × M3 on the back | [source](https://github.com/bigtreetech/BIGTREETECH-TouchScreenHardware/tree/master/BTT%20HDMI5%20V1.2) | ≈ |
| HDMI7 V1.2 (7-inch HDMI, 1024×600) | BIGTREETECH | 165 × 100 | clamp tabs, 5 × M3 on the back | [source](https://github.com/bigtreetech/BIGTREETECH-TouchScreenHardware/tree/master/BTT%20HDMI7%20V1.2) | ≈ |
| Pi TFT50 V2 (5-inch DSI, 800×480) | BIGTREETECH | 121 × 75.78 | clamp tabs, 4 × M3 on the back, Pi on its back | [source](https://github.com/bigtreetech/BIGTREETECH-TouchScreenHardware/tree/master/BTT%20Pi%20TFT50%20V2.0%20Github) | ≈ |
| Pi TFT70 V2 (7-inch DSI, 1024×600) | BIGTREETECH | 165 × 100 | clamp tabs, 4 × M3 on the back, Pi on its back | [source](https://github.com/bigtreetech/BIGTREETECH-TouchScreenHardware/tree/master/BTT%20Pi%20TFT70%20V2.0%20Github) | ≈ |
| Pi TFT43 V2 (4.3-inch DSI, 800×480) | BIGTREETECH | 105.5 × 67 | clamp tabs, 4 × M3 on the back, Pi on its back | [source](https://github.com/bigtreetech/BIGTREETECH-TouchScreenHardware/tree/master/BTT%20Pi%20TFT43%20V2.0%20Github) | ≈ |
| 4.3inch DSI LCD (800×480) | Waveshare | 106 × 68 | clamp tabs, 4 × M2.5 on the back, Pi on its back | [source](https://www.waveshare.com/img/devkit/LCD/4.3DP/Exterior-Size.jpg) | ≈ |
| 7inch HDMI LCD (C), 1024×600 | Waveshare | 164.9 × 124.27 | 4 × M3 | [source](https://www.waveshare.com/img/devkit/LCD/7CP/Exterior-Size.jpg) | ≈ |
| TFT35-SPI V2.1 (3.5-inch SPI, 480×320) | BIGTREETECH | 98 × 56 | 4 × M3 | [source](https://github.com/bigtreetech/TFT35-SPI/blob/master/v2/Hardware/BTT%20TFT35-SPI%20V2.1_SIZE.pdf) | ≈ |
| 7.3inch e-Paper (E) Spectra 6 (800×480) panel | Waveshare | 170.2 × 111.2 | clamp bars, pressing | [source](https://www.waveshare.com/img/devkit/LCD/7.3inch-e-Paper-HAT-E/7.3inch-e-Paper-E-details-size.jpg) | yes |
| Inky Impression 7.3-inch (Spectra 6, 800×480) | Pimoroni | 174.2 × 123.2 | 4 × M2, Pi on its back | [source](https://cdn.shopify.com/s/files/1/0174/1800/files/inky-impression-7-drawing.png) | ≈ |
| Inky Impression 4-inch (Spectra 6, 600×400) | Pimoroni | 103 × 78 | 4 × M2, Pi on its back | [source](https://cdn.shopify.com/s/files/1/0174/1800/files/inky-impression-4-drawing_0f7027b5-497b-45f4-81c4-b5053cb8c9af.png) | ≈ |
| Inky Impression 13.3-inch (Spectra 6, 1600×1200) | Pimoroni | 296.7 × 210 | 4 × M2, Pi on its back | [source](https://cdn.shopify.com/s/files/1/0174/1800/files/inky-impression-13-drawing.png) | ≈ |
| 2.9inch e-Paper Module (296×128) | Waveshare | 89.5 × 38 | 4 × M2 | [source](https://www.waveshare.com/img/devkit/LCD/2.9inch-e-Paper-Module/2.9inch-e-Paper-Module-size.jpg) | ≈ |
| 4.2inch e-Paper Module (400×300) | Waveshare | 103 × 78.5 | 4 × M2.5 | [source](https://www.waveshare.com/img/devkit/LCD/4.2inch-e-Paper-Module/4.2inch-e-Paper-Module-details-size.jpg) | ≈ |
| MagTag 2.9-inch e-ink (ESP32-S2) | Adafruit | 80.01 × 53.34 | 4 × M3 | [source](https://github.com/adafruit/Adafruit_MagTag_PCBs) | ≈ |
| ESP32-S3-Touch-LCD-7 (800×480) | Waveshare | 192.96 × 110.76 | clamp tabs, 4 × M3 on the back | [source](https://www.waveshare.com/w/upload/e/e8/ESP32-S3-Touch-LCD-7-details-size-2.png) | ≈ |
| Inkplate 6 (6-inch e-paper, 1024×758) | Soldered | 144.4 × 107.8 | clamp tabs, 4 × M3 on the back | [source](https://github.com/SolderedElectronics/Soldered-Inkplate-6-hardware-design) | ≈ |
| Inkplate 10 (9.7-inch e-paper, 1200×825) | Soldered | 224.8 × 162.43 | clamp tabs, 4 × M3 on the back | [source](https://github.com/SolderedElectronics/Soldered-Inkplate-10-hardware-design) | ≈ |
| Inkplate 6COLOR (5.85-inch 7-colour e-paper, 600×448) | Soldered | 131.4 × 105.5 | clamp tabs, 4 × M3 on the back | [source](https://github.com/SolderedElectronics/Soldered-Inkplate-6-COLOR-hardware-design) | ≈ |
| Inkplate 2 (2.13-inch e-paper, 212×104) | Soldered | 65.2 × 35.2 | clamp tabs, 4 × M3 on the back | [source](https://github.com/SolderedElectronics/Soldered-Inkplate-2-hardware-design) | ≈ |
| Inkplate 5 Gen2 (5.2-inch e-paper, 1280×720) | Soldered | 130.59 × 75.23 | clamp tabs, 4 × M3 on the back | [source](https://github.com/SolderedElectronics/Soldered-Inkplate-5-Gen2-hardware-design) | ≈ |
| T5 V2.3 (2.13-inch e-paper, ESP32) | LilyGO | 36.75 × 66.29 | 4 × M2 | [source](https://github.com/Xinyuan-LilyGO/LilyGo-T5-Epaper-Series/tree/master/dimensions) | ≈ |
| HyperPixel 4.0 (touch / non-touch, 800×480) | Pimoroni | 97.85 × 58.14 | on a Pi's header (On top); clamp bars when hung | [source](https://cdn.shopify.com/s/files/1/0174/1800/files/hyperpixel-rectangular-dimensional-drawing.png) | ≈ (the active area taken as centred, the standoff for an extension header) |

### Battery holders

| Holder | Vendor | Size, mm | Mount | Source | Checked |
|---|---|---|---|---|---|
| MPD BH-18650-W (1 × 18650 holder) | MPD | 77.7 × 20.9 | 2 × M3 | [source](https://memoryprotectiondevices.com/datasheets/BH-18650-W/BH-18650-W-datasheet.pdf) | yes |
| MPD BH2AA-W (2 × AA holder) | MPD | 57.81 × 31.5 | 2 × M2 | [source](https://www.memoryprotectiondevices.com/datasheets/BH2AAW/BH2AAW-datasheet.pdf) | ≈ (holes along the length taken as centred) |
| MPD BH4AA-W (4 × AA holder) | MPD | 57.15 × 61.72 | 2 × M2 | [source](https://www.memoryprotectiondevices.com/datasheets/BH4AAW/BH4AAW-datasheet.pdf) | ≈ (holes along the length taken as centred) |
| MPD BH2AAA-W (2 × AAA holder) | MPD | 51.21 × 25.02 | 2 × M2 | [source](https://www.memoryprotectiondevices.com/datasheets/BH2AAAW/BH2AAAW-datasheet.pdf) | yes |
