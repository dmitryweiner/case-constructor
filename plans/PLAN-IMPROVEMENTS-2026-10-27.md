# Case Constructor — improvements after the user voice of 2026-10-27

**Status: in progress — U1, U5, U2, U4 done.**

Written on 2026-10-27 from `user-voices/27-10-2026/` (`message.md`, the
user's project `case-constructor-Корпус-1.json`, two screenshots). Items
U1…U5; the order is below the items.

Same rules as PLAN.md: TDD, golden tests for new geometry (a new state per
feature, old ones untouched), `npm run check` and `npm run smoke` before
each commit, `docs/` and all four dictionaries in the same commit,
deviations recorded at the end of this file. The work goes on the branch
`improvements-2026-10-27`, one commit (and push) per item, a pull request
after the first; the user merges (AGENTS.md).

## What the user ran into

The project: a 175 × 71 × 29 box with three custom boards — TPA3118 (an
amplifier, against all four walls), a DC-DC (all four walls), KaRadio ESP32
(the front wall, raised on 16 mm standoffs over a 13 mm underside).

1. **"The connectors of board 1 are shorter than the wall: they sit 2.3 mm
   deeper than asked."** Its ports end at the board edge (`protrude` 0,
   the custom editor's default), the wall is 2 mm and the board keeps
   `WALL_GAP` 0.3 from it: their faces are 2.3 mm inside the outer surface,
   while the board's "Connectors from the surface" is 0 (flush). True, but
   the line names neither the wall nor the board by name nor a cure. Next
   to it "Board 1 is not against its wall" — it asked for the right wall
   too, and boards 2 and 3 stand right of it; which wall and which board
   push it are not said either. The user did not understand what to fix.
2. **Every port is called "usb-c".** `+ Port` always makes `usb-c-<n>`
   (`customBoard.ts`), and a type change keeps the id. The id is in the
   captions on the model ("button · usb-c-1"), the opening toggles and the
   warnings ("usb-c-1 is 18 mm from the wall").
3. **Lid next to the body for printing.** The print layout puts the lid
   right of the body, 10 mm apart (`printLayout`): this case is 360 mm
   along x — no common bed takes it; behind the body it would be 175 × 152.
   ("в импорте" in the note means the STL export.)
4. **A cut in the wall for a part under the board.** It works — an edge
   port's `z` is the part's bottom above the PCB top, negative under the
   board, and the user found it by trying — but the editor says nothing of
   it, and the edge select's "bottom" (a part on the underside, a hole
   through the floor) reads like "a connector on the edge, under the board".

## Decisions (2026-10-27, with the user)

- **U1.** Port ids from the type (`led-1`, `button-2`); a type change
  renames an automatic id and moves its opening toggle; old files' `usb-c-N`
  on a port of another type is renamed on load. No free-text port name.
- **U2.** The "connectors recessed" line stays, as information: rewritten
  to name the board, the walls and the cure; drawn grey with ℹ, not counted
  in "N warnings". "Not against its wall" names the wall and the board that
  pushes it.
- **U3.** Every message that has a place shows there: a translucent red
  volume over the spot and a red numbered badge "⚠ 1" over it; the list
  numbers its lines the same way; hovering or tapping a line or a badge
  highlights the pair and opens the full text in a bubble at the badge. A
  toggle in the view card, "Warnings on the model", on by default.
- **U4.** In the Both export: "Lid: auto | right | behind" and a gap
  slider. Auto takes the layout whose longer side is shorter. Kept in the
  state and the project file; screws and clamp bars follow the lid as now.
  One STL as now (no separate files).
- **U5.** No new control for "under the board": the editor explains `z`
  and the sides.

---

## U1. Port ids follow the type (bug)

**Plan.**
- `+ Port`: the id is `<type>-<n>`, the first free `n` (the type is still
  usb-c, so the first is `usb-c-1`).
