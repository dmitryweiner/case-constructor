# Case Constructor — what the Tier A boards left to do

Status: written on 2026-10-25 after the Tier A boards from
`PERSPECTIVE-BOARDS.md` went into the catalog (25 entries, the Pico 2 as an
alias). The open questions were settled with the user on the same day
(below); the work goes in the order
**B8 → B1 → B2 → B5 → B4 → B6 → B3 → B7 → B9**.

Same rules as PLAN.md: TDD, golden tests for new geometry (a new state per
feature, old ones untouched), `npm run check` and `npm run smoke` before
each commit, commit and push after each item, deviations recorded at the
end of this file.

The transcription agents worked around the gaps below and said so in their
reports. The workarounds are in the data, so each item lists the entries it
touches.

## Decisions (2026-10-25, with the user)

- **Q1 (B1).** The default of **Pins soldered downwards** is how the board
  ships: the entry says so (`pins.soldered`). DevKitC, Nano, DevKit V1 come
  with pins; Pico, XIAO, Zero, Feather come bare.
- **B1, rails.** With pins soldered on a gripped edge the rail gets a **pin
  bed** instead of its lower lip (see B1). A warning alone was rejected: it
  leaves every soldered rail board without a mount.
- **Q2 (B2).** M1.6 is for **boards only**. The lid keeps M2…M4.
- **Q3 (B6).** **Variants in one entry** (`variants`), with a select on the
  board card. The Feather ESP32-S3 TFT and Reverse TFT become variants of
  the Feather ESP32-S3 entry.
- **Order:** B8, B1, B2, B5, B4, B6, B3, B7, B9.
- **B7:** everything, with no new dependencies; `scripts/proto/` is deleted
  at the end.
- **B9:** the ≈ entries are checked against drawings found online (the ones
  without a drawing stay ≈), RAK3401 on the RAK19007 and the Feather TFT
  variants are done here. The visual review stays with the user.

---

## B1. Header pins under the board: one rule for every entry

**Now.** `bottomHeight` is "the tallest part below the PCB", which also
sets the lowest standoff (`bottomHeight + 1`). For boards with through-hole
header rows, the entries do not agree on whether pins pointing down count:

| Pins down counted (8.5 mm) | Pins not counted (1–3.6 mm) |
|---|---|
| Arduino Nano, ESP32 DevKit V1, ESP32-DevKitC V4, Adafruit Feather (both), Heltec WiFi LoRa 32 V4 | Heltec WiFi LoRa 32 V3 (1.5), Heltec Mesh Node T114, Raspberry Pi Pico, Seeed XIAO, Waveshare Zero, ESP32-C3 SuperMini, Olimex ESP32-POE-ISO, RAK19007 |

With pins counted, a bare board gets a case about 7 mm taller than needed.
Without them, a board with soldered pins sits on them, or the pins pass
through the floor. On rails the pins along the gripped edges also collide
with the lower lip (`docs/boards.md`, Rails).

**Plan.**
- An entry describes the **bare** board: `bottomHeight` without pins, plus
  an optional `pins: { below: 8.5, edges: ["front", "back"] }` (how far the
  pins reach under the PCB, and which edges carry the rows).
  `pins.soldered` says how the board ships (Q1); `pins.inset` is the row
  centre from the edge (default 1.27).
- The board card gets **Pins soldered downwards** (a checkbox,
  `#board<i>_pins`). It is shown only for boards with `pins`, its default is
  `pins.soldered`, and it is kept in the placement (sanitized like every
  other field; a missing value takes the default).
- Effective underside = `max(bottomHeight, pins.below)` when the box is
  ticked; the lowest standoff and `zBottom` follow it.
- **Rails: the pin bed.** On a gripped edge that carries pins, with the box
  ticked, the rail loses its lower lip. Under the groove it stops at the
  header's plastic (`PIN_SPACER` = 2.5 mm below the PCB), reaches inwards
  far enough to carry it, and has a slot along the pin row (from the
  plastic down to the floor) for the pins. The upper lip still clicks over
  the edge. Pins on a gripped edge of a bare board change nothing. The other
  pair of edges is not offered: the short edges carry the USB.
