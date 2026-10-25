# Case Constructor — improvements after the user trial

**Status: done except the thread form (R4), which waits for the user's test print of `inspect.mjs --thread-test`.**

Written on 2026-10-25 from the notes of a trial of the live site with real
users (the draft `REVIEW-RESULTS.md`, deleted once this plan is agreed).
Items R1…R8; the order is below the items.

Same rules as PLAN.md: TDD, golden tests for new geometry (a new state per
feature, old ones untouched), `npm run check` and `npm run smoke` before
each commit, `docs/` and all four dictionaries in the same commit,
deviations recorded at the end of this file. New since this plan: the work
goes on the branch `improvements-2026-10-25`, one commit (and push) per
item; the user reviews and merges into `main` (AGENTS.md).

## Decisions (2026-10-25, with the user)

- **Plans** live in `plans/` from now on: `PLAN.md`, `PLAN-IMPROVEMENTS.md`,
  `PLAN-IMPROVEMENTS-NEW-BOARDS.md` and `PERSPECTIVE-BOARDS.md` moved there
  with this plan; references updated. `IDEA.md` stays in the root.
- **Branch.** An iteration goes on its own branch; the user reviews and
  merges into `main` (AGENTS.md, Commits).
- **R4.** The printed thread is rough on the print, not in the view (the
  user printed a P6 next to a Bambu Studio M6: ours has lumps along the
  thread and does not feel round). A print-friendly profile, chosen by a
  test print before the default changes; the fit default goes to 0.35 mm
  regardless.
- **R6.** Captions are always shown with *Boards* on; a click on a caption
  toggles the port's opening (undoable). No hover highlight from the card.
- **R7.** Per board: the wall and the port face's offset from the outer
  surface (0 = flush).
- **R3.** Head diameter (both seats) and counterbore depth; countersunk
  defaults from DIN 7991.
- **R8.** Every battery kind: cylindrical cells 18650 / 21700, AA / AAA
  (14500 / 10440), a flat pack (LiPo, power bank) by size, and ready-made
  holders as catalog entries. Held by **cradles + a clamp on screws**.

---

## R1. Box → console → box puts the lid under the table (bug)

**What happens.** A console cannot have a lid on its slope, so
`sanitizeLid` turns a `top` lid into `allowed[0]` = `bottom` when the shape
becomes a console. Back on the box the lid stays on the bottom: the user
never chose it. In the exploded view a bottom lid is lifted along its
normal, i.e. *down*, and the scene keeps z = 0 on the grid
(`scene.ts`: "the bed stays on the grid") — so the lid hangs under the grid
(the screenshot).

