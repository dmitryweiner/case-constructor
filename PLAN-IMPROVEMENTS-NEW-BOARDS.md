# Case Constructor — what the Tier A boards left to do

Status: written on 2026-10-25 after the Tier A boards from
`PERSPECTIVE-BOARDS.md` went into the catalog (25 entries, the Pico 2 as an
alias). Nothing here is started. The next iteration picks the order.

Same rules as PLAN.md: TDD, golden tests for new geometry (a new state per
feature, old ones untouched), `npm run check` and `npm run smoke` before
each commit, commit and push after each item, deviations recorded at the
end of this file.

The transcription agents worked around the gaps below and said so in their
reports. The workarounds are in the data, so each item lists the entries it
touches.

## Open questions

To settle with the user before the item starts:

- **Q1 (B1).** What a header-pin board defaults to: pins down (the case is
  ~7 mm taller than needed for a bare board) or bare (a soldered board does
  not fit)?
- **Q2 (B2).** Should the lid screw select offer M1.6, or should boards only?
- **Q3 (B6).** For a family entry, a variant select or separate entries?

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
- The board card gets **Pins soldered downwards** (a checkbox). It is shown
  only for boards with `pins`, its default comes from Q1, and it is kept in
  the placement (sanitized like every other field).
- Effective underside = `max(bottomHeight, pins.below)` when the box is
  ticked.
- Rails: with pins on a gripped edge, a warning (the code exists:
  `layout warnings`). Raising the board above the lip, or offering the other
  pair of edges, is open to discussion.
- Migrate every entry in the table: move the 8.5 to `pins`, and give
  `pins` to the boards that have rows but no count yet.

**Tests.** A sanitizer round trip with and without `pins`. The standoff
height follows the checkbox. The golden test gets a new state (a Nano on
rails with pins down); old states keep their numbers, because a missing
`pins` keeps today's behaviour.

## B2. Screws below M2

**Now.** `SCREW_SIZES` is M2…M4 (`src/geo/fasteners.ts`). The Heltec WiFi
LoRa 32 V4 has Ø1.9 holes (they hold the display bracket), and the entry
says M2, which does not pass.

**Plan.** Add **M1.6** to the table: tap 1.3, insert 2.4 (the length to
check against a real M1.6 insert), nut 3.2 AF × 1.3, head 3.0 × 1.0. The
standoff diameter keeps its 5 mm minimum. Answer Q2 for the lid. Set the
Heltec V4 entry to M1.6. Keep M1.2 out: the RAK19007's M1.2 holes are for
its modules, not for mounting the board.

**Tests.** The fasteners table test covers the new row (every diameter > 0,
tap < d < insert). The golden test gets a new state with a board on M1.6.

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

## B6. Family entries with parts that move between variants

**Now.**
- **XIAO, Waveshare Zero, Feather:** one outline, but buttons sit in
  different places per variant. The agents set those buttons `cut: false`,
  so no variant gets an opening it does not need, and none gets the
  openings it does need.
- **QuinLED Dig-Quad / Dig-Uno, Olimex:** a part on top that overhangs the
  edge (the plug-in ESP32's antenna) is entered as an edge port with
  `cut: false` and a `protrude`, which keeps the wall clear.

**Plan (Q3).**
- **(a) Separate entries** per variant when the parts differ. This is
  cheap, but the picker gets longer.
- **(b) `variants: [{ id, name, ports: { <portId>: { …overrides } } }]`** in
  an entry, with a variant select on the board card. It is kept in the
  placement, and only the overrides differ.

Recommended: (b) for XIAO, Zero and Feather, and the Feather ESP32-S3 TFT as
a variant with its display on top.

The overhang workaround stays. Write it into the add-board skill.

## B7. CAD tools: make the agents' throw-away readers permanent

**Now.** The drawings came in four forms the tools could not read:
- **Allegro DXF with everything in blocks (INSERT)** — ROCK 4D, ROCK 5B.
  `scripts/dxf.mjs` skips blocks.
- **Vector PDF named "DXF"** — Orange Pi 5 Max, 5 Pro.
- **STEP assemblies** — Orange Pi 5 Plus, BTT Pi, XIAO, Waveshare Zero,
  Dragon Q6A.
- **Eagle `.brd` and KiCad `.kicad_pcb`** — Adafruit Feather, CM5 IO Board.

The agents wrote temporary readers in the session's scratchpad (gone with
the session). For two of them they installed packages there without asking
the user: `ezdxf` (pip, in a venv) and `occt-import-js` (npm).

**Plan.** Extend the existing scripts and keep everything in Node. **Every
new dependency needs the user's explicit approval first** (agents included),
recorded here:
- `dxf.mjs`: expand INSERT blocks (with their transform). With `--boxes`,
  print the block name per component (Allegro and Radxa write the package
  name there: `TYPEC`, `CON_HDMI`, `USB3_TH18`…).
- `dxf.mjs file.pdf`: read a vector PDF through `pdftocairo -svg` (poppler
  is already used), correct its scale against a known dimension (`--scale`
  or `--fit w,d`), and treat its paths as polylines.
- `scripts/step.mjs` (new): the bounding box of every part of a STEP
  assembly, mapped into the board frame (`--flip`, `--rotate`). It needs a
  STEP reader (`occt-import-js`, a dev dependency of about 10 MB of WASM);
  ask first. The 79 MB Creo export of the ROCK 5B+ gave 0 triangles with
  it. Note that as a known limit.
- `board.mjs --brd <file>` / `--kicad <file>`: list the footprints with
  their positions (both are text formats, no dependency needed).
- The add-board skill gets a section "which tool for which drawing".

**Tests.** A tiny fixture per format in `tests/fixtures/` (a block DXF, a
one-page vector PDF, a two-part STEP), each read back to known boxes.

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

## B9. Data follow-ups

- **The user's visual review** of every new entry: `shots/<id>.png` against
  its drawing, and `shots/<id>-case.png` (regenerate with
  `node scripts/board.mjs --svg <id> --png` and the snap from the skill).
- **≈ entries to verify against a drawing.**
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
- **Possible entries:** Feather ESP32-S3 TFT (display on top), unless B6
  makes it a variant. RAK3401 (1 W) core on the RAK19007: check its height
  and antennas, then add it to the name.

---

## Deviations

(none yet)
