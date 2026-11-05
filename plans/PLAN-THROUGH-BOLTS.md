# Case Constructor — a lid on through bolts

**Status: plan, decisions taken (2026-11-05).**

Written on 2026-11-05 from the user's request. Items T1…T6; the order is at
the end.

Same rules as PLAN.md: TDD, golden tests for new geometry (a new state per
feature, old ones untouched), `npm run check` and `npm run smoke` before
each commit, `docs/` and all four dictionaries in the same commit,
deviations recorded at the end of this file. The work goes on the branch
`through-bolts`, one commit (and push) per item, a pull request after the
first; the user merges.

## What the user asked for

A fifth lid fastening: **through bolts**. A bolt goes from the lid's outer
face through the whole case to the opposite face, a nut on it outside. The
same settings as the lid's screws (size, head seat) plus the nut's size and
where it sits: **recessed** (a hex pocket in the far face, the nut flush or
below it) or **on the face** (a plain hole, the nut stands on the surface).

## What is there now

- `lid.fastening`: `snaps | screws | magnets | printed` (`lidSpec.ts`).
  Screws, magnets and printed screws share the corner posts
  (`postSpots`, `fastening.ts`): a boss in each corner of the opening,
  filled out to the walls, `postLength` (8 mm) below the parting plane, a
  45° taper under it; with a deep lid it rises inside the lid to the plate
  less the fit (`postSolids`, `lip.ts`).
- The lid gets a through hole (screw + 0.4) and the head seat
  (`headSeat`, `headLimits`/`seatRoom`: the seat keeps `SEAT_WALL` from the
  face's edge, the sliders stop there, the worker clamps a file).
- The layout keeps `postRoom` (post Ø + 0.5) as side margin for a top or
  bottom lid with posts — for the whole height, so a full-height column
  needs no new room.
- Checks on the main thread: `postCollisions` (post box against boards),
  `postsInOpenings`, head limits, labels keep clear of heads.

## Proposal (to be confirmed — see "Open questions")

- **Where.** A top or bottom lid on a box, a cylinder and a hinged half.
  Not on a side lid (the bolt would run along the floor's corners, through
  the supports' zone) and not on a console (the far face of its bottom lid
  is the slope: the nut would sit askew). The option is disabled there; a
  state that has it while the shape or face cannot (a shape change, a
  file) is **built as screws** with a note, and comes back when allowed —
  the `lid.chosen` / `lid.face` pattern, done in `effectiveLid`.
- **The column.** The corner post becomes a column from the far plate to
  the lid plate less the fit: the same footprint (boss + fill to the
  corner), no taper (it stands on the plate). With a deep lid it rises
  inside the lid as today's posts do. Its diameter: around the through hole,
  or around the nut pocket when the nut is recessed (as `bossDiameter` for
  `hole: 'nut'` today), so `postRoom` grows only by that.
- **The hole.** A clearance hole (d + `THROUGH_CLEARANCE`) through the lid
  plate, the column and the far plate. In the lid the head seat as for
  screws (none / counterbore / countersunk, its diameter and depth, the same
  limits). The hole kind (tap / insert / nut) is not offered.
- **The nut.** Recessed: a hex pocket (AF + `NUT_CLEARANCE`, height + 0.4)
  from the far face, turned so a flat faces the case centre; the column
  above it is solid, so no boss is needed. On the face: only the hole; the
  nut stands on the far face. Either way the nut's seat keeps `SEAT_WALL`
  from the far face's edge (`seatRoom` on the far face), a file asking for
  more gets a warning.
- **State.** `lid.fastening: 'through'`; `lid.nut: { place: 'recessed' |
  'surface', … size, see Q2 }`. The screw size and head reuse `lid.screw`
  and `lid.head`. Sanitized like the rest; an old file has no `nut` and
  gets the default.
- **The bolt's length.** A note under the lid card (and in the warnings
  list as info): "4 × M3 × 40 bolts, 4 × M3 nuts" — the shortest standard
  length (ISO 4762 / ISO 7380 series: …16, 20, 25, 30, 35, 40, 45, 50, 60,
  70, 80, 90, 100) that goes through the nut fully, and how far its end
  stands out. Longer than 100 mm: a warning (threaded rod or a lower case).
  See Q3 for whether the pocket follows that length.
- **Printing.** The body prints on its far face (opening up), the column is
  vertical: no supports. A recessed pocket is on the bed: its ceiling over
  the bolt's hole is a bridge, exactly like a counterbore in the lid today.
- **What the view shows.** See Q4.

## Decisions (2026-11-05, with the user)

- **Q1. Where.** A top or bottom lid on a box, a cylinder and a hinged
  half; not on a console, not on a side lid (disabled there; a state that
  has it is built as screws with a note, and comes back when allowed).
  On a hinged half's inner face a flat head or a standing nut sticks into
  the closing gap: it is counted into `innerProtrusion`, so the automatic
  gap grows (the user chooses recessed seats if they want it thinner).
- **Q2. The nut's size.** A type from a table — hex DIN 934 (the `SCREWS`
  table's `nutAF/nutH`) or nyloc DIN 985 (taller) — and its across-flats
  and height overridable, with a reset to the table (like the head seat).
- **Q3. The bolt's length.** The note names the standard bolt; a recessed
  nut's pocket goes as deep as that bolt needs, so its end never stands out
  of the far face (the nut sits deeper, the column holds it). A nut on the
  face: the note only, with how far the end stands out.
- **Q4. Bolts and nuts in the view.** Drawn as grey hardware ghosts, like
  boards, in the assembled and exploded views; never in the print layout or
  an STL.

- **Q5. A standing nut on the face the case stands on** (the bottom with a
  top lid): the case stands on four nuts — a short note, no warning.
