# Case Constructor — standalone displays

**Status: approved (2026-10-27), in progress.**

Written on 2026-10-27 from `PERSPECTIVE-SCREENS.md`, its last section ("What
the catalog needs for them"). Boards with a screen on them are in the
catalog already (a `display` part on top, its window cut through the lid);
the displays sold on their own — the Pi displays, the SPI/I²C modules, the
e-paper panels — need a new way of being held. Items D1…D8; the order is
below the items.

Same rules as the earlier plans: TDD, golden tests for new geometry (a new
state per feature, old ones untouched), `npm run check` and `npm run smoke`
before each commit, `docs/` and all four dictionaries in the same commit,
deviations recorded at the end of this file. The work goes on the branch
`displays-2026-10-27` from `main`, one commit (and push) per item, a pull
request when the first item lands; the user reviews and merges.

## Decisions (2026-10-27, with the user)

- **Faces.** A display goes on the ceiling: the top of a box or a cylinder,
  the console's slope. The four walls (a 1602 on the front of a box) are the
  next iteration; `docs/limitations.md` says so.
- **Panels with no holes in front of the glass** (Touch Display 2, the
  original Pi 7″, HyperPixel, bare e-paper): clamp bars on posts from the
  plate, the batteries' mechanism; the glass sits in a locating rim.
- **An SBC on the display's back** (the 58 × 49 pattern of most DSI
  displays): an attached placement, positioned by the shared hole pattern,
  held on the display's own metal standoffs. The case reserves its room and
  opens its ports; no printed supports of its own.
- **Data.** The whole Tier A of the four segments of
  `PERSPECTIVE-SCREENS.md`, after the mechanisms (D7).
- **P1…P6** below: confirmed.
- **Order** (confirmed): the modules' data right after D3 — they need only
  D1–D3, and they lead the demand signals; see Order.

## Proposals (all confirmed, P3–P5 within their items)

- **P1. A display is a board entry**, `kind: "display"`, not a new kind of
  placement like a battery. A battery had no PCB, no holes and no ports; a
  display has all three, and the CYD's `display` part already is the window.
  What is new is *how it is held*, and that is a property of the placement
  that any board may use (a CYD hung from the lid has its screen flush with
  the window instead of `margin.top` below it).
- **P2. Defaults.** A `display` entry is hung from the ceiling when added; so
  is a board with a `display` part (CYD, Sunton, T-Display). A placement
  without the field is on the floor, so old files, presets and golden states
  do not move.
- **P3. The window** is the display part's rectangle (or circle) plus its
  clearance — the active area for TFT/OLED, the visible area for character
  LCDs — with a 45° chamfer outwards through the plate, so the plate's edge
  does not shade the picture at an angle. A toggle per board turns the
  chamfer off.
- **P4. The glass** lies against the inner face of the plate (no recess
  into the plate: 2 mm would leave a 1 mm skin), located by a rim around its
  outline (+0.2 mm fit, 1.2 mm wide, as high as the glass is thick, at most
  3 mm). The plate between the window and the rim hides the panel's border.
- **P5. On the console's slope** the case is sized by the board's
  unprojected outline: the slope's angle depends on the case depth, which
  depends on the boards. The case comes out at most d·(1 − cos θ) deeper
  than it must (6 % at 20°).
- **P6. The attached board is stored inside its display's placement**
  (`back`), not as a separate placement pointing at an index: removing or
  reordering boards needs no index bookkeeping, and the display's card owns
  it.

---

## D1. Display entries

**Now.** `BoardDef.kind` is `sbc | mcu | holder | battery`; a screen is a
`display` port on top (`schema.ts`), its opening the port's rectangle plus
0.3 mm.

**Plan.**
- `kind: "display"`. The picker gets a *Displays* group of its own, like the
  batteries and the holders (`picker.displays`), sorted by vendor and name;
  boards with a screen (CYD, Sunton) stay under their vendors. Search
  matches "display" and "screen" in all four languages.
- **The window** (confirmed): the active area for TFT and OLED — the whole
  picture shows, the panel's black border hides behind the plate; the
  visible area for character LCDs (1602, 2004, 12864), as their drawings
  give it. The `display` type's clearance stays 0.3 mm (the CYD's golden
  states do not move).
