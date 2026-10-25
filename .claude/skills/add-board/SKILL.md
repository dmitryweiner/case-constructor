---
name: add-board
description: Add a board (SBC or microcontroller) to the Case Constructor catalog from its official mechanical drawing — transcribe outline, holes, ports and parts into src/boards/data/<id>.json, register it, check it and compare it against the drawing.
---

# Add a board to the catalog

A catalog entry is data: one JSON file in `src/boards/data/`, validated by
`src/boards/schema.ts` and `tests/boards.test.ts`. Read `PLAN.md` §2.2 (the
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
printed next to them), every port on the right edge at the right place. Ask
the user to look as well.

## 6. See it in a case

```bash
node scripts/snap.mjs --out shots/<id>-case.png --click '#board0_remove' --click '#boardAdd' \
  --click '[data-board="<id>"]' --click '#tabBody' --view
```

Every enabled port must open its wall; no warnings you cannot explain.

## 7. Document and commit

Add a row to the catalog table in `docs/boards.md` (board, vendor, size,
mount, source link, checked yes/≈). Commit: `boards: add <name>`.