- Type select: when the id is automatic for the old type
  (`^<oldType>-\d+$`), it becomes `<newType>-<n>` (first free), and the
  placement's `cuts[old]` moves to `cuts[new]`. An id the user's file
  brought in that does not match is kept.
- Load: `sanitizeState`, custom boards only: a port whose id is `usb-c-<n>`
  and whose type is not `usb-c` gets `<type>-<n>` the same way, its
  `cuts` entry moved. Idempotent (the new id no longer matches), fuzzed by
  `tests/state.test.ts` as every sanitizer.
- Tests: the editor's id rule (pure helper next to `portFrom`), the
  migration on the user's file (fixture: a copy of `Корпус-1.json`, its
  ports become `button-1`, `dc-jack-5.5-1`, `led-1`, `display-1` …), cuts
  kept. Smoke: add a port, change its type, the caption and the toggle say
  the new id.

## U2. The layout messages say where and what to do

**Plan.**
- `info.portsRecessed`: one line per board for all its walls, with the
  board's name: "Board 1 «TPA3118», front and back: the connectors end at
  the board's edge and the wall is 2 mm — their faces sit 2.3 mm inside the
  outer surface. Flush: a thinner wall, or the ports' Out." When some port
  does protrude, "end at the board's edge" becomes "stick out 1.2 mm past
  the board's edge". Params: board, name, walls (translated face names),
  protrude, wall, mm.
- `warn.notAgainstWall`: "Board 1 «TPA3118» is not against the right wall:
  board 3 «KaRadio ESP32» pushes it further out. Align them on that side or
  untick “right”." The pushing board is the one whose line sets
  `inner[side]` (`caseLayout`); per wall, not per board.
- Board names in the other board messages too (`warn.boardsOverlap`,
  `warn.standoffHitsBoard`, `warn.portFar` …) where the message names a
  board, and the port's type name with its id ("led · led-1"), as the
  captions.
- Severity: a message code starting with `info.` is drawn grey with ℹ and
  left out of "N warnings" (`showWarnings`); the panel's own `info.*`
  lines (depth raised, lid face moved) follow the same rule.
- All four dictionaries; `docs/` where the messages are described.

## U3. Warnings on the model

