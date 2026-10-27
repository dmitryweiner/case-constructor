# Perspective screens — what to add to the catalog next

Researched on 2026-10-26, in the same way as `PERSPECTIVE-BOARDS.md`. The
goal is to add the displays people are using *now*, because those are the
ones they will print cases for. A display only belongs in the catalog if it
scores on all three of these:

1. **Demand, measured rather than guessed.** Each segment has its own
   signals, listed below.
2. **It is sold bare and needs a case or frame.** A panel with its driver
   board, a module, or a board with a screen on it. Displays that ship in an
   enclosure (portable monitors, BTT Pad 7, the official Touch Display 2
   case) are out.
3. **There is a drawing to transcribe from.** For a screen the drawing must
   give more than for a board: the glass or panel outline, the **active area
   and its offset** from the outline (that is the window), the thickness,
   the holes on the back, and where the FPC, HDMI or header leaves. With
   only some of that, the entry goes in as `verified: false` (≈).

A display that shares an outline and hole pattern with one already chosen
costs little, so it moves up. In the SBC segment that is common: most DSI
boards carry the Pi's own **58 × 49** hole pattern on the back, so the SBC
screws straight onto the display.

Segments:

| Segment | Status |
|---|---|
| Displays for single-board computers (DSI, HDMI, DPI, SPI HATs) | below; the signals table right after this one is this segment's |
| Boards with a screen on them (CYD/Sunton, Guition, Waveshare ESP32-S3-Touch-LCD, LilyGO T-Display, CrowPanel) | below, with its own signals |
| Small SPI/I²C modules (OLED, ST7789/ILI9341 TFT, GC9A01 round, 1602/2004, Nextion, printer displays) | below, with its own signals |
| E-paper (Waveshare, Good Display, Inky, Inkplate, TRMNL DIY, LilyGO T5) | below, with its own signals |

What the four segments say, in short:

- **Boards with a screen are the cheapest wave**: they are boards, the
  catalog takes them today (a `display` part on top). Four of them are
  variants of entries already there: Guition JC2432W328 and CYD2USB of
  the CYD, the ESP32-S3 TFT and Reverse TFT Feathers of the S3 Feather.
  Then the Sunton family (3.5″, 2.4″, 3.2″, 4.3″, 5″, 7″: one drawing
  style, holes 3.5 mm in), Waveshare ESP32-S3-Touch-LCD-4.3 (the best
  drawing of all) and -7, Guition JC4827W543, LilyGO T-Display S3.
- **Standalone displays need a new kind of placement** (the last section):
  the Pi displays (Touch Display 2, the original 7″, HyperPixel, BTT HDMI5/7
  and TFT50), the modules (0.96″ OLED, the LCDwiki MSP TFTs 2.4–4.0″, the
  round GC9A01, 1602/2004) and the e-paper panels.
- **E-paper has one dominant outline** (170.2 × 111.2, 7.5″ / 7.3″) and one
  board that fits the catalog as it is (Pimoroni Inky Impression: holes,
  a Pi on its back).
- **The generic 0.96″ SSD1306 OLED** leads every signal in its segment and
  has no vendor drawing: measure two or three sellers' boards.

## Signals and what they are worth

| Signal | Segment | What it measures | Caveat |
|---|---|---|---|
| Printables search (GraphQL API): of the top 60 results, how many have the model in the name, and their downloads summed | all | People print cases or mounts for this, the strongest signal for this project | Top 60 only. The search's own total is noise ("hdmi5" returns 735). One model can dominate (BTT HDMI5: 11.9k of 18.8k) |
| The Pi Hut review counts (Reviews.io API by SKU) | SBC | Sales to Raspberry Pi buyers (UK/EU) | All-time: favours the original 7″ (2015) over Touch Display 2 (2024) and its 10″ (2026-07) |
| Pimoroni shop review counts | SBC | Sales of Pimoroni products | Pimoroni only. Everything is pre-order / "notify me" now |
| Reddit titles since 2024-10-26 (Arctic Shift archive) | SBC | Current talk in r/raspberry_pi, r/klippers, r/homeassistant, r/cyberDeck | Word matches, not phrases; numbers like "7.9" are useless. Order of magnitude only |
| KlipperScreen GitHub issues per model; Klipper Discourse "Hardware known to work with KlipperScreen" (79 posts, 122k views); KlipperScreen `docs/Hardware.md` | SBC | What KlipperScreen users run | Small numbers (2–26). The thread dates from 2021 and leans old. The docs list is yes/no |
| GitHub stars of driver repos | SBC | Installs of the driver | Includes old installs |
| Amazon, Thingiverse | — | Not measured: behind JavaScript or bot walls | |

Raw counts, SBC segment:

- **KlipperScreen issues:** waveshare 24, DSI 24, "5 inch" 12, "7 inch" 8,
  "touch display 2" 6, hyperpixel 5, HDMI5 4, Pad 7 3, TFT35 3, HDMI7 2,
  TFT43 2.
- **Discourse thread mentions:** waveshare 26, tft50 12, tft35 8,
  sunfounder 7, tft70 4, goodtft 4, hdmi7 2, hyperpixel 2, hdmi5 1.
- **Reddit titles:** r/raspberry_pi waveshare 193, touchscreen 169, "touch
  display" 63, DSI 51, "Touch Display 2" 32, HDMI display 27, hyperpixel 6;
  r/klippers KlipperScreen 48, Pad 7 12, TFT35 9; r/homeassistant
  touchscreen 118, wall panel 112, waveshare 38; r/cyberDeck screen 154,
  waveshare 12.
- **GitHub stars:** goodtft/LCD-show 2,742 (MHS/MPI 3.5″ SPI clones),
  KlipperScreen 1,390, waveshareteam/LCD-show 459, pimoroni/hyperpixel4 359.

## Displays for single-board computers

### Tier A — high demand, drawing checked

| Display | Panel | Outline, mm | Active area, mm | Back | Why | Drawing | Note |
|---|---|---|---|---|---|---|---|
| Raspberry Pi Touch Display 2, 7″ (SC1635) | 720×1280 DSI, portrait | 120.24 × 189.32, R8, 0.7 lens; depth 14.92 (standoffs 8.5) | 86.94 × 154.56, 16.65 from the left, 17.38 from the bottom | Pi bosses 49 × 58 (Ø5, M2.5); 4 bracket holes 70.71 × 140; plate 99.71 × 168.55; DSI FPC at the centre | Printables 47 models / 15.7k. Pi Hut 48 reviews, 4.65★. r/raspberry_pi 32 titles | Product brief p. 5: `pip-assets.raspberrypi.com/categories/1083-raspberry-pi-touch-display-2/documents/RP-010429-MM-3-touch-display-2-7-inch-product-brief.pdf`; STEP `…/RP-009154-DD-3-raspberry-pi-touch-display-2-step-7inch.zip` | Waveshare 7″ DSI LCD (H) has the identical outline and holes (`waveshare.com/img/devkit/LCD/7inch-DSI-LCD-H/7inch-DSI-LCD-H-details-size.jpg`): an alias |
| Raspberry Pi 7″ Touch Display, original (SC1227) | 800×480 DSI via an adapter | lens 192.96 × 110.76; module 5.96 + standoffs | LCD 154.08 × 85.92; touch 154.88 × 86.72, 19.04 from the left, 11.0 from the top | 4 × M3 at 126.2 × 65.65; Pi 4 × M2.5 at 58 × 49; frame ≈164.9 × 100.6; 50-pin FPC on the bottom tail | Pi Hut **303 reviews**, 4.74★, still sold. Printables 57 models / 17.5k. KlipperScreen docs | `datasheets.raspberrypi.com/display/7-inch-display-mechanical-drawing.pdf` | Waveshare 7″ DSI LCD and (C) 1024×600 share the front (`waveshare.com/img/devkit/LCD/7inch-DSI-LCD-C/Exterior-Size.jpg`); their back holes only in the STEP `files.waveshare.com/upload/f/fe/7inch-dsi-lcd%20c%203D.zip` |
| BTT HDMI5 V1.2 | 5″ IPS 800×480, HDMI + USB-C touch | board 121 × 76 | not on the drawing (the STEP models the PCB only) | 4 holes 5 mm in (111 × 66), Ø not dimensioned; HDMI on the right edge, 3 buttons on the top edge, speaker; no Pi on the back | Printables 60+ models / **18.8k** (one Voron mount 11.9k). KlipperScreen docs | `github.com/bigtreetech/BIGTREETECH-TouchScreenHardware/tree/master/BTT%20HDMI5%20V1.2` (SIZE pdf, 63 MB STEP) | KlipperScreen; mounts on the printer, the Pi sits elsewhere. V1.0 has its own folder |
| Generic 7″ 1024×600 HDMI: Waveshare 7″ HDMI LCD (C) / (H) and clones | 7″ HDMI, micro-USB touch | board 164.9 × 124.27; LCM 163.92 × 97.12 | 154.08 × 85.92 | 4 ear holes 156.9 × 114.96 (one span reads 148.9 on the image); HDMI and USB on the left edge. (H) adds glass, buttons, VGA, audio | Printables "waveshare hdmi" 31 / 6.5k, "waveshare 7 inch" 19 / 4.1k, Elecrow 7″ 16 / 3.75k | `waveshare.com/img/devkit/LCD/7CP/Exterior-Size.jpg`, `files.waveshare.com/upload/3/33/7inch-hdmi-lcd-c-panel-dimension.pdf`, `…/7HP/Exterior-Size.jpg`, `files.waveshare.com/upload/9/9b/7inch_HDMI_LCD_%28H%29_drawing.zip` | Elecrow RC070 (retail 164 × 124 × 14.4) is probably the same board: unchecked. LCDwiki MPI7002 `lcdwiki.com/res/MPI7002/MPI7002_Size.pdf` did not respond |
| Pimoroni HyperPixel 4.0 (touch / non-touch) | 800×480 DPI on GPIO | PCB 97.85 × 58.14, LCD 97.20 × 58.44; depth 12 | 86.4 × 51.8 | HAT pattern 58 × 49, first hole 15.35 from the left; the Pi hangs below on standoffs | Pimoroni **221 reviews**, 4.75★. Printables 52 / 9.1k. KlipperScreen docs | `cdn.shopify.com/s/files/1/0174/1800/files/hyperpixel-rectangular-dimensional-drawing.png` | |
| Waveshare 4.3″ DSI LCD (also QLED) | 800×480 DSI | board 106 × 68 | — | corners 99.3 × 61.8; Pi 58 × 49 (25.62 from the left, 9.5 from the top) | Printables 52 / 7.1k. KlipperScreen docs | `waveshare.com/img/devkit/LCD/4.3DP/Exterior-Size.jpg`, `waveshare.net/w/upload/2/28/4.3inch_DSI_LCD_Drawing.zip` | |
| BTT Pi TFT50 V2.0 / V2.1 | 5″ DSI 800×480 | board 121 × 75.78 | — | corners 113.03 × 67.77; Pi 57.83 × 49.07, 33.5 from the left; DSI FPC on the right edge | Printables 43 / 8.0k. Discourse 12 mentions. KlipperScreen docs | `github.com/bigtreetech/BIGTREETECH-TouchScreenHardware/tree/master/BTT%20Pi%20TFT50%20V2.0%20Github` (SIZE pdf + STEP) | Family: Pi TFT70 V2.0 (165 × 100, corners 155 × 90, Pi 58.17 × 49.07, checked), Pi TFT43 V2.0 (pdf not viewed). Stock varies (BIQU: "notify me") |
| BTT HDMI7 V1.2 | 7″ IPS 1024×600 HDMI | board 165 × 100 | — | 5 holes: corners 5 mm in (155 × 90) + one on the bottom row 106.55 from the left; HDMI and USB-C on the right edge, audio top right, 3 buttons bottom; no Pi on the back | Printables 55 / 7.4k | `…/BIGTREETECH-TouchScreenHardware/tree/master/BTT%20HDMI7%20V1.2` (SIZE pdf + STEP) | Same outline and corner holes as Pi TFT70: one case fits both |
| BTT TFT35-SPI V2.1 | 3.5″ SPI, on a ribbon to the CB1/Pi | — | — | — | Printables 56 / **11.4k**. r/klippers 9 titles | `github.com/bigtreetech/TFT35-SPI` (`v2/Hardware/BTT TFT35-SPI V2.1_SIZE.pdf`, `v2/3D/…step`) | Tier A demand; the drawing is listed in the repo but was not opened, so no dimensions yet |