- Migrate every entry in the table: move the 8.5 to `pins`, and give
  `pins` to the boards that have rows but no count yet.

**Tests.** A sanitizer round trip with and without `pins`. The standoff
height follows the checkbox. The pin bed leaves the pin rows free (a pin
box per row does not touch the rail) and has no slivers. The golden test
gets a new state (a Nano on rails with pins down); old states keep their
numbers, because a missing `pins` keeps today's behaviour. The smoke ticks
the box on a rail board.

**Done.** 24 entries carry `pins` (bare `bottomHeight` estimated where the
8.5 was the pins). See the deviations for what differs from the plan.

## B2. Screws below M2

**Now.** `SCREW_SIZES` is M2…M4 (`src/geo/fasteners.ts`). The Heltec WiFi
LoRa 32 V4 has Ø1.9 holes (they hold the display bracket), and the entry
says M2, which does not pass.

**Plan.** Add **M1.6** to the table: tap 1.3, insert 2.4 × 3 (an estimate
until a real M1.6 insert is measured), nut 3.2 AF × 1.3 (ISO 4032), head
3.2 × 1.3 (ISO 7045). The standoff diameter keeps its 5 mm minimum. The lid
keeps M2…M4 (Q2): its select and its sanitizer use their own list, and an
M1.6 in a lid from a file falls back to the default. Set the Heltec V4
entry to M1.6. Keep M1.2 out: the RAK19007's M1.2 holes are for
its modules, not for mounting the board.

**Tests.** The fasteners table test covers the new row (every diameter > 0,
tap < d < insert). The lid sanitizer refuses M1.6. The golden test gets a
new state with a board on M1.6.

**Done.** `LID_SCREW_SIZES` is the lid's list; the Heltec V4 is on M1.6.

## B3. Non-rectangular outlines

**Now.** `size` is a rectangle. Entries that are not:
- **Chamfers:** Arduino Uno / UNO Q / Leonardo / Mega, Heltec V4 (2.16 and
  3.81 × 45°), Orange Pi Zero 3W.
- **Notches:** RAK19007 (bottom 15.5–28.5 × 0–8, right 52–60 × 6.9–21.4),
  Orange Pi 5 Max / 5 Pro (the power key sits in a notch of the right edge).

The rectangle is safe for the case, because the cavity is at least that
big. The ghost is wrong, though, and the overlap check is pessimistic.

**Plan.**
- An optional `outline: [[x, y], …]` in the board frame (a simple polygon,
  inside `size`).
- The ghost PCB draws it (already triangulated with `earcut`, holes
  included).
- Layout and the cavity keep using `size`.
- The board check rejects an outline that leaves `size` or crosses itself.
- Low priority: it changes the picture, not the print.

**Done** for Arduino Uno, Leonardo, Mega (layer 20 of their Eagle files),
UNO Q (the UNO outline: its Allegro files are binary), Heltec V4 (its
datasheet drawing), RAK19007 (the notches above) and, after B7, the Orange
Pi 5 Pro (its vector PDF through `dxf.mjs`: a bottom view, the power key's
notch 1.25 × 6.1 mm on the right edge). Left for B9: the Orange Pi 5 Max
(Drive asks for a confirmation the tools cannot give) and the Zero 3W (a
Drive folder) — download them by hand.

## B4. Parts on the underside

**Now.** A part is on an edge or on top (`edge: "top"`). Parts the user
must reach from below cannot be described:
- ESP32-2432S028R: RESET and BOOT buttons, the RGB LED.
- Adafruit Feather ESP32-S3 Reverse TFT: the display.
- Bottom LEDs on several SBCs.

Today the user adds a bottom opening by hand.

**Plan.**
- `edge: "bottom"`: a part centred at (x, y) on the PCB's underside, with
  h measured downwards.
- Its cutter is a vertical column from just below the part down through the
  floor, the mirror of a top element. It goes through the common cutter
  pass, so a bottom lid gets the hole too.
- Standoffs and rails already avoid nothing there. Warn when a bottom part
  lands on a standoff or a rail.
- It counts towards `bottomHeight`.

