# Case Constructor — a hinged case

**Status: done (2026-10-29), H10–H12 after the user's review.**

Written on 2026-10-28 from the user's request: a new kind of case, two
halves joined by hinges — a clamshell (a cyberdeck, a Meshtastic
communicator with a keyboard below and a screen above, a DS-like handheld).
To be decided with the user: what the hinges are; where the cable (or
several) goes from one half to the other and the holes for it; each half
has its own lid, on its top or its bottom. Items H1…H9; the order is below
the items.

Same rules as the earlier plans: TDD, golden tests for new geometry (a new
state per feature, old ones untouched), `npm run check` and `npm run smoke`
before each commit, `docs/` and all four dictionaries in the same commit,
deviations recorded at the end of this file. The work goes on the branch
`hinged-2026-10-28` from `main`, one commit (and push) per item, a pull
request when the first item lands; the user reviews and merges.

## Decisions (2026-10-28, with the user)

- **Hinges** (Q1): integral knuckles on a pin or a screw (H3, H4), snap
  knuckles — split rings that click onto a bar, no pin (H5, Q5), a separate printed
  hinge screwed onto the walls (H7). No bought metal hinge
  (`docs/limitations.md`).
- **The cable** (Q2): a slot in each half's hinge wall between knuckle
  blocks (H6). The hidden route through a hollow barrel is the next
  iteration.
- **Keeping it closed** (Q3): magnets at the front edge, **inside** the
  case — a pocket behind a thin skin of the inner face, nothing seen from
  outside; optional (H8).
- **Parts tabs** (Q4): the same three, the meanings widened — Both = every
  part, Body = both bodies (and the hinge parts), Lid = both lids.
- **P1…P8**: proposed with the plan, not objected to.

## How it folds (the geometry everything else follows)

- **Two boxes, each a case of its own.** The lower half *A* (the base:
  keyboard, battery, the main board) and the upper half *B* (the cover:
  the screen). Each is a box in its own case frame, exactly as today:
  z up, outer bottom at z = 0, front at y = 0. Its **inner face** is its
  top: the face the other half closes onto (A's keyboard, B's screen).
- **The hinge runs along x**: on A's back edge and on B's **front** edge.
  Laid open flat, B lies behind A with both inner faces up and both frames
  pointing the same way — so B's boards are placed as one sees them on the
  open screen (x to the right, y up the screen), and a cable's x is the same
  number in both halves. Which side of the case is the hinge side is chosen
  by its width and depth (a book that opens sideways is a narrow, deep case).
- **Closed**, B lies on A upside down, turned 180° about the hinge axis,
  its inner face a gap `g` above A's (`hinge.gap`). The axis lies in that
  gap (any axis behind the back edge with a 180° fold must), behind the back
  walls by the barrel's radius plus a clearance — so the other half's edge
  clears a barrel all the way round. The barrels stand out of the inner
  faces by `g + 2r` together; how much each half takes is the **axis
  split** (P4).
- **One footprint, two heights** (P1): both halves are `w × d` (the larger
  of what each half's boards need, or the manual size); each has its own
  height (auto: what its boards need; manual: `#case_hA`, `#case_hB`).
  Corner and edge radii, wall and plate thickness are shared.
- **Lids** (the request): each half has its own lid on its **top** (the
  inner face) or its **bottom** (the outer face) — the existing lid card,
  per half, with two faces offered. Depth, fastening, skirt, everything
  else as today.

## Proposals

- **P1. A new shape kind `hinged`** (`#case_kind_hinged`), not a flag on
  the box: the case card offers it next to box, cylinder, console. A half
  is a `box` inside. The state keeps half A where a single case keeps its
  contents (`boards`, `lid`, `extraCuts`, `vents`, `fan`, `label`,
  `shape.size.h`), and half B in `state.hinge.b` (the same fields and its
  height), plus the hinge's own settings. So a box turned into a hinged case
  keeps its boards in A, and back to a box keeps B in the state (hidden),
  the way `lid.chosen` keeps a face for later. Wall mounting (keyholes,
  ears) is off for a hinged case (`docs/limitations.md`).
- **P2. A half is an ordinary case** — `halfState(state, 'a' | 'b'):
  AppState`, pure: a `box` with the shared footprint as its fixed size,
  that half's height and contents, the cable slots as extra cuts on its
  hinge wall, and the hinge's additive part (`state.half`, read only by
  the build). Layout, ghosts, cutters, warnings and the worker's
  `buildCase` run per half unchanged. The panel edits **one half at a
  time** — a switch at the top of the panel, *Lower half / Upper half*
  (`#edit_half_a|b`, a view setting like the view mode, not saved in the
  project): the boards, lid, openings and extras cards work on
  `halfState(state, edited)`, and `withHalf(state, edited, next)` writes
  their result back. No card learns about halves; their ids stay.
