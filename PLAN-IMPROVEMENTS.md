# Case Constructor — improvements after the review

Status: agreed with the user on 2026-10-22. Done: I1…I6.

Same rules as PLAN.md: TDD, golden tests for new geometry (a new state per
feature, old ones untouched), `npm run check` and `npm run smoke` before
each commit, commit and push after each milestone, deviations recorded at
the end of this file.

## Decisions

Taken with the user on 2026-10-22:

1. **Boards (I5):** arrange buttons (a) and per-board alignment to another
   board (b); no top-view plan with dragging (c) for now.
2. **Keyholes (I6):** a choice of *through* (today) or *closed*; a closed
   keyhole sits in an **outward** pad on the outer bottom, and two feet of
   the same height on the other end keep the case from rocking.
3. **Printed screws (I7):** they go into the **lid's STL**, laid out next
   to the lid; Both exports body + lid + screws. P6 (Ø 6 mm, pitch 1.5) is
   the smallest size.
4. **Magnets (I8):** **press-fit only**: open pockets, the magnet goes in
   after printing. No melting in (neodymium loses its strength above
   ~80 °C) and no pause-embedded pockets.

Taken by default unless the user objects: Q2 (the preset note stays
translated), Q3 (the case re-centres when the sheet hides, eased like the
sheet), Q7b (a knurled thumb head with a slot).

---

## I1. The Lid tab shows the lid in the print layout

**Now.** `effectiveView` (`src/main.ts`) returns `assembled` for the Lid
tab: the lid is drawn as it sits on the case, moved down onto the grid. The
STL is exported in print orientation (`lidForPrint`), so the view and the
file disagree.

**Plan.** The Lid tab draws `lidForPrint(lid, …)` — outer face down, the
skirt up, exactly as exported. The view row stays hidden (one meaningful
choice); the caption says "Lid · print layout". When printed screws are on
(I7) they lie next to the lid, as in its STL.

**Tests.** Smoke: on the Lid tab the drawn lid's lowest z is 0 and its
outer face is down (the bbox matches `lidForPrint`).

## I2. A built-in preset has one name in every language

**Now.** The name of a built-in preset is a dictionary key
`preset.<id>` (`builtinName` in `main.ts`): switching the language renames
the open preset on the top-bar button and in the list, and the suggested
file name differs by language.

