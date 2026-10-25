# CLAUDE.md — working notes

## Plan

`plans/PLAN.md` — architecture and milestones M0…M8, decisions taken with the user
at the top. Deviations from the plan are recorded at its end as they happen.
`plans/PLAN-IMPROVEMENTS.md` — the improvements after the review (I1…I8), same
rules.
`plans/PLAN-IMPROVEMENTS-NEW-BOARDS.md` — what the Tier A boards left (B1…B9):
done; read it only for its decisions and deviations.
`plans/PLAN-IMPROVEMENTS-2026-10-25.md` — what the user trial asked for
(R1…R8), the current plan; on the branch `improvements-2026-10-25`.

## Node

Node 22 (`.nvmrc`; vitest 5 needs ≥ 22.12). The login shell has Node 20 by
default (`fnm env` in ~/.zshrc puts it first in every command). A
SessionStart hook in `.claude/settings.local.json` exports Node 22's path
through `$CLAUDE_ENV_FILE`; without it, run commands with
`export PATH=~/.local/share/fnm/node-versions/v22.23.3/installation/bin:$PATH`.
Check with `node -v` once per session.

## Deploy

GitHub Pages is published by `.github/workflows/deploy.yml` on every push to
`main`: `npm ci`, `npm run check`, `npm run build`, a check that the main chunk
does not mention `manifold`, and the upload of `dist/`.

## Commands

```bash
npm run check     # tsc + eslint (no `as` casts) + vitest
npm run smoke     # browser smoke; --preview for the production build
npm run build     # production build → ./dist
```

## Tools: permanent scripts instead of throw-away ones

Do not write temporary Playwright/Node scripts with `cat > tmp.mjs <<EOF` —
every cycle that is tokens thrown away. Reusable plumbing lives in
`scripts/lib/harness.mjs`; a new check is **a flag on an existing script**.
3D helpers from the sibling project ClayForm (`../clayform`) may be borrowed
freely; a temporary script that turns out useful becomes a permanent one.

- `scripts/smoke.mjs` — browser smoke: every shape, slider extremes, every
  catalog board from the picker (with nut/insert holes, a rotation and its
  pins toggled), soldered pins raising the board, a family's model, port
  toggles, user openings, the custom board editor and its catalog JSON,
  board search and overlap warnings, arranging and aligning two boards (and
  undo), every lid face, cylinder/console lid restrictions, snaps and screws
  with every hole and head kind, magnets, printed screws (P4 with its
  warning, the Lid tab with the screws, a lid export), vents, fan, through
  and closed keyholes, ears by count and walls, a label in a real font,
  export of each mode with a real download (times printed), undo/redo, user
  preset through a reload, project file round trip and a foreign JSON
  refused, the view modes per parts tab and the caption (the Lid tab's lid
  on its outer face), all four languages (switch, memory, the open preset
  keeps its name, a fresh `he-IL` browser keeps the panel on the left), the
  mobile sheet (the case on screen keeps its size and proportions). Browser in
  `en-US`. Flags: `--preview`, `--shots <dir>`.
- `scripts/snap.mjs` — a spot screenshot in a given state; prints status,
  audit, warnings and blockers. Waits for the worker's build. Flags: `--out`
  (required), `--preset <id>`, `--lang en|ru|uk|he`, `--set <id>=<value>`,
  `--check <id>`, `--uncheck <id>`, `--click <selector>`, `--upload
  <id>=<path>` (in command-line order), `--panel open|hidden` (the mobile
  sheet), `--view`, `--clip x,y,w,h`, `--camera
  iso|under|top|bottom|front|back|left|right` (dev builds; use it instead of
  guessing `--orbit` values), `--orbit dx,dy`, `--url <path>`, `--wait <ms>`, `--width/--height`, `--preview`,
  `--eval '<js>'` (prints a page expression; dev builds expose
  `window.__case.state() / parts() / ghosts() / drawn() / drawnParts()` — the meshes and
  the roles actually drawn; `built()` — the worker has answered for the
  current state). On the dev server it waits for the first build and for the
  build after each action; a page reload in between (HMR while another
  process edits files) exits with code 3 instead of shooting the old page. An action on a missing or disabled control fails at
  once with exit code 2.
  A picture can lie (an open box seen from above
  looks closed under flat light): check the mesh with `--eval` or
  `inspect.mjs --levels` before believing an image.
