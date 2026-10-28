# Perspective keyboards — what to add to the catalog next

Researched on 2026-10-27, in the same way as `PERSPECTIVE-BOARDS.md` and
`PERSPECTIVE-SCREENS.md`. The segment is small keyboards sold as boards:
I²C or USB keypads that go into handhelds, cyberdecks and Meshtastic nodes,
and macropads. `PERSPECTIVE-BOARDS.md` left keyboards out as "boards that
live inside something else"; here the keyboard is the board the case is
built around. A keyboard only belongs in the catalog if it scores on all
three of these:

1. **Demand, measured rather than guessed.** The signals are listed below.
2. **It is sold bare and needs a case.** A PCB with its keys, or a keypad on
   its carrier board. Keyboards sold in a shell (ZitaoTech's, Beepy,
   Cardputer) are out.
3. **There is a drawing to transcribe from.** For a keyboard the drawing
   must give more than for a board: the outline, the holes, **the key
   field** (its extent and offset from the outline, which becomes the
   lid's window) and **the key tops' height** above the PCB, plus where the
   connector leaves. With only some of that, the entry goes in as
   `verified: false` (≈).

The list started from five keyboards the user named (CardKB v1.1,
BBQ20KBD, KeebDeck Keyboard, ZitaoTech BB9900 USB, mini PiQwerty II). Three
came out of the research: the Adafruit MacroPad RP2040, the Solder Party
Keyboard FeatherWing, and ZitaoTech's BBQ20 USB keyboard, the one with
published Gerbers. Two of the user's five did not survive the criteria
unchanged:
- **The KeebDeck Keyboard is a part, not a board.** It is a silicone
  keypad and a dome sheet that go onto someone else's PCB. Solder Party's
  board with that keypad on it is **KeebDeck Basic**, and that is the
  entry.
- **The BB9900 USB keyboard is only sold assembled in a printed case**, and
  its repo has no PCB files.

## Signals and what they are worth

| Signal | What it measures | Caveat |
|---|---|---|
| Printables search (`demand.mjs printables`): of the top 60, how many have the model in the name, and their downloads summed | People print cases or plates for this, the strongest signal for this project | Small numbers in this segment. One model can dominate (a Meshtastic case for the CardKB: 1,758 of 4,514) |
| GitHub code search, exact id (`demand.mjs github`) | Mentions in code and configs | Vendored libraries set a floor: every Meshtastic fork carries `CARDKB_ADDR`. "BB9900" (18,816) is the BlackBerry phone, not the keyboard: unusable |
| CircuitPython downloads (`demand.mjs circuitpython`, 697 boards, 618k in all) | Firmware downloads for keyboards that have their own MCU | Below ≈1,000 is noise. Only the MacroPad and the BBQ20KBD have a build |
| Meshtastic firmware `src/input/cardKbI2cImpl.cpp` | Which I²C keyboards a node finds by itself | Yes/no. It scans CardKB, BBQ10 (0x1F), T-Deck, MPR121, TCA8418, RAK14004 and STC8H |
| GitHub stars of the hardware repos | Mindshare | Hype skews it: ZitaoTech's Hackberry Pi has 2,726★ and is a finished device |
| Tindie review counts | Sales of small makers | All-time. Two of the three sellers are "taking a break" |
| Hackaday.io followers and likes | Attention for a project | Not sales |
| Amazon, AliExpress (the CardKB's main channel) | — | Not measured: behind bot walls |

Raw counts:

- **Printables (name matches of the top 60 / downloads):** CardKB 18 of 26
  / **4,514** (Heltec LoRa32 V3 Meshtastic case, "M5Stack CardKB
  Keyboard-ready" 1,758 and 510). Adafruit MacroPad 24 / **2,010** (Adafruit
  Macropad Case 618, HaloPad V2 284). KeebDeck 4 of 9 / 222 (A Frame for the
  KeebDeck Basic 127). BBQ20 2 / 71 (BBQ20KBD Top Plate 60). Keyboard
  FeatherWing 1 / 7. BBQ10, BB9900, PiQwerty, "blackberry keyboard": 0.
  For scale: Beepy 10 of 169 / 1,015.
- **GitHub code:** `CardKB` **4,232**, `"CARDKB_ADDR"` 425,
  `adafruit_macropad` 1,534, `BBQ10Keyboard` 660, `bbq20kbd` 220,
  `keebdeck` 115, `i2c_puppet` 71, `PiQwerty` 16.
- **CircuitPython:** `adafruit_macropad_rp2040` **2,515 (#17 of 697)**,
  `solderparty_bbq20kbd` 652 (#335, noise).
- **Stars:** solderparty/bbq20kbd_hw 225, i2c_puppet (the BBQ20KBD's
  firmware) 120, keebdeck_keyboard_hw 56, keebdeck_basic_hw 50,
  keyboard_featherwing_hw 29 (+ 43 for arturo182's original), arturo182/BBQ10KBD
  452. ZitaoTech: BBQ20-USB_BLE 172, BB9900-USB_BLE 128, BBQ20-USB 86,
  BB9900-USB 66.
- **Tindie:** ZitaoTech BB9900 USB 11 reviews (4.64), BBQ20 USB 9 (5.00),
  both out of stock. bobricius mini PiQwerty 9 reviews (5.00).
- **Hackaday.io:** mini PiQwerty II 177 followers, 144 likes, last updated
  2021-04.

What the numbers say:

- **The CardKB leads by an order of magnitude** in code, and on Printables
  it is the keyboard people put into Meshtastic cases. Meshtastic finds it
  by itself. Its partner in those cases, the Heltec V3, is already in the
  catalog.
- **The MacroPad is the strongest board of its own kind**, at #17 in
  CircuitPython with 24 printed cases.
- **The BlackBerry keyboards are a niche with good drawings.** The
  BBQ20KBD and the Keyboard FeatherWing have KiCad layouts and STEP. The
  BBQ20KBD runs i2c_puppet, which speaks the BBQ10 protocol, so
  Meshtastic's BBQ10 driver serves it (unchecked on hardware).

**In the catalog (2026-10-28, `plans/PLAN-KEYBOARDS.md`):** all of Tier A
and Tier B — CardKB v1.1, BBQ20KBD, MacroPad RP2040, KeebDeck Basic,
Keyboard FeatherWing — and the preset `meshtastic-cardkb` (Heltec V3 +
CardKB). Corrections found on the way are in the plan's deviations (K6a–c):
the CardKB's keys stand 1.75 mm and its Grove socket is on top; the
MacroPad's STEMMA QT and reset are on the left edge seen from the front; one
of the BBQ20KBD's holes is under its keyboard.

## Tier A — high demand, drawing checked

| Keyboard | Controller, link | PCB, holes | Key field, height | Why | Drawing | Note |
|---|---|---|---|---|---|---|
| M5Stack Unit CardKB v1.1 (U035-B) | ATmega8A; I²C at 0x5F on a Grove HY2.0-4P | 84 × 54, R5; **no holes**: rails. PCB 1.0 | 4 rows of tact switches at 6 pitch, first column 15 from the left, the top row 11 from the top edge. A 4-key arrow cross at the bottom left (9.15 / 11.3 from the left, 6.5 / 9 from the bottom). Key tops 2.75 above the PCB. 6.3 overall at the Grove socket | Printables 18 / **4.5k**. GitHub code **4,232**. Meshtastic finds it by itself | `m5stack-doc.oss-cn-shenzhen.aliyuncs.com/806/cardkeyboard_v1_1.pdf` (checked; text is outlined, so read from the picture). Docs: `docs.m5stack.com/en/unit/cardkb_1.1` | The Grove socket is on the left edge, about 11–23 from the top (the drawing's 11 and 12 dimensions; confirm against the STEP or a photo). Pairs with `heltec-wifi-lora-32-v3`: a preset |
| Solder Party BBQ20KBD | RP2040, i2c_puppet; USB-C, STEMMA QT, PMOD | 74 × 53.1; **2 × Ø2.7 on a diagonal**: (11.4, 3.8) and (70.9, 50) | The BlackBerry Q20 keyboard with its trackpad on top. Base 71.33 × 45.53 at (1.34, 2.48), 1 above the PCB. Key tops 4.15 above the PCB. Trackpad connector (Hirose) at (12, 30.9) | Stars 225 + 120. Code 220. CircuitPython 652. Printables 2 / 71 (a top plate). Serves Meshtastic as a BBQ10 | `solderparty/bbq20kbd_hw`: `bbq20_keyboard.kicad_pcb` (checked, `board.mjs --kicad`), `bbq20_keyboard_full.step` (checked, `step.mjs`), `bbq20_keyboard_case.step` (Solder Party's own case, not opened) | **The USB-C (37, 48.9), STEMMA QT (21.4, 49.85) and PMOD header (46.25–58.95, 42.53) are on the underside**, at the top edge |
| Adafruit MacroPad RP2040 (5100; kit 5128) | RP2040; USB-C, STEMMA QT | 59.69 × 104.14; 4 × M3 SMT nuts at (3.81, 19.05), (55.88, 19.05), (3.81, 100.33), (55.88, 100.33), spaced 52.07 × 81.28 | 12 MX switches, 3 × 4 at 19.05 pitch, centres x 10.8 / 29.85 / 48.9, y 10.8…67.94. Kailh hot-swap sockets on the underside. PEC11 encoder at (11.43, 90.17). 1.3″ 128×64 OLED (not read) | CircuitPython **2,515 (#17)**. Code 1,534. Printables 24 / **2.0k** | Eagle `adafruit/Adafruit-MacroPad-RP2040-PCB`, `Adafruit MacroPad 2040 rev D.brd` (checked, `board.mjs --brd`). STEP/STL `adafruit/Adafruit_CAD_Parts/5100 MacroPad RP2040/` (not opened) | USB-C on the top edge at 29.85, STEMMA QT on the right edge at y 92.71. Switch and keycap heights come from the STEP. The lid needs 14 mm switch cutouts or one window |

## Tier B — a drawing, narrower demand

- **Solder Party KeebDeck Basic**: the board for the user's "KeebDeck
  Keyboard". STM32F042; USB-C on the top edge at 43.7; Qwiic on the
  underside at (32.1, 64.3). 87.4 × 67.6, 4 × Ø3, 4.45 in from the edges
  (78.5 × 58.7). Under the silicone keypad there are 72 switch pads in 6
  rows, x 4.1…83.3, y 13.4…53.49. The keypad itself is 85.8 × 48.6
  (`keebdeck_keyboard_hw/dimensions.pdf` p. 1, the 6x13; only that size is
  final). It needs a top cover that holds its flange down. Solder Party
  makes the cover as a PCB (`keebdeck_basic_faceplate.kicad_pcb`, not
  opened); a printed lid could do the same job.
  - Demand: Printables 4 / 222 (a frame 127), code 115, stars 56 + 50.
    Sold on Lectronz.
  - Drawing: `solderparty/keebdeck_basic_hw/keebdeck_basic.kicad_pcb`
    (checked), `keebdeck_basic.step`.
- **Solder Party Keyboard FeatherWing**: a BlackBerry Q10 keyboard plus a
  2.6″ 320×240 TFT (ER-TFT026, resistive touch through a TSC2004),
  microSD, and a Feather socket. 68 × 100, 4 × Ø3.2 at (7.2, 3.8) and
  (60.8, 96.2) corners, spaced 53.6 × 92.4. The keyboard connector is at
  (43.6, 58.2), the TFT's FPC at (23.4, 70.5), the microSD at (48.1, 90.1),
  and the STEMMA QT on the left edge at y 48.1.
  - Demand: code `BBQ10Keyboard` 660 (shared with the BBQ10 PMOD and
    Beepy), stars 29 + 43, Printables 1 / 7. Whether it is still sold was
    not checked.
  - Drawing: `solderparty/keyboard_featherwing_hw/keyboard_featherwing.kicad_pcb`
    (checked), `.step`.
  - A keyboard and a display window in one lid.

## Tier C — backlog

- **mini PiQwerty USB keyboard II** (bobricius). Raspberry Pi Pico, 36
  DTS63K switches, micro-USB, 107 × 65 × 20 as three stacked PCBs (front
  panel, main board, bottom cover; 8 thick without the bottom). Sold on
  Tindie as a bare PCB set or assembled (9 reviews; one asks for the USB on
  the side). Stacked with M2 × 10 and ≈4 mm spacers, according to a
  reviewer.
  - Demand: code 16, Printables 0, Hackaday 177 followers.
  - **No drawing**: no Gerbers or CAD published, so the holes would be a
    measurement.
  - The front and bottom PCBs are already its case. A printed one replaces
    only the bottom board.
- **ZitaoTech BBQ20 USB keyboard (wired)**. A BlackBerry Q20 keyboard with a
  trackpad on an RP2040 board, USB-C. `ZitaoTech/BBQ20-USB-keyboard` (86★)
  publishes `Haredware/Gerber/Gerber_BBQ20_USB_Keyboard.zip` and a
  schematic (neither opened), plus the case STL.
  - Sold only assembled in a printed case (Tindie, 9 reviews, out of
    stock). A DIY build from the Gerbers is the only bare one.
- **The BB Q10 keyboard PMOD / breakout** (arturo182, 452★ and 111★, last
  pushed in 2020). The ancestor of the BBQ20KBD. Probably no longer sold
  (unchecked).

## Not candidates

- **ZitaoTech BB9900 USB keyboard** (from the user's list). Sold only
  "assembled with a 3D printed case" ($30; Tindie 11 reviews, 4.64; seller
  on a break). The repo (`BB9900-USB-keyboard`, 66★) has the case STLs
  and firmware, **no PCB files**.
- **ZitaoTech BLE keyboards** (BBQ10, BBQ20, BB9900, P9983 USB_BLE). Cased
  and battery-powered. The sizes in their READMEs (BBQ20 54.97 × 81.95 ×
  13.3) are the finished units'. The BBQ20's
  `Mechanical drawing/BBQ20_2D_Drawing.DXF` (checked: 81.95 × 54.97, 4 ×
  Ø2.7) is the unit's outline, useful only for a holder.
- **Finished devices**: Beepy (SQFMI), Hackberry Pi Zero / CM5 / Pi5
  (ZitaoTech), M5Stack Cardputer, LilyGO T-Deck.

## Gaps

- **CardKB**: the Grove socket's position and the key field's right and
  bottom margins come from a picture. Check them against a photo, and look
  for an M5 STEP (none is listed on the docs page).
- **MacroPad**: the OLED's position, and the switch and keycap heights.
  These are in the STEP from `Adafruit_CAD_Parts`, not opened.
- **Not opened**: the KeebDeck Basic faceplate, the BBQ20KBD case STEP, the
  ZitaoTech BBQ20 Gerbers.
- **Not checked**: whether the Keyboard FeatherWing and the BBQ10 PMOD are
  still sold, and whether the BBQ20KBD works on Meshtastic on real hardware.
- **Not researched**: RAK14004 (a WisBlock keypad that Meshtastic
  supports), TCA8418 and MPR121 keypad boards, and the CardKB's sales on
  AliExpress and Amazon.

## What the catalog needs for them

- **A key field on top.** Today there are two ways to fake it: a `display`
  part, which gives a window through the lid and a rim from its `glass`, or
  a user opening. A `keys` part type would do it properly: the field's
  rectangle, the key tops' height, and the lid's choice of one window or a
  grid of holes. The grid needs rows, columns, pitch and hole size: 14 mm
  at 19.05 for the MacroPad, round or square holes at 6 pitch for the
  CardKB. KeebDeck needs a third option, a window narrower than the keypad
  with the keypad's flange under the lid. That is the faceplate's job, the
  same way the screen rim holds a display's glass.
- **A keyboard usually hangs from the lid.** The Meshtastic CardKB cases
  put the keys in the top face next to the Heltec's display. The display
  placements already do this (`placement.on: 'ceiling'`, its supports from
  the plate). A keyboard needs the same, and on the console's slope too.
- **Connectors on the underside at an edge** (BBQ20KBD: USB-C, STEMMA QT,
  PMOD; MacroPad: the sockets). Edge ports with a negative `z` already
  cover this; check the channel against the floor.
- **Two diagonal holes** (BBQ20KBD): two standoffs leave the other corners
  free, so the board rocks under a key press. Either add rests under the
  free corners, or use the lid's rim to press the keyboard base down.
- **No holes** (CardKB): `rails`. The rails must stay clear of the arrow
  cross and the key rows at the edges.
- **A preset**: Heltec V3 + CardKB, a Meshtastic node with a keyboard.
  These are the top Printables models in the segment.