**Plan.**
- The state keeps the face the user chose (`lid.face`); the face the case is
  built with is resolved like the lid depth, at build time
  (`effectiveLid`): on a console `top` becomes `bottom`. The Lid card shows
  the effective face, says why ("the console's slope cannot be a lid — the
  lid is on the bottom"), and a click on any face is an explicit choice that
  replaces the remembered one. `sanitizeLid` stops coercing the face by
  shape (it only checks it is a face); every consumer of `lid.face`
  (layout, print, worker, ghosts, warnings) reads the effective one —
  audited with a grep, pinned by a test: box → console → box gives `top`
  again, and a console's built lid is on the bottom.
- The exploded view lifts the whole composition when anything goes below
  z = 0: the lowest point stands on the grid (a bottom lid floats under the
  body, both above the grid). Smoke: the bottom face's exploded view has
  every drawn part's min z ≥ 0.

## R2. Mobile: turn and zoom the case with the settings open

**Now.** On a narrow screen `#panelBackdrop` covers the canvas while the
sheet is open; any touch on it closes the sheet.

**Plan.** The backdrop goes (or becomes `pointer-events: none`); the canvas
takes drags and pinches with the sheet open, as on a desktop. A *tap*
(pointer down/up within ~6 px and ~300 ms, one finger) on the canvas still
closes the sheet. Smoke: with the sheet open, a drag on the visible part of
the canvas changes the camera and leaves the sheet open; a tap closes it.

## R3. Head diameter for counterbored and countersunk lid screws

**Now.** Both seats are sized by the pan head of `FASTENERS` (M3: 5.5 mm).
A countersunk M3 (ISO 10642 / DIN 7991) has a 6 mm head, so it does not
sink flush — likely what the users ran into.

**Plan.**
- Countersunk seats get their own default diameters (DIN 7991: M2 4.0,
  M2.5 5.0, M3 6.0, M4 8.0).
- `lid.screw.headD`: an optional override (number or `null` = from the
  table), a slider *Head diameter* under the head kind (counterbore and
  countersunk only), range d + 1 … 3 d, showing the table value when unset;
  a reset button returns to the table. `lid.screw.headH`: the same for the
  counterbore depth (now `headH` of the table, capped by the plate).
- Sanitizer, project file, golden state (countersunk M3 with a 6.5 mm head).

## R4. Printed screws: looser fit, smoother thread

**Now.** `lid.thread.fit` defaults to 0.2 mm (range 0.1–0.4) — too tight on
real printers. The thread looks rough. Two possible reasons, to be told
apart before changing anything:
- the *view*: the preview draws 16 points per turn (`threadPoints`), a
  visibly faceted helix; the export has 48 (24 segments) to 64;
- the *print*: the 60° profile has flanks 60° from the axis — the lower
  flank is a 60° overhang, past the usual 45°, and prints rough on a
  standing screw.

**Found.** The view is not it: an export at the default resolution has 48
points per turn, within ~0.006 mm of the helix. It is the print: the lower
flank of a 60° profile hangs out ≈ 0.35 mm per 0.2 mm layer (almost a line
width), on a layer of a few mm² that has no time to cool; a 1.5 mm pitch
half a pitch deep makes each layer a strongly eccentric cam, which the
fingers feel as "not round".

**Plan.**
- Default fit 0.35 mm, range 0.1–0.8; presets and golden states that pin
  the old default keep it explicitly.
- **Test print first.** `inspect.mjs --thread-test <dir>` (a flag, not a
  throw-away script) writes, per candidate profile, a P6 screw and a short
  nut block with the fit marked on it: (a) today's 60°, (b) the lower flank
  at 45° from the axis (overhang ≈ 0.2 mm per layer), the upper flank as
  now, a shallower thread (0.4 P); (c) the fine ISO pitch (P6 × 1) with
  today's profile. The user prints them and picks; the winner becomes the
  default profile (any other stays only if the user wants a choice).
- The chosen profile goes into `threadSection`; the hole is the same section
  grown by the fit, so screw and hole still mate; `tests/thread.test.ts`
  keeps turning the screw in its hole. Golden states of printed screws move
  knowingly (`UPDATE_GOLDEN=1`, only them).

## R5. Label: quick placement — anchor and quarter turns

**Now.** The label is placed by its offset from the lid face's centre
(`label.x/y`) and an angle; putting it at an edge means trial and error.

**Plan.**
- `label.anchor`: a 3 × 3 grid (centre, the four edges, the four corners) as
  buttons; `x/y` become a fine offset from the anchor (0 by default). At an
  edge the label's rotated bounding box keeps `label.margin` (new, default
  3 mm) from the face's flat part — inside the edge fillet, the corner
  radius and the lid's screw posts' heads.
- Angle: buttons 0 / 90 / 180 / 270 next to the slider (the slider stays for
  anything else).
- Old project files: no anchor = `centre` with their x/y — unchanged.
- The panel warns when the label does not fit inside the flat part.

## R6. Port labels in the view

**Plan.** A ghost caption over every edge port and top element of the board
ghosts: the port's short name (`port.<type>` · id, as in the board card),
an HTML overlay positioned by projecting the port's anchor every frame
(`scene.ts`), translucent, never blocking the canvas's gestures. Shown whenever
*Boards* is on. A port that is not cut has its caption dimmed. A click on a
caption (a press and release without a drag, so turning the view never
toggles anything) toggles the port's opening, the same as its checkbox in
the card, with undo. Captions that overlap at the current zoom are thinned
(the nearer one wins). Smoke: the Pi 4 shows its edge captions; a click on
the Ethernet caption unchecks `#board0_cut_ethernet`, undo checks it back.

## R7. A board flush against a wall

**Now.** The cavity is the boards' footprints (connectors' protrusion
included) plus the side margin, and the layout is centred in it. A
connector's face ends `margin` inside the inner wall, so a plug has to reach
through margin + wall; a connector can never stand flush with the case's
outer surface.

**Plan.**
- Per board: *Against the wall* — none / left / right / front / back (case
  frame, after the rotation), and *Port face* — flush with the outer
  surface (0) or recessed / proud by −wall … +3 mm.
- Layout: on that side the board sets the cavity's wall: the inner wall
  is placed so that the board's connectors on that edge end at the outer
  surface + the offset (or, when a connector protrudes less than the wall,
  the board edge stays 0.3 mm from the inner wall and the panel says so).
  No margin on that side; the other sides are as now. With a manual size
  the boards are pushed to that wall instead of centred. Two boards against
  the same wall at different depths: the outer one sets the wall, the
  other gets a warning (Align → the wall is the fix).