- **P3. The worker builds both halves** and adds the hinge to each body;
  parts carry their half (`JobPart.half`). Editing one half must not
  rebuild the other: the worker keeps the last build of each half, keyed
  by its state, and reuses it (the 300 ms preview budget of M8 holds for
  the heavier half, not for the sum).
- **P4. Printable as laid out.** Each body prints opening up (as today), so
  a half whose lid is on the **bottom** prints on its inner face — a knuckle
  sticking out of that face would hang below the bed. Integral knuckles
  (H3) are therefore built so that such a half's barrels stay within its
  height (the axis `r` under its inner face) and the other half's barrels
  take all of `g + 2r`. With **both** lids on the bottom (the usual laptop:
  a service cover under the keyboard, a back cover behind the screen)
  integral knuckles cannot be printed at all: the hinge kind falls back to
  the printed hinge on screws (H7) and the panel says why. The rule is
  `knuckleSplit(lidA, lidB)`, tested; the print layout's parts never go
  below the bed (a test).
- **P5. The gap between the halves** is automatic by default: whatever
  stands out of the two inner faces — key tops, a knob's shaft, a socket
  standing out of a lid (`keyNotes`, `plugNotes`), a raised label, printed
  caps — plus 0.5 mm; a manual gap below that is a warning naming what
  touches. Default otherwise 1 mm.
- **P6. A test that turns the hinge.** `tests/hinge.test.ts` builds both
  halves, poses B from closed to open flat in 15° steps and requires zero
  shared volume between A's and B's parts at every angle (like the thread
  test turning the screw in its hole), and the barrels' clearance at the
  closest angle.
- **P7. The view gets an angle** — `#view_angle`, 0° closed … 180° open
  flat, 110° by default; a view setting. Assembled and exploded show the
  halves at that angle (exploded: each lid lifted off its half along its
  normal); the board ghosts, port captions and warning badges move with
  their half. `ScenePart` gets a transform instead of a bare offset.
- **P8. Warnings per half.** Everything computed today is computed for each
  half and prefixed *Lower half: / Upper half:* (`Message.half`); its spot
  is posed with the half. New ones: a port or a user opening on the hinge
  wall that runs into a knuckle or a cable slot, a cable outside the
  hinge's straight edge, the gap (P5), a hinge kind that cannot be printed
  with these lids (P4).

## Items

- **H1. Two halves.** State (`hinge`, sanitizer, fuzz), `halfState`,
  `withHalf`, the shared footprint and the two heights (`caseLayout` per
  half with a fixed size), `#case_kind_hinged`, `#case_hB`, the half switch
  and the cards through the lens, a board added goes to the edited half.
  The worker builds both halves (P3, the per-half cache); the view shows
  them closed and open at a fixed angle; warnings per half (P8). Export:
  Both lays out all four parts. No hinge yet: two cases side by side.
- **H2. View and export of two halves.** The angle (P7), exploded with two
  lids, the print layout of all parts (two bodies, two lids, then the hinge
  parts, printed screws and caps in a row: `print.ts` generalised from
  body + lid to a list), the parts tabs (Q4), the caption, the part list,
  the STL names.