- The `display` port may carry the **glass**: `glass: { x, y, w, d, r,
  shape, t }` in the board frame — the outline of the lens, glass or bezel
  (centre, size, corner radius, rect or round) and its thickness; its front
  is at the port's `h` above the PCB, like any top part. The port's own
  rectangle stays the window. The sanitizer keeps the window inside the
  glass and the glass inside `size`; `tests/boards.test.ts` checks it.
- A panel with no PCB beyond the glass (Touch Display 2, a bare e-paper
  panel) is written with the glass as its `size` and the module's
  thickness as `t`; the driver board and the FPC are parts on the
  underside. The add-board skill gets a *Displays* section with these
  rules (what goes into `size`, `t`, `glass`, the window; active area
  versus visible area).
- The ghost draws the glass as a dark slab and the window in a lighter
  tone. `board.mjs --svg` and the review page draw the glass outline and
  the window, so an entry is checked against its drawing as boards are.
- First entry: the 2.8″ SPI TFT MSP2807 (`lcdwiki.com/res/MSP2807/…`, holes
  Ø3.2 at 44 × 78.08), the proving entry of D2–D3.

## D2. A board hung from the ceiling (box, cylinder)

**Plan.**
- `placement.on: "floor" | "ceiling"` (missing = floor). On the ceiling,
  `z` is the gap from the board's front (its tallest top part, the glass)
  to the inner ceiling, 0…`Z_MAX`. The board is not turned over: its top
  still faces up, it is only held from above.
- **The gap** (confirmed) is the board's z slider, *Gap to the ceiling*:
  0.3 mm by default for a board on standoffs or rails — the drawings' and
  the print's tolerance, so a glass thicker than drawn is not pressed
  against the plate and the PCB not bent. Below 0.3 mm the panel warns
  (`warn.glassGap`). A clamped panel (D5) is pressed against the plate by
  design: gap 0 and no warning.
- **Layout** (`layout.ts`). `z0 = ceiling − z − t − topHeight`. The inner
  height must hold every floor stack and every hung stack, and their sum
  plus `margin.top` where a floor board and a hung board overlap in plan
  (`minimumDims`). Then the case height decides the hung boards' z.
  Arranging and x/y alignment work as now; *height* alignment aligns only
  boards on the same side.
- **Supports** (`standoffs.ts`) grow down from the ceiling plate to the PCB's
  top at each hole (`SINK` into the plate). The screw goes in from below,
  through the PCB, into a pilot hole, an insert or a nut pocket near the
  plate (`postHole`, mirrored). Rails are the mirrored plain rail; a pin bed
  is never needed (the pins point away from it). A support's `base` is in
  the ceiling plate, so it goes to the part that owns the plate: the lid
  with a top lid, the body with a bottom lid. The existing `onLid` rule
  already says that.
- **Openings.** Top parts' columns already start just above the part and go
  through the ceiling; edge channels and walls work in plan as now; parts
  on the underside keep their column through the floor (a pin hole for a
  reset button).
- **Checks.** Overlap in 3D works on z0/zTop/zBottom as now; *a standoff
  runs into a board* learns that a hung board's standoffs go up.
- **View.** In the exploded view a board held by the lid rises with it
  (its ghost and port captions); one held by the body stays.
- **Card.** `#board<i>_on_floor|ceiling`; the z slider is relabelled *Gap
  to the ceiling* on the ceiling. Until D4 the console offers only the
  floor.
- Golden: MSP2807 hung from a top lid on M3 screws, on inserts.

## D3. The window and the glass seat

**Plan.**
- **Chamfered window.** A cutter may flare: `CutterSpec.flare` grows the
  section by that much per millimetre along the push from the plate's
  inner face outwards. The worker builds a flared cutter as the hull of
  its two end sections (`cut.ts`), rect or round. A hung board's display
  part gets flare 1 (45°) unless `placement.bevel === false`
  (`#board<i>_bevel`). P3 confirmed: the angle is fixed; a slider only if
  users ask for one.
