# Case Constructor — keyboards

**Status: in progress (2026-10-27).**

Written on 2026-10-27 from `PERSPECTIVE-KEYBOARDS.md`, its last section
("What the catalog needs for them"). A keyboard is the board the case is
built around: its keys must come through the lid, and a key press pushes
the board away from the fingers. Most of what that needs is already
there for displays (`PLAN-DISPLAYS.md`): hanging from the ceiling or the
console's slope, a window cut through the plate with a chamfer, a rim that
locates what lies under the plate. Items K1…K8; the order is below the items.

Same rules as the earlier plans: TDD, golden tests for new geometry (a new
state per feature, old ones untouched), `npm run check` and `npm run smoke`
before each commit, `docs/` and all four dictionaries in the same commit,
deviations recorded at the end of this file. The work goes on the branch
`keyboards-2026-10-27` from `main`, one commit (and push) per item, a pull
request when the first item lands; the user reviews and merges.

## Decisions (2026-10-27, with the user)

- **Openings** (Q1): both, the placement's choice — a window over the
  field or a hole per key (P4).
- **Keys under the face** (Q2): reported, no pocket (P5). A pocket the
  keyboard rises into is the next step if a test print asks for it.
- **Free corners** (Q3): rests from the opposite plate (P7).
- **Data** (Q4): Tier A and Tier B (P8).
- **P1…P8**: confirmed with these answers.

## Proposals

- **P1. A keyboard is a board entry**, `kind: "keyboard"`, the way a
  display is: it has a PCB, holes and ports, and what is new is a part
  (the key field) and how the lid opens over it. The picker gets a
  *Keyboards* group (`picker.keyboards`); search matches "keyboard",
  "keypad", "macropad" in all four languages. A keyboard hangs from the
  ceiling when added (`hangsByDefault`), like a display; a placement
  without `on` stays on the floor, so nothing old moves.
- **P2. The key field is a top part, type `keys`.** Its rectangle (`x, y,
  w, d`) is the field; `h` is the key tops above the PCB; `base` is where
  the plate may come down to: the top of the keypad's base (BBQ20), the
  switches' plate line (MX: the lid is the switch plate), a tact switch's
  body (CardKB). `rows` (optional) give the keys: `[{ y, x, n, pitch, w,
  d, shape }]`, the first key's centre, how many, their pitch along x,
  their size — enough for the CardKB's rows, the BlackBerry's staggered
  ones, a 3 × 4 MX grid, KeebDeck's 6 × 13, and an arrow cross as rows of
  one and two.
- **P3. `base` is a field of any top part, not only of the keys**: a part
  that goes through the plate from that height on. The MacroPad's encoder
  is one (a new type `knob`: round, the shaft's diameter, `base` the
  bushing's top, `h` the shaft's top). The entry's `topHeight` keeps its
  meaning for the case — the tallest thing that stays *under* the plate: a
  part with `base` counts with its base. So the hung front, the stacks and
  the case height do not change; a top part's column already starts at
  `min(part top, ceiling − 0.2)`, so keys taller than the ceiling are cut
  through as they are. `tests/boards.test.ts` checks every part against
  `topHeight` that way.
- **P4. The lid's opening over the keys** is the placement's choice,
  `placement.keys: "window" | "holes"` (the entry's `open` by default):
  one window over the field plus the clearance, chamfered 45° like a
  display's (the same `#board<i>_bevel`), or a hole per key from `rows`,
  the key's size plus the clearance (`#board<i>_keyFit`, 0…3 mm). Holes
  need `rows`; a web between two holes thinner than `KEY_WEB` (0.8 mm) is
  reported. MX holes are 14 mm (the switch: the lid is the plate, as on
  the Printables MacroPad cases); larger keycap holes are a fit of 2.25 mm.
- **P5. How far the keys stand out** is reported: the key tops are `h −
  base − gap − plate` above the outer face. An information line says it;
  with holes a key top under the face is a warning (a finger cannot press
  a key at the bottom of a 2 mm hole), the cure in the line: a window, a
  thinner top (Case → floor), the gap to 0. No pocket (decided).
- **P6. A keypad's flange under the plate** (KeebDeck: the silicone sheet
  is wider than its window): the `keys` part may carry a `glass` (here the
  flange: its outline and thickness, its front at `base`), and the
  display's rim locates it, the plate around the window holds it down. No
  new geometry, `rim.ts` reads it from any top part.
