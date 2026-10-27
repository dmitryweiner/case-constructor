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
| Displays for single-board computers (DSI, HDMI, DPI, SPI HATs) | done, below |
| Boards with a screen on them (CYD/Sunton, Guition, Waveshare ESP32-S3-Touch-LCD, LilyGO T-Display, CrowPanel) | **pending**: research stopped on the API limit |
| Small SPI/I²C modules (OLED, ST7789/ILI9341 TFT, GC9A01 round, 1602/2004, Nextion, printer displays) | **pending**: same |
| E-paper (Waveshare, Good Display, Inky, Inkplate, XIAO 7.5″ / TRMNL DIY, LilyGO T5) | **pending**: same |

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

Pending. Already in the catalog: ESP32-2432S028R (CYD, ≈), Heltec WiFi
LoRa 32 V3/V4 and Wireless Tracker (small OLEDs). The boards plan lists
LilyGO T-Display S3 in its Tier B.

## Small SPI/I²C modules

Pending.

## E-paper

Pending.

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
- **Round windows** for HyperPixel 2.1 Round (and GC9A01 modules, when the
  modules segment is in).
- **The FPC or cable leaves somewhere.** DSI FPCs, HDMI and USB on the
  driver board's edge need room in the cavity, as ports do now.
- **Shared outlines go in together:** Touch Display 2 7″ with Waveshare 7″
  DSI (H); the original 7″ with Waveshare 7″ DSI / DSI (C) on the front;
  BTT HDMI7 with Pi TFT70; BTT HDMI5 and Pi TFT50 with Waveshare 5″ DSI
  (121 × 76); the three Touch Display 2 sizes.