### Tier B — the second wave

- **Touch Display 2, 5″** (SC1975, 720×1280 DSI). Outline 91.46 × 143.4,
  R5; active area 62.1 × 110.4; depth 14.92. Back: Pi 49 × 58, brackets
  51 × 103.7, plate 72.96 × 122.74. Pi Hut 16 reviews, Printables 4 / 240.
  Brief p. 5 `…/RP-010430-MM-3-touch-display-2-5-inch-product-brief.pdf`,
  STEP `…/RP-009152-DD-3-raspberry-pi-touch-display-2-step-5inch.zip`
  (both checked, same directory as the 7″).
- **Touch Display 2, 10″** (SC2005, 1200×1920, 4-lane DSI, Pi 5 and CM only;
  launched 2026-07-22, $80). Outline 166.88 × 248.10, R5, 1.1 lens; active
  area 135.36 × 216.58, 15.76 in; depth 15.55. Back: 8 × M2.5, Pi 49 × 58,
  brackets 121.8 × 160, plate 143.36 × 228.73. Pi Hut 3 reviews,
  Printables 0 — too new to measure, but it is the Home Assistant panel
  size. Brief `…/RP-010276-MM-6-10_%20Touch%20Display%202%20product%20brief.pdf`,
  STEP `…/RP-010666-DD-2-raspberry-pi-touch-display-2-step-10inch.zip`
  (both checked). The three Touch Display 2 sizes go in together.
- **Waveshare 5″ DSI LCD** (800×480). Board 121 × 76; corners 113 × 68; Pi
  58 × 49, 25.59 from the left. Pi Hut 21 reviews, Printables 21 / 3.5k.
  `waveshare.com/img/devkit/LCD/5inch-DSI-LCD/Exterior-Size.jpg`,
  `files.waveshare.com/wiki/5inch%20DSI%20LCD/5inch-dsi-lcd_2D_Drawing.zip`.
  The 121 × 76 outline of the BTT HDMI5 and TFT50.
- **Waveshare 5″ DSI LCD (C)** (1024×600). Glass 120.7 × 77.2; active area
  109 × 65.8; depth 12.6; corners 113 × 68 (4 in); Pi 58 × 49.
  `waveshare.com/img/devkit/LCD/5inch-DSI-LCD-C/5inch-DSI-LCD-C-size.jpg`.
- **Waveshare 7″ DSI LCD (E)** (1280×800). Glass 170.18 × 104.2; active area
  151.8 × 95.1 (9.19 / 4.55 in); module 6.9. Back: M3 95 × 68 (1.5 high),
  Pi M2.5 58 × 49 (8 mm standoffs). The driver board is shared with 8″ (C)
  and 10.1″ (E).
  `waveshare.com/img/devkit/LCD/7inch-DSI-LCD-E/7inch-DSI-LCD-E-details-size.jpg`,
  STEP `files.waveshare.com/wiki/7inch-DSI-LCD-(E)/7inch_DSI_LCD_(E)_20250428_stp.zip`.
- **Waveshare 10.1″ DSI LCD (E)** (1920×1200) and **(C)** (1280×800). Glass
  239 × 147, R2; active area 217.18 × 135.96. (E): module 4.8, the same
  95 × 68 / 58 × 49 driver board 35.5 from the bottom and 67.48 from the
  right; (C): holes not on the image. (C): Pi Hut 8 reviews, a Printables
  case 742 downloads, a common Home Assistant panel.
  `…/10.1inch-DSI-LCD-E/10.1inch-DSI-LCD-E-details-size.jpg`,
  `…/10.1inch-DSI-LCD-C/10.1inch-DSI-LCD-C-details-size.jpg`.
- **Waveshare bar displays** (cyberdecks):
  - 7.9″ HDMI/DSI (400×1280): glass 207.78 × 69.8, active area 191.08 × 60.4;
    driver-board holes not dimensioned. Printables 6 / 1.1k. 3D:
    `files.waveshare.com/upload/4/43/7.9inch_HDMI_LCD_3D_Drawing.zip`.
  - 8.8″ DSI (480×1920): glass 240.5 × 68, R2, active area 219.88 × 55.72;
    back M3 105 × 57 + Pi M2.5 58 × 49; 6.45 + 8 mm standoffs.
    `…/8.8inch-DSI-LCD/8.8inch-DSI-LCD-details-size.jpg` (checked).
  - 11.9″ HDMI/DSI (320×1480): glass 287.3 × 69.8, R3, active area
    268.18 × 57.98. Printables 6 / 792. `…/11.9inch-HDMI-LCD/Exterior-Size.jpg`.
- **BTT Pi TFT43 / TFT70 V2.0**: Printables 26 / 3.4k and 14 / 2.25k; in the
  TFT50 family above.
- **Waveshare 3.5″ RPi LCD (A) and the MHS-3.5 / MPI3501 SPI clones**
  (480×320). Panel 85.06 × 56.21; active area 74.24 × 49.76; HAT footprint
  (58 × 49 assumed, not dimensioned). goodtft/LCD-show 2.7k stars and a
  KlipperScreen doc page, but Printables is low: an old installed base.
  `waveshare.com/img/devkit/LCD/3.5inch-RPi-LCD-A/Exterior-Size.jpg`,
  `files.waveshare.com/upload/0/0c/3.5inch-rpi-lcd-a-panel-dimension.pdf`
  (bare LCM only).
- **Pimoroni Display HAT Mini** (2.0″ 320×240 SPI). 65.5 × 35 × 9; active
  area 40.8 × 30.6; Pi Zero footprint, 2 standoffs. Pimoroni 52 reviews,
  Printables 2 / 383 (pwnagotchi builds).
  `cdn.shopify.com/s/files/1/0174/1800/files/DisplayHATMiniDimensionalDrawing.png`.
- **Pimoroni HyperPixel 4.0 Square** (720×720 DPI). Touch 84 × 84 × 9.5;
  active area 72 × 72. Pimoroni 67 reviews, Printables 6 / 502. No drawing
  found.
- **Pimoroni HyperPixel 2.1 Round** (480×480). Glass Ø71.26; active area
  Ø53.28; PCB 65 × 30 with Pi Zero holes 58 × 23.5; depth 10.8. Pimoroni 28
  reviews. `cdn.shopify.com/s/files/1/0174/1800/files/hyperpixel_round_drawing.png`.
  A round window.
- **Elecrow RC070 7″ HDMI**: Printables 16 / 3.75k; no official drawing (see
  the generic 7″ above).

### Tier C — backlog

- Waveshare 4″ DSI (480×800): 104.37 × 65.44, active area 87 × 52.44; 3D
  `files.waveshare.com/upload/a/a5/4inch_DSI_LCD_3D.zip`.
- Waveshare 5″ HDMI LCD on the GPIO header: ≈121.11 × 89.37, 4 × Ø3;
  `files.waveshare.com/upload/4/4a/5inch_HDMI_LCD%265inch_HDMI_LCD_B_panel_dimension.pdf`,
  LCDwiki MPI5001 `lcdwiki.com/res/MPI5001/MPI5001-size.pdf`.
- Waveshare 4″ RPi LCD (A) (SPI):
  `files.waveshare.com/upload/3/3d/4inch_RPi_LCD_A_panel_dimension.pdf`.
- Waveshare 13.3″ HDMI (H): 324.6 × 202.9, active area 294.5 × 165.9; DXF/STEP
  `files.waveshare.com/wiki/13.3inch_HDMI_LCD_H/13.3inch_hdmi_lcd-h-dxf.zip`.
- Waveshare 10.1″ HDMI LCD (B), bare:
  `files.waveshare.com/upload/9/9b/10.1inch_HDMI_LCD_B_panel_dimension.pdf`.
- Waveshare 8″ DSI (C), 3.4″ / 4″ DSI round, 2.8″ DSI: Pi Hut 0–5 reviews.
- Adafruit PiTFT 2.8 / 3.5 Plus: Printables 5 / 1.06k. Eagle `.brd` in
  `github.com/adafruit/Adafruit-PiTFT-3.5-Plus-PCB` and `…-Plus-2.8-PCB`
  (`board.mjs --brd` reads them).
- BTT TFT43-DIP (the repo has only a dtbo), SunFounder 7″ (no drawing).
- Radxa Display 10 FHD / 8 HD, Orange Pi / Rockchip MIPI panels: bare panels
  on an FPC, no driver board, no holes; Printables 0–2. Radxa 10 FHD
  155 × 246.16 × 5.95, active area 135.36 × 216.58; brief
  `dl.radxa.com/accessories/10-fhd/radxa_display_10_fhd_Revision_1.2.pdf`
  (not checked).