- **P7. Rests for a board that rocks** (BBQ20KBD: two holes on a
  diagonal): a keyboard's PCB corner with no hole within `REST_REACH`
  (20 mm) gets a rest under it, a column from the opposite plate (the
  floor for a hung keyboard; on the floor, a standoff without a screw)
  ending `REST_GAP` (0.2 mm) under the PCB, stepping aside for the parts on
  the underside. It goes to the part that owns that plate (the body under a
  top lid). Only boards with a `keys` part get rests: only there do presses
  push. A rest longer than `REST_MAX` (40 mm) is reported instead.
- **P8. Data**: Tier A (CardKB, BBQ20KBD, MacroPad RP2040) and Tier B
  (KeebDeck Basic, Keyboard FeatherWing) — both Tier B boards have KiCad
  layouts, and they prove P6 and a display with keys in one lid. Tier C
  stays out (no drawings, or sold only in a case).

---

## K1. The key field: schema, ghost, tools

**Plan.**
- `kind: "keyboard"`; port types `keys` and `knob` (`PORT_TYPES`); the
  optional `base` on a top part; `keys.rows` and `keys.open` (`window` by
  default) (P2–P4). The sanitizer keeps the field inside the board, every
  key inside the field, `base` ≤ `h`; `rows` at most 12 rows of 24 keys.
  The custom board editor offers `keys` and `knob` with `base`, no rows
  (a window only), and says so in its hint.
- **Ghost**: the field's base as a slab in the ports' colour, each key a
  small block up to `h` (the whole field one block without rows); a knob a
  cylinder. Port captions as for any part.
- `board.mjs --svg` and the review page draw the field and every key, so
  an entry is checked against its drawing as boards are.
- The add-board skill gets a *Keyboards* section: what goes into the field,
  `base`, `h`, `rows`; where to read them (KiCad footprints of the switches
  by `board.mjs --kicad --match`, STEP heights by `step.mjs`).
- First entry: none yet (K6); the tests use a fixture board.

## K2. A keyboard hung from the lid