- **Rim.** For a hung board whose display part has `glass`, the worker adds
  the rim (P4) from the plate down, to the owner of the board's supports.
  With a gap `z > 0` the rim is taller by the gap. P4 confirmed: fit,
  width and the height cap are constants (`RIM_FIT`, `RIM_W`, `RIM_H_MAX`),
  no controls; a test print may move them.
- **Warnings.** The rim running into a top part of its own board or into
  another board; the window in the rounded edge zone or over a lid post
  (the existing opening warnings, run for the window too); a standoff
  boss reaching into the glass.
- Proving entries: the round GC9A01 MSP1281 (a round window, a round glass,
  an `outline` of a round head with a tab), the 1602 with a PCF8574
  backpack (the window is the visible area, the glass is the bezel standing
  proud of the PCB).
- Golden: the MSP1281 on a cylinder, the 1602 on a box.

## D4. The console's slope

**Plan.**
- On a console `on: "ceiling"` is the slope. The board's plan position is
  as on the floor (layout frame); its plane is parallel to the slope, its
  front `z` below the slope's inner face: `toCase` gains the slope's turn
  about x.
- **Sizing** by the unprojected outline (P5, confirmed: an exact fit is not
  worth the iterations). The console's heights are
  raised (`caseLayout`'s deficit) until every hung board's lowest corner
  clears the floor and every floor board under it by `margin.top`. The
  slope's angle changes as the heights grow, so the loop runs to a fixed
  point (heights only grow; a few rounds, a cap and a test).
- **Openings and supports follow the board's normal**, not the vertical:
  top-part columns and the window along the slope's normal, standoffs
  perpendicular to the slope, edge channels along the tilted edge normals
  (`portAxis` already turns them). For a floor board the normal is the
  vertical, so nothing changes there.
- A board on the slope may stand against the left or right wall, not the
  front or back (its edge is not vertical there); the card hides those two.
- The print layout already lays a console with a bottom lid on its slope:
  the window side down, standoffs and rim up.
- **Through the opening** (confirmed: a warning is enough). A hung board
  goes in through the lid's opening; a 7″ panel may not pass a side lid's.
  `warn.boardNotThroughOpening` when a board's two smaller sizes do not
  fit the opening polygon — for every board, not only hung ones (a Pi 4
  does not pass a narrow side lid either, and nothing says so today). No
  preset has a side lid, so their checks stay clean.
- Proving: the BTT Pi TFT50 V2 (the KlipperScreen console), entered here.
- Golden: TFT50 on a console with a bottom lid on screws.

## D5. Clamp bars for panels without front holes

**Plan.**
- `mount.kind: "clamp"`: nothing to screw into from the front. The entry's
  `mount.holes` are then the threaded holes on the panel's back that the
  bars screw into (Touch Display 2's brackets at 70.71 × 140, the original
  7″'s M3 studs at 126.2 × 65.65); none means the bars press the back.
- **Posts** from the plate outside the rim, at both ends of each bar;
  **bars** across the back along the short side, 2 by default, or one row
  per row of back holes, with a through hole over each post (and over each
  back hole). The hole kinds and the head clearance are the standoffs'.
  The bars are the battery clamp generalised (`batterySolids.ts` → shared
  code, the battery's tests unchanged).
- **Press.** `placement.press` as for batteries: −3…1 mm; −1 by default for
  a pressing bar (room for foam tape; e-paper glass is ≈1 mm and a printed
  bar is not flat), 0 when the bar is screwed to the back. A slider in the
  board's card, *Clamp gap* (`#board<i>_press`), confirmed.
- **Direction** (confirmed): the bars run across the short side — shorter
  and stiffer, and Touch Display 2's bracket rows run that way; the posts
  stand by the long edges and widen the case by about 10 mm a side, as a
  battery's do.
- A bar keeps clear of parts on the panel's back and of an attached board
  (D6): it moves along the panel to a free place; with none, a warning.
- **Part.** The clamp bars of a display held by the lid travel with the lid
  (Lid tab, Both); battery bars stay with the body. The worker returns the
  bars by owner; exploded, they lift with their owner.
- Proving entries: Raspberry Pi Touch Display 2 7″ (screwed to the
  brackets; Waveshare 7″ DSI LCD (H) as an alias), the Waveshare 7.5″ V2
  e-paper panel (pressing).
- Golden: both.

## D6. A board on the display's back

**Plan.**
- The entry gives the pattern: `back: { holes, standoff, facing }` — the
  holes in the display's frame, the length of its own standoffs, and which
  face of the attached board turns to the display: `bottom` for DSI
  displays (the Pi's parts face away), `top` for HATs (HyperPixel, Inky
  Impression: the Pi's GPIO up into the display).
- The placement carries `back?: { board, variant, pins, cuts, rot }`
  (P6). The board's position follows from its holes: of the four turns
  (and the turn-over that `facing` asks for) those that put every hole
  within 0.3 mm of a pattern hole; `rot` picks among them
  (`#board<i>_back_rot`). The select `#board<i>_back` offers only boards
  whose holes fit the pattern.
- **Layout.** The attached board is a `PlacedBoard` of its own, with a
  `parent`: overlap checks, walls, port channels and captions treat it as
  any board; the display's stack depth includes the standoffs and the
  attached board. Turned over, its top parts' columns point down (through
  the floor), so they are **not cut by default** on an attached board;
  edge ports are, as everywhere.
- No supports of its own: the ghost draws the display's standoffs as grey
  columns.
- **Standoff length** (confirmed): a slider *Standoff height*
  (`#board<i>_back_standoff`), the entry's `standoff` by default, 3…30 mm
  — people fit longer ones for a Pi 5's cooler. With `facing: "top"` it
  never goes below the attached board's GPIO header (the HAT sits on it).
- **Card.** The attached board's variant, pins and port toggles sit in the
  display's card; removing the display removes it (undoable). Messages
  name it "board 2 (on the back of board 1)".
- Proving: Touch Display 2 7″ + Pi 5 (`bottom`), HyperPixel 4.0 + Pi 4
  (`top`).
- Golden: both.

## D7. The catalog: Tier A of the four segments

**Plan.** Through the add-board skill (its *Displays* section from D1),
drawings fetched with `scripts/fetch.mjs`, every entry laid over its
drawing on the review page; `verified` as for boards. Shared outlines go in
together, as families where only parts differ.

- **SBC displays** (one commit): Touch Display 2 7″ and Waveshare 7″ DSI
  (H) (D5), the original Pi 7″ with Waveshare 7″ DSI / DSI (C) on its front,
  BTT HDMI5 V1.2, the generic 7″ HDMI (Waveshare (C) / (H)), HyperPixel 4.0
  (D6), Waveshare 4.3″ DSI, BTT Pi TFT50 (D4) with TFT70 / TFT43 where the
  drawings are read, BTT HDMI7 (with TFT70's outline), BTT TFT35-SPI (its
  drawing first).
- **Modules** (one commit): the 0.96″ OLED (≈: no vendor drawing; LCDwiki's
  size and the community measurement, holes at the larger spacing seen),
  MSP2807 (D1), MSP2402, MSP3520, MSP4021, MSP1281 (D3), MSP1901, the
  1602 (D3) and 2004 with backpacks, the 12864, the 2.42″ and 1.3″ OLEDs,
  the ST7789 family (an entry per size: a variant cannot change the
  outline), the branded ST7789 boards whose drawings open.
- **E-paper and the last screen board** (one commit): the 7.5″ family (V2,
  B, BWRY; 7.3″ E on the same outline) with the driver HAT as a separate
  board, the Inky Impression 7.3 / 4.0 / 13.3 (a family; a Pi on the back,
  D6), the 2.9″ and 4.2″ modules (Waveshare and WeAct), MagTag, Inkplate
  6 / 10 / 6COLOR / 2 / 5 Gen2 (outlines from their STEP by
  `scripts/step.mjs`), LilyGO T5 4.7″ and T5 2.13; Waveshare
  ESP32-S3-Touch-LCD-7 (clamped by its frame's studs, D5).
- Research help, if any, follows the usage-limit rule: small model, one
  narrow slice, ≤ 25 calls, two at a time, findings in a scratchpad file.
- `PERSPECTIVE-SCREENS.md` marks what went in; `docs/boards.md` gets a
  Displays table.

## D8. Presets, documentation, limits

**Plan.**
- Presets: `klipperscreen-console` (BTT Pi TFT50 + Pi 4 on its back on a
  console, bottom lid) and `ha-wall-panel` (Touch Display 2 7″ + Pi 5,
  closed keyholes on the back). `tests/presetsBuild.test.ts` builds them;
  their notes in all four dictionaries.
- `docs/displays.md` (linked from `docs/README.md`): hanging, the window,
  the rim, clamps, a board on the back. `docs/limitations.md`: displays on
  the walls not yet; "display bezels" leaves the not-in-v1 list.
- `CLAUDE.md`: the invariants (hung boards, the normal-following openings,
  clamp owners, attached boards), the new control ids, the cost table with
  the heaviest display preset.
- Smoke, item by item: hang a display and see its standoffs on the lid;
  the window flares; the slope; clamps on the Lid tab; a Pi on the back and
  its ports; a project file round trip with all of it.

## Order

D1 → D2 → D3 → D7a (modules) → D4 → D5 → D6 → D7b (SBC displays) → D7c
(e-paper and Touch-LCD-7) → D8. Each item ends with its golden states, smoke
steps, docs and translations; D8's presets need D4–D6 and the D7 entries.
The 0.96″ OLED goes in as ≈ (no vendor drawing; a user's measurement of a
few sellers' boards verifies it later); BTT TFT35-SPI's drawing is opened
first, and without the sizes it goes in as ≈ or moves to Tier B (recorded
below).

## Deviations (recorded as they happen)

- **D2.** The gap is a slider of its own, `#board<i>_gap` (0.1 mm steps),
  shown instead of `#board<i>_z` on a hung board: a control's label is fixed.
- **D2.** *The same height* takes the reference's side too (a hung
  reference hangs the board at its gap), instead of aligning only boards on
  the same side — a button that silently did nothing is what the review
  found wrong with the view toggles.
- **D2.** A hung board's footprint includes its standoff bosses' overhang
  past its edge: M3 inserts on the MSP2807 reach 0.6 mm past it and met a
  top lid's skirt (slivers on the skirt's face). Floor boards unchanged.
- **D2.** The exploded view moves with the lid every board the lid holds
  (`heldByLid`): a hung board under a top lid, and also a floor board on a
  bottom lid — before, those stayed with the body.
- **D2.** Until D4, a board marked hung on a console stands on the floor at
  its default floor height; the card hides the choice there.
- **D3.** Instead of warning that the rim runs into a part, the rim steps
  aside for the board's other top parts (the MSP1281's ribbon tail sits
  right under its round glass: every GC9A01 user would see the warning);
  instead of warning that a boss reaches into the glass, the board's own
  supports step aside for the glass (a 1602's holes are 1.85 mm from its
  bezel, an M2.5 boss is Ø5.7). A screw hole under the glass is still
  reported (`warn.topPartOnSupport`). The rim and another board, and the
  window over a lid post, are not checked: the side margin keeps boards off
  the posts, and an overlap is reported already.
- **D3.** The 1602 entry is generic (`lcd-1602-i2c`, ≈): the outline, holes,
  bezel and visible area from Tinsharp's TC1602A-01T drawing, the PCF8574
  backpack's box estimated.
- **D3.** A hung board keeps the whole rounded zone of the top edge plus the
  skirt's band from the walls (`hungMargin`): under a rounded top the
  ceiling is flat only that far in and a top lid's opening is pushed in as
  much, and the smoke's slider extremes put the MSP1281's rim tangent to the
  skirt (96 degenerate triangles). So a window reaches the rounded edge only
  on a board against a wall; the warning stays for that.
- **D7a.** 21 module entries: LCDwiki MSP2401, MSP3520, MSP4021, MC242GX,
  Waveshare 1.54″ (verified); MSP1901, MSP1691 (hole Ø not drawn), the
  ST7789 1.14/1.3/1.54/2.0″ boards from LCDwiki's size pictures (glass
  thickness estimated), MC130GX, the generic 0.96″ OLED (LCDwiki's size
  picture), 2004 (Winstar WH2004A; the perspective's VA/AA offsets were
  misread — all centred at y 30), 12864 (Raystar RG12864A2), Waveshare 2″
  (hole Ø), the Adafruit 4311/3787/4313/4383/5394 (outline, holes and module
  from their STEPs; the active area assumed centred in the module) — ≈.
  The Adafruit 1.54″ and 1.3″ have their microSD opening off by default: on
  a hung board that thin the slot sits in a top lid's skirt band.
  Waveshare 1.69″ waits for D5: its holes are under the LCM (it is screwed
  from behind, standoffs on its back).
- **D4.** No fixed-point loop: the console's heights rise together, so the
  slope's angle never changes while they rise (the depth is fixed before);
  one deficit for the floor boards and the hung ones does it. Proven on
  the MSP3520 rather than the BTT Pi TFT50: the TFT50's corner holes are
  under its 5″ glass (it is screwed from behind) — it goes in with D5/D6.
  A tilted edge channel stops just past the wall it opens (a long one dived
  under the floor and was reported as split by the lid).
- **D5.** A clamped panel always hangs (the sanitizer sets it; the card
  hides the choice): on the floor nothing would hold it. Its gap defaults
  to 0 and is not warned about.
- **D5.** The clamp gap's control is `#board<i>_clampPress`: the battery's
  `press` control already has `#board<i>_press`.
- **D5.** The posts stand as far out as their boss needs to clear the rim
  (`postOut`), not at a fixed 5 mm: a fixed distance put an M3 insert's
  boss tangent to the rim (slivers). The footprint takes their reach.
- **D5.** Touch Display 2's "back" in the entry is its brackets' faces
  (t 8.72 = 6.42 to the back plate + 3 of bracket): the bars screw onto the
  brackets, and the DSI connector stays within that depth. Waveshare 1.69″
  likewise ends at its standoffs' faces.
- **D5.** `EDGE_KEEP` (0.05 mm): a rim or post at a footprint's edge put
  its face on the side margin's line, where the cavity's corner arc ends,
  and left a degenerate triangle on the ceiling. The MSP2807, MSP1281 and
  MSP3520 golden states moved by it (0.1 mm wider).
- **D6.** The attached board goes after every placed board in
  `layout.boards`, with the display's index: inserted after its display it
  shifted every later board's index, and much of the code reads
  `layout.boards[i]` as `state.boards[i]`. Its messages and captions carry
  the display's number (a translated "on the back of" would need a message
  inside a message).
