# Case Constructor — improvements after a Heltec LoRa 32 V4 case (2026-10-29)

**Status: done (2026-10-29).**

Written on 2026-10-29 from the user's attempt to make a case for the Heltec
WiFi LoRa 32 V4. Items N1…N4; the order is at the end.

Same rules as PLAN.md: TDD, golden tests for new geometry (a new state per
feature, old ones untouched — except where an entry's own data changes,
regenerated knowingly), `npm run check` and `npm run smoke` before each
commit, `docs/` and all four dictionaries in the same commit, deviations
recorded at the end of this file. The work goes on the branch
`improvements-2026-10-29`, one commit (and push) per item, a pull request
after the first; the user merges.

## What the user ran into

1. **The V4 has no mounting holes.** The four Ø1.9 holes of the entry
   (`heltec-wifi-lora-32-v4.json`, `mount.kind: "holes"`, M1.6) hold the
   display, not the board: a standoff under them presses into the
   display's screws. The board is held by its edges only — rails, as the
   V3 and every other Heltec entry already are.
2. **Rails are printed into the case.** The board goes in diagonally and
   clicks into both grooves (`standoffs.ts`, `rails`): stiff on a small
   board, impossible when the case is tight or the PCB is thick, and a
   broken lip breaks the whole body. The user wants loose rails, screwed
   down.
3. **Buttons are bare holes.** A board's buttons (`type: "button"`, PRG and
   RST on the Heltec) get a hole over them; a finger does not reach a
   button 5 mm under the lid. Keyboards already have printed caps (K3b);
   the user wants the same for every board with buttons.
4. **A case cannot be lower than 20 mm** (`SIZE_MIN`, also the auto size's
   floor). A bare Heltec needs about 14.

## Decisions (2026-10-29, with the user)

- **N1.** The V4 is held by rails along its long edges; the four holes go.
- **N2.** Screwed rails for every rail. The ears are the user's choice per
  board: outwards from the rail at both ends, or along the edge past the
  rail's ends. Printed on their tops, as the battery clamp bars.
- **N3.** The keyboards' cap (flange on the button, the stem up through
  the lid), no stepped cap. Only top buttons. One "Buttons: holes | caps"
  per board, the cap controls shared with keyboards.
- **N4.** Only the height goes down to 10; width and depth stay at 20.

---

## N1. Heltec V4: held by rails

**Plan.**
- The entry: `mount: { kind: "rails", holes: [], screw: "M2", rails:
  "long" }` (front and back edges, as the V3; the pins are on those edges,
  so soldered pins give the pin bed). The four holes go out of the entry.
- Check against the datasheet's drawing (`board.mjs --svg`, `--review --only
  heltec-wifi-lora-32-v4`) that nothing under the board sits in the rails'
  strip (the display's screw heads or nuts on the underside: if they stand
  out, `bottomHeight` covers them).
- `M1.6` in `SCREWS` stays (a custom board may use it), its comment no
  longer names the V4.
- Tests: the golden state `heltec-v4-m1.6` keeps its name and is
  regenerated knowingly (the entry it builds changed); a new state
  `feather-m1.6` (a Feather on M1.6 screws) keeps the M1.6 standoffs
  pinned. `tests/ghost.test.ts` needs nothing (its outline test holds for a
  board without holes).
- Smoke: unchanged (every catalog board from the picker).

## N2. Rails on screws (every rail)

A rail printed apart, with an ear at each end, screwed down onto a post of
the case. One option for every board held by rails: catalog rails, a
custom board's, a keyboard's `hold: "rails"`, a hung board's from the
ceiling, the pin bed.

**Plan.**
- `placement.railScrews: true` (missing: printed in, as now). Shown for a
  board whose resolved mount is `rails`. The screw and its hole kind are
  the placement's `mount` (`FastenerSpec`) — the same `#board<i>_screw`
  and `#board<i>_hole_tap|insert|nut` a board with holes has (M2 by
  default, M2…M4: an M1.6 does not hold a rail); today they are hidden for
  rails, with screwed rails they show.