**Plan.**
- `Message` gets an optional `spot` (`geo/message.ts`), case frame:
  `{ at: Vec3, box?: { min: Vec3, max: Vec3 }, holder: 'body' | 'lid' |
  { board: number } }` — `holder` decides how it moves in the exploded view
  and the print layout (a board's spot moves with its ghost; `heldByLid`).
  The core fills it where it knows the place:
  - layout: boards overlapping (the boxes' intersection), a standoff into a
    board (the column), not against the wall (the strip between the board's
    edge and the wall it asked for), connectors recessed (the edge's
    connector boxes up to the outer surface), a part on its support, the
    glass gap, a clamp blocked, a carried display on parts, a window in a
    corner;
  - cutouts: a port far from the wall (the port and the gap), a cut under
    the skirt, a cut in a corner, an extra under the skirt;
  - fastening: a post into a board, a post in an opening;
  - extras: the fan, keyholes, the label too big / over a screw (the
    label's box on its face).
  The rest (lid depth clamped, head sizes, the thread, the mesh audit) stay
  list-only, unnumbered.
- `main.ts` keeps messages as `Message` (with their text) instead of
  strings until they are drawn; the numbering is over the messages with a
  spot, in list order.
- Scene: a role `warn` (red, translucent, drawn over the case like the
  X-ray ghosts, no depth write) for the boxes; badges are HTML in the same
  overlay as the port captions (`#portCaptions`), red, never hidden by the
  captions' overlap rule (a caption under a badge hides instead). A tap on a
  badge toggles its bubble; hover on desktop. A hover or tap on a list line
  highlights its badge and box (brighter) and opens the bubble.
- Shown in the exploded and assembled views of Both and Body; not in the
  print layout or the Lid tab (the parts are turned there). Toggle
  `#viewWarnings` "Warnings on the model" in the view card next to
  `#viewPortNames`, kept like the other view toggles.
- Dev hook: `window.__case.warnings()` — the badges with their text,
  number and canvas position, for `snap.mjs --eval` and the smoke.
- Tests: spots of each layout message on fixed layouts (inside the case,
  the box around the place); the user's project gives its badges on the
  right wall and the front/back edges. Smoke: the user's project shows the
  badges, a hover on a line highlights one, the toggle hides them.

## U4. Lid placement in the Both STL

**Plan.**
- State: `print: { lid: 'auto' | 'right' | 'behind', gap: number }`
  (`gap` 2…50, default `PRINT_GAP_MM` 10; `auto` default), sanitized; old
  files get the defaults.
- `printLayout(body, lid, face, dims, shape, arrange)`: `right` as now;
  `behind` puts the lid at y = body depth + gap, x aligned at 0; `auto`
  computes both footprints and takes the one whose longer side is shorter
  (a tie keeps `right`). Screws go in a row after the lid in the same
  direction, clamp bars (`withClamps`) right of everything as now.
- View card, Both tab only: a segmented "Lid: auto | right | behind" and
  the gap slider (`#print_lid_auto|right|behind`, `#print_gap`); in the
  exploded/assembled view they still matter for the STL, so they stay
  enabled; the caption says "print layout: lid behind" when the print view
  is on.
- Tests: `print.ts` unit tests for each arrangement (bounds, no overlap,
  the gap), auto on 175 × 71 picks behind and on a 60 × 120 case picks
  right. Golden untouched (it pins parts, not the layout); the smoke
  exports Both with `behind`.

## U5. The editor explains Z and the sides

**Plan.**
- The edge select: front / back / left / right stay "edge: front …";
  `top` and `bottom` become "on top (hole in the lid/ceiling)" and "on the
  underside (hole in the floor)".
- Under an edge port's fields one hint line: "Z — the part's bottom above
  the board's top, mm; below zero — under the board (−t−h: right under
  it). Out — how far it sticks out past the board's edge." Under a top or
  bottom part: "X, Y — its centre on the board".
- Column headers get a `title` with the same text (desktop tooltips).
- A test that every edge port field has its hint key in all four
  dictionaries; smoke reads the hint.

## Order

U1 (bug) → U5 (text only) → U2 (messages) → U4 (print layout) → U3 (spots
on the model, the largest; it builds on U2's messages).

## Deviations (recorded as they happen)
- **U5.** The edges in the side select keep their plain names ("front"):
  "edge: front" did not fit the panel's select and was cut off. Only
  `top` / `bottom` say where the hole goes; the hint line under the fields
  explains the rest. No separate dictionary test: `Key` already makes tsc
  demand every key in all four dictionaries.
- **U2.** The board's name and the port's type travel as parameters
  (`boardName`, `aName`, `portType`, a comma list `walls`, a face `side`);
  `tm` turns them into words ("1 «TPA3118»", "LED · led-1", "front and
  back" through `Intl.ListFormat`), so no template had to change for the
  names. `boardParams` lives in `geo/message.ts`: `fastening.ts` cannot
  import it from `layout.ts` (which imports `fastening.ts`). A board off
  its wall with no other board further out (a manual size larger than the
  boards, both opposite walls asked) gets its own code,
  `warn.notAgainstWallSize`. The recessed note has two codes: connectors
  that end at the board's edge (nothing but their Out would help) and ones
  that stick out (it says the wall that brings them flush, when that wall
  is at least `WALL_MIN`). `#warnings` is a `div` of lines now (`.warn-line`,
  `.info`, a `.warn-head` with the counts); `snap.mjs` reads `innerText`.
- **U4.** The view draws the print layout with the current `state.print`,
  not the one of the last worker build: the lid's place changes no part, so
  it moves at once (the smoke caught the lag). The export lays out with the
  state it built. `bothForPrint` moved from `main.ts` into `print.ts` and
  returns where auto put the lid, for the caption. The default is auto for
  old files too: a long case's Both STL changes from side by side to behind.