- **D6.** It cannot stand against a wall: it rides on the display.
- **D6.** Pressing clamp bars do not step aside for it: a bar that runs
  into it is reported (`warn.clampBlocked`). Touch Display 2's bars are on
  its bracket rows, clear of a Pi.
- **D6.** HyperPixel 4.0 (`facing: top`) is not proven here: its LCD covers
  its whole PCB, so nothing holds it from the front, and clamp bars under
  it would run into the Pi below. It is held by the Pi it sits on — the
  opposite of a board on a display's back. Decided in D7b.
- **D7b.** A screwed clamp is a tab from the nearer post to each back hole,
  not a bar along each row: the BTT HDMI5's HDMI connector sits on its back
  across the line a full bar would take to its corner holes. The two
  Touch Display 2 golden states moved with it.
- **D7b.** In: Touch Display 2 7″ (D5/D6), the original Pi 7″ (its studs'
  height read as 2.5 mm, ≈), BTT HDMI5 and HDMI7 V1.2, Pi TFT50 / TFT70 /
  TFT43 V2 (Pi on the back; pattern places read from the back views'
  pixels, the LCD's active area assumed centred, ≈), Waveshare 4.3″ DSI (Pi
  on the back), Waveshare 7″ HDMI (C) (holes in its ears, clear of the
  glass: standoffs from the front), BTT TFT35-SPI V2.1 (its drawing has the
  PCB and holes only; the LCD taken as centred, the holes outside it, ≈).
  Most of them are clamped: their corner holes are under the glass.
- **D7b, open.** HyperPixel 4.0 is not in: its LCD covers its whole PCB and
  it sits on the Pi as a HAT, so the Pi standing on the floor holds it — a
  display carried by the board under it, the reverse of D6. To decide with
  the user.