- Openings: a flush port's channel starts behind the connector's body (at
  the board edge), not at its face, so the wall around the body is cut to
  the connector's section + clearance.
- Not offered: the cylinder (round wall), a rail edge (the rail is there),
  the lid's own face when it is a side lid. Checks that already exist cover
  the rest; added where missing: the lid skirt (top / bottom lid) and the
  corner posts against the board's parts near that wall.
- State: `placement.wall: Edge | null`, `placement.wallOffset: number`;
  sanitizer, project file, golden state (a Pi 4 flush right).

## R8. Batteries held inside the case

**The idea.** A battery (or a pack) placed in the cavity like a board, with
a printed part that holds it down on screws.

**Plan.**
- **R8a. Batteries in the layout.** A new list `batteries` in the state and
  a card *Batteries*: kind — a cell (18650, 21700, 14500 / AA, 10440 / AAA)
  × count 1…4 side by side, or a flat pack (w × d × h). A battery is a
  layout item like a board: x / y / z, rotation, Align and Arrange, takes
  part in auto size and in the overlap warnings; its ghost is drawn like a
  board's (cells as cylinders). The layout code gets a common item (board
  or battery) where it now takes boards; the board code keeps its own
  types.
- **R8b. Cradles and the clamp.** Two saddles on the floor belong to the
  body: concave seats for cells (the cell's radius + 0.3), a low fence for
  a pack. A separate printed *clamp* — a bar across the battery, concave
  underneath for cells, flat with a pressing rib for a pack — is screwed
  into two posts beside the battery with the boards' screw / tap / insert /
  nut choice. It presses by `press` (default 0.3 mm; up to −3 for a foam
  pad). One clamp per battery, two for cells longer than ~50 mm. The clamp
  is a new part (`clamp`, like the printed screw): the worker returns one
  in its own frame, the main thread places the copies; the print layout
  lays them next to the lid on their flat top; Both and Body export them;
  the exploded view lifts them above the battery.
- **R8c. Ready-made holders** (Keystone 1042/1043 18650, 2 × / 4 × AA boxes
  with published drawings) are catalog entries through the add-board skill:
  a "board" with mounting holes and the solder tabs as ports. The picker
  gets a *Battery holders* group.
- Presets: one that uses a cell pack (e.g. `esp32-sensor-box` gets a variant
  `esp32-18650-box`). Golden states: 2 × 18650 on cradles with a clamp, a
  LiPo pack, a holder entry.
- Not in R8: chargers and protection boards (TP4056, power bank modules) —
  catalog entries, a later batch.

---

## Order

R1 → R2 → R3 → R4 (fit and the test print; the profile waits for the
user's print) → R5 → R6 → R7 → R8a → R8b → R8c → R4 (the chosen profile).
Bugs and small things first, then the bigger features; R8 last since it
adds a part.

## Deviations (recorded as they happen)

- **R4 (fit, test prints).** A post's anchor — the point in the wall its
  corner fill reaches — was the opening's bounding-box corner pulled in by
  half a wall. On a rounded corner that point lies outside the outer
  surface, so the fill poked through the corner and was trimmed into seams
  (a zero-area triangle when a seam met an arc vertex: the console with a
  bottom lid on printed screws at the new 0.35 fit), and with a large
  radius the fill missed the wall (a gap between post and wall). The anchor
  is now half a wall outside the opening's edge on the diagonal; every
  state with posts moved in the golden file. The hole for an asymmetric
  form must be the screw's thread turned over (`threadHole`): the case's
  holes switch to it with the chosen form.
- **R7.** Several walls per board, not one (`placement.walls`, toggle
  buttons): the Pi 4 has connectors on two sides, and with one wall only one
  of them could be flush. The layout handles each side on its own anyway.
  New control kind `toggles` (any number pressed).
- **R8.** A battery is a placement in `state.boards` (`board: 'battery'`)
  rather than a list of its own: the layout, walls, alignment, arrange and
  overlap checks take it unchanged, and the Boards card holds it. Its clamp
  posts take the card's Screw and Hole (the standoffs' drilling, now
  `postHole`). Holders (R8c) are MPD's wire-lead ones (BH-18650-W, BH2AA-W,
  BH4AA-W, BH2AAA-W), not Keystone 1042/1043: those solder onto a PCB and
  have no screw holes. The AA holders' holes along the length are not
  dimensioned on the drawing (taken as centred): ≈.