**Tests.** A cutter test (the column reaches the outer bottom, nothing
else is cut), a golden state, and fastening/degenerate checks on a bottom
lid.

**Done.** `TopPort` takes `edge: 'top' | 'bottom'` (`onFace`); bottom
parts count in `undersideOf`; `warn.bottomPartOnSupport`. The CYD has its
BOOT, RESET and RGB LED underneath, placed from a photo (the entry stays
≈). The Reverse TFT comes with B6.

## B5. Port types the boards needed

**Now.** The agents used `generic` (and other types) with explicit sizes:

| Needed | Used for | Entries |
|---|---|---|
| screw terminal | power and LED outputs, wires leave through the wall | QuinLED Dig-Quad, Dig-Uno, BTT Pi (12–24 V) |
| JST / PicoBlade / Qwiic | battery, speaker, I²C | Feather (both), CYD, RAK19007, UNO Q |
| 2×N header | PoE 2×2, UEXT 2×5, 2×3 | ROCK 5C, 4D, Q6A, Olimex, UNO Q |
| SIM slot | nano-SIM (as `microsd`) | ROCK 5B+ |

**Plan.** Add `terminal` (5.08 pitch, an edge type, cut on: a slot for the
wires), `jst` (top or edge, cut off), `header-2xN` (top, cut off) and
`sim` (edge, like `microsd`). Defaults go into `PORT_TYPES`, the names go
into the four dictionaries (the custom board editor lists them), and the
entries in the table move to the new types. Standing connectors (HDMI,
USB-C on end: ROCK 5B+, Orange Pi 5 Max / Pro / Plus) stay as they are:
swap w and h. Document that in the add-board skill.

**Tests.** Today's ones: `tests/boards.test.ts` checks every type's
defaults and every entry.

**Done.** The four types, their names in the dictionaries, the entries in
the table moved (QuinLED, BTT Pi, Feather, CYD, RAK19007, UNO Q, ROCK 5C /
4D, Q6A, Olimex, ROCK 5B+).

## B6. Family entries with parts that move between variants

**Now.**
- **XIAO, Waveshare Zero, Feather:** one outline, but buttons sit in
  different places per variant. The agents set those buttons `cut: false`,
  so no variant gets an opening it does not need, and none gets the
  openings it does need.