- `scripts/inspect.mjs` — builds a case in Node (through vitest, so the same
  module resolution) and reports per part (body, lid, and the printed screw
  when there is one): triangles, degenerate triangles, watertight, volume,
  bbox, stage timings; `--stl <dir>` writes the raw parts. Manifold is lazy:
  a boolean's cost shows where its mesh is read, usually at the end.
  Flags: `--preset`, `--file <json>`, `--state '<json>'`, `--set
  path.in.state=value` (repeatable; JSON values like `boards=[]` work),
  `--segments <n>`, `--overlap` (where the assembled lid and body share
  volume, piece by piece), `--levels` (horizontal face areas per z: a
  zero-thickness membrane shows as equal up and down areas at one level),
  `--degenerate` (where the zero-area triangles are, and the first few in
  full: which vertices collapse along what). Strings need no quotes:
  `--set lid.face=bottom`. In zsh quote JSON
  values: `--set 'boards=[]'`.
- `scripts/board.mjs` — catalog tools: `--check` validates every board file
  and every variant (readable list of problems; `npm run boards:check` adds
  the vitest suite), `--svg <id> [--variant <v>] [--png]` draws the board's
  top view with holes, ports, the outline and their coordinates to compare
  against the drawing. `--format` rewrites every catalog file in the one
  layout (`scripts/lib/boardJson.mjs`; `tests/boards.test.ts` fails on any
  other) — edit entries as text, no regex scripts.
- `scripts/dxf.mjs <file.dxf|file.pdf>` — extents and circles of a vendor
  DXF or vector PDF (through `pdftocairo -svg`; `--page`, `--fit w,d` or
  `--scale` against a known size) — hole candidates, relative to the
  outline's corner. INSERT blocks are expanded (nested, moved, turned,
  scaled). `--png` renders it, `--min/--max` filter circle diameters (and box
  sizes), `--layer` picks a layer, `--layers` counts entities per layer,
  `--boxes` prints every polyline's and every block placement's bounding box
  with the block's name (component outlines: where a connector is),
  `--origin x,y` sets the board corner when the drawing is a panel with
  rails, `--flip` / `--rotate deg` turn a bottom view or a turned page into
  the catalog's top view, `--outline` prints the board's outline ready to
  paste as the entry's `"outline"` (the largest closed loop; `--tol`, `--eps`).
  Old-style POLYLINE/VERTEX (Allegro) is read. Parsing:
  `scripts/lib/drawing.mjs`, outlines `scripts/lib/outline.mjs`.
