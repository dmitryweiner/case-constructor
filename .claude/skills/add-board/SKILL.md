---
name: add-board
description: Add a board (SBC or microcontroller) to the Case Constructor catalog from its official mechanical drawing — transcribe outline, holes, ports and parts into src/boards/data/<id>.json, register it, check it and compare it against the drawing. Also the catalog review: the page that lays every entry over its vendor drawing (board.mjs --review), getting drawings a person must download, and acting on the user's OK/BAD report.
---

# Add a board to the catalog

A catalog entry is data: one JSON file in `src/boards/data/`, validated by
`src/boards/schema.ts` and `tests/boards.test.ts`. Read `plans/PLAN.md` §2.2 (the
format) and §0.4 (the board frame) first.

## 1. Find the drawing

Look for the vendor's mechanical drawing: a datasheet PDF, a DXF, a
"mechanical" or "dimensions" page. Record its URL — it goes into `source`.

- PDF: `curl -sL -o <scratchpad>/board.pdf <url>`, then
  `pdftoppm -png -r 120 -f <page> -l <page> board.pdf board` and read the
  PNG. `pdftotext -layout` helps find the page with the dimensions.
- Without an official drawing use a community one (a vendor's product photo
  with a scale, a well-known CAD model) and set `"verified": false`.

## 2. Transcribe

Write `src/boards/data/<id>.json` (kebab-case id, e.g. `orange-pi-5`).

The **board frame**: origin at the lower-left corner of the vendor's top view
(components up), x to the right, y up. Edges: `front` (y = 0), `back`
(y = d), `left` (x = 0), `right` (x = w). Pick the top view the drawing
shows; do not mirror a bottom view.

```jsonc
{
  "id": "…", "name": "…", "vendor": "…", "kind": "sbc" | "mcu",
  "size": { "w": 85, "d": 56, "t": 1.4 },          // PCB outline and thickness
  "mount": { "kind": "holes", "holes": [{ "x": 3.5, "y": 3.5, "d": 2.7 }], "screw": "M2.5" },
  // or "mount": { "kind": "rails", "holes": [], "screw": "M2", "rails": "long" | "short" }
  "topHeight": 16,      // tallest part above the PCB
  "bottomHeight": 2,    // tallest part below the bare board — header pins do not count
  // through-hole header rows: how far soldered pins reach below the PCB (plastic
  // included), the edges the rows run along (in front, back, left, right order),
  // the row centre's distance from its edge, and whether the board ships with them
  "pins": { "below": 8.5, "edges": ["front", "back"], "inset": 1.27, "soldered": true },
  "ports": [
    // edge connector: centre along the edge from its start (x for front/back, y for left/right)
    { "id": "usb-c", "type": "usb-c", "edge": "left", "along": 11.2, "z": 0, "protrude": 1.3 },
    // part on top: centre x, y; size w (along x) × d (along y) × h (above the PCB)
    // a part on the underside: "edge": "bottom", centre x, y as seen from the top, h below the PCB
    { "id": "gpio", "type": "header-2x20", "edge": "top", "x": 32.5, "y": 52.5, "w": 51, "d": 5, "h": 8.5 }
  ],
  "source": "https://…",
  "verified": true
}
```

- Port types and their defaults are `PORT_TYPES` in `src/boards/schema.ts`;
  give `w`/`h`/`d` only where the board differs (stacked USB, a tall jack).
  A round part (LED, round button) may give just `"d"`: its diameter.
- Types for what boards often carry: `terminal` (5.08 mm screw terminal on
  an edge; its opening is a slot at the wire entries, `cutH` high, 5.5 by
  default), `jst` (JST PH/SH, Qwiic, STEMMA QT; on an edge or `"edge":
  "top"`, no opening by default), `header-2xN` (a 2-row header other than
  the Pi's GPIO: PoE 2×2, UEXT 2×5), `sim` (a SIM slot on an edge, like
  `microsd`). `generic` is for what none of the types describe.