**Plan.** The name becomes a field of the preset in `src/state/presets.ts`,
in English (today's `en.ts` strings: "Pi 4 desktop case", …); the
`preset.<id>` keys leave all four dictionaries. The note (the tooltip:
what the preset is for) stays translated.

The i18n test forbids Cyrillic/Hebrew outside `src/i18n/`; English names in
`presets.ts` are fine. A test checks every preset has a non-empty, unique
name.

**Q2.** The note stays translated — agreed? (Recommended: yes, it is a
description, not a name.)

## I3. Mobile: the picture keeps its proportions under the settings sheet

**Now.** On a narrow screen the sheet covers the lower part of the canvas
and `scene.setBottomInset` centres the case above it with
`camera.setViewOffset(w, h + inset, 0, inset, w, h)`. Two defects:

1. `camera.aspect` stays `w / h` while the virtual frame is `w × (h +
   inset)` — Three.js maps the full frame with `aspect`, so the visible part
   is stretched by `(h + inset) / h`. That is the distortion the review
   saw: round holes became ellipses.
2. The visible part covers a smaller vertical angle than the full canvas,
   so opening or hiding the sheet also changes the scale: the picture jumps
   as if the canvas had changed size.

**Plan.** The canvas stays full size under the sheet (it already is: the
sheet is `position: absolute`). With an inset the virtual frame keeps the
same angular size per pixel: `aspect = w / (h + inset)` and a vertical fov
widened so that `tan(fov'/2) = tan(fov/2) · (h + inset) / h`. Opening or
hiding the sheet then only shifts the picture (re-centres it in the visible
part); scale and proportions do not change. Orbit and zoom keep working on
the full canvas.

**Tests.** Smoke on the mobile viewport: project a known point pair (the
case's bbox corners) to screen with the sheet open and hidden — the
on-screen width/height ratio and the size are the same within a pixel; only
the vertical position changes. `snap.mjs` gets a `--panel open|hidden`
flag for screenshots of both states (the backdrop cannot be clicked by
selector: its centre is under the sheet).

**Q3.** Re-centre the case when the sheet hides (it moves down to the
middle of the canvas), or leave it where it was (no movement at all, the
case stays in the upper part)? Recommended: re-centre, with the same
0.25 s ease as the sheet so it does not jump.

## I4. Board ghosts show their mounting holes

**Now.** `boardGhost` (`src/geo/ghost.ts`) draws the PCB as a plain slab.

**Plan.** The PCB slab gets real holes at `def.mount.holes` (diameter from
the board file): top and bottom faces as the outline with circular holes,
triangulated with `earcut` (a small pure dependency; `src/geo/` still never
imports Three.js), plus the hole walls. A pad ring (the port colour, thin,
on both faces) around each hole, so they read at a glance even at the
preview's angle. The standoff under each hole then visibly lines up with
the hole. Rail-mounted boards have no holes and do not change.

**Tests.** `tests/ghost.test.ts`: the PCB mesh of a board with holes is
closed, its volume is the slab minus the holes, no degenerate triangles;
a board without holes is unchanged.

## I5. Arranging several boards

**Now.** Each board has absolute x / y sliders (0…300 mm, the corner of its
rotated outline in the layout frame); a new board is put to the right of
the others. Placing two boards next to each other, aligned, takes trial and
error, and the sliders say nothing about the other boards.

**Plan.** a and b (decision 1); c is left for later.

- **a. Arrange buttons** in the Boards card header (shown with two boards
  or more): *In a row* (along x, aligned by the front edge), *In a column*
  (along y, aligned by the left edge), *Compact* (the smallest footprint:
  tries the rotations and row/column splits, keeps the order), *Stack*
  (one above the other, centred, each z above the previous board's top
  parts — for HAT-like layouts). One gap field for all of them (default
  `NEW_BOARD_GAP`, 5 mm). Each is one undo step. Footprints (ports that
  stick out, rails) are what is packed, so nothing overlaps.
- **b. Per-board alignment**: in each board box, a small row "align to
  board N: left / centre / right, front / centre / back, next to it on the
  right / behind" — for a precise layout the buttons cannot guess.
- **c. A top-view plan** in the Boards card: a small SVG of the cavity with
  the board outlines (numbered), their footprints, standoffs, overlaps in
  red; drag a board with a finger or the mouse (snaps to 0.5 mm and to the
  other boards' edges), the x / y sliders follow. The most direct, and the
  most work (pointer handling, touch on the mobile sheet).

Positions stay in the layout frame (the layout is still centred in the
cavity), so none of this touches the core's invariants; the arrangement is
a pure function `arrangeBoards(placements, mode, gap)` in `src/geo/`
tested in vitest (no overlaps, every footprint in the positive quadrant,
idempotent).

Alignment (b) moves only the board it belongs to; the reference board is
a select of the other boards' numbers, hidden with a single board.

## I6. Wall-mount keyholes: through or closed

**Now.** `keyholeCuts` (`src/geo/extras.ts`) cuts two keyholes straight
through the floor (or the back wall with a bottom lid): the cavity is open
to dust and the screw head sits inside the case.

**Plan.** `wallMount.keyhole: 'through' | 'closed'` (default `through`,
old files load unchanged). A closed keyhole is a pocket the screw head
slides into: from the outside the usual keyhole (head hole + slot), behind
the slot a wider channel for the head, closed on the inside. The floor
(~2 mm) is too thin for that — head pocket ≈ head height + 0.5 mm plus a
lip ≥ 1.5 mm over the slot ≈ 5 mm — so the material comes from a **boss**
around each keyhole (rounded pad ≈ head Ø + 6 mm × slot length + head Ø +
6 mm). It prints without supports in the body's print orientation: the
wider channel over the narrow slot is a short bridge (≈ head Ø).

**Where the boss goes (decision 2): outwards.** Two pads on the outer
bottom, the cavity untouched. Two pads on one line would let the case rock,
so two feet of the same height and footprint (no keyhole) stand mirrored
at the other end of the bottom: the case stands level on four. With a
bottom lid the keyholes are on the back wall: the pads stand out of the
back wall and need no feet (the case hangs on them; it stands on its
bottom). Pads are additive (unioned with the body like ears) and the
keyhole channel is cut through pad and floor as one cutter set. Feet and
pads are kept clear of ears and of vents on the bottom (vents under a pad
are thinned out like those under standoffs).

## I7. Printed plastic screws for the lid, with threads in the posts

**Now.** The lid is held by metal screws M2…M4 into corner posts: a pilot
hole for a self-tapping screw, a heat-set insert or a nut pocket.

**Plan.** A fourth hole kind for the lid, **printed**: the app prints the
screws themselves (as part of the lid's STL) and a matching internal thread
in each post.

*How small can a printed screw be.* With a 0.4 mm nozzle and 0.2 mm layers
the thread depth must be at least ~2 nozzle widths, so ISO pitches below
1.25 mm (M5 and smaller) print as a ribbed rod. Since both the screw and
the hole are printed, we are not bound to ISO: a coarse 60° profile with a
flat crest. Sizes offered:

| Name | Major Ø | Pitch | Post Ø | Use |
|---|---|---|---|---|
| P6 | 6 mm | 1.5 mm | ≈ 10.5 mm | smallest reliable; the default |
| P8 | 8 mm | 2 mm | ≈ 12.5 mm | big cases, PETG |
| P10 | 10 mm | 2.5 mm | ≈ 14.5 mm | thumb screws on large lids |

Below 6 mm the thread wears out after a few turns and the shank (printed
standing, layers across the axis) snaps at the head under the torque of a
lid screw — so P6 is the minimum. The radial clearance (0.2 mm default,
range 0.1…0.4) is a field, like `lid.fit`: printers differ.

*Geometry.* A single-start helical thread has a constant horizontal
cross-section that turns by 360° per pitch, so it is exactly
`CrossSection.extrude(height, divisions, twistDegrees)` of one 2D profile
— no hand-made helix mesh, watertight by construction. The internal thread
is the same twisted extrusion grown by the clearance and subtracted from
the post. Entry chamfers on both (45°, half a pitch), and the thread ends a
pitch short of the post's foot.

*The screw.* Printed standing on its head. Head: a knurled thumb head (no
tool needed) with a slot for a screwdriver. Length = lid plate + post
engagement (the post's `POST_LEN` grows to ≥ 1.5 × Ø). In the lid: a
clearance hole and a counterbore for the head, as today's `counterbore`.

*Consequences.* Posts get thicker (table above): `sideMargin` and `lidBand`
already take `bossDiameter`, so auto size grows on its own; small cases may
grow noticeably — the panel says why. The triangle count grows (a twisted
extrusion per post and per screw): the preview uses fewer divisions,
the golden table gets the new states, and the time is checked against the
300 ms preview limit (CLAUDE.md "What costs what").

*Export (decision 3).* The screws are in the **lid's STL**, in a row next
to the lid (same print job, same material); Both exports body + lid +
screws; the Lid tab (I1) shows them in that layout.

**Q7b.** Head: thumb head with a slot (default), plain cylinder head with a
slot, or a choice of both?

## I8. Lid on magnets

**Plan.** A third fastening next to snaps and screws: `lid.fastening =
'magnets'`. Disc magnets in the same corner posts (`postSpots`) and in
matching bosses on the lid's inner face, so magnet faces meet across the
parting line. Common disc sizes: 5×2, 6×2, 6×3, 8×2, 8×3, 10×2, 10×3 mm;
a diameter clearance (+0.2 mm default) like the other fits.

**Press-fit only (decision 4).** A neodymium magnet loses its strength for
good above its working temperature (80 °C for the common N35…N52 grades),
so it is not melted in like a heat-set insert. The pocket is open to the
parting line; the magnet is pressed in after printing (+ a drop of glue if
the fit is loose). The pocket depth is the magnet's height, so the magnet
face lies flush with the post top and the lid boss; the parting gap
(`lid.fit`) keeps them from touching. A 0.5 mm × 45° chamfer at the mouth
guides the magnet in.

Polarity: a note in the panel to put the magnets in attracting each other
(mark one face before inserting). The skirt stays: it centres the lid,
the magnets only hold it. Posts and lid bosses reuse the screw posts'
placement, collision and opening checks (`postSpots`,
`postCollisions`, `postsInOpenings`).

---

## Milestones

Small and independent first; each is one commit and push.

| # | What | Size |
|---|---|---|
| I1 | Lid tab in print layout | S |
| I2 | One preset name | S |
| I3 | Mobile view proportions | S |
| I4 | Mounting holes in ghosts | S–M |
| I5 | Arranging boards | M (a), L (c) |
| I6 | Closed keyholes | M |
| I8 | Magnets | M |
| I7 | Printed screws and threads | L |

Magnets before printed screws: they reuse the posts with simpler geometry,
and the post/boss changes they bring are what I7 builds on.

Each milestone updates: the dictionaries (en, ru, uk, he), the smoke (a
step per new control), `CLAUDE.md` (control ids, invariants that changed),
`README.md` features, `docs/limitations.md`, a golden state for new
geometry, `tests/presetsBuild.test.ts` if a preset uses it.

## Deviations (recorded as they happen)

- **I5.** No *Stack* arrange mode: boards stacked one above another each
  stand on their own standoffs from the floor, which run through the board
  below (`warn.standoffHitsBoard`) — HATs sharing standoffs are out of v1
  (docs/limitations.md). Alignment got *The same* standoff height instead.
  *Compact* scores a split by the case it gives (outer area with margins
  and walls, a cylinder's diameter), not the boards' bare area: the bare
  area favoured one long row. Compact never tries other rotations (the
  plan said it would): a rotation decides which wall a connector faces,
  and that is the user's choice. The arrange gap is a tool setting, not part
  of the project file.
- **I6.** Outward pads under the floor make the body print standing on
  them, with the floor between them on supports when the lid is on top —
  missed when the plan was agreed. Asked again: the user keeps outward pads
  and feet; the panel warns (`warn.keyholePadsOnBed`). A side lid prints the
  bottom standing, where the pads are a small overhang. Closed keyholes on
  a cylinder's round wall (bottom lid) fall back to through
  (`warn.keyholeClosedRound`). The standoff warning now measures the
  distance to the cutter's section, not to its centre: a closed pocket is
  long, and a standoff hole that reaches it opens the case.
