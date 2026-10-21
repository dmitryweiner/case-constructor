# CLAUDE.md — working notes

## Plan

`PLAN.md` — architecture and milestones M0…M8, decisions taken with the user
at the top. Deviations from the plan are recorded at its end as they happen.

## Node

Node 22 (`.nvmrc`; vitest 5 needs ≥ 22.12). The login shell has Node 20 by
default; run commands with
`export PATH=~/.local/share/fnm/node-versions/v22.23.3/installation/bin:$PATH`.

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
  lid face, cylinder/console lid restrictions, export of each mode with a real
  download (times printed), undo/redo, user preset through a reload, project
  file round trip and a foreign JSON refused, view toggles, all four
  languages (switch, memory, a fresh `he-IL` browser keeps the panel on the
  left), the mobile sheet. Browser in `en-US`. Flags: `--preview`,
  `--shots <dir>`.
- `scripts/snap.mjs` — a spot screenshot in a given state; prints status,
  audit, warnings and blockers. Waits for the worker's build. Flags: `--out`
  (required), `--preset <id>`, `--lang en|ru|uk|he`, `--set <id>=<value>`,
  `--check <id>`, `--uncheck <id>`, `--click <selector>`, `--upload
  <id>=<path>` (in command-line order), `--view`, `--clip x,y,w,h`, `--orbit
  dx,dy`, `--url <path>`, `--wait <ms>`, `--width/--height`, `--preview`.
- `scripts/inspect.mjs` — builds a case in Node (through vitest, so the same
  module resolution) and reports per part: triangles, degenerate triangles,
  watertight, volume, bbox, stage timings; `--stl <dir>` writes the raw parts.
  Flags: `--preset`, `--file <json>`, `--state '<json>'`, `--set
  path.in.state=value` (repeatable; JSON values like `boards=[]` work),
  `--segments <n>`, `--overlap` (where the assembled lid and body share
  volume, piece by piece), `--levels` (horizontal face areas per z: a
  zero-thickness membrane shows as equal up and down areas at one level),
  `--degenerate` (where the zero-area triangles are). In zsh quote JSON
  values: `--set 'boards=[]'`.
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
  (`geo/ghost.ts`, no CSG) line up with the worker's case.
- Supports (`geo/standoffs.ts`) go to the part that owns the floor under
  them (the lid when the floor is the lid), minus whatever of them would
  enter the other part; holes are drilled after the union. A deep side lid
  gets a band of extra cavity on its side (`lidBand`) so supports stay on the
  body's floor. A side lid's skirt has no floor strip (it would hit the
  supports); its cut starts at the opening's real lowest point, which an
  edge fillet lifts above the floor.
- Nut slots point towards the board's centre: pointing outwards they cut the
  wall next to a corner standoff.
- Openings (`cutters.ts`, `ports.ts`, `cut.ts`): every opening is a prism
  along an axis. An edge port is a channel from the connector's face outwards
  along the edge normal — one rule for flat, round and sloped walls, and
  nothing behind the face is touched. A top element is a vertical column from
  just above it through the ceiling. A user cut goes through the wall of its
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
  dropped; posts in an opening are reported.
- Slivers come from coincident geometry, not from manifold: a rod axis on a
  face (sink it), the web's bottom on the ceiling plane (lift it), two
  stacked prisms of one outline (build one prism and clip it), a part
  reaching `SPLIT_OFFSET` into the other part (stop short of the rim),
  unsimplified clipper offsets. `inspect.mjs --degenerate` shows where;
  `tests/fastening.test.ts` demands zero on every shape, face and fastening.
- Print layout (`print.ts`): the body with its opening up, the lid on its
  outer face; every exported STL is in print orientation.
- Visible text comes only from `src/i18n/` dictionaries; `en.ts` is the
  reference and gives `Key`. The core and the worker speak in message codes
  (`geo/message.ts`). A test fails on any Cyrillic or Hebrew in a string
  literal under `src/` outside `src/i18n/`.
- Hebrew is text-only RTL: `<html dir>` stays `ltr`; `style.css` gives every
  text element `unicode-bidi: plaintext` (= `dir="auto"`).
- No `as` casts (eslint); `as const` is allowed.

## What costs what

Measured on an M1 Mac in Node (`scripts/inspect.mjs`):

| Build | Time |
|---|---|
| default box, 24 segments, top lid | ~60 ms |
| box with fillets, side lid, 24 segments | ~140 ms |
| cylinder with 5 mm fillet, 64 segments | ~670 ms (114k triangles in the body) |
| preview in the browser (12 segments) | 10–35 ms in the worker |
| export in the browser (24 segments), click to download | ~90 ms |

Decided at M1: the preview is the exact case (same pipeline as the export,
12 segments per quarter arc), rebuilt 120 ms after the last edit. No
approximate preview is needed.

Golden tests pin volumes and triangle counts of a fixed set of states;
regenerate knowingly: `UPDATE_GOLDEN=1 npx vitest run tests/golden.test.ts`.
Add a state when a feature lands, never edit an old one.

## Control ids

Boards: `#boardAdd` opens `#boardPicker` (`#boardSearch`, rows
`#boardList [data-board="<id>"]`, `#boardPickerClose`); per board
`#board<i>_x|_y|_z`, `#board<i>_rot_0|90|180|270`, `#board<i>_screw`,
`#board<i>_hole_tap|insert|nut`, `#board<i>_remove`, port toggles
`#board<i>_cut_<portId>`. Top bar: `#viewBoards`.
Custom board: `#boardCustom`; editor ids `#board<i>_custom_name|_w|_d|_t|_topHeight|_bottomHeight`,
`#board<i>_custom_mount` (select), `_rails`, `_screw`, holes `_hole<h>_x|_y|_d|_remove`,
`_hole_add`, ports `_port<p>_type|_edge` (selects), `_port<p>_<field>`, `_port<p>_remove`,
`_port_add`, `_save`. The card rebuilds only when a custom board's structure changes
(`customSignature`), so a number input keeps its focus while typing.
Openings: `#cutAdd`; per cut `#cut<i>_face` (select), `#cut<i>_shape_rect|round`,
`#cut<i>_x|_y|_w|_d|_h|_r` (`_d` is the diameter of a round cut), `#cut<i>_remove`.
Case card: `#case_kind_box|cylinder|console`, `#case_cornerR`, `#case_edgeR`,
`#case_wall`, `#case_floor`, `#case_auto`, `#case_w`, `#case_diameter`,
`#case_d`, `#case_h`, `#case_frontH`, `#case_backH`.
Lid card: `#lid_face_<face>`, `#lid_depth`, `#lid_fastening_snaps|screws`,
`#lid_screw` (select), `#lid_hole_tap|insert|nut`,
`#lid_head_none|counterbore|countersunk` (screws only), `#lid_lipH`,
`#lid_lipT`, `#lid_fit`.
Export: `#tabBody`, `#tabLid`, `#tabBoth`, `#resolution`, `#exportBtn`.
Top bar: `#presetBtn` (list `#presetList [data-preset="b:<id>"|"u:<name>"]`),
`#saveBtn`, `#fileOpenBtn`, `#fileSaveBtn`, `#fileInput`, `#undoBtn`,
`#redoBtn`, `#viewLid` (assembled / lifted / hidden), `#viewXray`,
`#langSel`, `#panelBtn`, `#panelBackdrop`.