- Geometry (`rails.ts` pure: where the ears and posts are; `railSolids.ts`
  worker, out of `standoffs.ts`):
  - the rail: the same profile as now (bar with groove, or the pin bed),
    the same length, its bottom `RAIL_SEAT` (0.2) above the floor;
  - an ear at each end, flush with the rail's top, `RAIL_EAR_T` thick, a
    boss's diameter wide, a through hole: `placement.railEars: "out"`
    (missing) outwards from the rail's outer face (away from the board),
    or `"along"` past the rail's ends along the edge;
  - a post under each ear from the floor (`SINK`), up to the ear's bottom,
    with the hole kind's hole (`postHole`); a nut's slot points outwards
    along the ear (towards the board it would run under the rail);
  - the posts are supports (the floor's owner gets them, as now); the
    rails are a part of their own, like batteries' clamp bars: `rails`
    (floor) and, for a board hung from a plate the lid owns, `lidRails`.
- Layout: the ears and posts widen the board's footprint — on its rail
  edges (`out`) or past its other two edges (`along`) — so walls,
  alignment and the overlap checks see them; a board against the wall on
  such a side keeps the ear inside.
- Views and STL: in the exploded view the rails lift with the board; in
  the print layout and in the STL they lie on their tops (ears flat on the
  bed, the groove an overhang of `RAIL_GRIP` only), next to the clamp bars
  (`withClamps` takes them); the floor's rails go with the body (Body,
  Both), a lid's with the lid (Lid, Both).
- Warnings: the ear's head over the board's own parts or under the ceiling
  (the head stands `headH` above the ear) — `warn.railHead`; a post in an
  opening — as for lid posts.
- Tests: `tests/rails.test.ts` — ears and posts where planned for every
  edge and rotation; the rail on its posts shares no volume with the body
  (`--overlap`), the board in its grooves touches neither; zero slivers
  (`fastening.test.ts` style) on a floor and a hung board, with and without
  the pin bed; the sanitizer keeps `railScrews` only on a railed board.
  Golden: the Heltec V4 on screwed rails (body + rails), a hung one.
- Smoke: a Heltec V4, `#board0_railScrews` on, each hole kind, export Body
  and Both with the rails in the file.
- Controls: `#board<i>_railScrews` (toggle), `#board<i>_railEars_out|along`.

## N3. Printed caps over any board's buttons

The keyboards' caps (K3b: a stem through a hole, a flange under the plate)
over every top button of any board.

**Plan.**
- `placement.buttons: "caps"` (missing: holes, as now), shown for a board
  with at least one top button (`type: "button"`, `edge: "top"`) whose
  plate is over it (a floor board under a top lid or a body's top, a hung
  board). The cap parameters are the keyboards' placement fields, shared:
  `capShape`, `capR`, `capSize`, `keyFit` — the same controls
  (`#board<i>_capShape_round|square`, `#board<i>_capR`, `#board<i>_capSize`,
  `#board<i>_keyFit`), shown with caps on.
- Sizes: `capSize.ts` works on a list of keys (x, y, w, d) instead of a
  field: a board's buttons are one such list (only the ones whose opening
  is on), a field's keys another. `capSizeRange` per list.
- The cap is the keyboard's (the user): the flange on the button, the
  stem from it up through the plate and `CAP_PROUD` out of it. Its length
  from the button's top to the plate's face (`keysProud`'s rule for a
  button).
- Openings: with caps a button's hole is the stem plus the fit (as a key's
  hole, `openingsOf`'s corner), not the button plus its clearance.
- Collisions: a flange or stem over another part of the board (its box
  higher than the button) — `warn.capOverPart`, the spot on the
  cap; a flange beyond the plate's flat zone (a skirt, a rounded edge) —
  `warn.capOffPlate`.
- Caps go where the plate goes: printed and exported with the lid (Lid,
  Both), with the body when the top plate is the body's (a bottom or side
  lid), flange down in a row next to that part (`withCaps`); part role
  `cap`. The caps' info line as for keyboards (`info.buttonCaps`: how many,
  where they print).
- Tests: `tests/caps.test.ts` grows: a stepped cap is closed and its
  pusher reaches the button; caps over the Heltec's buttons under a top lid
  and a bottom lid, a hung board, a console's slope; no cap touches the lid
  or the body assembled. Golden: the Heltec V4 with button caps (the lid).
- Smoke: the Heltec V4, `#board0_buttons_caps`, a square cap, the Lid
  export carries the caps.
- Controls: `#board<i>_buttons_hole|caps`.

## N4. A case down to 10 mm high

**Plan.**
- `H_MIN = 10` for heights next to `SIZE_MIN` (20, width and depth stay):
  `size.h`, the hinged halves' `hA`/`hB`, the auto size's floor
  (`layout.ts`), the sliders (`caseCard.ts`). The console's heights are
  10 already.