- **H3. Integral knuckles on a pin.** `hinge.ts` (pure): the axis, the
  blocks of knuckles along the edge (two blocks near the ends by default, or
  one along the whole edge; knuckles per block, their length, the axial
  gap), alternating A, B, A…, inside the straight part of the edge (clear
  of the corner radius), the axis split (P4). `hingeSolids.ts` (worker): a
  barrel and a web that ties it to the body's part of the hinge wall —
  never across the parting plane, so a top lid still lifts off — its
  underside at 45° so it prints without supports; the pin's hole along the
  axis through every knuckle of a block. Pins: a 1.75 mm filament (the
  default: cut, pushed in, its ends melted), or a rod/nail of a given
  diameter. The rotation test (P6). Barrel 8 mm, pin hole + 0.2 mm,
  knuckle clearance 0.4 mm by default.
- **H4. A screw for an axle.** An M2/M2.5/M3 screw through each block: the
  head's seat in one end knuckle, a hex nut's pocket in the other (the
  board standoffs' nut slots and the lid's head seats, reused). Tightened,
  it holds the screen at any angle — the friction a laptop needs.
- **H5. Snap knuckles** (Q1, Q5). No pin: the lower half's knuckles are
  joined by a printed bar on the axis, the upper half's knuckles are split
  rings that click onto it (the cones first planned cannot work: see Q5).
  PETG is advised; the ring's fit and grip wait for a test print, like the
  window's clearance.
- **H6. Cables** (Q2). Up to four, each: its x along the hinge, flat
  (width × thickness: an FFC, an IDC ribbon) or round (a diameter: a bundle,
  a USB cable), and the slot's own size when a plug has to pass through it.
  Each half gets a rounded slot in its hinge wall as close to the inner face
  as its part allows (an extra cut on that face, so both parts and the
  skirt are cut alike); the knuckles step aside from a cable's zone. A note
  gives the cable's length between the slots closed and open flat — the
  slack it needs inside.