- **Q6. Bridging** over the recessed pocket: left to the slicer, as the
  counterbores today.

---

## T1. State, sanitizer, the Lid card

**Plan.**
- `FASTENINGS` gets `'through'`; `LidState.nut` with its sanitizer and
  default (`place: 'recessed'`, the size per Q2). `throughAllowed(kind,
  face)` in `lidSpec.ts`; `effectiveLid` builds `'through'` as `'screws'`
  where not allowed, with a note code (`note.throughAsScrews`).
- The Lid card: the fastening row gets "through bolts" (disabled where not
  allowed); for it the screw size, head, head diameter/depth and reset
  (the `screws` predicate widens), the nut: `#lid_nut_hex|nyloc`,
  `#lid_nutAF`, `#lid_nutH`, `#lid_nutReset` (when set),
  `#lid_nutPlace_recessed|surface`. Hole kind hidden. The nyloc's sizes
  (DIN 985: M2 4 × 2.8, M2.5 5 × 3.5, M3 5.5 × 4, M4 7 × 5 — from memory, to check against a datasheet) go into
  `fasteners.ts` next to the hex nut's.
- i18n: `fastening.through`, the nut's labels and hints, the note — four
  dictionaries via `scripts/i18n.mjs`.

**Tests.** The sanitizer (fuzzed with the rest in `tests/state.test.ts`;
an old file without `nut`); `effectiveLid` falls back and restores; the card
shows and hides the right controls (DOM test). A row of five fastenings fits
a phone's panel (smoke shot at the phone viewport).

## T2. Geometry: columns, the hole, the nut

**Plan.**
- `fastening.ts`: `postLength` / a new `columnRange(lid, frame, plate)` —
  for `'through'` the post runs from the far plate (its middle, as the
  trimmed posts do now) to the lid plate less the fit; `postDiameter` for
  the nut pocket when recessed.
- `lip.ts` `postSolids`: a `'through'` branch — one prism for the column
  (the existing clip above the rim stays), no taper; the hole through
  everything (body column, far plate) and the lid hole + head seat (the
  screws' code, shared). The nut: a hex prism from the far face
  (`frame.depth`), its pocket depth per Q3, a flat towards the centre.
- `build.ts`: `'through'` goes the posts' way; the far plate's hole and the
  pocket are part of `postHoles` (the body), cut after the column is added.
  A bottom lid: the far plate is the top — the same code in the lid's frame.
- Hinged: each half's columns in its own build; the protrusion per Q1.

**Tests.** `tests/fastening.test.ts`: `'through'` joins every allowed
shape × face (closed, no slivers, no overlap, with the Pi); a clear line
through each column: subtracting a rod of the hole's radius − 0.05 from body
and lid leaves their volumes unchanged; the recessed pocket's hex is empty;
`tests/parting.test.ts` membranes on the new variant. Golden: two new
states (box, top lid, recessed M3 countersunk; cylinder, bottom lid, M4 on
the face), old ones untouched. `inspect.mjs` timing of both.

## T3. Checks and neighbours

**Plan.**
- `postCollisions` / `postsInOpenings`: the full column's height range
  (boards, hung boards, displays on the ceiling; ports and user cuts, and
  the vents' cutters now, since a column reaches the walls' whole height).
- The nut's seat room on the far face (`seatRoom` with the far face, `SEAT_WALL`):
  a warning when a file's nut does not fit; the nut size control stops there.
- The far face's neighbours: vents on it thinned out around the columns'
  seats; labels there keep clear of the nuts (the `heads` list gets the
  nuts on the far face); keyholes and closed keyholes' pads on it warn if
  they meet a nut's seat.
- The bolt length note (Q3), and the standing-nut note (Q5).

**Tests.** Each warning fires on a state built for it and not on the
presets (`tests/presetsBuild.test.ts` stays clean); the length table:
known case heights → known bolts.

## T4. The view (if Q4 is yes)

**Plan.** `geo/ghost.ts`-style hardware meshes (pure, no CSG): a bolt (head
by kind, shank) and a nut per column, placed with the lid in the exploded
view (the bolts lift with it, the nuts stay with the body) and in place
when assembled; not in the print layout or any STL. Hidden with
`#viewBoards` off.

**Tests.** `window.__case.drawn()` lists them in exploded/assembled and not
in print; a DOM-free test of the meshes' boxes.

## T5. Docs

`docs/lid.md`: a "Through bolts" section (where it is offered, the column,
the nut's two places, the length note, what to buy); the parameter table
gets the nut rows; `docs/limitations.md` if Q1 leaves the console and side
lids out. `CLAUDE.md`: the control ids (`#lid_fastening_through`,
`#lid_nut_*`), the invariant (a through column runs plate to plate, no
taper), the smoke's list, the "what costs what" row.

## T6. Smoke

`scripts/smoke.mjs`: through bolts on the default case (both nut places,
a head kind each), a cylinder with a bottom lid, the fallback on a console
(the note shows, back on a box), the Body and Lid exports.

## Order

T1 (state and card first: the files and fixtures move once), T2, T3, T4,
T5 with each item's docs as it lands, T6 grows with each item.

## Deviations

- **T3, the nut's limit.** Planned: the nut's across-flats slider stops
  where the nut would reach the far face's edge, and the worker clamps a
  file, as for the head seat. A recessed nut's column grows with its
  pocket, so the post slides further in and the limit never binds; only a
  nut on the face, wider than its column, can run over the edge. So no
  limit and no clamp: a warning (`warn.nutOverEdge`, `nutOverEdge`) instead.
- **T3, keyholes.** No check of their own: a column now looks for openings
  along its whole height, the extras' included, so a keyhole or the fan
  that cuts a column or its nut is reported as a post in an opening.

