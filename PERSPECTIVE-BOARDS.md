# Perspective boards — what to add to the catalog next

Researched on 2026-10-22. The goal is to add the boards people are using
*now*, because those are the ones they will print cases for. A board only
belongs in the catalog if it scores on all three of these:

1. **Demand, measured rather than guessed.** Each segment has its own
   signals, listed below.
2. **It is sold as a bare PCB that needs a case.** Finished devices
   (SenseCAP, T-Deck, HA Green, Zigbee sticks) are out. So are mini-ITX
   boards, which go into PC cases, and boards that live inside something
   else (keyboards, LED panels).
3. **There is a drawing to transcribe from** (`.claude/skills/add-board`).
   Where a board has an official PDF, DXF or STEP, it keeps its rank. With
   only a community measurement it can still go in, but as `verified:
   false` (≈). If there is no drawing at all, the board drops a tier.

A board that only varies an existing catalog entry (same outline,
different ports) costs little, so it moves up.

## Signals and what they are worth

| Signal | Segment | What it measures | Caveat |
|---|---|---|---|
| Meshtastic node maps (`meshmap.net/nodes.json`, 9,528 nodes; meshview Bay Area 1,597 and New York 1,923) | LoRa | Share of live nodes per hardware model | Only nodes that publish position over MQTT. This skews toward fixed ESP32 nodes. The US is RAK-heavy and the world is Heltec-heavy |
| Home Assistant analytics (`analytics.home-assistant.io`, 707k installs) | SBC, ESPHome | HA OS board share, integration installs | Covers HA users only |
| Klipper host images, GitHub release downloads (MainsailOS, BTT CB1/CB2) | SBC | Downloads per board image | Includes re-downloads and image variants |
| Vendor image downloads on GitHub (Radxa, Milk-V, Sipeed) | SBC | Downloads | Same caveat |
| Armbian `config/boards/*.conf/.csc` and `github.armbian.com/armbian-images.json` | SBC | Support tier (platinum, standard `.conf`, community `.csc`), year introduced, date of the newest image | **Armbian publishes no download counts.** The "Popularity" sort on armbian.com/boards puts sponsors and partners first, so it shows support, not demand |
| DietPi, HA OS, OpenWrt 25.12 images, the archived Joshua Riek ubuntu-rockchip | SBC | Whether a second OS ecosystem supports the board | Yes/no only |
| CircuitPython downloads (`circuitpython.org/downloads`, 685 boards, counts refreshed monthly) | MCU | Downloads per board | Time window not stated. Anything under about 1,000 is noise |
| GitHub code search: `board = <id>` in `platformio.ini`, `board:` in ESPHome YAML | MCU | Projects per board | All-time, not current |
| MicroPython builds, WLED's list of compatible controllers, Meshtastic and MeshCore variants | MCU | Whether the board is supported | Yes/no only |
| Reviews: raspberry.tips 14-board comparison (2026-10-14), CNX "2025 in review", XDA 2026 | SBC | Editorial attention | Qualitative |

What the numbers say about boards already in the catalog:

- **Heltec WiFi LoRa 32 V3** is #1 in Meshtastic worldwide (20.4 %).
- **Pi 4 and Pi 5** lead HA OS (16.5 % and 9.9 %). Raspberry Pi also outdraws every other Klipper host by an order of magnitude (MainsailOS images: 37k + 21k downloads against 1.6k for the best non-Pi board).
- **Pico** is #1 in CircuitPython (61k).
- **ROCK 5B** has 78k image downloads.
- **ESP32-S3-DevKitC-1** has 11k projects on PlatformIO; the generic `esp32dev` id, used mostly by the DevKit V1 clones, has 34k.
- **D1 mini** is first on WLED's DIY list.

Some of these heavily used entries are still ≈ (`verified: false`): Uno,
Mega, Orange Pi 5, ESP32-DevKitC V4, Wemos D1 mini. Checking them against a
drawing is worth as much as a new board.

## Tier A — the first wave

### Single-board computers