**Plan.**
- `hangsByDefault` takes boards with a `keys` part. The hung frame (the
  ceiling, the console's slope) is the display's: the front is
  `topHeight`, which for a keyboard is the keys' base (P3). Supports,
  rails and the slope come with it.
- Rails on a keyboard (CardKB) step aside for the keys: the rail's top lip
  stops short of the field and of the keys at the edges, as it does for a
  glass (`layout.ts`, `topPartOnSupport`).
- **Messages** (P5): `info.keysProud` (how far the key tops stand above
  or below the face), `warn.keysUnderFace` (holes, key tops under the
  face). Both point at the field on the model (`Message.spot`).
- Golden: a fixture keyboard hung under a top lid on M2.5 screws; the same
  on a console's slope.

## K3. Openings over the keys

**Plan.**
- `placement.keys` (P4) and its card: *Keys: window | holes*
  (`#board<i>_keys_window|holes`, holes only with rows), *Key fit*
  (`#board<i>_keyFit`). The chamfer toggle shows for a keyboard too.
- `ports.ts`: a `keys` part makes one cutter (the window) or one per key
  (the holes), along the board's normal, so the slope works as it does for
  a display; `JITTER_MM` keeps a row of holes from sharing planes. A
  `knob` makes a round column of its shaft (or bushing) plus clearance.
- `warn.keyWebThin` where two holes leave less than `KEY_WEB`.
- A tap on the field's caption toggles its opening, as for any part.
- Golden: holes on a 3 × 4 MX fixture; the window chamfered.

## K3b. Printed caps over the keys (added 2026-10-28, the user's request)

**Decision (with the user):** keys too low for a finger (the CardKB's tact
switches stand 1.75 mm) get either the window, the Grove cable inside, or a
hole per key with a printed cap in it: a cylinder over the button with a
flange under the lid that keeps it from falling out.

**Plan.**
- `placement.keys: "caps"` (`#board<i>_keys_caps`, rows needed). Each cap
  (`capSize.ts`, pure): a stem over its key, the key plus `CAP_GROW` (0.75)
  a side; a flange `CAP_FLANGE_T` (0.8) thick, `CAP_LIP` (1) past the stem
  at most and never closer than `CAP_GAP` (0.3) to a neighbour's; the hole
  the stem plus the key fit (`CAP_FIT`, 0.25, by default). The flange lies
  on the key, the plate the gap above it (`frontHeight`: the key tops plus
  the flange); the stem stands `CAP_PROUD` (1) out of the lid.
- The caps are solids of revolution built in the main thread (`caps.ts`,
  no CSG) and placed like the printed screws: in their holes in the view
  (exploded, over the lifted lid), flange down in rows next to the lid in
  the print layout and in the Lid and Both STLs. Part role `cap`.
- `info.keyCaps` (how many, that they print with the lid);
  `warn.capFlangeSmall` when the fit leaves a flange less than `CAP_HOLD`
  (0.4) past its hole; the web check as for holes.
- Golden: the CardKB under a top lid with caps (the lid; the caps are not
  the worker's). Tests: the cap mesh is closed, the caps do not touch the
  lid in their holes.

## K4. A keypad's flange under the plate

**Plan.** (P6) `glass` allowed on a `keys` part; its front at `base`. The
rim, the supports stepping aside for it, the window narrower than it — the
display code, read from any top part with a glass. Proving entry: KeebDeck
Basic (K6). Golden: a fixture with a flange.

## K5. Rests

**Plan.** (P7) `rests.ts` (pure: where, how long, which part owns them) and
the worker's columns (`standoffs.ts`, the opposite plate's owner). The
ghost draws them as grey columns; `warn.restTooLong`; a rest stepping aside
for a part on the underside (BBQ20KBD's USB-C at the top edge). Golden:
BBQ20KBD hung under a top lid.

## K6. The catalog

**Plan.** Through the add-board skill (its *Keyboards* section from K1),
drawings from `drawings/` (already cached: the CardKB PDF, the three KiCad
layouts, the BBQ20KBD STEP, the MacroPad Eagle board), every entry laid
over its drawing on the review page.
- **M5Stack CardKB v1.1**: rails, a window by default (the tact switches
  are too low for holes), rows from the drawing's picture: ≈ until the
  Grove socket and the right and bottom margins are checked (a photo, an
  M5 STEP if one turns up).
- **Solder Party BBQ20KBD**: from its KiCad layout and STEP — verified; two
  diagonal holes (K5); USB-C, STEMMA QT and PMOD on the underside at the
  top edge (edge ports with a negative `z`: a channel tested against the
  floor's edge fillet).
- **Adafruit MacroPad RP2040**: from the Eagle board; the switch heights,
  the OLED and the encoder from `Adafruit_CAD_Parts/5100` (fetched by
  `scripts/fetch.mjs`, opened with `step.mjs`); MX holes by default, the
  OLED as a display part, the encoder a `knob`.
- **Solder Party KeebDeck Basic** (flange, K4) and **Keyboard FeatherWing**
  (a BlackBerry Q10 keyboard and a 2.6″ TFT: a display window and a keys
  window in one lid) from their KiCad layouts.
- `PERSPECTIVE-KEYBOARDS.md` marks what went in; `docs/boards.md` gets a
  Keyboards table.

## K7. The preset

**Plan.** `meshtastic-cardkb`: Heltec WiFi LoRa 32 V3 and the CardKB hung
side by side under a top lid (the display window and the keys window), on
screws, its note in all four dictionaries; `tests/presetsBuild.test.ts`
builds it (closed, no slivers, no overlap, no warnings).

## K8. Documentation, limits, smoke

**Plan.**
- `docs/keyboards.md` (linked from `docs/README.md`): the field, windows
  and holes, how far the keys stand out, flanges, rests.
  `docs/limitations.md`: keyboards on the walls not yet (as displays); no
  switch-plate clips (an MX switch clips into 1.5 mm, the plate is the
  case's floor setting).
- `CLAUDE.md`: the invariants (`base`, `topHeight` of a keyboard, rests and
  their owner), the control ids, the cost table with the MacroPad's holes.
- Smoke, item by item: add a keyboard from the *Keyboards* group and see it
  hang; window ↔ holes; the fit slider; the warnings; the preset through a
  project file round trip.

## Order

K1 → K2 → K3 → K6a (CardKB, MacroPad) → K5 → K6b (BBQ20KBD) → K4 → K6c
(KeebDeck Basic, Keyboard FeatherWing) → K7 → K8. Each item ends with its
golden states, smoke steps, docs and translations.

## Deviations (recorded as they happen)
- **K1.** `topHeight` on a keyboard is the tallest part *outside* the key
  field, not "including the field's base" as P3 had it: over a window the
  plate is not there over the field, so the field may rise into the window
  (the CardKB's keys then reach the face). Under holes the plate lies on the
  field's `base` (`frontHeight`), so the two openings hang the board at
  different heights. A support between the keys is not reported as under a
  part: only the keys themselves count (`partOnSupport`).
- **K2.** The key notes are in `cutWarnings` (`keyNotes`, `ports.ts`), not
  in the layout's collisions: they need the outer top, and they are about
  the opening. A key field closed by its toggle says nothing. The rails
  stepping aside for the keys waits for the CardKB's data (K6): a rail's
  lip covers `RAIL_GRIP` (1.5 mm) of the PCB's top, and the check already
  reports a key on it. The smoke steps come with the first catalog
  keyboard (K6a): a custom board cannot carry rows.
- **K3.** The fit slider (`#board<i>_keyFit`) is for the window and the
  holes alike, 0.05 mm steps. A key's hole keeps the port's rounded corner
  (`min(1.5, fit)`), like every rectangular opening. Golden: the two K2
  keypad states moved with it (holes are the keypad's default), one state
  added for the window.
- **K6a.** Read from the drawing, the CardKB is not what the perspective
  had: its key tops are 1.75 mm above the PCB (the 2.75 is from its
  underside), the Grove socket stands on top at the left edge, 5.3 mm, its
  plug going in sideways, and the key legends are printed on the PCB beside
  the keys. Decided with the user: the window covers the whole face of the
  board (socket included), the plate lies right above the PCB, and the
  socket's plug gets a slot in the lid: an edge port's `reach` ends its
  channel that far past the face (and starts it behind the socket's body,
  so under holes or caps the plate does not lie on it); the footprint keeps
  the slot clear of the wall, `portFar` and the split note leave it alone.
  Its keys are rows of round Ø2.1 buttons (the drawing's), so holes and
  caps size from the buttons.
- **K6a.** The MacroPad cannot hang: its holes are at the switches' edges,
  and a post from the lid would run into the switch bodies. It has 8 mm M3
  standoffs soldered under it (the STEP; the Eagle part says "SMT nut"), so
  it stands on the floor (`hangsByDefault` leaves out a keyboard whose
  holes are among its keys, `holesAmongKeys`), and a floor keyboard brings
  the ceiling down to `CEILING_GAP` over its front (`stacksHeight`, like a
  carried display). Its default standoff height puts the switches' plate
  line under the least case's ceiling (`floorZ`); lower,
  `warn.keysPlateHigh` says how high to raise it. The STEP is the front
  view: the STEMMA QT and the reset button are on the left edge (the
  perspective's "right" was Eagle's back view), USB-C, STEMMA QT, reset and
  the speaker on the underside; the OLED's glass covers the top-left hole
  (it is screwed from below); its active area is taken as centred (≈). The
  encoder sits turned 45°: its opening is a round Ø17.6 over its body.
  MX key tops are the switch housing (11.6 mm), without keycaps.
- **K6a.** A key field closed by its toggle stays under the plate whole:
  `frontHeight` counts its key tops then.