- **H7. A printed hinge on screws** (Q1). For lids on both bottoms (P4) and
  for whoever wants the hinge replaceable: two leaves with the knuckles of
  H3 between them, printed in one piece flat on their mounting faces (the
  closed pose), knuckles joined by the cones of H5 with a print-in-place
  clearance — or with the pin of H3/H4. The leaves screw onto the hinge
  walls: holes through the leaf and the wall, a pad inside the wall with a
  tapped hole, an insert or a nut pocket (the boards' hole kinds). The pads
  are supports for the overlap checks. Part `hinge` in the STLs.
- **H8. Gap and closing** (P5, Q3). The automatic gap and its warnings.
  Magnets, optional (`#hinge_magnets`): a pair at the front corners, each
  in a boss inside its half behind the inner face's plate, the pocket open
  to the inside, a skin of `MAGNET_SKIN` (0.6 mm) left to the outside —
  nothing seen from outside; the boss goes to the part that owns that plate
  (the lid's when the lid is on top) and steps aside for the boards like a
  support. Sizes from the lid's magnet table.
- **H9. Preset, docs, smoke.** A preset (`cyberdeck-clamshell`: a Pi and a
  keyboard below, a 7″ display above; or the Meshtastic CardKB split into
  two halves), `docs/hinged.md`, `docs/limitations.md` (hinges leave its
  omissions, the bought hinge and the hollow barrel join them), smoke (the
  kind, the half switch, a board in each half, both lids top/bottom, every
  hinge kind and axle, a cable, the angle, magnets, the exports), CLAUDE.md
  (invariants and control ids), golden states per item.

## Questions (answered 2026-10-28, see Decisions)

- **Q1. Which hinges.** Asked: integral knuckles on a pin, a separate
  printed hinge on screws, a bought metal hinge, snap knuckles. Chosen: the
  first two and the snap knuckles.
- **Q2. The cable's route.** A slot in each hinge wall, or through a hollow
  barrel. Chosen: the slot.
- **Q3. Keeping it closed.** Magnets, a snap latch, nothing. Chosen:
  magnets, inside the case, optional.
- **Q4. The parts tabs.** The same three widened, or tabs per half.
  Chosen: the same three.

- **Q5. The snap's mechanism** (asked at H5). Cones into sockets need the
  lower half's end knuckles to spread along the axis by the cone's height,
  and a knuckle tied to its wall along its whole length does not. Chosen: a
  split ring (C) on a printed bar, clicked on radially.

## After the review (2026-10-29, the user)

- **H10. The half switch in the Boards card.** *Editing: Lower half /
  Upper half* moves from its own bar to the top of the Boards card (shown
  for a hinged case only). It still decides what the lid, openings and
  extras cards show.
- **H11. Knuckles on the side walls** (`hinge.place: 'back' | 'sides'`,
  confirmed: the axis stays along the back edge). On each side a pivot:
  the lower half's cheek lies on its side wall at the back corner, the
  upper half's on its own side wall over a spacer, one layer further out;
  both reach back to discs on the axis, and the axle goes through them
  across (x) — a pin, a screw, a snap. The back wall stays free for ports
  and cables. Both kinds: printed with the halves (the cheeks are
  `knuckles`) or a printed hinge screwed on (`leaves`: the cheeks are
  separate parts, pads inside the side walls). Cones (printed in place)
  stay with the back: one cheek over the other with a 0.35 mm gap does not
  print without supports. The axis lies a clearance behind the back walls
  (no barrel is there), the discs stick out of the width by two cheeks.
- **H12. Cables through the inner faces** (`cable.through: 'wall' |
  'face'`): the slot goes through the inner face's plate next to the hinge
  edge instead of the hinge wall; closed, the cable lies folded in the gap
  between the halves. The knuckles keep off its zone as before.

## Order

H1 → H2 → H3 → H4 → H5 → H6 → H7 → H8 → H9; then H10 → H12 → H11. H1 and H2 give two cases
side by side and their export; H3 is the first hinge; each later item
stands alone.

## Deviations

- **H1 (2026-10-28).** Done. Control ids follow `renderControls`:
  `#edit_half_a|b` (the plan said `#half_a|b`), `#view_angle`; the lower
  half's height is `#case_hA` (a hinged case hides `#case_h`, whose label
  says *Height*). The half's kind stays `hinged` inside `halfState` rather
  than `box`: the lid card offers a half's two faces by it, and the only
  place that asked for `box` exactly (a flared window's corner check) now
  asks for "not a cylinder or a console". `ScenePart` keeps its offset
  (P7 said a transform): the upper half's meshes are posed in the main
  thread with `transformMesh`, which costs nothing at these sizes. New
  tool: `scripts/i18n.mjs` (keys into all four dictionaries).

- **H2 (2026-10-28).** Done. The print layout was already there with H1:
  each half laid out as a single case, the upper half behind
  (`printAll`). H2 added the captions (*Both halves / Both bodies / Both
  lids*, the angle, *the upper half behind*), the part list's lines, and
  the angle greyed out in the print layout and hidden on the Lid tab.

- **H3 (2026-10-28).** Done. Two blocks are inset by the corner radius plus
  1 mm and merge into one in the middle when they do not fit 10 mm apart.
  The web's strip is the flat of the wall on the body's side of the parting
  plane, from 45° under the barrel to its top; past it the web keeps 0.2 mm
  off the wall (a box subtracted), not the lid itself — the lid is
  subtracted as well, so the parts never share volume. The knuckles are
  added after the supports and before the openings (a port through the
  hinge wall cuts them, with a warning) rather than with the additive
  extras. `inspect.mjs` and the golden test build a hinged state per half.

- **H4 (2026-10-28).** Done. M2.5 by default (an M3's nut pocket needs a
  9 mm barrel: the barrel grows to `barrelMin` when the axle needs it). The
  head's seat is a counterbore in the block's first knuckle, the nut's
  pocket a hex prism with a corner up in its last; a note says the screws
  to buy (count, size, the block's length less the head's seat).

- **H5 (2026-10-28).** Done, as a C-clip on a bar (Q5) instead of the
  planned cones. The bar is the barrel's radius less the ring's 1.4 mm
  wall and a 0.2 mm fit; the slit is 15 % narrower than the bar and opens
  outwards from the upper half's wall — closed, that is backwards, so the
  upper half goes on by being pushed back over the hinge, and its weight
  presses the ring onto the bar at any angle it stands at.

- **H6 (2026-10-28).** Done. The slot's top is 0.5 mm under the inner
  face's plate (the cut goes through the skirt as well: the common cutter
  pass), its ends rounded (a stadium). The cutters carry a source of their
  own (`cable`) and stay out of the openings' warnings; the knuckles step
  aside by 1 mm. The length note measures the straight line between the
  slots' mouths at every 5° from closed to flat. The plug's size only
  widens the slot (no separate connector model).

- **H7 (2026-10-28).** Done. Per block of knuckles one printed hinge; its
  leaves are a 2.4 mm plate on each half's hinge wall under that half's
  knuckles, the knuckles on pedestals that stop at the axis (past it, the
  turning half's pedestal ran into the other wall: the rotation test found
  it). Cones are a fourth axle, for the leaves only (`axlesFor`); the
  snap and the pin and screw axles work on leaves too. The screws: two per
  leaf and block, as near the knuckles as the body's part of the wall and
  the lid's skirt let the pads be; the plate grows down past their heads.
  The pads' boxes are checked against the boards (`leafPadWarnings`), not
  as supports. No bought hinge (decided).

- **H8 (2026-10-29).** Done. The automatic gap adds up both faces'
  protrusions (closed, they may face each other) plus 0.5 mm, 1 mm when
  nothing stands out; a manual gap under the bare protrusions is a warning.
  The magnets sit a quarter in from each side rather than at the corners
  (the lid's corner posts are there), one clearance off the wall for both
  halves so they meet, built as supports of the inner face's plate. Their
  bosses are checked against the boards' boxes.

- **H9 (2026-10-29).** Done. The preset is `meshtastic-clamshell` (the
  CardKB below, the Heltec V3 above, the Grove cable through the hinge, a
  printed hinge on M2.5 screw axles, both lids underneath, 6 × 2 magnets),
  not the 7″ cyberdeck: its parts are all in the catalog's tested presets.
  Its depth is set by hand (86 mm) so the magnets clear the CardKB, and the
  Heltec stands against the left wall with its USB-C sunk 1.5 mm into it.
  `tests/presetsBuild.test.ts` builds a hinged preset per half, its leaves
  included, and wants no hinge warnings.

- **H10 (2026-10-29).** Done. `#halfBar` is a sticky strip at the top of
  the Boards card (not a card of its own); it still drives the lid,
  openings and extras cards.

- **H12 (2026-10-29).** Done. A face slot lies inside the hinge wall at
  the same distance in both halves (the larger skirt clearance of the two),
  so closed the slots face each other and the cable crosses the gap
  straight; `CableSlot.mouth` is where the length note measures from.

- **H11 (2026-10-29).** Done. A cheek is the hull of its disc and a 6 mm
  strip on the side wall's flat by the back corner (the body's part of the
  wall); the upper half's spacer had to stand past the lower cheek's strip
  as well as the axis's clearance — with the axis split towards one half,
  the other half's cheek reaches up past the faces to its disc and ran into
  the spacer closed (the rotation test found it). Cheeks are 3.5 mm, more
  when a screw axle's head and nut sink in them. A printed hinge's upper
  cheek takes its screws through the spacer, past its own strip; the screw
  note gives one length, the shortest of the cheeks'. Openings through the
  side walls under a cheek are not warned about yet.

- **H10, the review (2026-10-29).** The switch reads *Editing: lower /
  upper* on one row (`half.a.short`, `half.b.short`); the warnings keep
  the full *Lower half: / Upper half:*.
  Then (the user, 2026-10-29) one frame instead: the Boards, Lid,
  Openings and Mounting cards stand in `#halfGroup`, framed when the case is
  hinged and headed by the one switch, sticky while they scroll.