- **QuinLED Dig-Quad / Dig-Uno, Olimex:** a part on top that overhangs the
  edge (the plug-in ESP32's antenna) is entered as an edge port with
  `cut: false` and a `protrude`, which keeps the wall clear.

**Plan (Q3: variants).**
- `variants: [{ id, name, ports?: { <portId>: { …overrides } }, add?: [ports],
  topHeight?, bottomHeight? }]` in an entry. The overrides change fields of
  existing ports (`cut`, position, `edge`), `add` brings ports only that
  variant has. Names are English strings in the JSON, like board names.
- The board card gets a select (`#board<i>_variant`), shown only for
  entries with variants; the placement keeps `variant` (sanitized against
  the entry, a missing or unknown one takes the first variant).
- `boardOf` resolves the variant, so layout, ghosts, cutters and the
  worker all see one resolved `BoardDef`. The board check validates every
  variant resolved.
- XIAO, Waveshare Zero and Feather get a variant per model, with their
  buttons back at `cut: true` where the drawing has them. The Feather
  ESP32-S3 TFT (display on top) and Reverse TFT (display on the underside,
  B4) are variants of the Feather ESP32-S3 entry.

**Tests.** A sanitizer round trip with a variant, the resolution test (an
override and an added port show up, the others stay), the board check over
every variant, a golden state with a non-default variant.

**Done.** XIAO (8 models), Waveshare Zero (3), Feather (6), Feather
ESP32-S3 (S3, S2, C6, TFT, Reverse TFT), each button placed from the
vendor's own board file (Eagle `.brd`, KiCad, STEP, DXF), with its net to
tell reset from boot. Every variant builds closed and sliver-free in
`tests/cutouts.test.ts`.

The overhang workaround stays. Write it into the add-board skill.

## B7. CAD tools: make the agents' throw-away readers permanent

**Now.** The drawings came in four forms the tools could not read:
- **Allegro DXF with everything in blocks (INSERT)** — ROCK 4D, ROCK 5B.
  `scripts/dxf.mjs` skips blocks.
- **Vector PDF named "DXF"** — Orange Pi 5 Max, 5 Pro.
- **STEP assemblies** — Orange Pi 5 Plus, BTT Pi, XIAO, Waveshare Zero,
  Dragon Q6A.
- **Eagle `.brd` and KiCad `.kicad_pcb`** — Adafruit Feather, CM5 IO Board.

The agents wrote temporary readers. The ones that need no packages are kept
in `scripts/proto/` (its README says which board each was used for). For
two jobs the agents installed packages in the scratchpad without asking the
user:
- **`ezdxf` (pip, in a venv):** to expand INSERT blocks.
- **`occt-import-js` (npm):** to triangulate STEP models.

Neither is needed.
- **INSERT expansion** is a block definition placed with a translation,
  rotation and scale, nested.
- **STEP is a text format.** `scripts/proto/stepbox.py` walks the assembly's
  placements and reads part boxes and circles (holes) with the standard
  library. Other agents used the same approach for the Orange Pi 5 Plus,
  XIAO and Waveshare Zero.

**Plan.** Extend the existing scripts and keep everything in Node, with **no
new dependencies**: only the standard library and `pdftocairo` (poppler is
already used). A dependency is added only with the user's explicit approval
(agents included), and it is recorded here. Rewrite each prototype, then
delete it from `scripts/proto/`:
- **`dxf.mjs`: expand INSERT blocks** (nested, with their transform). With
  `--boxes`, print the block name per component: Allegro and Radxa write
  the package name there (`TYPEC`, `CON_HDMI`, `USB3_TH18`…).
- **`dxf.mjs file.pdf`: read a vector PDF.** Go through `pdftocairo -svg`,
  correct the scale against a known dimension (`--scale` or `--fit w,d`),
  and treat its subpaths as polylines and circles. The prototypes are
  `proto/pdfboxes.mjs` (boxes of every subpath, as for the ROCK 5B) and
  `proto/svg2dxf.py` (SVG → DXF, as for the Orange Pi 5 Max / Pro).
- **`scripts/step.mjs` (new): the bounding box of every part of a STEP
  assembly**, mapped into the board frame (`--flip`, `--rotate`). It also
  lists the circles of a part (hole candidates, as `dxf.mjs` does), from
  the text parser of `proto/stepbox.py`. Known limit to check: the 79 MB
  Creo export of the ROCK 5B+. A STEP kernel (`occt-import-js`, about
  10 MB of WASM) comes in only with the user's approval, and only if a real
  file defeats the text parser.
- **`board.mjs --brd <file>` / `--kicad <file>`: list the footprints** with
  their positions, in the board frame. The prototypes are `proto/brd.py`
  and `proto/kpcb.py`.
- **The add-board skill** gets a section "which tool for which drawing".

**Tests.** A tiny fixture per format in `tests/fixtures/` (a block DXF, a
one-page vector PDF, a two-part STEP), each read back to known boxes.

**Done.** `scripts/lib/drawing.mjs` (DXF with blocks, pdftocairo SVG),
`scripts/lib/step.mjs`, `scripts/lib/pcb.mjs` (Eagle, KiCad) behind
`dxf.mjs`, the new `step.mjs` and `board.mjs --brd / --kicad`; fixtures for
all five formats in `tests/drawing.test.ts`; `scripts/proto/` deleted. The
ROCK 5B+ Creo export (79 MB) reads in 2.6 s with 0.7 GB: no STEP kernel.

## B8. `snap.mjs` loses clicks while the dev server reloads

**Now.** While another process edits files, Vite's HMR reloads the page
between `goto` and the first click, and the click goes to the old page. The
snap then shows the default Pi 4 case with its warnings. `--wait 1500`
worked around it. (An agent also blamed `--view` for taking the next
argument; it does not: `parseArgs` treats it as a boolean.)

**Plan.** Before the actions, `snap.mjs` waits for the app to report ready
(`window.__case.state()` present and the first build done). After each
click that changes the board list, it waits for the next build. A reload
during the actions is reported as an error, not shot silently.

**Done.** The dev hook has `built()` (the worker answered for the current
generation). The snap waits for it after boot and after every action, not
only board-list clicks: a slider's rebuild had the same race. A reload exits
with code 3.

## B9. Data follow-ups

- **The user's visual review** of every new entry: `shots/<id>.png` against
  its drawing, and `shots/<id>-case.png` (regenerate with
  `node scripts/board.mjs --svg <id> --png` and the snap from the skill).
- **≈ entries to verify against a drawing** (done here: search for an
  official drawing, re-transcribe from it, and leave ≈ where none exists).
  - From before: Arduino Uno, Mega, Orange Pi 5, ESP32-DevKitC V4,
    Wemos D1 mini.
  - New: ESP32 DevKit V1, ESP32-C3 SuperMini, ESP32-2432S028R, QuinLED
    Dig-Uno, XIAO ESP32-S3 Sense.
- **Heights the drawings lack** (accepted as estimates for now):
  - ROCK 5B+: standing HDMI and USB-C.
  - RAK19007: height of the core module.
  - QuinLED: terminal heights.
  - Orange Pi 5 Max / Pro: USB-C.
  - CM5 IO Board: power button.
- **Feather ESP32-S3 TFT / Reverse TFT:** done in B6, from Adafruit's
  drawings.
- **RAK3401 (1 W) core on the RAK19007:** check its height and antennas,
  then make it a variant of the RAK19007 (B6).

---

## Deviations

- **B1.** The golden `esp32-rails-cylinder` changed (body 808 → 840
  triangles): the DevKitC ships with pins soldered, so its rails are a pin
  bed now. That is the feature, not a regression; the other states kept
  their numbers.
- **B1.** The ghost draws a pin row along the whole edge (less `inset` at
  each end): the entry does not say where a row ends, and the bed's slot
  runs the rail's length anyway.
- **B1.** The custom board editor has no pins controls; a custom board's
  catalog JSON keeps `pins` when it has them.
- **B1.** `pins.inset` is at least 0.8 mm: closer to the edge the slot
  would meet the groove's face.
- **B5.** The terminal's "slot for the wires" needed a port field the plan
  did not name: `cutH`, the opening's height from the port's bottom
  (`terminal` defaults to 5.5). The QuinLED Dig-Quad's 14 mm power
  terminals have `cutH: 8`, an estimate like their heights (B9).
- **B6.** Variants may also `remove` ports (the XIAO SAMD21 has no buttons,
  the RP2040 no shield), which the plan did not list.
- **B6.** A port's `type` cannot be overridden: the Feather RP2350's boot
  button stays the `boot` port of type `switch`, moved to the top.
- **B6.** No top drawing of the XIAO RP2350 was found (its DXF is the
  bottom silkscreen): its variant keeps the entry's ports, buttons closed.
- **B6.** ESP32-S3-Zero: the STEP model has both buttons as one part and the
  2D drawing is a bottom view; BOOT is taken as the left one, as on the
  other Zeros. (XIAO C6 / MG24 first kept the S3's 1.6 × 2.6 buttons; the
  pad boxes of `board.mjs --kicad` (B7) then showed them turned: 2.6 × 1.6.)
- **B6.** The Feather ESP32-S3 TFT has its module on the underside next to
  the right-hand holes: the layout warns that a 5 mm standoff reaches it.
  That is the board, not the data; the variant test expects the warning.
- **B3.** The board check requires the holes inside the outline, not the
  parts: a part on a module may overhang the base board (the RAK4631's BLE
  connector sits above the RAK19007's notch).
- **B7.** Allegro block names are not always package names: the ROCK 4D's
  are `PART_TOP_<n>`. Each placement still comes out as its own box.
- **B7.** The prototype's circle boxes ignored the circle's plane (a
  vertical hole counted as a flat ring) and it crashed on a 2D point (the
  RP2350-Zero model); `step.mjs` places each circle in its own plane and
  reads both.
- **B7.** In a PCBA model many small parts are named "PCBA…": the board is
  the largest of the BOARD/PCB-named parts, `--board` overrides.