- What gets tight under 20 and is checked at h = 10 and 12 on every shape
  and lid face: `edgeR` (clamped to what the height leaves), the lid depth
  (`effectiveLid`) against the walls' rounded zone, the lid posts and snaps
  (dropped or reported as now when they do not fit), the label and vents on
  a low wall. `tests/parting.test.ts` and `tests/fastening.test.ts` take a
  10 mm case.
- `floorZ` (a keyboard's default standoff "in the least case") keeps 20:
  its constant gets its own name, so keyboards do not change.
- Auto-sized cases lower than 20 now come out lower: the golden states
  that hit the old floor move; checked one by one that only those did.
- Smoke: `#case_h` at 10 with the auto size off; the auto Heltec case.

---

## Order

N1 (data, minutes), N4 (small, moves goldens — before the new ones are
added), N2, N3.

## Deviations

- **N4.** The manual height grew to the least cavity (`INNER_MIN.h`, 10
  inside), so a case could not go under 14: `INNER_MIN.h` is 6 now (what
  10 leaves inside 2 mm plates; a thicker plate grows the case).
- **N4.** A hinged half keeps 20 (`HINGED_H_MIN`, `heightMin(kind)`): an
  empty upper half sized from its boards came out 10 high, and a printed
  hinge's leaves and the side pivots did not fit its wall.
- **N4.** A sliver found on the way: in a 12–13 mm case with magnets, a lid
  post's 45° taper reached through the floor and met the outer bottom
  fillet (clipped by the outer shell, a zero-area triangle there). Posts and
  their tapers now stop in the middle of the far plate (`lip.ts`).
- **N4.** Tests that leaned on the old least case pin a 20 mm one by hand:
  `parting.test.ts`'s empty case, two keyboard tests (`keys.test.ts`).
  Goldens moved: the 17 auto cases that sat on the old 20 (each checked:
  only the body's height and volume moved; the hinged halves did not).
- **N2.** The rails are not a part of the clamp bars' kind: the bars are
  flipped as one mesh for print, and a hung board's rail flipped so would
  stand on its ears' wrong side. The worker sends each owner's rails twice:
  screwed down (`rail`, `lidRail`, drawn as clamps) and as they print
  (`railPrint`, `lidRailPrint`, each rail top down; a hung rail is the same
  solid turned, so one print pose serves both).
- **N2.** The ear's top is `EAR_DROP` (0.05) under the rail's top: on one
  plane, the pin bed's top and the ears' left zero-area triangles in the
  union.
- **N2.** Ears along the edge leave the board no wall on the other two
  edges (they would stand in it); outwards, the rail edges had none already.
- **N2.** The rails' screw select leaves out M1.6 for a catalog board on
  rails; a keyboard held by rails shows it, and the rails take an M2
  (`railScrewSpec`).
- **N2.** Not done: `warn.railHead` (the screw's head 2.45 mm over the PCB
  top, beyond the board; the top margin keeps 3 by default, so only a
  margin set under it reaches the lid) and a post in an opening. Left for
  when a case shows it.
- **N3.** Caps go with the part that has the top (`capsWithLid`: the lid
  on top, else the body), the keyboards' caps too: before, they always
  went with the lid, a bottom lid's included.
- **N3.** `warn.capOffPlate` (a flange beyond the plate's flat zone) is
  not done: the flange lies on its button, under the plate, never against
  its skirt or edge. Over a taller part next to the button:
  `warn.capOverPart`.
- **N3.** The caps' sizes take a list of keys as well as a key field
  (`CapKeys`): a board's buttons are one such list.
- **After the review (the user).** The rails' controls, the screw and the
  hole kind moved up under "Fixing" (the floor/ceiling choice), one block
  of how the board is held. "Insert" was unclear: in Russian and Ukrainian
  it is "термовставка", in Hebrew "תותב חום", and the hole kind's hint in
  every language says what each kind is (a self-tapping screw cuts its own
  thread; a brass heat-set insert melted in with a soldering iron; a hex
  nut dropped into a pocket).
- **Found, not done.** A Heltec V3 or V4 hung under a top lid (the
  picker's default for a board with a display) has its USB-C opening in the
  lid's skirt band: `warn.cutUnderSkirt`, on `main` too, before N4. A
  separate item if the user wants it (the auto height could keep edge
  openings below the skirt).