- Home Assistant wall panels: plenty of talk (r/homeassistant: wall panel
  112, touchscreen 118) but few Printables models. They are built on Touch
  Display 2 7″/10″ or the Waveshare 10.1″ DSI, covered above; many have moved
  to ESP32-S3/P4 panels (the boards-with-a-screen segment).

### Not candidates

- BTT Pad 7 (a tablet with a CB1, 185.7 × 124.78 × 39.5).
- The official Touch Display 2 case, the Pibow frame, the Waveshare panel-mount
  enclosure.
- Waveshare "IPS Display + Aluminium Enclosure" 7″/10.1″, "10.1″ HD in Case",
  the "with case" 10.1″ HDMI (B) and 4.3″.
- Raspberry Pi Monitor, portable monitors, ROADOM 7″ (seems to ship in a
  case, unchecked), The Pi Hut metal case with a 3.5″ TFT.

### Gaps

- Not opened: the STEP files, the BTT TFT35-SPI and TFT43 drawings.
- Hole diameters are not dimensioned on the BTT HDMI5/7 drawings and most
  Waveshare images: the STEP (`scripts/step.mjs`) or a measurement.
- No drawing found: HyperPixel Square, Elecrow, ROADOM, SunFounder.
- No back drawing: Waveshare 7″ DSI (C), 10.1″ DSI (C), 7.9″, 11.9″.
- Not measured: Amazon, Thingiverse, the Raspberry Pi forum.

## Boards with a screen on them

The display and the MCU on one bare PCB: these are ordinary catalog boards
with a `display` part on top. Already in the catalog: ESP32-2432S028R (CYD,
≈), Heltec WiFi LoRa 32 V3/V4 and Wireless Tracker (small OLEDs). The boards
plan has LilyGO T-Display S3 in its Tier B; it moves to Tier A here.

### Signals

| Signal | What it measures | Caveat |
|---|---|---|
| CircuitPython downloads (`_data/files.json` in adafruit/circuitpython-org, 697 boards, 618k in all) | Firmware downloads per board | Window not documented. Most boards sit at 600–1,100: only ≈1,400 and up means anything |
| GitHub code search, exact board id (`total_count`) | Mentions in code and configs | Approximate; demo bundles inflate it. Short ids give junk (T-Embed 1.8M, T-QT 484k) and were dropped; "ESP32-S3-Touch-LCD-2" also matches 2.1 and 2.8 |
| GitHub stars of community and vendor repos | Community activity | Biased to hype projects (Marauder) |
| openHASP `user_setups/*` (1,027★) | A supported Home Assistant panel | Yes/no |
| ESPHome device pages (esphome-devices) | Pages users contributed | Weak: the CYD has none, its configs live elsewhere |
| Printables `searchPrints2.totalCount`, specific queries | People print cases for this | Fuzzy; "T-Display" (8,796) and "cyd" (954) are noise |
| meshmap.net `hwModel` (9,569 nodes) | Meshtastic boards with screens | MQTT-position nodes only |

**Shared outlines:** the CYD's 86 × 50 with holes 4 mm in is also Guition
JC2432W328, CYD2USB (2432S028Rv3) and 2432S028Rv2 — variants of
`esp32-2432s028r`. Sunton 8048S043 and 4827S043 share one 123 × 74 PCB. The
Adafruit ESP32-S3 (Reverse) TFT Feather is a Feather — variants of
`adafruit-feather-esp32-s3`. Close but not equal: Sunton 7″ (181 × 108)
and CrowPanel 7″ (181 × 104), Sunton 5″ (137 × 84) and CrowPanel 5″
(137.2 × 79.9) — different hole spacing.

### Tier A — high demand, usable drawing

Sunton holes are all Ø3.2 (R1.6 on the drawing); spacing is centre to
centre.