- **A PCB that is not a rectangle** (Arduino's chamfered right edge, Heltec
  V4, RAK19007's notches) gets `"outline": [[x, y], …]`: a simple polygon,
  counter-clockwise, inside `size`, the holes in it. Only the board's
  picture uses it; the case is still sized by `size`. Arcs become a few
  points. `board.mjs --svg` draws it over the dashed rectangle.
- A **standing connector** (HDMI or USB-C on its end: ROCK 5B+, Orange Pi 5
  Max / Pro / Plus) keeps its type with `w` and `h` swapped.
- A part the user reaches from below (CYD buttons, a bottom LED, a
  Reverse TFT display) is `"edge": "bottom"`: the floor gets a column under
  it, and its `h` counts towards the underside, so `bottomHeight` need not
  repeat it. Give x, y in the top view's frame (mirror a bottom view).
- `z` is the bottom of an edge connector above the PCB top; negative for
  something under the board (a microSD slot: `-(t + h)`).
- `protrude` is how far the connector sticks out past the edge (USB/Ethernet
  on a Pi: 2–3 mm).
- `pins`: give it to every board with 2.54 mm through-hole rows that a user
  may solder pointing down (DevKits, Nano, Pico, XIAO, Feather…). The board
  card shows **Pins soldered downwards**, its default is `soldered` (how the
  board ships), and rails on those edges become a pin bed. `inset` is
  (board width − row spacing) / 2 when the rows sit symmetric.
- **A family with one outline and parts that move** (XIAO, Feather,
  Waveshare Zero) is one entry with `variants`, the first the default:
  `{ "id": "rp2040", "name": "XIAO RP2040", "ports": { "reset": { "x": 4.83,
  "cut": true } }, "remove": ["shield"], "add": [ …ports… ] }`. Overrides
  change `x y along z w h d protrude clearance cutH cut edge shape` of an
  entry's port (not its type); `topHeight`/`bottomHeight` may differ too.
  Give the entry's ports as the default variant has them. Draw one variant
  with `node scripts/board.mjs --svg <id> --variant <v> --png`.
- **A part on top that overhangs an edge** (a plug-in ESP32's antenna on the
  QuinLED, Olimex) is an edge port with `"cut": false` and a `protrude`: it
  keeps the wall clear of it without opening anything.
- Boards that share an outline (Uno R3/R4) are one entry: aliases in `name`
  after a slash.
- Where the drawing gives no heights, the type defaults stand and
  `"verified"` stays `false` until someone measures.

### Displays

A screen sold on its own (an SPI module, a Pi display, an e-paper panel) is
`"kind": "display"`: the picker groups it under *Displays*, whatever its
vendor; register it in the displays' block of `RAW_BOARDS`. Its screen is a
`display` part on top, and two rectangles from the drawing matter:

- **The window** is the part itself (`x, y, w, d`, centre and size): the
  active area (AA) of a TFT or an OLED — the whole picture shows, the
  panel's black border hides behind the case; the visible area (VA) of a
  character LCD (1602, 2004, 12864). `h` is the front of the glass above the
  PCB top (the stack: tape, LCD, touch panel).
- **The glass** is `"glass": { "x", "y", "w", "d", "t" }` on that part (plus
  `"r"` for rounded corners, `"shape": "round"` with `w` as the diameter):
  the outermost of the lens, the touch panel, the LCD module or the metal
  bezel, and its thickness — the case's rim holds it, the plate around the
  window hides it. It must contain the window and stay inside `size`.
- The drawing's offsets are usually from the PCB's top edge: y in the board
  frame is `d − offset − size / 2` for a centre.
- A **panel with no PCB beyond the glass** (Touch Display 2, a bare e-paper
  panel): `size` is the glass outline (`outline` for its rounded corners),
  `t` the module's thickness without the lens (up to 20 mm); the window's
  `h` and the glass's `t` are the lens (at least 0.2 mm); the driver board, the FPC and the back plate are
  parts on the underside, `bottomHeight` the deepest of them.
- `board.mjs --svg` draws the glass dark and dashed under the window, the
  review page outlines it in blue: lay both over the drawing's front view.

Get the drawing with `node scripts/fetch.mjs <url>` (or `--board <id>` for
an entry's `source`): it lands in `drawings/`, unpacked (zip, and rar
through the system `bsdtar`), and stays there for the next check.

What a person must download (Google Drive, a site this machine cannot
reach) goes through the user:
- Give links that open. An old Drive folder link without its
  `resourcekey=…` parameter asks for access; the vendor's wiki or forum
  usually has the same link with the key, or a direct file link.
- Register each file under the entry's board, the file name after a `#`
  so one board can have several (TOP and BOT):
  `node scripts/fetch.mjs '<source>#<file name>' --board <id> --file ~/Downloads/<file>`.
  A file at its own URL: `node scripts/fetch.mjs <url> --board <id>`.
- Radxa (`dl.radxa.com`), Espressif, Arduino and GitHub download by
  script: fetch those yourself, do not send the user.

## 2b. Which tool for which drawing

Every tool prints in the board frame (origin at the outline's lower-left
corner, x right, y up) or says how to get there. No new dependencies: the
standard library and `pdftocairo` (poppler) only.

| The vendor gives | Tool | Notes |
|---|---|---|
| DXF (also Allegro, also Gerber turned into DXF) | `node scripts/dxf.mjs f.dxf` | `--layers`, `--layer L --boxes` (every polyline and every block placement, by block name), `--min/--max`, `--origin x,y` for a panel or a drawing with parts sticking out, `--flip`/`--rotate` into the top view, `--outline` for the entry's `"outline"` |
| Vector PDF ("DXF" in the name, a dimension sheet) | `node scripts/dxf.mjs f.pdf [--page n]` | `--fit w,d` scales the extents to the board's size; check the other axis it prints. A bottom view comes mirrored: compare the holes |
| STEP model or assembly | `node scripts/step.mjs f.step` | `--match 'USB\|HDMI'`, `--part BOARD` (holes), `--board <name>` when the board part is guessed wrong, `--rotate`, `--flip`. Reads an 80 MB Creo export in seconds |
| Eagle `.brd` | `node scripts/board.mjs --brd f.brd` | footprints with their side, pad box and nets (a button's net tells RESET from BOOT), plain mounting holes; `--match`, `--rotate 90`, `--flip` when the product's top is the file's bottom, `--outline` |
| KiCad `.kicad_pcb` | `node scripts/board.mjs --kicad f.kicad_pcb` | the same; an outline drawn inside a footprint counts |
| A photo only | estimate, keep `"verified": false`, say so in the entry's commit | on the review page it is a picture aligned by two points: good for a connector on the wrong side, never for `verified` |

After writing or changing a file, `node scripts/board.mjs --format` puts it
in the catalog layout (one port, hole and variant per line; the test fails
otherwise). Edit entries as text with that layout in mind, not with
throw-away scripts.

## 3. Register

Import the file in `src/boards/catalog.ts` and add it to `RAW_BOARDS`, in
the vendor's group.

## 4. Check

```bash
npm run boards:check      # scripts/board.mjs --check + tests/boards.test.ts
```

## 5. Compare with the drawing

```bash
node scripts/board.mjs --svg <id> --png    # shots/<id>.svg and .png
```

Open the PNG next to the drawing: outline, holes (their coordinates are
printed next to them), every port on the right edge at the right place.

Then lay it over the drawing and ask the user to look:

```bash
node scripts/board.mjs --review --only <id>   # updates shots/review/index.html
```

The caption over the drawing says how it was aligned. `by holes 4/4 (rms
0.02 mm)` with the edge near 100 % is the drawing's frame; `HOLES OFF by up
to … mm` means the entry's holes disagree with the drawing (a real finding,
not an alignment fault); `WEAK` or a low `connectors` percentage on a
symmetric hole pattern may be a wrong half turn or mirror — the page's
↻ 90° and ⇋ settle it by eye. `not aligned: two points by hand` (modules
without holes, pictures) needs the user's two clicks.

### Checking an existing entry (≈ or a review)

The order that worked on the Tier A boards (plans/PLAN-IMPROVEMENTS-NEW-BOARDS.md,
B9):

1. `node scripts/fetch.mjs --board <id>`; if the `source` is a page, find
   the drawing on it and fetch that.
2. **Orientation first.** Compare the holes: `--compare <id>` (board.mjs
   or dxf.mjs). Mirrored holes mean a bottom view (`--flip`); swapped axes
   mean a turn (`--rotate 90`). Holes are the most reliable thing on any
   drawing — fix the frame on them before reading anything else.
3. **Size and outline**: the `size` line of `--compare`, then `--outline`.
4. **Parts by their body, not their origin.** A footprint's origin is often
   a pin (a DC jack's origin is a pin, its axis is the body's centre): use
   the pad box centre `board.mjs` prints, or the package outline.
5. Record what the check changed in the commit, set `"verified": true`
   only when holes, size and the connectors came from the vendor's own
   file, and put the file's URL in `source`.

Pitfalls met so far:
- SolidWorks models are often Y-up: `step.mjs --up y`.
- In a PCBA model many small parts are named "PCBA…": pass `--board`.
- A castellated board's model is about 0.6 mm wider than the PCB (the
  half-holes): take x from the board's centre.
- A module's antenna that overhangs the PCB is not board: keep `size` to
  the PCB and give the overhang as an edge part with `"cut": false` and a
  `protrude` (DevKitC).
- Some PDFs draw every edge there and back, others start dimension lines at
  the outline's corners: `--outline` copes with both; `--tol` if pieces
  still do not meet.
- A drawing with a white page rectangle behind it: `--layer stroke`.
- Two concentric circles at a hole are its pad and its drill: `--compare`
  takes the drill.

### The user's review report

The review page's "Копировать отчёт" gives one line per marked board:
`OK  <id>`, `BAD <id> — note`, `?   <id> — note`. Act on it:
- **OK**: `"verified": true` — the entry matched the vendor's own file on
  the page (a picture does not count: keep `false` for those). Say so in
  the commit.
- **BAD**: re-transcribe the entry from its cached drawing by this skill
  (the frame from the holes first). A line without a note means the whole
  entry: holes, size, every port — not just what looks off. Record the
  list in the current plan's deviations before starting, so a session that
  stops halfway leaves it.
- **?**: ask the user what they saw before changing anything.
- A board the page could only align by hand, or not at all: say which, so
  the user knows the report did not cover it.

## 6. See it in a case

```bash
node scripts/snap.mjs --out shots/<id>-case.png --click '#board0_remove' --click '#boardAdd' \
  --click '[data-board="<id>"]' --click '#tabBody' --view
```

Every enabled port must open its wall; no warnings you cannot explain.

## 7. Document and commit

Add a row to the catalog table in `docs/boards.md` (board, vendor, size,
mount, source link, checked yes/≈). Commit: `boards: add <name>`.