| Board | SoC | Size, mm | Why | Drawing | Note |
|---|---|---|---|---|---|
| Radxa ROCK 5C / 5C Lite | RK3588S2 / RK3582 | 85×56 | Armbian **platinum** (until 2027-06), image dated 2026-10-22. 21k vendor image downloads. OpenWrt 25.12 | PDF + DXF + STEP v2.10: `dl.radxa.com/rock5/5c/docs/radxa_rock_5c_2d_dimensions_v2.10.pdf`, `…_2d_top_v2.10.dxf.zip` | Pi 4 layout |
| Radxa ROCK 5B+ | RK3588 | 100×75 | Armbian **platinum**. In the raspberry.tips 2026 test. Replaces the 5B in the catalog | DXF `dl.radxa.com/rock5/5b+/docs/hw/radxa_rock5bp_v12_2d.zip`, STEP `…/rock5bp_pcba_3d_V1_2_20250314.stp` | Close to `radxa-rock-5b` |
| Radxa ROCK 4D | RK3576 | 85×56 | Armbian `.conf`. On CNX's list of notable 2025 boards | PDF/DXF/STEP: `dl.radxa.com/rock4/4d/docs/hw/Radxa_ROCK_4D_2D_V1.11_20250328.pdf` | |
| Radxa Dragon Q6A | QCS6490 | 85×56 (≈) | 2025, Armbian `.conf`, sold as a Pi alternative from $76 | PDF/DXF/STEP v1.21: `dl.radxa.com/dragon/q6a/hw/radxa_dragon_q6a_2d_dimensions_v1.21.pdf` | |
| Orange Pi 5 Plus | RK3588 | 100×75 | Armbian `.conf` (standard), image dated 2026-08. raspberry.tips 2026: "price-performance winner". DietPi | `OPI-5PLUS-PCBA.rar` linked as "Mechanical" on the vendor's service page (Google Drive, contents not opened) | |
| Orange Pi 5 Max | RK3588 | 89×57 | Armbian `.csc`, image dated 2026-10-20. Widely sold | `OPi_5_Max_V1_1-DXF.pdf` (Google Drive) | |
| Orange Pi 5 Pro | RK3588S | 89×56 | Armbian `.csc`. In the raspberry.tips 2026 test | `OPi_5_Pro_V1_2_1-dxf.pdf` (Google Drive) | |
| Orange Pi Zero 3W | Allwinner A733 | 65×32 | 2025. Armbian `.conf`, which is unusual for an Orange Pi. Pi Zero format with PCIe | DXF top/bottom + position diagram (Google Drive folder `199S7SkbqVDjMpPT7tkcbBX6kmbfnz94r`) | |
| Raspberry Pi CM5 IO Board | CM5 (BCM2712) | 160×90 | CM5 since Nov 2024, in production until at least 2036. CM5 carriers are a lively category | Datasheet §6.1: `datasheets.raspberrypi.com/cm5/cm5io-datasheet.pdf` (checked) | Large board |
| BIGTREETECH Pi V1.2 (CB1) | Allwinner H616 | 85×56 | Klipper host. The CB1 image, shared with the BTT Pi, has 47k + 11k downloads. Its users own printers by definition | STEP `github.com/bigtreetech/BTT-Pi/3D/BIGTREETECH_Pi_V1.2.zip`, PDF `Hardware/BIGTREETECH_Pi_V1.2.1.pdf` | |
| Arduino UNO Q | QRB2210 + STM32U585 | 68.58×53.34 | Oct 2025, the flagship after Qualcomm bought Arduino. Armbian `.conf`. Third-party cases already sell | Datasheet §12: `docs.arduino.cc/resources/datasheets/ABX00162-datasheet.pdf`, CAD `ABX00162-cad-files.zip` | Uno outline with different ports (USB-C, no USB-B or barrel jack). A separate entry, not an alias |

### Microcontrollers and LoRa