- `scripts/step.mjs <file.step>` — every part of a STEP assembly in the board
  frame (box, height above the board's top), `--part <name>` its holes,
  `--match`, `--board`, `--rotate`, `--flip`, `--up y` for a Y-up model. Text parser, no CAD kernel
  (`scripts/lib/step.mjs`).
- `scripts/board.mjs --brd <file>` / `--kicad <file>` — the footprints of an
  Eagle or KiCad layout in the board frame, with side, pad box (and its
  centre), nets and mounting holes; `--outline` as above, `--compare <id>`
  the entry's holes and size against the file's (also in `dxf.mjs`, in its
  frame after `--origin/--flip/--rotate`; `scripts/lib/compare.mjs`);
  `--match`, `--rotate`, `--flip` (`scripts/lib/pcb.mjs`). `tests/drawing.test.ts`
  reads a fixture of every format back to known boxes (`tests/fixtures/`).
- `scripts/fetch.mjs <url> | --board <id> | --all` — vendor drawings in the
  local cache `drawings/` (not committed; zips unpacked, `drawings/index.json`
  maps URL → file), downloaded once; `--file <path>` registers a file
  downloaded by hand (Google Drive asks a person), `--list`. Fetch here, not
  with curl into the scratchpad: the next session finds the same files.
- Adding a board: the skill `.claude/skills/add-board/SKILL.md` (its
  "which tool for which drawing"). No new dependencies without the user's
  explicit approval, subagents included.
- `scripts/lib/harness.mjs` — flags, a vite server on ports 5273 / 4273
  (not ClayForm's), console error collection, CPU throttle, browser locale.
  `CASE_BROWSER` overrides the chromium executable.

## Architectural invariants

- `src/geo/` is a pure geometry core and **never imports Three.js**.
- The core works **in millimetres**, z-up, the outer bottom of the case at
  z = 0, the outer bounding box from the origin. The renderer turns it y-up.
- Everything from outside (UI, localStorage, a JSON file, a worker message)
  passes `sanitizeState`. Sanitizers never throw and are idempotent
  (`tests/state.test.ts` fuzzes them). Cross-field limits that depend on the
  computed case size (lid depth) are applied at build time by
  `effectiveLid`, and the panel warns about the clamp.
- **The main thread does not know about WASM.** All CSG lives in
  `src/worker/` and the worker-only geo modules (`csg.ts`, `shell.ts`,
  `parting.ts`, `build.ts`); `main.ts` must have no import path into them.
  CI greps the main chunk for `manifold`.
- Manifold objects are not garbage-collected: hold them in a `CsgScope` and
  `dispose()`.
- Shells are convex, so a loft is built as the **convex hull of its rings**
  (`loft.ts` points → `hullOf`): watertight by construction, no degenerate
  quads where a radius collapses to zero.
- Cross-sections for the lid skirt come from the loft **formula**
  (`section.ts`), not from slicing a mesh: with a flat lid the parting plane
  is exactly the ceiling, where a mesh slice hits a coplanar face. The skirt
  follows the intersection of the cavity sections at both ends of the skirt
  — the cavity is convex, so the prism fits all the way down.
- Rounded `CrossSection.offset` results are `simplify`-ed: clipper leaves
  near-duplicate arc vertices that become zero-area slivers after extrusion
  (it blocked the export at M0).
- Every face has a rigid frame (`face.ts`): z along the outward normal, the
  face at z = 0, (u, v) as seen from outside. The lid is "the part beyond a
  plane at `plate + depth`" in that frame.
- **Never split on a face.** With a flat lid the parting plane is the cavity
  ceiling, and a split there left the body a zero-thickness membrane over
  its opening: watertight, right volume, invisible to every check — and a
  slicer prints a closed box. The cut goes `SPLIT_OFFSET` (0.01 mm) into the
  body; `tests/parting.test.ts` hunts membranes on every shape and face.
- Boards (`src/boards/`): catalog entries are JSON validated strictly by
  `tests/boards.test.ts`; placements live in the layout frame and the whole
  layout is centred in the cavity (`geo/layout.ts`, `caseLayout`). The main
  thread and the worker compute the same layout, so board ghosts
  (`geo/ghost.ts`, no CSG) line up with the worker's case. A ghost's PCB has
  its mounting holes through it (faces triangulated with `earcut`) and a pad
  ring around each, in the ports' colour.
- Supports (`geo/standoffs.ts`) go to the part that owns the floor under
  them (the lid when the floor is the lid), minus whatever of them would
  enter the other part; holes are drilled after the union. A deep side lid
  gets a band of extra cavity on its side (`lidBand`) so supports stay on the
  body's floor. A side lid's skirt has no floor strip (it would hit the
  supports); its cut starts at the opening's real lowest point, which an
  edge fillet lifts above the floor.
- Family entries (`variants`): `entryOf(placement)` is the entry as
  written, `boardOf(placement)` the variant resolved (`resolveVariant`):
  layout, ghosts, cutters and the worker only ever see the resolved board.
  The board card rebuilds when the variant changes (its cut toggles do).
- Header pins (`pins` in an entry, `pins` in the placement): an entry is the
  bare board; soldered pins raise the lowest standoff to `pins.below + 1`,
  and a rail on a pinned edge is the **pin bed** (`pinBedProfile`): one
  extruded profile, no lower lip, a shelf under the header's plastic with a
  slot for the pins.
- Nut slots point towards the board's centre: pointing outwards they cut the
  wall next to a corner standoff.
- Cutters get a few microns of different growth each (`cut.ts`,
  `JITTER_MM`): a row of headers or a vent grid shares planes, and a union
  of prisms with coplanar faces leaves slivers (the Mega found it).
- Openings (`cutters.ts`, `ports.ts`, `cut.ts`): every opening is a prism
  along an axis. An edge port is a channel from the connector's face outwards
  along the edge normal — one rule for flat, round and sloped walls, and
  nothing behind the face is touched. A top element is a vertical column from
  just above it through the ceiling; a part on the underside (`edge:
  "bottom"`), one from just below it down through the floor (with a bottom
  lid, through the lid: the common cutter pass). A user cut goes through the wall of its
  face along the face normal (deeper on a cylinder's curve; a vertical column
  on the console's slope). All cutters are unioned and subtracted once from
  each part, after the skirt, so the skirt and both halves are cut alike.
- Lid fastening (`opening.ts`, `fastening.ts` pure; `lip.ts` worker): the
  opening polygon (convex intersection of the cavity sections at the plane
  and `lip.h` below) carries the skirt, the snaps and the posts. Snap bump
  and groove are the same rod (`CutterSpec`, round) grown by the fit. The
  effective lid depth is at least the walls' rounded zone (`cornerZone`):
  inside it the opening is narrower than the cavity below and a skirt hangs
  free of the walls — snaps found that out. Snaps landing in an opening are
  dropped; posts in an opening are reported. Magnets use the screw posts
  (`postDiameter`), a pocket in each and a facing one in the lid
  (`magnetPockets`); a magnet post stops a fit below the lid's boss, and its
  corner fill stops `POST_STEP` below its top — reaching it, the top face met
  the outer corner's edge on the diagonal: slivers.
- Printed screws (`thread.ts` pure, `screwSolids.ts` worker): a single-start
  thread has one horizontal section at every height, turned 360° per pitch,
  so a thread is `CrossSection.extrude` with a twist (one slice per point and
  turn) — the screw and, grown by the fit, its hole. The worker returns one
  screw in its own frame (part `screw`); the main thread places the copies
  over the posts (`screwsInCase`) or in a row next to the lid
  (`screwsForPrint`, `lidWithScrews`), for the view and the STL alike.
  `tests/thread.test.ts` turns the screw in its hole: at the right angle it
  touches nothing, at a wrong one it runs into the thread.
- Slivers come from coincident geometry, not from manifold: a rod axis on a
  face (sink it), the web's bottom on the ceiling plane (lift it), two
  stacked prisms of one outline (build one prism and clip it), a part
  reaching `SPLIT_OFFSET` into the other part (stop short of the rim),
  unsimplified clipper offsets. `inspect.mjs --degenerate` shows where;
  `tests/fastening.test.ts` demands zero on every shape, face and fastening.
- Extras (`extras.ts` pure, `extrasSolids.ts` worker): vents, the fan seat
  and keyholes are ExtraCuts on faces and go through `extraCutters` (curved
  walls and the console's slope come for free); vents are thinned out of the
  skirt band, away from floor supports and port openings. Ears and the label
  are additive. Closed keyholes (`closedKeyholes`) are additive pads and
  feet whose pockets are cut by the worker after the pads are added (in the
  common cutter pass the pads would fill them back); vents are thinned out
  under them. The label is rasterised in the main thread
  (`ui/labelRaster.ts`, fonts in `public/fonts`, loaded lazily) and sent with
  each job (`CsgJob.label`); the worker unions the raster's row runs into a
  CrossSection and extrudes it on the lid face.
- View and export live in one card: the parts tab decides what is shown and
  exported (Both — default and first; Body with its boards; the Lid alone,
  in its print layout), the view row decides how (exploded — default,
  assembled, print layout as in the STL), and a caption over the canvas says
  it in words. Only meaningful choices are offered (`effectiveView`): Both —
  all three; Body — assembled and print layout; Lid — none: it is
  drawn as it prints and as its STL is (and no Boards).
  The chosen mode is kept, so Both brings exploded back. Before, the export
  tab silently switched the view to the print layout, and the review found
  the view toggles "did nothing".
- Print layout (`print.ts`): the body with its opening up, the lid on its
  outer face, printed screws on their heads in a row after the lid; every
  exported STL is in print orientation. A console with a bottom lid lies on
  its slope instead (opening up it would stand on an edge).
- The lid keeps the face the user chose (`lid.chosen`) next to the face it
  is built on (`lid.face`): a change of shape (`withShapeKind`,
  `lidForKind`) puts it back when the new shape allows it (box → console →
  box leaves a top lid on top). The sanitizer only checks the face against
  the shape: it cannot tell a stale choice from one to restore.
- Visible text comes only from `src/i18n/` dictionaries; `en.ts` is the
  reference and gives `Key`. The core and the worker speak in message codes
  (`geo/message.ts`). A test fails on any Cyrillic or Hebrew in a string
  literal under `src/` outside `src/i18n/`.
- Hebrew is text-only RTL: `<html dir>` stays `ltr`; `style.css` gives every
  text element `unicode-bidi: plaintext` (= `dir="auto"`).
- No `as` casts (eslint); `as const` is allowed.

## What costs what

Measured on an M1 Mac in Node (`scripts/inspect.mjs`; the worker in the
browser is within ~10 % of it):

| Build | Segments | Time | Triangles (body + lid) |
|---|---|---|---|
| default Pi 4 case (preview) | 12 | 75 ms | 6k |
| default Pi 4 case (export) | 24 | 130 ms | 12k |
| `pi4-desktop` preset (vents, posts, label) — preview | 12 | 250 ms | 20k |
| `pi4-desktop` — export | 24 | 0.5 s | 44k |
| `pi4-desktop` — finest export | 64 | 2.0 s | 150k |
| `cylinder-puck` — finest export | 64 | 1.2 s | 130k |
| default Pi 4 on printed P6 screws — preview | 12 | 230 ms | 20k + a 4.5k screw |
| printed P6 screws — export | 24 | 0.9 s | 120k + a 33k screw |
| printed P6 screws — finest export | 64 | 2.2 s | 215k + a 58k screw |

Decided at M1 and confirmed at M8: the preview is the exact case (the same
pipeline as the export, 12 segments per quarter arc), rebuilt 120 ms after
the last edit; even the heaviest preset stays under the 300 ms the plan set
as the limit, so the preview never drops vents or the label. Vent slots and
round holes are the bulk of the triangles.

Golden tests pin volumes and triangle counts of a fixed set of states;
regenerate knowingly: `UPDATE_GOLDEN=1 npx vitest run tests/golden.test.ts`
prints which states changed, were added or removed — check that only the
ones you meant moved.
Add a state when a feature lands, never edit an old one.

## Presets

Built-in presets (`src/state/presets.ts`): `pi4-desktop`, `pi-zero-gpio`,
`esp32-sensor-box`, `arduino-uno-box`, `cylinder-puck`, `plain-box`. Each is
built by `tests/presetsBuild.test.ts` (closed, no slivers, no overlap, no
layout warnings). A preset's name is one English string in `presets.ts`
(not translated: the review asked for one name); its note is the
dictionary key `preset.<id>.note`.

## What is not in v1

`docs/limitations.md` — decided omissions and known limits.

## Control ids

Boards: `#boardAdd` opens `#boardPicker` (`#boardSearch`, rows
`#boardList [data-board="<id>"]`, `#boardPickerClose`); with two boards or more
`#boardsArrange_row|column|compact` and `#boards_gap` (geo/arrange.ts);
per board
`#board<i>_x|_y|_z`, alignment (two boards or more) `#board<i>_align`
(details), `#board<i>_alignRef`,
`#board<i>_align_left|centreX|right|nextX|front|centreY|back|nextY|height`, `#board<i>_rot_0|90|180|270`, `#board<i>_screw`,
`#board<i>_hole_tap|insert|nut`, `#board<i>_pins` (boards with header rows), `#board<i>_variant` (family entries), `#board<i>_remove`, port toggles
`#board<i>_cut_<portId>`.
Custom board: `#boardCustom`; editor ids `#board<i>_custom_name|_w|_d|_t|_topHeight|_bottomHeight`,
`#board<i>_custom_mount` (select), `_rails`, `_screw`, holes `_hole<h>_x|_y|_d|_remove`,
`_hole_add`, ports `_port<p>_type|_edge` (selects), `_port<p>_<field>`, `_port<p>_remove`,
`_port_add`, `_save`. The card rebuilds only when a custom board's structure changes
(`customSignature`), so a number input keeps its focus while typing.
Extras: toggled cards `#on_vents`, `#on_fan`, `#on_label`; vents
`#vents_face_<face>` (checkboxes), `#vents_pattern_slots|hex|round`,
`#vents_along_x|y`, `#vents_size|_pitch|_margin`; fan `#fan_face` (select),
`#fan_size_25…60`, `#fan_x|_y|_screwD`; wall mount
`#mount_kind_none|keyholes|ears`, `#mount_keyhole_through|closed`, ears
`#mount_earCount_1…4`, `#mount_earWalls_leftRight|frontBack|one`,
`#mount_earWall` (select), `#mount_earAlong_centre|ends`, `#mount_spacing`, `#mount_screwD`; label
`#label_text`, `#label_font`, `#label_size`, `#label_raised`, `#label_depth`,
`#label_x|_y|_angle`.
Openings: `#cutAdd`; per cut `#cut<i>_face` (select), `#cut<i>_shape_rect|round`,
`#cut<i>_x|_y|_w|_d|_h|_r` (`_d` is the diameter of a round cut), `#cut<i>_remove`.
Case card: `#case_kind_box|cylinder|console`, `#case_cornerR`, `#case_edgeR`,
`#case_wall`, `#case_floor`, `#case_auto`, `#case_w`, `#case_diameter`,
`#case_d`, `#case_h`, `#case_frontH`, `#case_backH`.
Lid card: `#lid_face_<face>`, `#lid_depth`, `#lid_fastening_snaps|screws|magnets|printed`,
`#lid_screw` (select), `#lid_hole_tap|insert|nut`, `#lid_magnet` (select),
`#lid_magnetFit` (magnets only), `#lid_thread` (select), `#lid_threadFit`
(printed screws only),
`#lid_head_none|counterbore|countersunk` (screws only), `#lid_lipH`,
`#lid_lipT`, `#lid_fit`.
View and export card (`#exportCard`): parts `#tabBoth` (first, default),
`#tabBody`, `#tabLid`; view `#viewExploded` (default), `#viewAssembled`,
`#viewPrint`; `#viewBoards`, `#viewXray`; `#resolution`, `#exportBtn`. The
caption over the canvas `#viewCaption` says what is shown and scrolls to the
card. Dev builds: `window.__case.drawn()` lists the roles drawn last,
`drawnParts()` the meshes with their offsets.
Mobile: on a narrow screen the view centres the case above the settings
sheet (`scene.setBottomInset`): the canvas stays full size under the sheet,
and the inset only moves the picture, eased like the sheet — the virtual
frame keeps the canvas's angle per pixel (its own aspect, a wider fov).
With the canvas's aspect the picture was stretched and round holes came
out as ellipses; the smoke measures the case on screen in both states
(`window.__case.project`).
Top bar: `#presetBtn` (list `#presetList [data-preset="b:<id>"|"u:<name>"]`),
`#saveBtn`, `#fileOpenBtn`, `#fileSaveBtn`, `#fileInput`, `#undoBtn`,
`#redoBtn`,
`#langSel`, `#panelBtn`, `#panelBackdrop`.