| Board | MCU / display | PCB, holes | Display, mm | Why | Drawing | Note |
|---|---|---|---|---|---|---|
| Guition JC2432W328 (C), CYD2USB (2432S028Rv3) | ESP32; 2.8″ 240×320 ST7789; JC: CST816 capacitive + USB-C; CYD2USB: USB-C + micro-USB | **50 × 86, holes 4 in (42 × 78): the CYD's** | as the CYD | JC: code 470, openHASP, Printables 2. CYD2USB: code 645. The CYD itself: repo 4,568★, code 9,408, CircuitPython 1,826 | `github.com/maxpill/JC2432W328/blob/main/technical_specifications/Dimensions.png` (also in NewTX/ and Shadowtrance/jc2432w328c) | **The cheapest additions**: variants of `esp32-2432s028r` (other connectors and USB) |
| Sunton ESP32-3248S035 (R/C), "CYD 3.5″" | ESP32; 3.5″ 320×480 ST7796; R XPT2046, C GT911 | 101.5 × 54.9; 4 × Ø3.2, 3.5 in (94.5 × 47.9) | glass 85.5 wide; AA 73.44 × 48.96 | Code 1,760. openHASP. Marauder-on-CYD 1,786★. Printables 7 | `github.com/wegi1/ESP32-3248S035-3-5INCH-LCD/blob/main/3-Structure_Diagram/Dimensions.jpg`; spec PDF in Massmore/3.5inch_ESP32-3248S035 `2-Specification/` | Connectors from photos; rzeldent `assets/schematics/ESP32-3248S035R-PCB.pdf` may have the layout |
| Sunton ESP32-2432S024 (R/C/N) | ESP32; 2.4″ 240×320 ILI9341 | 74.4 × 42.9; 4 × Ø3.2, 3.2 in (68.0 × 36.5) | AA in the spec (unchecked) | Code 984. Printables 42. CircuitPython 628. openHASP | `github.com/NoosaHydro/2.4inch_ESP32-2432S024/blob/main/3-Structure_Diagram/Dimensions.png` + spec PDF | |
| Sunton ESP32-2432S032 (R/C/N) | ESP32; 3.2″ 240×320 ST7789 | 93.7 × 55.0; 4 × Ø3.2, 3.5 in (86.7 × 48.0) | unchecked | Code 467. Printables 22. openHASP | `github.com/kpeeem/3.2inch_ESP32-2432S032/blob/main/3-Structure_Diagram/3.2.jpg` | |
| Sunton ESP32-8048S043 and ESP32-4827S043 (C/R/N) | ESP32-S3 N16R8; 4.3″ ST7262 RGB, 800×480 / 480×272 | **both 123 × 74**; 4 × Ø3.2, 3.5 in (116 × 67) | module 105.5 × 67.2 | 8048: code 1,448, ESPHome page, Printables 12. 4827: code 1,072. openHASP | `github.com/wegi1/ESP32-4827S043-4INCH-LCD/blob/main/3-Structure_Diagram/Dimensions.png` (back view with USB-C, P1–P4 JST, TF placed; the 8048's file is byte-identical) | One entry, two variants |
| Sunton ESP32-8048S070 (C/R/N) | ESP32-S3; 7″ 800×480 ST7262, GT911 | 181 × 108; 4 × Ø3.2, 3.5 in (174 × 101) | module 165 × 100 | Code 1,328. Printables 12 + 9. CircuitPython 396. openHASP | `github.com/wegi1/ESP32-8048S070-7INCH-LCD/blob/main/3-Structure_Diagram/Dimensions.png` | |
| Sunton ESP32-8048S050 (C/R/N) | ESP32-S3; 5″ 800×480 | 137 × 84; 4 × Ø3.2, 3.5 in (130 × 77) | module 121 × 76 | Code 584. Printables 14. CircuitPython 341 | `github.com/wegi1/ESP32-8048S050-5INCH-LCD/blob/main/3-Structure_Diagram/Dimensions.png` | The weakest here; in for the family |
| Guition JC4827W543 (C/R/N) | ESP32-S3; 4.3″ 480×272 NV3041A QSPI; GT911 / XPT2046 | 120 × 70.2 with corner ears; 4 × Ø3.2 at 112.6 × 62.1 | AA 95.04 × 53.86 | Code 992. openHASP. ESPHome page. Repos 53★, 55★, 35★. Printables 1 | `github.com/profi-max/JC4827W543_4.3inch_ESP32S3_board` `Docs/JC4827W543 Specifications-EN.pdf` p. 6 (back view with USB-C, TF, P2–P5 JST) | |
| Waveshare ESP32-S3-Touch-LCD-4.3 | ESP32-S3; 800×480 ST7262 RGB; GT911 | 106 × 68; 4 holes 4 in (98 × 60); glass 106.1 × 67.8 | AA 95.54 × 54.36: 5.33 from the right, 9.09 from the bottom, ≈4.35 from the top; total 8.8 | Code 2,760 (with 4.3B). openHASP. Printables 3 | `waveshare.com/w/upload/7/7f/Esp32-s3-touch-lcd-4.3-003.jpg` (every connector dimensioned: UART and USB USB-C on the left at 12.93 and 32.90, SD, terminals, JST); STEP `files.waveshare.com/wiki/ESP32-S3-Touch-LCD-4.3/ESP32-S3-Touch-LCD-4in3_3D_Drawing.zip` | The best drawing in the segment. Non-touch: 105.4 × 67.1 |
| Waveshare ESP32-S3-Touch-LCD-7 (and 7B, 1024×600) | ESP32-S3; 800×480 ST7262; GT911 | glass 164 × 97; **mounts on 4 × M3 studs on the LCD's metal back at 126.2 × 65.65**; the PCB has 4 × M2.5 | AA 153.84 × 85.63 | Code **5,136**, the highest Waveshare. openHASP. Printables 3 | `waveshare.com/w/upload/d/d4/ESP32-S3-Touch-LCD-7-details-size-1.png`, `…/e/e8/…-details-size-2.png`, `files.waveshare.com/wiki/ESP32-S3-Touch-LCD-7/ESP32-S3-Touch-LCD-7in0_Drawing.zip`; 7B `waveshare.com/w/upload/9/99/ESP32-S3-Touch-LCD-7B-details-size1.jpg` | Mounts by the display's frame, not the PCB. The 126.2 × 65.65 studs are the original Pi 7″ display's M3 pattern |
| LilyGO T-Display S3 (touch / non-touch) | ESP32-S3; 1.9″ 170×320 ST7789, 8-bit parallel; optional CST816 | 26.09 × 61.98 (STEP); **no holes**: rails | LCD 25.95 × 49.87 | 1,204★. Code 7,008. CircuitPython 1,183. ESPHome 2 pages, openHASP 2. Printables 30–33 | `github.com/Xinyuan-LilyGO/T-Display-S3/tree/main/dimensions` (`t-display-s3-pcb.stp`, `-full.stp`, `PCB.dwg`, LilyGO's shells) | The top LilyGO board |
| Adafruit ESP32-S3 TFT Feather / Reverse TFT Feather (**already in**: variants `tft`, `reverse-tft`) | ESP32-S3; 1.14″ 240×135 ST7789 | Feather 50.8 × 22.86; 2 × Ø2.2 at x 2.54, 2 × Ø2.5 at x 48.26 (the Reverse mirrored) | on top (TFT) or underneath (Reverse) | CircuitPython **2,338 (Reverse, #19 of 697)** and 1,587. Code 1,178 / 47 | Eagle: `github.com/adafruit/Adafruit-ESP32-S3-TFT-Feather-PCB`, `…/Adafruit-ESP32-S3-Reverse-TFT-Feather-PCB` (`board.mjs --brd`) | Variants of `adafruit-feather-esp32-s3`. `PLAN-IMPROVEMENTS-NEW-BOARDS.md` already names both |

**Added on 2026-10-27** (branch `screens-tier-a`): Guition JC2432W328 (variant
`jc2432w328` of `esp32-2432s028r`), Sunton 2432S024, 2432S032, 3248S035,
8048S043 / 4827S043 (one entry, one PCB), 8048S050, 8048S070, Guition
JC4827W543, Waveshare ESP32-S3-Touch-LCD-4.3 (✓: the vendor's dimensioned
drawing and STEP agree within 0.6 mm), LilyGO T-Display S3 (variant `touch`).
All but the Waveshare are ≈: outlines and holes from the dimension
drawings, connectors from the spec PDFs' back views (Sunton's are turned
180° on the 4.3″ and 5″, mirrored on the rest; the drawings' TF slot
settles which), the active area centred on the module where no offset is
given. Two notes on the drawings: the T-Display S3 has two Ø1.9 holes at the
antenna end only (it stays on rails), and the Guition back view is a hand-held
photo.

Not added:
- **CYD2USB** (2432S028Rv3): no drawing and no photo of the bare board; its
  USB-C position would be a guess.
- **Waveshare ESP32-S3-Touch-LCD-7**: the driver PCB sits on the LCD's
  metal back; the case mounts on the frame's M3 bosses (126.2 × 65.65) and
  its connectors are 23 mm inside the frame edge, past the schema's
  `protrude` limit (−20). It waits for display placements with the
  standalone displays (the last section).

### Tier B — the second wave

- **Guition JC3248W535 (C/N)**, "Cheap Black Board". ESP32-S3, 3.5″
  320×480 AXS15231B QSPI. Module 94.5 × 62, AA 73.4 × 49, corner bosses on
  the back. Code 2,640; NorthernMan54/JC3248W535EN 129★; ASCII-Aquarium
  (445★). Demand is Tier A, the drawing is not: the spec PDF
  (`github.com/NorthernMan54/JC3248W535EN` `2-Specification`, p. 6) has
  only the outline and the AA; the two "slot method" DXFs (58.4 × 82.9, four
  Ø6.1) look like panel cutouts. **No hole positions.**
- **Guition JC8048W550 (C)**, ESP32-S3 5″ 800×480. Code 1,154, openHASP.
  `3-Structure_Diagram/Dimensions.png` in wegi1/ESP32S3-JC8048W550C-I
  (unchecked).
- **Guition JC1060P470 (C_I_W)**, ESP32-P4 + C6, 7″ 1024×600. 164.9 × 104
  (`github.com/sukesh-ak/JC1060P470C_I_W-GUITION-ESP32-P4_ESP32-C6`
  `3-Structure_Diagram/Dimensions.jpg`); DWG in
  wegi1/ESP32P4-JC1060P470C-I_W_Y (unchecked). Code 1,328.
- **Elecrow CrowPanel HMI 4.3 / 5.0 / 7.0** (bare). Outline PDFs and STEP in
  each `Elecrow-RD/CrowPanel-<s>-HMI-ESP32-Display-*` repo
  (`Datasheet/<s>inch_HMI_Outline_Dimensions.pdf`, `3D file/`):
  4.3 121.7 × 71.5, 4 × Ø3.2 at 114.7 × 64.5, LCD 105.7 × 67.5;
  5.0 137.2 × 79.9, 4 × Ø3.2 at 130.2 × 72.9, LCD 120.7 × 76.3;
  7.0 181 × 104, 4 × Ø3.1 at 174 × 96.95. Code 8,448 for "CrowPanel" (every
  product); openHASP; Printables 19 + 17.
- **Waveshare ESP32-S3-Touch-LCD-2.8.** PCB 49.92 × 69.02 (STEP), M2.5 SMT
  standoffs at (4.51, 4.51) and (4.51, 64.51), the others presumably
  mirrored; glass overhangs to 50.5 × 73.1. Code 1,426, CircuitPython 1,081.
  `files.waveshare.com/wiki/ESP32-S3-Touch-LCD-2.8/ESP32-S3-Touch-LCD-2.8_3D.zip`.
- **Waveshare ESP32-S3-Touch-LCD-2.** PCB 35 × 48.2, 4 holes 3 in
  (29 × 42.2); glass 37.1 × 58.8, AA 31 × 41.2; 9.7 with headers.
  CircuitPython 1,135. `waveshare.com/w/upload/8/8a/ESP32-S3-Touch-LCD-2-details-size.png`.
- **Waveshare ESP32-S3-Touch-LCD-5 (5B).** Glass 127.7 × 87.45 R4, AA
  109 × 65.8; PCB ≈120.5 × 75.5, 4 × M2.5 at 111 × 63; 14 thick. Code 1,146.
  `files.waveshare.com/wiki/ESP32-S3-Touch-LCD-5/ESP32-S3-Touch-LCD-5_Drawing.zip`.
- **Waveshare ESP32-P4-WIFI6-Touch-LCD-7B** (1024×600). PCB 164 × 97, 4
  holes 4 in (156 × 89), connectors dimensioned. Code 2,704 (all sizes).
  `waveshare.com/w/upload/8/88/900px-ESP32-P4-WIFI6-Touch-LCD-7B-details-size.jpg`.
- **Waveshare ESP32-S3-LCD-1.47** (a USB-A dongle). PCB 20.33 × 36.4 + the
  plug, 4 × Ø2.0; AA 17.39 × 32.35. CircuitPython 1,124.
  `files.waveshare.com/wiki/ESP32-S3-LCD-1.47/ESP32-S3-LCD-1.47_Structural_Drawings.zip`.
  ESP32-C6-LCD-1.47 probably the same outline (code 1,520).
- **Waveshare ESP32-S3-Touch-LCD-2.1** (round 480×480 ST7701). PCB Ø65,
  4 × M2; lens Ø75, VA Ø53.88; 9.5 thick. Code 1,720.
  `files.waveshare.com/wiki/ESP32-S3-Touch-LCD-2.1/ESP32-S3-Touch-LCD-2.1_structure.zip`.
  A round board.
- **Waveshare ESP32-S3-Touch-AMOLED-1.43** (round 466×466): glass Ø46, AA
  Ø36.75, M2 holes. Code 404. **AMOLED-1.75**: ESPHome page, code 1,912;
  cased and bare versions — check which is bare.
- **Waveshare ESP32-S3-Touch-LCD-4.3B**: 112.4 × 75.1 / 116.3 × 79; drawing
  zip `…/ESP32-S3-Touch-LCD-4in3B_Drawing.zip` (unchecked).
- **LilyGO T-Display (original TTGO)**: 25.19 × 51.48 (STEP), holes not
  found; 1,199★, openHASP. `github.com/Xinyuan-LilyGO/TTGO-T-Display/tree/master/3d_file`.
- **LilyGO T-Display S3 AMOLED / Plus**: Plus 25.55 × 53.87, 2 × Ø2 at
  (2.69, 51.97) and (22.72, 51.97), from
  `LilyGo-AMOLED-Series/dimensions/T-Display-S3-AMOLED-Plus.DXF`. Code 948.
- **Adafruit PyPortal / Titano / Pynt**: CircuitPython 1,579 / 993 / 761;
  Printables "pyportal case" 16. Eagle in `adafruit/Adafruit-PyPortal-PCB`.
- **Seeed Round Display for XIAO** (the XIAO plugs into it; 1.28″ GC9A01,
  ≈Ø39). Code 1,700 + 994. SCH&PCB zip and a shell STL on
  `wiki.seeedstudio.com/get_start_round_display/`. Pairs with `seeed-xiao`.
- **WT32-SC01 / SC01 Plus** (bare 3.5″ ESP32). Code 4,200, openHASP,
  Printables 25. Drawing unchecked.

### Tier C — backlog

- LilyGO: T-HMI (2.8″, 50.46 × 79.5, `T-HMI/3D/HMI.dxf`), T4-S3 (2.41″
  AMOLED, 38.74 × 51.56), T-Display S3 Long, T-QT Pro (17.8 × 31.6, no
  holes), T-RGB (round 2.1/2.8″), T-Display S3 Pro, T-Display-P4.
- Sunton ESP32-2432S022 (2.2″), ESP32-2424S012 (C3, 1.28″ round),
  ESP32-1732S019 (1.9″): doc bundles via rzeldent.
- Elecrow CrowPanel 2.4 / 2.8 / 3.5 HMI (sold with or without an acrylic
  case).
- Waveshare ESP32-S3-Touch-LCD-1.28 / 1.69 / 1.85 (the 1.85 has a 2D zip),
  RP2040/RP2350 (Touch-)LCD-1.28 (CircuitPython 901 / 722 / 784 / 611).
- Heltec Vision Master T190 (60 × 25.4 × 10.2, no holes; Meshtastic 14
  nodes; datasheet p. 10).
- Pimoroni Pico Display Pack 2.8 (add-on, ≈73 × 47 × 9.5, AA 57.5 × 43.2).
- Makerfabs MaTouch / ESP32-S3 Parallel TFT, Espressif ESP32-S3-LCD-EV-Board,
  Adafruit FunHouse.

### Not candidates

- Finished: M5Stack Core / Core2 / CoreS3 / Dial / Tab5 / Cardputer, LilyGO
  T-Deck, T-Embed (in shells), ESP32-S3-BOX-3, SenseCAP Indicator, Pimoroni
  Presto (aluminium stand), Waveshare Touch-AMOLED-1.8 and Touch-LCD-3.5B/C
  (cased), Guition ESP32-4848S040 (an 86-box wall panel in metal; demand is
  very high — code 4,208, a 445★ repo — but it is finished), Lanbon L8/L9,
  CrowPanel Advance (own enclosure, unchecked).
- No display on the board: Adafruit Qualia ESP32-S3.

### Gaps

- Not opened: JC8048W550, JC1060P470 (DWG), Waveshare 4.3B and AMOLED-1.75,
  the C6-LCD-1.47 RAR, the XIAO Round zip, the Pico Display PNG, WT32-SC01,
  CrowPanel 2.4–3.5 and Advance, Makerfabs, the LCD-EV board.
- Connector positions on the Sunton/Guition images are mostly not
  dimensioned (only the 4.3″ back views place them): photos plus the board
  edge.
- Holes not confirmed: the original T-Display (none in the STEP), T-HMI and
  T-RGB (DXF polylines only).
- Not measured: Thingiverse, PlatformIO board ids, LVGL/SquareLine forums.

## Small SPI/I²C modules

### Signals

| Signal | What it measures | Caveat |
|---|---|---|
| GitHub code search in ESPHome YAML (`"platform: X" extension:yaml`, plus the `model:` line) | Home-automation configs per display | Approximate counts; forks and copied examples inflate them. Comparable only within the group |
| GitHub code search for `#include <Lib.h>` | Arduino sketches per library | Copies of the library count. TFT_eSPI (138k) is inflated this way; `Adafruit_ST7735.h` covers ST7735 and ST7789 |
| `X_DRIVER filename:platformio.ini` | Which TFT_eSPI driver PlatformIO projects choose | Only projects with the setup in build flags (`User_Setup.h` holds every driver and cannot be counted) |
| Klipper `"lcd_type: X" extension:cfg` | Printer displays | Every Klipper fork carries the example configs: ratios only |
| Printables `searchPrints2.totalCount` | Models (cases, mounts) mentioning the term | Full-text and fuzzy ("2.0 tft" catches unrelated models) |
| PlatformIO registry `popularity_rank` | Library installs through PlatformIO | A rank, no counts |
| PyPI last-month downloads (pypistats) | Raspberry Pi / Blinka use | CI and mirrors count; microcontroller CircuitPython installs from bundles are not counted |
| U8g2 constructor names | — | **Unusable**: every U8g2 example lists all constructors; each name scores ≈28k |

Raw counts:

- **ESPHome YAML:** SSD1306 I²C 1204, SPI 67, 128×32 84; SH1106 206,
  SH1107 37; `ili9xxx` 1084 (ILI9341 269, GC9A01A 208, ST7789V 147, ST7796
  66, ILI9488 34, ST7735 25); old `st7789v` 198, `st7735` 83; `mipi_spi` 676;
  `nextion` 179, `lcd_pcf8574` 126, `max7219` 127 + `max7219digit` 109,
  `tm1637` 95, `st7920` 48, `ssd1351_spi` 45, `ssd1327_i2c` 44, `pcd8544` 44.
  For scale: `waveshare_epaper` 418.
- **Arduino includes:** LiquidCrystal_I2C 49k, Adafruit_SSD1306 46k,
  U8g2lib 42k, LovyanGFX 17.7k, Arduino_GFX 13k, Adafruit_ST7735 6.3k,
  Adafruit_SH110X 4.3k, XPT2046_Touchscreen 4.3k, TM1637Display 3.5k,
  MCUFRIEND_kbv 2.4k, LedControl 1.7k, Nextion.h 512, Adafruit_GC9A01A 384.
- **TFT_eSPI driver in `platformio.ini`:** ST7789 1094, ILI9341 517, ST7796
  188, ILI9488 128, GC9A01 124.
- **Klipper `lcd_type`:** st7920 5416, uc1701 (Mini12864) 4696, hd44780 806,
  sh1106 605, ssd1306 184.
- **PlatformIO rank:** Adafruit GFX 8, lvgl 11, Adafruit SSD1306 13,
  TFT_eSPI 20, LovyanGFX 22, U8g2 24, SH110X 33, ST7735/ST7789 38,
  LiquidCrystal_I2C 49, ILI9341 69, GC9A01A 231, TM1637 276.
- **PyPI, last month:** luma.oled 8208, circuitpython-ssd1306 4316,
  luma.lcd 2361, circuitpython-ili9341 2259, rgb-display 1542.
- **Printables:** printer displays lead — **tft35 266** ("btt tft35" 108,
  "tft35 e3" 69), **12864 196** ("mini 12864" 73). Then ssd1306 106,
  "0.96 oled" 87, "1.3 oled" 84, max7219 76, nextion 70, "2.4 tft" 68,
  "16x2 lcd" 67, ssd1309 60, "2.8 tft" 55, "3.5 tft" 51, "20x4 lcd" 51,
  "round display" 39, "2.0 tft" 38, "1.8 tft" 28, tm1637 28, "4.0 tft" 24.

**Where the generic outlines come from.** The red- and blue-PCB AliExpress
modules are the LCDwiki "MSP/MC" modules (QDtech, Shenzhen). Their drawings
are vector PDFs with every dimension: `scripts/dxf.mjs` reads them. All the
red SPI TFTs are built alike: glass taped to the front of the PCB, a 14-pin
2.54 header on the bottom edge pointing back, a 4-pin SD header at the top,
4 corner holes Ø3.2 (pad Ø4.7) 3.00 from the edges. They mount face-down
against the window on M3 standoffs from inside.

### Tier A — high demand, drawing checked

The active area (AA) offset is from the PCB edge, the PCB seen from the
front; VA is the visible area (the window).

| Module | Controller, resolution | PCB, mm | Holes | AA / VA, mm | Thickness, mm | Why | Drawing | Note |
|---|---|---|---|---|---|---|---|---|
| Generic 0.96″ I²C OLED (blue, 4-pin) | SSD1306 / SSD1315, 128×64 | 27.3 × 27.8 (sellers 27–28) | 4 × Ø≈2, **spacing varies** (one measured 22.3 × 23.0, a drawing 20.5 × 23.0) | AA ≈21.74 × 10.86 | panel 1.42; ≈11.3 with pins | First in every signal: ESPHome 1204, include 46k, Printables 106 + 87, PyPI 4.3k + luma 8.2k | **Weak**: [LCDwiki MC096GX](https://www.lcdwiki.com/0.96inch_OLED_Module_SKU:MC096GX) (size only), a community measurement `git.cuvoodoo.info/kingkevin/qeda_library/…/display_oled_0.96in.yaml` | Must be in the catalog; measure two or three sellers' boards first (≈). Panel off-centre, flex folded to the back, header on the top edge. The 7-pin SPI board has the same outline |
| 2.8″ SPI TFT, resistive touch + SD (MSP2807) | ILI9341 + XPT2046, 240×320 | 50.00 × 86.00 | 4 × Ø3.2 at 44.00 × 78.08 | AA 43.2 × 57.6 at x 3.40, y 9.30 from the top; VA 45.2 × 59.45 | 5.6; 12.78 with the header | ESPHome ILI9341 269, `platformio.ini` 517, XPT2046 4.3k, Printables 55 | `lcdwiki.com/res/MSP2807/MSP2807_Size.pdf` | No-touch MSP2806 (`…/MSP2806_Size.pdf`, not read) probably shares the outline |
| 2.4″ SPI TFT (MSP2402) | ILI9341, 240×320 | 42.72 × 77.18 | 4 × Ø3.2 at 36.72 × 67.26 | AA 36.72 × 48.96 at x 3.00, y 9.26 | 4.3 / 12.68 | Printables "2.4 tft" 68; the ILI9341 counts above | `lcdwiki.com/res/MSP2402/MSP2401_Size.pdf` | Same family |
| 3.5″ SPI TFT + touch (MSP3520) | ILI9488, 320×480 | 56.34 × 98.00 | 4 × Ø3.2 at 49.50 × 92.00 | AA 48.96 × 73.44 at x 3.69, y 9.95; touch VA 50.56 × 77.84 | 5.8 / 14.18 | ESPHome 34, `platformio.ini` 128, Printables "3.5 tft" 51 | `lcdwiki.com/res/MSP3520/MSP3520_Size.pdf` | IPS ST7796 MSP3525/3526 have their own drawing (`…/MSP3525_MSP3526/3.5inch_SPI_Module_MSP3526_Size.pdf`) and a 3D zip (download failed) |
| 4.0″ SPI TFT + touch (MSP4021) | ST7796S, 320×480 | 61.74 × 108.04 | 4 × Ø3.2 at 54.90 × 102.04 | AA 55.68 × 83.52 at x 3.03, y 9.40 | 5.65 / 14.00 | ESPHome ST7796 66, `platformio.ini` 188, Printables 24 | `lcdwiki.com/res/MSP4021/MSP4021_Size.pdf` | |
| 1.28″ round IPS (MSP1281) | GC9A01, 240×240 | 38.03 × 45.80: a round head + a 23.00-wide tab with the header | 2 × Ø2.0, 19.40 apart, in the tab ≈5.8 above the bottom edge (check) | AA Ø32.40, 2.82 from the top and sides; glass Ø35.6 | LCD 1.5 + tape 0.3 + PCB 1.6 + parts 1.1 | ESPHome 208, `platformio.ini` 124, Printables 15–20 ("round display" 39) | `lcdwiki.com/res/MSP1281/MSP1281_Size.pdf` | A round outline with a tab (the catalog's `outline`). Adafruit 6178 differs: 36 × 42.16, 2 × Ø2.5 at (6.6, 6.35) and (29.46, 6.35), from its STEP |
| 1.9″ IPS (MSP1901) | ST7789, 170×320 | 29.00 × 62.00 | 4 × Ø2.0 at 25.00 × 57.99 | AA 22.695 × 42.72; LCM 25.8 × 49.72 | LCD 1.43; 11.71 with the header | ST7789 is the most-chosen driver (`platformio.ini` 1094; ESPHome 198 + 147 + 106) | `lcdwiki.com/res/MSP1901/MSP1901_Size.pdf` | 8-pin header on the top edge |
| 1602 character LCD + PCF8574 backpack | HD44780, 16×2 | 80.0 × 36.0 | 4 × Ø2.5 at 75.0 × 31.0 (generic Ø2.5–3.0) | VA 64.5 × 13.8, AA 57.7 × 9.4 (from a turned scan: check, 16.0 is usual) | ≈13 + ≈12 backpack behind | LiquidCrystal_I2C 49k, ESPHome 126, Printables 67 + 29 | `cdn-shop.adafruit.com/datasheets/TC1602A-01T.pdf` p. 4 | The window is the VA. The bezel stands proud of the PCB |
| 2004 character LCD + PCF8574 | HD44780, 20×4 | 98.0 × 60.0 | 4 × Ø2.5 PTH (pad Ø5) at 93.0 × 55.0 (generic Ø3–3.5) | VA 77.0 × 25.2 at x 10.5, y 10.35; AA 70.4 × 20.8 | 13.6 max | Printables 51 + 30; the 1602's libraries | `cdn-shop.adafruit.com/datasheets/WH2004A-CFH-JT%23.pdf` p. 9 | 16-pin header top left |
| LCD12864 graphic LCD (bare) | ST7920, 128×64 | 93.0 × 70.0 | 4 × Ø2.5 PTH (pad Ø5.5) at 88.0 × 65.0 | VA 72.0 × 40.0 at x 10.5, y 9.9; AA 66.52 × 33.24 | 13.6 max | ESPHome 48; Klipper st7920 5416 (inflated); Printables 12864 196 (mostly printers) | Raystar RG12864A2 datasheet p. 4 (endrich.com) | Generic blue board: 20-pin header on the top; Raystar: 18 pins at the bottom. Same outline and holes |
| 2.42″ OLED (MC242GX) | SSD1309, 128×64 | 72.00 × 43.00 | 4 × Ø3.0 at 68.00 × 39.00 | AA 55.01 × 27.49; VA 57.50 wide | 2.85 iron frame; 12.39 with the header | Printables ssd1309 60, "2.42 oled" 42 | `lcdwiki.com/res/MC242GX/2.42inch_IIC_Module_MC242GX_Size.pdf` | SPI version MSP242X `…/MSP242X/2.42inch_SPI_IIC_Module_MSP242X_Size.pdf` (not read); Waveshare 2.42″ has its own 2D zip |
| 1.3″ I²C OLED (MC130GX/VX) | SH1106, 128×64 | 33.50 × 35.40 | 4, positions not read | AA 29.42 × 14.7 | — | ESPHome 206, SH110X 4.3k, Printables 84 | [LCDwiki page](https://www.lcdwiki.com/1.3inch_IIC_OLED_Module_SKU:MC130GX) (size); the drawing is probably in its manual | Adafruit 938 (STEMMA) is another board: 35.56 × 33.02, 4 × Ø2.5 at 30.48 × 27.94 from (2.54, 2.54), from its STEP |
| ST7789 IPS family, generic | ST7789: 1.14″ 135×240, 1.3″ / 1.54″ 240×240, 1.69″ 240×280, 2.0″ 240×320 | 1.14: 30.40 × 28.00; 1.3: 39.22 × 27.78; 1.54: 32.00 × 43.72; 1.69: 31.00 × 48.00; 2.0: 36.48 × 61.12 | in drawings not read | AA 14.86 × 24.91, 23.4², 27.72², 27.972 × 32.634, 30.6 × 40.8 | — | As the 1.9″; Printables "2.0 tft" 38 | PCB and AA from LCDwiki page text; `…/MSP1691/MSP1691_Size.pdf` failed to download; the rest in user manuals | The cheap 1.3″ 240×240 has **no holes** on many boards (7-pin, no CS): check. One family entry with variants |
| Branded ST7789: Waveshare, Adafruit | as above | Waveshare 2″ 58 × 35, 1.54″ 50 × 35, 1.69″ 31.5 × 39, 1.3″ 45 × 31 | Waveshare: 4 × M2 | Waveshare 2″: 30.60 × 40.80 | — | — | Waveshare 2D: `files.waveshare.com/upload/6/6d/2inch_LCD_Module_2D_Drawing.pdf`, `files.waveshare.com/wiki/1.54inch_LCD_Module/1_54inch_lcd_module_2d.zip`, `files.waveshare.com/upload/4/41/1.69inch_LCD_Module_2Ddrawing.pdf` (not opened). Adafruit STEP in `github.com/adafruit/Adafruit_CAD_Parts`: 4313 (1.3″), 3787 (1.54″), 4311 (2.0″), 5394 (1.9″), 4383 (1.14″) | Each brand its own outline |

### Tier B — the second wave

- **1.8″ SPI TFT 128×160 + SD (MSP1803, ST7735S).** 34.5 × 58.0, AA
  28.03 × 35.04. Adafruit_ST7735 6.3k (shared with ST7789), ESPHome 83 + 25,
  Printables 28. The drawing is probably in its user manual
  `lcdwiki.com/res/MSP1803/1.8inch_SPI_Module_MSP1803_User_Manual_EN.pdf`
  (not checked): Tier A once read.
- **1.44″ ST7735 (MSP1443).** 29.7 × 43.36, AA 26.2 × 27.2; drawing in its
  manual.
- **BTT TFT35 (E3 / V3.0).** A printer touch display with its own MCU and
  encoder, sold bare. Printables 266 / 108 / 69 — the strongest case signal
  in this segment. Drawing believed to be in
  `bigtreetech/BIGTREETECH-TouchScreenHardware` (not opened; the same repo
  holds the HDMI5/HDMI7 above).
- **RepRapDiscount Full Graphic Smart Controller** (ST7920 + encoder + SD +
  buzzer) and **Mini12864** (UC1701 / ST7567; Klipper 4696, Printables 73).
  No drawing; printer users usually reuse the printer's housing.
- **Nextion / TJC HMI.** ESPHome 179, Nextion.h 512, Printables 70 (2.8″ 7,
  3.5″ 13, 4.3″ 5, 7″ 12). Per-model dimension drawings on nextion.tech (not
  opened); each size has its own outline and holes in the PCB.
- **MAX7219** 4-in-1 8×8 matrix (FC-16) and the 8-digit 7-segment board.
  ESPHome 127 + 109, LedControl 1.7k, Printables 76 + 37. No drawing; boards
  vary.
- **TM1637 4-digit.** ESPHome 95, include 3.5k, Printables 28. No drawing;
  small and generic.
- **0.91″ 128×32 OLED** (SSD1306, ESPHome 84). Generic 12 × 38, no holes;
  Adafruit 931 / 4440 have STEP.
- **ILI9341 2.2″ (MSP2202, 40.1 × 67.2) and 3.2″ (MSP3218, 55.04 × 89.3).**
  Drawings downloaded (`…/MSP2202/MSP2202_Size.pdf`, `…/MSP3218/MSP3217_Size.pdf`),
  not read. Less demand than 2.4″ and 2.8″.
- **Adafruit 2.8″ capacitive touch (2090).** 62.48 × 81.28, 4 × Ø3 at
  57.15 × 76.2 (STEP).

### Tier C — backlog

- 1.5″ OLEDs: SSD1351 RGB (ESPHome 45; LCDwiki MC01506 34 × 47, 4 × Ø2.2 at
  29 × 42, AA 26.855², drawing `…/MC01506/MC01506_size.pdf` read); SSD1327
  grey (ESPHome 44; Waveshare 44.5 × 37 with a 2D zip, Adafruit 4741 STEP).
- SH1107 1.12″ 128×128 (Pimoroni, Adafruit 5297), ESPHome 37.
- Pimoroni 1.3″ / 1.54″ SPI LCD breakouts; Seeed Grove OLED / LCD / 4-digit
  (on the Grove 20 mm grid); 0.96″ ST7789 80×160 (MSP0964); Nokia 5110
  PCD8544 (ESPHome 44).
- 16-bit parallel modules and MCUFRIEND Uno shields (MCUFRIEND 2.4k): a
  shield stacks on the Uno, not a panel to mount.

### Not candidates

- The CYD and its LCDwiki ESP32-32E/S3 relatives, LilyGO T-Display, M5Stack,
  Pico Display Packs, PiTFT: boards with a screen or HATs (the other
  segments).
- QSPI AMOLED dev boards (`qspi_dbi` 125, mostly integrated), HUB75 panels.

### Gaps

- The generic 0.96″ SSD1306 has no authoritative drawing: measure two or
  three sellers' boards.
- Not opened: LCDwiki manuals for MSP1443, MSP1803, MC130 and the 1.3 / 1.54
  / 2.0″ IPS; the Waveshare 2D files; the BTT TFT35 repo; Nextion datasheets;
  RRD FGSC / Mini12864; TM1637 and MAX7219.
- Failed downloads: LCDwiki MSP1691 and MSP3526 (the site's TLS is
  intermittent).
- Not gathered: Thingiverse (its API needs a token), AliExpress orders,
  Arduino Library Manager downloads.
- To check on the drawings: the 1602 VA height (13.8 against the usual 16.0)
  and the height of the GC9A01 holes above the bottom edge.

## E-paper

**One panel outline covers the most-used family.** The 170.2 × 111.2 glass
is the Waveshare 7.5″ V2 and its colour variants (B/W/R, B/W/R/Y), the
Waveshare 7.3″ E (Spectra 6), the Good Display GDEY075T7, the panel in the
TRMNL DIY kit and the panel on the Inky Impression 7.3 (the 7.3″ F ACeP is
probably the same, unconfirmed). A raw panel is glass with an FPC and no
holes: it needs a pocket, and its driver is a separate board.

### Signals

| Signal | What it measures | Caveat |
|---|---|---|
| ESPHome YAML: `"waveshare_epaper" "<model>"` (561 in all) and `"epaper_spi"` (113) | Home Assistant configs per panel model | Legacy search tokenises on punctuation: `7.50in` (169) also matches `7.50inV2` |
| GxEPD2 class names | Arduino sketches per panel | Every vendored GxEPD2 holds every class: a floor of ≈2.7–3k; only the margin above it counts. `GxEPD2_420` (7280) is a prefix of every 4.2″ class |
| Waveshare Python drivers (`epd7in5_V2`, …) | Raspberry Pi users | Vendored `waveshare_epd` copies: a floor of ≈120–180 |
| `from inky` / `inky.auto` / `InkyPHAT` / `DISPLAY_INKY_FRAME*`; `Inkplate.h`, `ARDUINO_INKPLATE*` | Inky and Inkplate users | `inky.auto` hides the model; Inkplate counts include vendored examples |
| GitHub stars of projects built on a display | Mindshare | A star is not a unit sold |
| CircuitPython downloads | Firmware per board (MagTag, Inky Frame, Badger) | As above |
| meshmap.net | Meshtastic e-paper boards | Biased to finished devices |
| TRMNL `usetrmnl.com/api/models` | Panels the TRMNL BYOD software supports | A list, no per-model counts |
| Printables `searchPrints2.totalCount` | Cases and frames | Fuzzy ("epaper" 4545, "e-paper" 214); the title-filtered run hit a 429, so raw totals only: order of magnitude |

### Tier A — high demand, drawing exists

| Display | Size, colours | Outline, mm | Holes | Active area, mm | Why | Drawing | Note |
|---|---|---|---|---|---|---|---|
| 7.5″ mono panel: Waveshare 7.5″ V2 = Good Display GDEY075T7 (UC8179) + e-Paper Driver HAT | 800×480 B/W, 4-grey; same outline: V2, B (B/W/R), B/W/R/Y, G | panel 170.2 × 111.2 × 1.18 (GD: 1.25); FPC at the centre of the bottom edge | panel none; HAT (Rev 2.3) 65.0 × 30.5, 4 × Ø3.0 (top 3.5 from the top and sides, bottom 4.0 up: the Pi Zero 58 × 23); FPC adapter 31.75 × 17.5, 4 × Ø3.0 3.5 in | 163.2 × 97.92 (GD 163.2 × 97.72); offsets in the V2 spec | **The top ESPHome model** (`7.50in` 169, `7.50inV2` 136, `V2p` 43, `-bV3` 40, `-bV2` 27). Python `epd7in5_V2` 466. GxEPD2 `750_T7` 4344, `750c_Z08` 4696. esp32-weather-epd **6,319★**, InkyPi 4,264★, Inkycal 1,483★. TRMNL BYOD bw/bwr/bwry; the TRMNL DIY kit's panel. Printables 45 | panel `waveshare.com/img/devkit/LCD/7.5inch-e-Paper/7.5inch-e-Paper-details-size.jpg` (outline and AA, no offsets); HAT `…/7.5inch-e-Paper-HAT/7.5inch-e-Paper-HAT-details-size-2.jpg`; spec `files.waveshare.com/upload/6/60/7.5inch_e-Paper_V2_Specification.pdf` §1.4 p. 5 (the full mechanical drawing); `good-display.com/product/396.html` | A family entry: panel variants (V2, B, BWRY, 7.3 E, 7.3 F?) and drivers (Waveshare HAT, Waveshare ESP32 driver, DESPI-C02, Seeed EE04 / TRMNL kit) |
| Waveshare 7.3″ E (Spectra 6) | 800×480, 6 colours | 170.20 × 111.20 × 0.91; FPC 25.5 wide, 72.35 from the left, 24 below the glass | HAT (E) as above; FPC adapter 45 × 21, 4 holes | 160 × 96, 4.70 from the top, 5.10 from the right | Python `epd7in3e` 122; `epaper_spi` Spectra-E6 17; GxEPD2 `730c_GDEP073E01` 1364 (new, below the floor); Printables "waveshare 7.3" 93 | `waveshare.com/img/devkit/LCD/7.3inch-e-Paper-HAT-E/7.3inch-e-Paper-E-details-size.jpg`, `…-HAT-E-details-size.jpg` | Same outline as the 7.5″. 7.3″ F (ACeP 7-colour): Python 301, GxEPD2 2672; `…/7.3inch-e-Paper-HAT-F/7.3inch-e-Paper-F-details-size.jpg` not opened |
| Pimoroni Inky Impression (Spectra 6): 7.3″ PIM773, 4.0″ PIM789, 13.3″ PIM774 | 800×480 / 600×400 / 1600×1200, 6 colours; 4 rear buttons since Nov 2025 | 7.3: PCB 174.2 × 123.2, panel 170.2 × 111.2 2.0 from the left; 4.0: 103 × 78; 13.3: PCB 296.7 × 210, panel 284.7 × 208.8 | 4 × M2, 3.0 in (7.3: 168.2 × 117.2); Pi 58 × 49 on the back (7.3: 47.0 from the bottom, 26.7 from the right) | 7.3: 160 × 96, 7.1 from the right; 4.0: 84.6 × 56.4; 13.3: 270.4 × 202.8 | `from inky` 1334, `inky.auto` 530; pimoroni/inky 862★; InkyPi 4,264★; TRMNL BYOD 7.3 and 13.3; Printables 25 | `cdn.shopify.com/s/files/1/0174/1800/files/inky-impression-7-drawing.png`, `…/inky-impression-4-drawing_0f7027b5-497b-45f4-81c4-b5053cb8c9af.png`, `…/inky-impression-13-drawing.png` (all dimensioned) | **The best fit for the catalog**: a real board with holes and a Pi on its back. A family of three. 7.3 buttons on the left edge at y 28.5 / 52.5 / 76.5 / 100.5. The old 5.7″ ACeP (PIM534) has its own drawing |
| Waveshare 2.9″ module (V2) and WeAct 2.9″ | 296×128 B/W | Waveshare 89.5 × 38.0, R1, a 16.5 side notch for the header; WeAct 91.8 × 37.5 (STEP) | 4, 2.5 in (84.5 × 33), Ø not given (probably M2) | 66.89 × 29.05 | ESPHome `2.90in` 119, `2.90inv2` 80; GxEPD2 `290_T94` 3776, `_V2` 3496; Python 195; Printables 44 | `waveshare.com/img/devkit/LCD/2.9inch-e-Paper-Module/2.9inch-e-Paper-Module-size.jpg`; WeAct STEP and shape PDFs `github.com/WeActStudio/WeActStudio.EpaperModule/tree/master/Hardware` (1.54, 2.13, 2.9, 2.9-4C, 3.7, 4.2; the PDFs are not in mm: use the STEP) | |
| Waveshare 4.2″ module (V2) and WeAct 4.2″ | 400×300 B/W | 103.0 × 78.5; WeAct 89.8 × 91.8 (STEP) | 4, 3.0 in (97 × 72.5), Ø not given | 84.8 × 63.6 | ESPHome `4.20in` 57 + `gdey042t81` 17; GxEPD2 `420*` 7280 (prefix); `epaper_spi` WeAct and GDEY042T81 models; Printables **80**, the second size | `waveshare.com/img/devkit/LCD/4.2inch-e-Paper-Module/4.2inch-e-Paper-Module-details-size.jpg` | 8-pin header on the left edge, 30.35 from the top |
| Adafruit MagTag 2.9″ | ESP32-S2 + 296×128 4-grey | 80.0 × 53.3 | 4 × M3, ≈4.1 in | — | CircuitPython **2,522, #16 of 697**, the top e-paper board; `adafruit_magtag` 423; Printables 52 | fab print rev D (inches) `cdn-learn.adafruit.com/assets/assets/000/138/679/medium800/adafruit_products_fab.png`; Eagle `github.com/adafruit/Adafruit_MagTag_PCBs`; CAD `Adafruit_CAD_Parts/4800 MagTag` | A board with a screen on it |
| Soldered Inkplate 6 / 10 / 6COLOR / 2 / 5 Gen2 / 13SPECTRA | open hardware, ESP32 + panel on the PCB | from the STEP (not measured yet) | from the STEP | — | `ARDUINO_INKPLATE10` 278, `…COLOR` 268, `…6PLUS` 266, `…5V2` 197, `…13SPECTRA` 180, `…2` 176; ESPHome `inkplate6` 36; TRMNL BYOD five models; Printables 45 | each repo has the board STEP and the official case (STEP, F3D, STL): `github.com/SolderedElectronics/Soldered-Inkplate-6-hardware-design` (`OUTPUTS/V1.2.1/…3D.step`), `…-Inkplate-10-…` (`V1.3.1`), `…-Inkplate-6-COLOR-…` (`V1.2.0`), `…-Inkplate-2-…`, `…-Inkplate-5-Gen2-…` | Outline and holes by `scripts/step.mjs` |
| LilyGO T5 4.7″ (ESP32 / ESP32-S3) | ED047TC1 960×540, 16-grey, parallel | DXF extents 71.27 × 119.06 | M2 × 4 PCB screws (shell README); holes are polylines in the DXF | — | `epd_driver.h` 1908; LilyGo-EPD47 570★, epdiy 1,963★; Printables "t5 4.7" 29, "t5 epaper" 63 | `github.com/Xinyuan-LilyGO/LilyGo-EPD47/blob/esp32s3/shell/EPD47-S3.dxf` (layers BottomOverlay, KeepOut); shells STEP/STL in `shell/style1..3`; `datasheet/ED047TC1.pdf` | |
| LilyGO T5 V2.13 / V2.3 | ESP32 + 2.13″ 250×122 | DXF extents 40.18 × 66.29 | not extracted | — | ESPHome `2.13in-ttgo` 66, `-b74` 26; `LILYGO_T5_V213` 222; Printables 27 | `github.com/Xinyuan-LilyGO/LilyGo-T5-Epaper-Series/tree/master/dimensions` (`T5_2.13.dxf`, `LILYGO_T5 2.13.stp`, `Dimensions.JPG`) | |

### Tier B — the second wave

| Display | Size | Outline, mm | Holes | Active area, mm | Why | Drawing |
|---|---|---|---|---|---|---|
| Waveshare 2.13″ HAT (V4) | 250×122 B/W | pHAT 65.0 × 30.2, panel on the PCB, FPC folded round the right edge | Pi Zero pattern (not dimensioned) | 48.55 × 23.71 | Python `epd2in13_V4` **510**, `_V3` 278; ESPHome 16 + 21; Printables 14 | `waveshare.com/img/devkit/LCD/2.13inch-e-Paper-HAT/2.13inch-e-Paper-HAT-details-size.jpg` |
| Waveshare 2.7″ HAT | 264×176 B/W, 4 buttons | unchecked | Pi Zero | unchecked | Python `epd2in7` **810**, the highest Python count; ESPHome 32; Printables 44 | `…/2.7inch-e-Paper-HAT/2.7inch-e-Paper-HAT-details-size.jpg` (downloaded, not read) |
| Waveshare 1.54″ module | 200×200 B/W | 48.0 × 33.0, R1.5 | 4, 2.5 in | 27.6 × 27.6 | ESPHome 59 + 36; GxEPD2 `154_D67` 4384; Python 177 | `…/1.54inch-e-Paper-Module/1.54inch-e-Paper-Module-size.jpg` |
| Waveshare 4.26″ HAT | 800×480 B/W | 107.0 × 64.0, R1 | Pi 58 × 49, 14.5 from the left, 7.5 from the top/bottom | unchecked | TRMNL BYOD; ESPHome model; Seeed EE04; Printables 18 | `…/4.26inch-e-Paper-HAT/4.26inch-e-Paper-HAT-details-size.jpg` |
| Waveshare 5.83″ panel + HAT | 648×480 B/W | panel 125.40 × 99.50 | HAT as the 7.5″ | 119.232 × 88.320 | ESPHome 14 + 13; GxEPD2 3408; Python 142; TRMNL BYOD | `…/5.83inch-e-Paper/5.83inch-e-Paper-details-size.jpg` |
| Waveshare 13.3″ K | 960×680 B/W | panel 286.32 × 212.26; FPC 12.5 wide, 137.14 from the left, 106 long | HAT 65 × 32.2, Ø3 | 275.52 × 195.16, 4.20 from the top, 1.30 from the right | ESPHome 13; Python 160 | `…/13.3inch-e-Paper-HAT-K/13.3inch-e-Paper-HAT-K-details-size.jpg` |
| Waveshare 13.3″ E (Spectra 6) HAT+ | 1600×1200, 6 colours | panel 284.70 × 208.80 × 0.85 (the Inky 13.3's); FPC on the left edge | HAT+ 65 × 30.5, R3.5 | 270.40 × 202.80 | Python 37; `epaper_spi` 17 | `…/13.3inch-e-Paper-E/13.3inch-e-Paper-E-details-size.jpg` |
| Waveshare 2.66″ module | 296×152 B/W | 83.5 × 37.0 | 4, 3.0 in | 60.088 × 30.704 | Python 266 | `…/2.66inch-e-Paper-Module/2.66inch-e-Paper-Module-details-size.jpg` |
| Pimoroni Inky pHAT (4-colour since Aug 2025) | 250×122 | 65 × 30.5 × 8.5; panel 59.2 × 29.2 at 2.9 / 0.65 | none (on the header) | 48.5 × 23.8 | `InkyPHAT` 295 | `cdn.shopify.com/s/files/1/0174/1800/files/Inky_pHAT_Dimensions.png` |
| Pimoroni Inky wHAT (4-colour) | 400×300 | 91 × 77 × 8.5 | Pi standoffs (unchecked) | 84.8 × 63.6 | `InkyWHAT` 173 | none linked |
| Pimoroni Inky Frame 7.3 / 5.7 / 4.0 (Pico 2 W) | 800×480 / 600×448 / 640×400 | 7.3 ≈179 × 139 | "a selection of mounting holes" + legs | 7.3: 160 × 96; 4.0: 86 × 54 | CircuitPython 697 / 624; `DISPLAY_INKY_FRAME*` 177 / 114 / 139; Printables 53 | `inky-frame-7.3.png`, `inky-frame-5-7-drawing.png`, `inky-frame-4-drawing.png` under `cdn.shopify.com/s/files/1/0174/1800/files/` |
| Pimoroni Badger 2040 / 2040 W / 2350 | 2.9″ 296×128 badge | unchecked | unchecked | — | CircuitPython 1032 / 799 / 415; Printables 33 | not looked up |
| Adafruit 2.9″ eInk FeatherWing / ThinkInk breakouts | 296×128 grey / tri-colour | Wing 79.5 × 47.0 | 4, 74.4 × 38.1 | — | `adafruit_il0373` 892, `ssd1680` 635 (all panels) | `cdn-learn.adafruit.com/assets/assets/000/137/963/medium800/raspberry_pi_fab_wing.png`; Eagle `github.com/adafruit/Adafruit-E-Paper-Display-Breakout-PCBs` |
| WeAct 1.54 / 2.13 / 2.9 / 3.7 / 4.2 | B/W, B/W/R, 4-colour | STEP | STEP | — | repo 438★; ESPHome WeAct models | WeAct `Hardware/` above |
| Heltec Wireless Paper (ESP32-S3 + LoRa, 2.13″) | 250×122 B/W | 72 × 30 | 4 corners, 25.0 between centres vertically | 48.55 × 23.705 | meshmap 41 nodes (#29); CircuitPython 204; Printables 16 | `resource.heltec.cn/download/Wireless_Paper/Wireless-Paper.pdf` p. 7 (partial) |
| Waveshare e-Paper ESP32 Driver Board (Rev 3) | driver | 48.25 × 29.46 | **none**; FPC adapter 31.75 × 17.5, 4 × Ø3 | — | drives the Tier A panels | `…/e-Paper-ESP32-Driver-Board/e-Paper-ESP32-Driver-Board-details-size.jpg` |
| Good Display DESPI-C02 | 24-pin 0.5 mm FPC adapter | 41 × 22 | unknown | — | esp32-weather-epd's adapter | `good-display.com/product/516.html` (size only) |
| Seeed XIAO ePaper Display Board EE04 / TRMNL 7.5″ DIY kit driver | driver | unchecked | unchecked | — | TRMNL DIY kit; official cases on Printables (1354873, 1354879, 1361112); "trmnl" 47 | GrabCAD `grabcad.com/library/xiao-epaper-display-board-esp32-s3-ee04-1`; `files.seeedstudio.com/wiki/Epaper/EE04/XIAO_ePaper_Display_Board_EE04_V1.2_SCH&PCB.zip` |

### Tier C — backlog

- Heltec Vision Master E290 / E213 (E290 87.96 × 36.63 × 12 from
  retailers; no official drawing).
- Adafruit ThinkInk Feather RP2040 (CircuitPython 817), 2.13″ and 1.54″
  FeatherWings, the eInk Bonnet, bare EYESPI panels; Pimoroni Pico Inky Pack.
- Other Good Display panels (each has a spec PDF); Waveshare 3.7″, 10.3″
  (IT8951 HAT), 5.65″ F, 2.9″ HAT.
- Inkplate 6FLICK, 6MOTION, 6PLUS, 4TEMPERA (close to finished).
- Elecrow CrowPanel 4.2″ e-paper (CircuitPython 275; probably cased).

### Not candidates

- TRMNL OG / X, Seeed reTerminal E1001 / E1002 / E1004 / Sticky, Seeed XIAO
  7.5″ ePaper Panel (a PLA case 178 × 131 × 19), Waveshare PhotoPainter
  (a frame): finished.
- LilyGO T-Echo / T-Echo Plus (the most common e-paper Meshtastic device,
  172 nodes, 1.8 %), Heltec Mesh Pocket, ThinkNode M1/M5/M6/M7, WisMesh Tag,
  Wio Tracker L1 E-ink: finished.
- M5Paper / M5PaperS3, Xteink X4 / X3, Kindle / Kobo / BOOX: e-readers.
- LilyGO T5S3 4.7″ e-paper PRO: sold with a shell (a board DXF exists,
  63.3 × 67.92).

### Gaps

- Inkplate outlines and holes: `scripts/step.mjs` on the `OUTPUTS/*/… 3D.step`
  files.
- Printables counts filtered by title (a 429); Thingiverse, MakerWorld.
- GxEPD2 counts not normalised against the vendored floor.
- Not read: the Waveshare 2.7″ HAT and 7.3″ F images, the Inky Frame 7.3
  drawing, the GDEY075T7 drawing, the DESPI-C02 datasheet, the EE04 board,
  Heltec Vision Master.
- Hole diameters not given by Waveshare for the 2.9″, 4.2″, 1.54″ and 2.66″
  modules: the spec PDFs or a measurement.
- Inky pHAT / wHAT holes, LilyGO T5 hole circles (DXF polylines).

## What the catalog needs for them

- **A display is a placement, not a board's port.** Today a screen is a
  `display` port on top of a board (`schema.ts`), and its opening is the
  part's own rectangle plus 0.3 mm. A standalone display is a placement of
  its own, as batteries are (`entryOf` turns it into a board entry), so the
  layout, walls and overlap checks stay as they are.
- **The window is the active area, not the outline.** The entry carries both:
  the glass or module outline and the active area with its offset (they are
  what every drawing above gives). The window goes through the face at the
  active area plus a clearance; the glass sits in a pocket behind it,
  against the inside of the face, with a lip that hides the panel's border.
- **It mounts face to the wall.** Its "top" faces the lid or the console's
  slope, the reverse of a board standing on the floor. The holes on its
  back (or the brackets of Touch Display 2) take standoffs from the face;
  a raw panel with no holes (e-paper, Radxa MIPI) needs clips or a frame.
- **An SBC on its back.** The 58 × 49 pattern on most DSI boards means the
  Pi screws to the display, not to the floor: a board placed on the
  display's back, its supports from the display's standoffs. That makes the
  case depth the display's plus the Pi's.
- **Portrait and landscape.** Touch Display 2 is portrait natively; a
  rotation of the placement covers it.
- **Mounting on the display's frame.** Waveshare ESP32-S3-Touch-LCD-7 and
  the original Pi 7″ mount by M3 studs on the LCD's metal back
  (126.2 × 65.65), not by the PCB's holes: the supports go to the frame.
- **Round windows and round boards**: HyperPixel 2.1 Round, the GC9A01
  modules (a round head with a tab — the entry's `outline`), Waveshare
  ESP32-S3-Touch-LCD-2.1 (a Ø65 PCB), Touch-AMOLED-1.43, the XIAO Round
  Display.
- **A glass panel with no holes** (e-paper, Radxa MIPI): a pocket of the
  glass outline behind the window, a slot for the FPC and its bend, and the
  driver board as a second placement on standoffs.
- **The window is the visible area for character LCDs** (1602/2004/12864):
  the metal bezel stands proud of the PCB, so the board sits back by the
  bezel's height.
- **The FPC or cable leaves somewhere.** DSI FPCs, HDMI and USB on the
  driver board's edge need room in the cavity, as ports do now.
- **Generic modules vary between sellers** (0.96″ OLED hole spacing, 1602
  hole Ø2.5–3.0, the 1.3″ ST7789 with no holes): an entry stays ≈ until a
  measured board backs it, and the hole size is the largest seen.
- **Shared outlines go in together:** Touch Display 2 7″ with Waveshare 7″
  DSI (H); the original 7″ with Waveshare 7″ DSI / DSI (C) on the front;
  BTT HDMI7 with Pi TFT70; BTT HDMI5 and Pi TFT50 with Waveshare 5″ DSI
  (121 × 76); the three Touch Display 2 sizes; the CYD with JC2432W328 and
  CYD2USB; Sunton 8048S043 with 4827S043; the 7.5″ e-paper family with the
  7.3″ E and the Inky Impression 7.3's panel; the LCDwiki MSP TFTs (one
  construction, four sizes); the three Inky Impression sizes.