| Board | MCU | Size, mm | Holes | Why | Drawing | Note |
|---|---|---|---|---|---|---|
| Heltec WiFi LoRa 32 **V4** | ESP32-S3 + SX1262 | 51.7×25.4 | Ø1.9 | Meshtastic **17.1 %**, #2 worldwide about a year after its 2025 release. MeshCore | Datasheet p. 15: `s.heltec.cn/download/WiFi_LoRa_32_V4/datasheet/WiFi_LoRa_32_V4.3.1_Datasheet.pdf` | Close to `heltec-wifi-lora-32-v3` |
| RAK19007 base + RAK4631 (also RAK3401 1 W) | nRF52840 + SX1262 | 30×60 | M1.2 | Meshtastic 11.0 % worldwide, **20–23 % in the US (#1)**. On Meshtastic's "community favorites" list | RAK19007 datasheet, figures 11–13: `docs.rakwireless.com/product-categories/wisblock/rak19007/datasheet/` | Modular: the base board with a module on top |
| Heltec Mesh Node T114 | nRF52840 + SX1262 | 50.8×22.86 | **none** | Meshtastic 3.8 % (4.4–4.7 % in the US) | Outline: `resource.heltec.cn/download/Mesh_Node_T114/Datasheet.pdf` p. 10 | Rails |
| Raspberry Pi Pico 2 / Pico 2 W | RP2350 | 51×21 | 4×Ø2.1 | CircuitPython: Pico 2 W 17.1k (#3), Pico 2 15.5k (#4). Pico W is #2 at 17.2k | `datasheets.raspberrypi.com/pico/pico-2-datasheet.pdf`, STEP `Pico-2-step-20240708.zip` | Same footprint as the catalog Pico: probably an alias of `raspberry-pi-pico` (check the debug header and the W's antenna) |
| Seeed XIAO family (ESP32-S3/-C3/-C6, RP2040/RP2350, nRF52840, SAMD21, MG24) | various | 21×17.8 | none | CircuitPython: RP2040 3.7k, nRF52840 Sense 3.4k, S3 2.8k. PlatformIO: S3 1.5k, C3 1.3k. Meshtastic: XIAO S3 + Wio-SX1262 3.1 %, XIAO nRF52 2.3 %, and the XIAO is inside the SenseCAP Solar Node (5 %) | Official DXF/STEP: `files.seeedstudio.com/wiki/SeeedStudio-XIAO-ESP32S3/res/XIAO_ESP32S3_v1.1_Dimensioning.dxf`, `…/XIAO-BLE/XIAO-nRF52840-DXF.zip`, `…/XIAO-RP2040/res/XIAO-RP2040-DXF.zip` | One outline, several variants. Rails. The S3 Sense with its camera is 15 mm tall |
| Adafruit Feather (RP2040, ESP32-S3 incl. TFT, RP2350, ESP32 V2, nRF52840, M4) | various | 50.8×22.86 | 4×Ø2.54 | CircuitPython: Feather RP2040 3.2k, S3 Reverse TFT 2.3k, M4 2.1k, and more | Specification `learn.adafruit.com/adafruit-feather/feather-specification`, Eagle files in `github.com/adafruit/Adafruit-Feather-*-PCB` | One outline covers dozens of boards |
| ESP32 DevKit V1, 30-pin (DOIT and clones) | ESP32 | 51.8×28.2 (≈) | 4×Ø2.8 (≈) | PlatformIO `esp32doit-devkit-v1` 11.6k, plus most of `esp32dev` (34k). ESPHome `esp32dev` 6k | Community only: `forum.fritzing.org/t/doit-esp32-devkit-v1/6158` | ≈. Not the same board as the catalog's DevKitC V4 |
| ESP32-C3 SuperMini | ESP32-C3 | 22.5×18 | none | CircuitPython 2.2k. About 8k GitHub mentions. On WLED's DIY list | Pinout images only (mischianti.org) | ≈, rails |
| ESP32-2432S028R "Cheap Yellow Display" | ESP32 + 2.8″ TFT | 86×50 | 4×M3 | CircuitPython 1.8k. Community repo with 4.5k stars, updated 2026-09 | Community: `mischianti.org/esp32-2432s028-cheap-yellow-display-…` | ≈. The screen needs a window (a user opening on the face) |
| Waveshare Zero (RP2040-Zero, ESP32-S3-Zero, RP2350-Zero) | RP2040 / S3 / RP2350 | 23.5×18 | none | CircuitPython: RP2040-Zero **10.3k (#5)**, S3-Zero 2.2k, RP2350-Zero 1.8k | Dimension images + STEP: `waveshare.com/wiki/RP2040-Zero`, `files.waveshare.com/wiki/ESP32-S3-Zero/ESP32-S3-Zero-2D-size.jpg` | One outline. Rails |
| QuinLED Dig-Quad v3 / Dig-Uno v3 | ESP32 | Quad is 100.3 wide | M2.5 / M2 | Recommended by WLED's author. WLED is installed in 34k HA setups | `quinled.info/quinled-dig-quad-board-dimensions`, `quinled.info/2020/08/02/quinled-dig-uno-board-dimensions` | WLED users print their own cases |
| Olimex ESP32-POE-ISO (rev K) | ESP32 | ≈28×80 | yes | One of 6 ready-made ESPHome Bluetooth-proxy boards. ESPHome is installed in 153k HA setups | `github.com/OLIMEX/ESP32-POE-ISO` → `HARDWARE/Dimensions/…revision-J-dimensions.pdf` | Ethernet + PoE |

## Tier B — the second wave

High demand but no public drawing, or a strong board in a narrower niche.

**SBC**
- **NVIDIA Jetson Orin Nano Super Dev Kit** (100×79). In very high demand since Dec 2024 ($249), and the kit ships without a case. The drawing is in the Jetson Download Center (login required), and the NVIDIA forum says the carrier specification has no hole positions.
- **ODROID-M1S / N2+ / M2.** HA OS supports them officially and all are in Armbian. The drawings are not verified (wiki.odroid.com sits behind Cloudflare).
- **FriendlyElec, all with a direct DXF on the wiki, so `scripts/dxf.mjs` reads them as is and they are cheap to add:**
  - NanoPi **M6** (platinum, 90×62): `wiki.friendlyelec.com/wiki/images/f/f7/NanoPi_M6_2405_2D_CAD_DXF.zip`
  - NanoPi **M5** (platinum, 90×62)
  - NanoPC-**T6** / T6 LTS (platinum, 110×80)
  - Routers (OpenWrt 25.12): **R76S** (platinum, 58×58), **R6S** (platinum, 90×62), **R5S**, **R4S**, **R3S**. They often ship in a metal case, so fewer people need a printed one.
- **Khadas Edge2** (platinum, 82×57.5) and **VIM4 / VIM3 / VIM1S** (VIM4 is platinum, and HA OS supports the VIM series). DXF: `dl.khadas.com/products/edge2/blueprints/dxf/`, `…/vim4/blueprints/dxf/`.
- **Orange Pi 5 Ultra**, **Orange Pi 3B** (Pi 4 format), **Banana Pi BPI-M7 = ArmSoM Sige7** ("the only RK3588 board on Amazon"). All have DXF on Google Drive.
- **Radxa ZERO 3E** (a sibling of the catalog's 3W, DXF `dl.radxa.com/zero3/docs/hw/3e/radxa_zero_3e_v1200_2d.zip`) and **Radxa Dragon Q8B** (2026, DXF v1.30).
- **BIGTREETECH Pi 2 (CB2)**, 94×56. About 5k Klipper image downloads. STEP in `github.com/bigtreetech/CB2`.
- **BeagleY-AI** (85×56, Armbian `.conf`). `design/BeagleY-AI_mechanical_drawing.pdf` in `openbeagle.org/beagley-ai/beagley-ai`.
- **Libre Computer Le Potato / Sweet Potato** (Pi 3B footprint, Armbian `.conf`, a long-time Amazon seller). No drawing found; the Pi 3B+ entry could be adapted.
- **Banana Pi BPI-R4** (100.5×148). The flagship OpenWrt board with Wi-Fi 7. DXF on Google Drive, linked from the documentation.

**MCU / LoRa**
- **LilyGO T-Beam v1.x** (2.5 %), **T-Beam S3 Supreme** (1.3 %), **T3-S3** (1.2 %). Meshtastic and MeshCore. DXF in `github.com/Xinyuan-LilyGO/LilyGo-LoRa-Series/tree/master/dimensions`.
- **Seeed Wio Tracker L1** (Meshtastic 2.6 %, 3.9–5.9 % in the US). No board drawing; Seeed publishes its own printable case.
- **B&Q Station G2** (1.7 %, 4.6 % in the Bay Area). No drawing found.
- **ESP32-C6-DevKitC-1** (25.4×58.55, no holes, checked with `scripts/dxf.mjs`). Thread and Zigbee: the Thread integration has 212k HA installs. DXF: `dl.espressif.com/dl/schematics/esp32-c6-devkitc-1-dimensions_v1.2.dxf`.
- **YD-ESP32-S3 N16R8**: CircuitPython **6.0k (#6, the top ESP board)**. Check whether it matches `esp32-s3-devkitc-1`; if it does, it is an alias.
- **LilyGO T-Display S3**: about 6.4k GitHub mentions. DWG + STEP in `github.com/Xinyuan-LilyGO/T-Display-S3/dimensions`. Needs a display window.
- **Arduino Nano ESP32 / Nano R4 / Nano Matter**: the Nano outline with USB-C, a variant of `arduino-nano`. Datasheet ABX00083 §13.
- **NodeMCU ESP8266 v2 / v3**: PlatformIO `nodemcuv2` 9k. A large installed base, but declining (WLED: "not for new installs").
- **LOLIN S2 / C3 / S3 Mini** (34.3×25.4, official PDF `wemos.cc/…/dim_s2_mini_v1.0.0.pdf`). Close to the D1 mini.
- **Adafruit QT Py** (RP2040 / S3 / S2 / C3, 21.8×17.8), **ESP32-S3 SuperMini**, **Teensy 4.1 / 4.0**.
- **ESP32-P4** (Waveshare ESP32-P4-NANO, Espressif Function-EV): rising, but the drawings are not checked.
- **QuinLED Dig-Octa** (WLED, large installations).

## Tier C — backlog

- **SBC:**
  - Radxa ROCK 5T (platinum, 110×80)
  - Banana Pi M5 Pro = ArmSoM Sige5
  - Radxa Cubie A5E (STEP only)
  - Radxa E20C / E52C (OpenWrt; usually sold with a case)
  - Thundercomm RUBIK Pi 3
- **RISC-V:**
  - Orange Pi RV2 and Orange Pi 6 Plus (no drawings)
  - Banana Pi BPI-F3 (148×100)
  - SpacemiT MusePi Pro (platinum)
  - StarFive VisionFive 2
  - Milk-V Duo / Duo S (SDK 97k + 24k downloads; DXF only for the Duo S and the module)
  - Sipeed LicheeRV Nano (69k downloads, no drawing)
- **MCU:**
  - Pro Micro outline: nice!nano, SuperMini nRF52840, KB2040. These end up inside keyboards. A DIY ProMicro nRF52840 does show up as a Meshtastic node (2.1 %), with no official PCB.
  - Adafruit MatrixPortal (mounts on an LED panel)
  - Circuit Playground (round, for education)
  - Pimoroni Pico Plus 2 / Pico LiPo (Pico-format variants)
  - M5Stamp S3
  - STM32 Black Pill / Blue Pill
  - SparkFun Thing Plus
  - Arduino GIGA R1 (Mega outline)
  - ESP32-C6 SuperMini

## Not candidates

- **Finished products:** SenseCAP Solar Node (Meshtastic 5 %), T1000-E (4.2 %), T-Deck, T-Echo, Heltec MeshPocket, WisMesh Tag, Home Assistant Green and Yellow, SLZB-06, SONOFF ZBDongle, GL.iNet routers, M5Stack Atom.
- **Mini-ITX boards** (they fit a standard PC case): Radxa ROCK 5 ITX, Milk-V Jupiter, Orion O6.
- **x86 boards** (Radxa X4, ZimaBoard 2): outside the current catalog's segment.

## What the catalog needs for them

- **Boards without mounting holes** (XIAO, T114, Waveshare Zero, the SuperMinis, QT Py, LOLIN Mini) go on `rails`, as the Heltec boards and the DevKits already do.
- **Display boards** (CYD, T-Display S3) need a screen window. Today that is a user opening on the face. A `display` port type on top of the board, one that cuts a window through the lid, would make the window automatic.
- **Modular LoRa kits** (RAK19007 + RAK4631, XIAO + Wio-SX1262) are entered as one board with the stack's overall height.
- **Shared outlines go in together:** Pico 2 with Pico, UNO Q with Uno, Nano ESP32 with Nano, the ROCK 5B+ next to the 5B, Heltec V4 next to V3.
