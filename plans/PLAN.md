# Case Constructor — implementation plan

A web app that builds a 3D-printable enclosure for a PCB (or several) from
parameters and exports STL: pick a case shape, drop in boards from a catalog
(Raspberry Pi, Orange Pi, ESP32, Arduino, Heltec…) or describe your own, and
the app places standoffs, cuts openings for every port, splits off a lid with
snaps or screws, and adds vents, a fan seat, wall mounts and a label.

A sibling of [ClayForm](https://github.com/dmitryweiner/clayform): the same
stack, the same architectural invariants, the same way of working. What is
different is the domain — rectangular, CSG-heavy geometry instead of bodies
of revolution — and that nearly every solid here comes out of a boolean
operation.

Repository: `case-constructor`; the app is called **Case Constructor**
everywhere a person sees it. Live at
`https://dmitryweiner.github.io/case-constructor/`.

## Decisions made with the user (2026-10-21)

**Scope**

1. **Shapes, all four in v1**: box with rounded vertical edges (the base
   shape), optional fillet of the top/bottom edges, cylinder, and a console
   (sloped front panel).
2. **Case size is automatic** from the boards plus margins, with manual
   override that can only grow a side, never shrink below the minimum.
3. **Lid on any of the six faces.** Boards always stand on the floor. A
   bottom lid means the floor plate with standoffs *is* the lid and the rest
   is an upturned cup; a side lid is a wall without a floor, standoffs stay
   on the floor. Cylinder: top or bottom only. Console: any face except the
   sloped one.
4. **Lid depth is adjustable**: 0 = a flat plate with a skirt, more = the lid
   takes part of the walls. A port cutout that crosses the parting line is
   split between the two parts.
5. **Lid fastening**: snaps (skirt with bumps + groove in the wall, prints
   without supports, relies on wall spring) or screws into **corner posts
   inside the case** (the auto-size accounts for them).
6. **Three board/lid fastener styles**: plain hole for a self-tapping screw,
   hex pocket for an embedded nut, hole for a heat-set insert. M2 / M2.5 /
   M3 / M4.
7. **Boards without mounting holes** (ESP32-DevKitC, Arduino Nano, D1 mini)
   are held by **two grooved rails** along two edges.
8. **Several boards** per case, side by side and on different levels, each
   on its own standoffs from the floor; intersections are detected and
   reported as warnings.
9. **Cutouts**: side walls for edge ports, the ceiling face for upward-facing
   elements (GPIO header, display, buttons, LEDs, FPC connectors), and free
   user-defined rectangular/round cutouts on any face.
10. **Extras in v1**: ventilation (slots or hex/round grid), fan seat
    (25/30/40/50/60 mm), wall mounting (keyholes or ears), label on the lid
    (engraved or embossed text).
11. **Board catalog at release: the full list from IDEA.md, main models,
    ~30 boards**, dimensions from official mechanical drawings, each entry
    carrying its source URL. New boards are added with a Claude Code skill.
12. **No share link.** Presets live in `localStorage`; the full state is
    saved to / loaded from a JSON file. Undo/redo stays.

**Infrastructure and process**

13. Same stack as ClayForm: Vite + TypeScript + Three.js + manifold-3d (WASM
    in a worker) + vitest + Playwright smoke; GitHub Actions builds every push
    and deploys `main` to GitHub Pages.
14. **Languages: en, ru, uk, he**; auto-detected from the browser, default
    English; manual choice remembered. Hebrew is **text-only RTL**: Hebrew
    strings render right-to-left inside the usual left-to-right layout. (The
    ISO code is `he`; `iw` in IDEA.md is the deprecated alias.)
15. **Everything in English**: code comments, README, `docs/`, `PLAN.md`,
    `CLAUDE.md`, `AGENTS.md`. Conversations with the user stay in Russian.
16. Name: **Case Constructor**.
17. **Commit and push after every milestone** (CI deploys it). `npm run check`
    and `npm run smoke` before each commit. TDD: red → green → refactor,
    golden tests pin geometry.

---

## 0. Architecture

### 0.1 What comes from ClayForm (copied, not depended on)

| Module | Fate |
|---|---|
| `geo/surface.ts` (SurfaceMesh type), `geo/normals.ts`, `geo/stl.ts`, `geo/validate.ts`, `geo/bytes.ts` | as is |
| `geo/csg.ts` (manifold bridge, `CsgScope`) | as is, plus `splitByPlane`, `trimByPlane`, `extrude`, `hull` helpers |
| `geo/message.ts` (`Message = { code, params }`) | as is |
| `worker/{client,protocol,csg.worker}.ts` | adapted: jobs are `preview` and `export`, parts are `body` and `lid` |
| `state/{schema,history,presets,userPresets,presetFile}.ts` | adapted; `share.ts` dropped |
| `i18n/*` | extended to four languages, reference dictionary becomes `en.ts` |
| `ui/{dom,card,controls,presetList,progress,staticText,adjust,exportPanel}.ts` | adapted |
| `ui/markRaster.ts`, `geo/bottom.ts` (height-map relief grid) | reused for the lid label |
| `render/scene.ts` | adapted: several meshes with per-part materials, ghost boards |
| `scripts/lib/harness.mjs`, `smoke.mjs`, `snap.mjs`, configs, `deploy.yml` | as is |

Dependency versions are the latest at M0 (today: manifold-3d 3.5, three
0.186, vite 8, vitest 5, typescript-eslint 8.7). TypeScript stays on the 5.x
line unless typescript-eslint and vitest already support the 7.x native
compiler. Node 22 LTS in `.nvmrc`.

### 0.2 Invariants (carried over, verbatim in spirit)

- `src/geo/` is a pure geometry core and **never imports Three.js**.
- The core works **in millimetres**. Axis is z-up, the outer bottom of the
  floor is at z = 0; the renderer rotates to y-up.
- Everything from outside (UI, localStorage, a JSON file, a worker message)
  passes through `sanitizeState`. Sanitizers never throw and are idempotent;
  tests check both.
- **The main thread does not know about WASM.** All CSG lives in
  `src/worker/`; CI greps the main chunk for `manifold` and fails if found.
  The worker calls `sanitizeState` on every incoming message.
- Manifold objects are not garbage-collected: everything created is held in
  a `CsgScope` and released with `dispose()`.
- Visible text comes only from the `src/i18n/` dictionaries. The core and
  the worker speak in message codes.
- No `as` casts (eslint `consistent-type-assertions: never`); type guards
  instead.
- Permanent scripts with flags instead of throw-away ones (`scripts/`).

### 0.3 What is different from ClayForm

- **CSG is the main path, not the exception.** A vessel was parametric with
  CSG as garnish; a case is a shell minus thirty cutters plus posts. The
  good news: box-like solids have a few thousand triangles, and manifold
  does such booleans in milliseconds to a few tens of milliseconds. So the
  preview is the exact geometry (debounced ~250 ms), not an approximation
  — to be measured at M1 and the plan adjusted if wrong.
- **Parametric meshing is limited to primitives**: the rounded shell (a loft
  of rounded-rectangle sections), cylinders, rounded boxes for cutters,
  hex prisms for nut pockets, the label relief. Everything else is boolean
  composition.
- **Boards are data, not code.** Each catalog entry is a JSON file validated
  by a TypeScript type and a test; adding a board touches no `.ts` file.
- **Faces instead of a parting plane.** A `Face` abstraction (six faces of a
  box, the top/bottom and the curved side of a cylinder, the sloped panel of
  a console) carries a local 2D frame and the wall thickness behind it.
  Every cutout — port, vent, fan, user rectangle — is "a 2D shape on a face,
  pushed through the wall". The lid is "the part of the shell beyond a
  plane parallel to a face".

### 0.4 Coordinate conventions

- Case frame: x = width (left → right), y = depth (front → back), z =
  height. Outer bounding box starts at the origin.
- Inner cavity origin = inner front-left-bottom corner, at
  `(wall, wall, floor)`.
- Layout frame: boards are positioned relative to the bounding box of all
  board footprints. The cavity is sized to that box plus margins (auto) or
  larger (manual); the layout is centred in the cavity. This breaks the
  circular dependency between board positions and case size.
- Board frame: origin at the board's lower-left corner in the vendor's top
  view, x to the right, y up (away from the viewer). Edges: `front` (y = 0),
  `back` (y = d), `left` (x = 0), `right` (x = w). Rotation about z in
  90° steps.

---

## 1. Project structure

```
src/
  geo/                   pure geometry core (no Three.js)
    surface.ts normals.ts stl.ts validate.ts bytes.ts message.ts   ← ClayForm
    csg.ts               manifold bridge + splitByPlane/trimByPlane/extrude
    face.ts              Face: normal, 2D frame, outline, wall thickness; six box faces, cylinder side, console slope
    shell.ts             outer solid, inner solid, shell = outer − inner; rounded loft, cylinder, console
    loft.ts              rounded-rectangle section loft (the one parametric mesher)
    parting.ts           lid face + depth → body and lid solids
    lip.ts               lid skirt, snap bumps + grooves
    posts.ts             corner posts for lid screws
    fasteners.ts         screw table: tap/insert/nut sizes, head sizes, standoff diameters
    standoffs.ts         board standoffs with the three hole kinds; rails for hole-less boards
    cutters.ts           Cutter = shape on a face through the wall; rounded rect, circle
    ports.ts             board ports → cutters (edge projection, rotation, clearance)
    vents.ts fan.ts wallmount.ts label.ts
    layout.ts            auto-size, centring, collisions, warnings
    build.ts             the whole case: state → { body, lid } (worker only)
    print.ts             print layout: lid beside the body, face down
  boards/
    schema.ts            BoardDef type, sanitizeBoard, PORT_TYPES defaults
    catalog.ts           index of built-in boards (imports data/*.json)
    data/*.json          one file per board, with source URL
  state/                 schema.ts history.ts presets.ts userPresets.ts presetFile.ts
  worker/                client.ts protocol.ts csg.worker.ts
  render/scene.ts        Three.js: parts, ghost boards, exploded view
  i18n/                  index.ts en.ts ru.ts uk.ts he.ts
  ui/                    cards, controls, board picker, custom board editor, export panel
  main.ts style.css
tests/                   vitest; golden/ pins geometry
scripts/                 smoke.mjs snap.mjs board.mjs lib/harness.mjs
docs/                    user docs (README.md index, one file per feature, boards.md)
.claude/skills/add-board/SKILL.md    the add-a-board skill
.github/workflows/deploy.yml
```

---

## 2. Data model

### 2.1 Application state (v1)

```ts
interface AppState {
  version: 1;
  shape: {
    kind: 'box' | 'cylinder' | 'console';
    cornerR: number;          // vertical edges, mm (box, console)
    edgeR: number;            // top/bottom edge fillet, mm (box, cylinder); 0 = sharp
    wall: number;             // side wall thickness, default 2
    floor: number;            // floor and lid plate thickness, default 2
    auto: boolean;            // size from boards
    size: { w: number; d: number; h: number };   // manual override; clamped ≥ minimum
    margin: { side: number; top: number };       // board edge → inner wall (2), tallest part → ceiling (3)
    console: { frontH: number; backH: number };  // console only; top face slopes between them
    segments: number;         // per quarter arc for preview; export uses state.resolution
  };
  boards: BoardPlacement[];
  lid: {
    face: Face;               // 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right'
    depth: number;            // 0 = plate; walls taken by the lid, mm
    fastening: 'snaps' | 'screws';
    screw: FastenerSpec;      // size, hole kind, head style
    lip: { h: number; t: number };   // skirt height (3), thickness (wall/2, ≥ 1.2)
    fit: number;              // printing clearance for the skirt and grooves, default 0.2
  };
  vents: { on: boolean; faces: Face[]; pattern: 'slots' | 'hex' | 'round'; size: number; pitch: number; margin: number; along: 'x' | 'y' };
  fan: { on: boolean; face: Face; size: 25 | 30 | 40 | 50 | 60; x: number; y: number; screwD: number };
  wallMount: { kind: 'none' | 'keyholes' | 'ears'; spacing: number; screwD: number };
  label: { on: boolean; text: string; font: string; sizeMm: number; depth: number; raised: boolean; x: number; y: number; angle: number };
  extraCuts: { face: Face; shape: 'rect' | 'round'; x: number; y: number; w: number; h: number; r: number }[];
  exportMode: 'body' | 'lid' | 'both';   // 'both' = print layout, one STL
  resolution: number;       // segments per quarter arc for export
}

interface BoardPlacement {
  board: string;            // catalog id, or 'custom'
  custom?: BoardDef;        // only when board === 'custom'
  x: number; y: number;     // layout frame, mm
  z: number;                // PCB underside above the inner floor = standoff height
  rot: 0 | 90 | 180 | 270;
  mount: FastenerSpec;      // for 'holes' boards; rails ignore it
  cuts: Record<string, boolean>;   // port id → cut an opening (default from the port type)
}

interface FastenerSpec {
  size: 'M2' | 'M2.5' | 'M3' | 'M4';
  hole: 'tap' | 'insert' | 'nut';
  head: 'none' | 'counterbore' | 'countersunk';   // lid screws only
}
```

Sanitizers per sub-object, as in ClayForm (`defaultX()` / `sanitizeX()` next
to the type). The board list is capped (8) and every placement is checked
against the catalog; an unknown id falls back to the first catalog board.

### 2.2 Board definition (catalog JSON)

```jsonc
{
  "id": "raspberry-pi-4b",
  "name": "Raspberry Pi 4 Model B",        // proper noun, not translated
  "vendor": "Raspberry Pi",
  "kind": "sbc",                            // "sbc" | "mcu"
  "size": { "w": 85, "d": 56, "t": 1.4 },   // PCB, mm
  "mount": {
    "kind": "holes",                        // "holes" | "rails"
    "holes": [ { "x": 3.5, "y": 3.5, "d": 2.7 }, { "x": 61.5, "y": 3.5, "d": 2.7 }, … ],
    "screw": "M2.5",                        // default size
    "rails": "long"                         // rails only: which edge pair, "long" | "short"
  },
  "topHeight": 16,                          // tallest part above the PCB (auto height)
  "bottomHeight": 2,                        // tallest part below (minimum standoff)
  "ports": [
    // edge port: along = centre along that edge from the board origin corner,
    // w = width along the edge, h = height, z = bottom above the PCB top
    // (negative = below, e.g. a microSD slot), protrude = beyond the edge
    { "id": "usb-c",   "type": "usb-c",   "edge": "left", "along": 11.2, "z": 0, "protrude": 1.3 },
    { "id": "hdmi-0",  "type": "micro-hdmi", "edge": "left", "along": 26 },
    { "id": "eth",     "type": "rj45",    "edge": "right", "along": 45.75 },
    // top element: rectangle on the board, h above the PCB
    { "id": "gpio",    "type": "header-2x20", "edge": "top", "x": 32.5, "y": 52.5, "w": 51, "d": 5, "h": 8.5 },
    { "id": "act-led", "type": "led", "edge": "top", "x": 1.5, "y": 10, "d": 1.5 }
  ],
  "source": "https://datasheets.raspberrypi.com/rpi4/raspberry-pi-4-mechanical-drawing.pdf",
  "verified": true                          // dimensions checked against the drawing
}
```

`PORT_TYPES` (in `boards/schema.ts`) gives each type its default `w`, `h`,
`clearance`, `shape` (rect / round) and `cut` default: `usb-a`, `usb-c`,
`micro-usb`, `mini-usb`, `usb-b`, `hdmi`, `mini-hdmi`, `micro-hdmi`, `rj45`,
`audio-3.5`, `dc-jack-5.5`, `microsd`, `sd`, `sma`, `header-2x20`,
`header-1xN` (parametric), `display`, `button`, `led`, `fpc` (camera/display
ribbon), `switch`, `antenna`, `generic`. A board entry may override any
field. The sanitizer fills defaults, so a JSON line like the `hdmi-0` above
is complete.

Validation (`tests/boards.test.ts`, every data file): unique ids, holes
inside the outline, edge ports within the edge, top elements within the
outline, finite positive sizes, source URL present, `verified` boolean.
Unverified boards are shown in the picker with a mark and a hint.

### 2.3 Fastener table (`geo/fasteners.ts`, defaults in mm)

| Size | Tap hole | Heat-set insert hole | Nut across flats | Nut height | Pan head Ø | Head height |
|---|---|---|---|---|---|---|
| M2 | 1.7 | 3.2 | 4.0 | 1.6 | 3.8 | 1.3 |
| M2.5 | 2.2 | 3.5 | 5.0 | 2.0 | 4.5 | 1.7 |
| M3 | 2.6 | 4.0 | 5.5 | 2.4 | 5.5 | 2.0 |
| M4 | 3.5 | 5.6 | 7.0 | 3.2 | 7.0 | 2.6 |

Standoff/post diameter = hole + 2 × 1.6 (minimum 5); with a nut pocket,
across-flats + 0.4 + 2 × 1.6. Nut pocket depth = nut height + 0.4, with a side
slot of the same width through the standoff wall so the nut slides in; the
pocket sits 2 mm above the floor so the screw tip has room. The insert hole is
the insert length deep (4 / 4 / 5 / 6 mm) with a 0.5 mm chamfer. A global
`holeComp` is not a parameter: the fit clearance covers it, and the table is
the place to tune.

---

## 3. Geometry

### 3.1 Shell (`loft.ts`, `shell.ts`)

The outer solid is a **loft of rounded-rectangle sections**: a ring of
vertices per z-level, the same vertex count on every ring, quads between
rings, fan caps at both ends. A section at height z has half-sizes
`(w/2 − inset, d/2 − inset)` and corner radius `max(cornerR − inset, 0)`,
where `inset(z) = edgeR − sqrt(edgeR² − (edgeR − dz)²)` within `edgeR` of
either end and 0 elsewhere. With `edgeR = 0` the loft degenerates to a plain
extrusion. A cylinder is the same loft with `w = d = 2R`, `cornerR = R`.
A console is a box loft without edge fillet, then `trimByPlane` with the
sloped plane through the front and back heights.

The inner solid is the same generator with the wall subtracted from all
half-sizes, `cornerR − wall` and `edgeR − wall` (clamped at 0), floor
thickness from below and (for a closed ceiling) from above. Shell = outer −
inner in manifold. This is deliberately a boolean rather than a hand-built
hollow mesh: the boolean is cheap and provably watertight.

Minimum sizes: wall ≥ 1.2, floor ≥ 1.2, cornerR ≤ min(w, d)/2, edgeR ≤
min(cornerR, h/2 − 1). The sanitizer clamps; the UI shows the clamp.

### 3.2 Faces (`face.ts`)

```ts
interface FaceFrame {
  face: Face;
  origin: Vec3; u: Vec3; v: Vec3; n: Vec3;   // outward normal, 2D basis on the outer surface
  wall: number;                               // thickness behind this face
  extent: { w: number; h: number };           // flat faces; outline for cutout bounds checks
  flatRegion: Rect | null;                    // part of a box face not taken by corner arcs
}
```

A box has six frames. A cylinder has `top`, `bottom` and a curved `side`
whose frame is built per angle (`sideFrameAt(theta)`): the tangent plane at
that angle, `u` along the circumference, `v` up. The console's `top` frame is
the sloped plane; its `front` is shorter than `back`.

A cutter is `{ frame, shape, x, y, w, h, r }` → a solid: the 2D shape
extruded from `−(wall + 1)` to `+1` along `n` (through the wall with a
margin). Cutouts in the rounded corner zone of a box face are allowed but
flagged (`warn.cutInCorner`): a port there is rare and usually a placement
mistake.

### 3.3 Ports → cutters (`ports.ts`)

For each placed board, each edge port is transformed by the board rotation
and position into the case frame; its outward edge direction picks the wall
it faces (`+x → right`, etc.). The cutter rectangle: along the wall = port
width + 2 × clearance, vertical = `[z0, z0 + h]` + clearance, where
`z0 = floor + board.z + t + port.z`; corners rounded by `min(1.5, clearance)`.
For a cylinder the facing angle is the angle of the port centre, and the
cutter is built in that `sideFrameAt`. Warnings: distance from the port face
to the inner wall > 12 mm (`warn.portFar`), cutter overlaps the lid skirt
zone (`warn.cutUnderSkirt`), cutter crosses the parting plane (`info.cutSplit`).

Top elements become cutters on whichever face their normal hits (the ceiling
for a floor-mounted board). Round types (`led`, `button` round, `sma`) cut
circles; everything else rounded rectangles. Each has a `cut` toggle in the
board card, defaulting from the port type (headers, displays, FPC, LEDs cut
by default; buttons too; `generic` does not).

User `extraCuts` are cutters straight from state.

### 3.4 Standoffs and rails (`standoffs.ts`)

For a `holes` board: a cylinder per hole from the inner floor to
`board.z`, diameter from the fastener table, with the hole kind chosen for
that board. Standoffs are unioned with the body **after** the shell is cut
by the parting plane and **before** cutouts — a vent slot under a standoff
must not open it.

For a `rails` board: two rails along the chosen edge pair, from the floor to
`board.z + t + 1.2`, 3 mm thick, with a groove `t + 0.3` wide and 1.5 mm deep
at `board.z`, open at both ends and shortened 2 mm per end. The board is
inserted diagonally and clicks into the grooves; this is documented in
`docs/boards.md`. Minimum `board.z` = `bottomHeight` + 1 for both kinds.

### 3.5 Parting and lid (`parting.ts`, `lip.ts`, `posts.ts`)

The parting plane is parallel to the lid face at `plateThickness + depth`
from the outer surface. `splitByPlane` gives the raw lid and body. Then:

- **Skirt**: a ring (inner outline of the shell at the parting plane, offset
  inward by `fit`, thickness `lip.t`, height `lip.h`) unioned to the lid
  along `−n`. For the cylinder the ring is a circle; for the console's side
  faces a rectangle; the sloped face cannot be a lid in v1.
- **Snaps**: half-cylinder bumps (r 0.6, length 10) on the outside of the
  skirt at `lip.h − 1.5`, two per side longer than 40 mm, one otherwise
  (cylinder: four at 90°). The body gets matching grooves enlarged by `fit`.
  Both are booleans with the same bump primitive, so bump and groove cannot
  drift apart.
- **Screws**: a post in every corner of the open face (quarter-rounded
  column hugging the two adjacent walls; on a cylinder, a round boss on the
  wall at four angles) from `parting − 8` to `plateInner − fit`, with the
  hole kind of `lid.screw`. The lid plate gets a through hole (screw + 0.4)
  with an optional counterbore (head Ø + 0.4, head height) or 90°
  countersink. Posts are part of the body; with `depth > 0` they rise
  through the lid cavity, inset from the lid wall by `fit`.

With a bottom lid the standoffs sit on the lid (the floor is the lid), so the
standoff pass runs on the part that owns the floor. The code decides by
geometry (which part contains the inner floor point), not by `lid.face`.

### 3.6 Extras

- **Vents** (`vents.ts`): a grid of cutters on each chosen face within the
  face's flat region minus `margin`, minus the lid skirt zone; slots
  (`size` × 4·size, rounded, along x or y), hex or round holes on a
  staggered grid of `pitch`. Cutters are unioned first, then subtracted
  once — thirty small differences cost more than one big one.
- **Fan** (`fan.ts`): a round opening of `size − 2` and four screw holes on
  the standard square (20 / 24 / 32 / 40 / 50 mm) on one face at (x, y).
- **Wall mount** (`wallmount.ts`): `keyholes` — two keyhole slots through
  the floor (head Ø + 1, slot screw Ø + 0.6, 6 mm long) at `spacing`; `ears`
  — two tabs 10 × 8 × floor on opposite sides at floor level with a hole.
  Keyholes move to the body's back wall when the floor is the lid.
- **Label** (`label.ts`): the text rasterised in the main thread
  (`ui/markRaster.ts`, fonts from `public/fonts`: Rubik carries Latin,
  Cyrillic and Hebrew; Oswald as a second face), sent to the worker as a
  `MarkRaster` like ClayForm's maker's mark, turned into a relief plate by
  the height-map grid (`geo/bottom.ts`) and unioned (raised) or subtracted
  (engraved) on the lid's outer face. Depth 0.4–1.5 mm.

### 3.7 Layout and checks (`layout.ts`)

Pure functions, tested first:

- `boardFootprints(state)` → rotated rectangles with heights.
- `requiredInner(state)` → minimum inner `w, d, h` from footprints,
  margins, standoff/rail extents and lid skirt; the effective inner size is
  `max(required, manual)` when `auto` is off.
- `collisions(state)` → list of `Message`s: board–board overlap (3D boxes),
  standoff or post through another board, board outside the cavity (cannot
  happen with auto size, can with a manual console), post colliding with a
  board (`warn.postHitsBoard`).
- `cutWarnings(cutters)` → the port warnings of §3.3.

Blocking vs warning: only a non-manifold result, an empty part, or a part
larger than the 400 mm cap blocks export (`validate.ts` + manifold status).
Everything else is a warning shown in the panel; the user is the designer.

### 3.8 Print layout (`print.ts`)

`exportMode: 'both'` writes one STL with the body as is and the lid beside
it (gap 10 mm along x), rotated so the lid's outer face is on the bed — the
skirt points up and prints without supports. A pure transform on the lid
mesh in the main thread; the preview shows the same layout when the mode is
selected.

---

## 4. Worker

Same `CsgClient` as ClayForm: one running job, one waiting, the waiting one
replaced by a fresher request; an export is never evicted by a preview.

```ts
type CsgJob =
  | { kind: 'preview'; state: AppState; segments: number; label?: MarkRaster | null }
  | { kind: 'export';  state: AppState; label?: MarkRaster | null };

interface JobPart { id: 'body' | 'lid'; positions; indices; normals; note: string; blocking: Message[] }
```

Pipeline in `geo/build.ts` (worker only): shell → split → standoffs/rails →
posts → skirt (+ bumps / grooves) → cutters (ports, extras, vents, fan,
mount, user) → label → validate each part. Progress is reported per stage
(`JobProgress`), as in ClayForm.

Expected cost (to be measured at M1 and written into `CLAUDE.md`): a box with
two boards and twenty cutters at preview segments — tens of milliseconds;
a cylinder at 64 segments per quarter with vents — a few hundred. If the
preview exceeds ~300 ms on an M1 Mac, the preview drops vents and the label
(the two most expensive and least alignment-critical) and the panel says so.

---

## 5. UI

Same layout as ClayForm: top bar, left panel of collapsible cards, 3D view,
mobile panel. Panel cards, top to bottom:

1. **Case** — three shape tiles; corner radius, edge fillet, wall, floor;
   "Size from boards" toggle with W / D / H inputs (read-only showing the
   computed size when on; clamped to the minimum when off); margins;
   console front/back heights.
2. **Boards** — one card per placed board: catalog name (or "Custom"),
   x / y / z, rotation, fastener (size, hole kind), list of ports with a cut
   checkbox each, remove. "+ Add board" opens the picker: search box, grouped
   by vendor, unverified entries marked. "+ Custom board" adds a board with
   the **custom editor**: size and thickness, mount kind, a holes table
   (x, y, Ø, add/remove), a ports table (type, edge, along / x y, size
   overrides, add/remove). A custom board is part of the state and travels
   with the JSON file; "Save as catalog JSON" downloads it in the §2.2
   format so it can be contributed.
3. **Lid** — face (six buttons, disabled where the shape forbids), depth,
   fastening, screw size / hole / head, lip height and thickness, fit.
4. **Openings** — vents card, fan card, extra cuts list (face, shape, x, y,
   size).
5. **Mounting and label** — wall mount card, label card (text, font, size,
   raised/engraved, depth, position, angle).
6. **Export** — tabs Body / Lid / Both (print layout); resolution; status
   (part sizes, warnings, audit verdict); the STL button with progress.

Top bar: Presets (built-in + user, as ClayForm's panel), save preset, open /
save JSON file (and drag-and-drop of a file onto the window), undo / redo,
view toggles (lid: assembled / lifted / hidden; boards on/off; x-ray),
language `<select>` with endonyms (English, Русский, Українська, עברית),
mobile settings button.

Preview: body and lid as separate meshes (lid slightly different shade);
boards drawn by the main thread as translucent slabs with port blocks and
hole markers — a parametric mesh, no CSG, so boards update at slider speed
while the case follows after the debounce. "Lifted" moves the lid along its
face normal by 30 mm.

Control ids follow ClayForm's scheme (`#case_wall`, `#lid_depth`,
`#board0_x`, `#board0_cut_usb-c`, `#vents_pitch`, …) and are listed in
`CLAUDE.md` for the smoke and `snap.mjs`.

---

## 6. Internationalisation

- `src/i18n/en.ts` is the reference dictionary; `Key` is derived from it.
  `ru.ts`, `uk.ts`, `he.ts` must have the same keys (`tsc`) and the same
  placeholders (test).
- Plural forms in `{n|…}` follow `Intl.PluralRules` categories in the
  language's order: en `one|other`; ru and uk `one|few|many`; he
  `one|two|other`. The test counts forms per language against
  `new Intl.PluralRules(lang).resolvedOptions().pluralCategories`.
- Detection: first of `navigator.languages` whose primary tag is one of the
  four; `localStorage` `caseconstructor_lang` wins; default `en`.
- RTL text-only: every dictionary-driven text node is rendered in an element
  with `dir="auto"`; `<html lang>` follows the language, `dir` stays `ltr`.
  Numbers, units and ids are LTR by nature. A smoke step opens the app in
  `he-IL` and checks that a known label renders and the panel is still on
  the left.
- Guard test: no Cyrillic or Hebrew letters in string literals under `src/`
  outside the dictionaries (ClayForm's guard, extended to the Hebrew block).
- Board names and vendors are not translated. Port type names, face names,
  fastener kinds, warnings, progress stages, preset names and notes are.
- Translations are written by the agent and reviewed by the user; Hebrew
  gets an explicit review pass at M8.

---

## 7. Board catalog and the add-board skill

### 7.1 Release list (~30, dimensions from official drawings)

| Vendor | Boards |
|---|---|
| Raspberry Pi | 3 Model B+, 4 Model B, 5, 3 Model A+, Zero 2 W, Pico / Pico W |
| Banana Pi | BPI-M5, BPI-M2 Zero |
| Orange Pi | Zero 3, Zero 2W, 3 LTS, 5 |
| Radxa | ROCK 5B, ROCK 4 SE, ROCK 3A, Zero 3W |
| Repka Pi | Repka Pi 3, Repka Pi 4 |
| Walnut Pi | Walnut Pi 1B |
| Espressif / ESP32 | ESP32-DevKitC V4, ESP32-S3-DevKitC-1, ESP32-C3-DevKitM-1, ESP32-CAM, Wemos D1 mini (ESP8266 / ESP32 form factor) |
| Arduino | Uno R3 / R4 (same outline), Mega 2560, Nano / Nano Every, Leonardo, Micro, Pro Mini |
| Heltec | WiFi LoRa 32 V3, Wireless Stick V3, Wireless Stick Lite V3, Wireless Tracker |

Boards that share an outline (Uno R3 / R4, Nano / Nano Every) are one entry
with aliases in `name`. Where a drawing gives no port heights, the port type
default is used and the entry stays `verified: false` until measured.

### 7.2 Skill `.claude/skills/add-board/SKILL.md`

Steps the skill prescribes:

1. Find the vendor's mechanical drawing (datasheet PDF or DXF); record the
   URL. Without an official source, use a community drawing and set
   `verified: false`.
2. Transcribe outline, thickness, holes, edge ports (type, edge, along, z,
   protrude), top elements (type, x, y, w, d, h), `topHeight`,
   `bottomHeight` into `src/boards/data/<id>.json` following §2.2 and the
   frame convention of §0.4.
3. Register the id in `src/boards/catalog.ts`.
4. `npm run boards:check` — the validator (`scripts/board.mjs --check`) and
   the vitest suite.
5. `node scripts/board.mjs --svg <id> --out shots/<id>.svg` — a dimensioned
   top view of the board with ports and holes, to compare against the
   drawing by eye (the user is asked to do it).
6. `node scripts/snap.mjs --board <id> --out shots/<id>.png` — the board in a
   default case, lid lifted.
7. Add a row to `docs/boards.md`; commit `boards: add <name>`.

The skill lives in the repository so it travels with it; `CLAUDE.md` points
to it.

---

## 8. Testing

- **vitest, TDD.** Pure functions first: sanitizers (never throw, idempotent),
  fastener table, loft sections, face frames and cutter extrusion, port
  projection with all four rotations and all six faces, layout and
  collisions, plural forms, board schema validation on every data file.
- **Geometry tests through manifold in Node**: watertight, positive volume,
  expected part count, a cutout actually opens the wall (ray through the
  port centre is unobstructed), bumps and grooves coincide within `fit`,
  posts align with lid holes.
- **Golden tests**: volume and triangle counts of the body and lid for a
  fixed set of states (default box, cylinder, console, bottom lid, screws,
  snaps, two boards, each extra on); `UPDATE_GOLDEN=1` to regenerate
  knowingly.
- **Smoke (Playwright)**: boot, each shape, add a board from the picker,
  each lid face and fastening, each extra, custom board editor, export of
  each mode with real download, preset save/load, JSON file round trip,
  undo/redo, mobile panel, all four languages (switch, memory, `he-IL`
  rendering). Console errors fail the run.
- **CI**: `npm run check` (tsc + eslint + vitest), `npm run build`, grep the
  main chunk for `manifold`, deploy `dist/` to Pages on `main`.

---

## 9. Milestones

Each milestone ends with `npm run check`, `npm run smoke`, a commit and a
push; CI deploys. New visible text lands in all four dictionaries in the same
commit; new features get their `docs/` page in the same commit.

- **M0 — Scaffold.** Repo from the ClayForm pattern: configs, `deploy.yml`,
  `.nvmrc`, eslint without `as`, `CLAUDE.md`, `AGENTS.md`, `docs/README.md`,
  README. `geo/` core modules copied, `csg.ts` with the new helpers, worker
  skeleton, `CsgClient`, scene, i18n with four dictionaries and the plural
  test, state schema with sanitizers for `shape` and `lid`, history, presets
  (localStorage + JSON file), smoke harness. Deployed: a rounded box shell
  with a flat top lid, STL download works.
- **M1 — Shells and parting.** Loft with corner and edge radii, cylinder,
  console; shell = outer − inner; parting on any face with depth; skirt;
  print layout; validation; golden tests. **Measure** preview and export
  times and record them in `CLAUDE.md`; decide the debounce and whether the
  preview is exact.
- **M2 — Boards.** Board schema, sanitizer, catalog with four development
  boards (Pi 4B, ESP32-DevKitC, Arduino Uno, Heltec WiFi LoRa 32 V3),
  placement state, layout and auto size, standoffs with the three hole
  kinds, rails, board ghosts in the preview, collision warnings, board
  cards and the picker.
- **M3 — Cutouts.** Faces, cutters, port projection for box / cylinder /
  console, top-element cutouts, per-port toggles, user extra cuts, cutout
  warnings.
- **M4 — Lid fastening.** Snaps (bumps + grooves), screws (corner posts,
  hole kinds, head styles), bottom-lid standoff ownership, fit parameter,
  export of body / lid / both with the layout.
- **M5 — Custom board editor.** Size, mount kind, holes table, ports table,
  save as catalog JSON, round trip through the preset file.
- **M6 — Extras.** Vents, fan seat, wall mount, label (fonts, raster,
  relief, raised / engraved).
- **M7 — Catalog.** The ~30 boards of §7.1 with sources; `scripts/board.mjs`
  (`--check`, `--svg`); the add-board skill; `docs/boards.md`; smoke picks
  every catalog board once.
- **M8 — Release polish.** Built-in presets (Pi 4B desktop case, Pi Zero
  with GPIO access, ESP32 sensor box, Arduino Uno box, cylinder sensor
  puck), mobile panel, docs for every feature, README with screenshots,
  Hebrew and Ukrainian review pass, performance numbers and control ids in
  `CLAUDE.md`, "what is not in v1" written down.

---

## 10. Not in v1 (decided now, so nobody wonders later)

- A lid on the sloped face of the console.
- Edge fillet on the console; fillets on cutout edges and post tops.
- Cantilever snap hooks, hinges, sliding side panels.
- Stacked HATs sharing standoffs with the board below (each board has its
  own standoffs; a HAT is placed as a second board at its height).
- Light pipes, button caps, display bezels, battery compartments, DIN rail
  clips, rubber-foot recesses.
- Cutouts with sacrificial bridges for support-free printing of wall
  openings (openings are small; slicers bridge them).
- Share links. Multi-file export (3MF, STEP).
- Translating README or `docs/`.

## 11. Open questions (resolve while building, none block M0)

1. ~~Manifold cost of `edgeR` lofts at high segment counts on the cylinder —
   if export at 64 segments per quarter is slow, cap the export resolution
   per shape.~~ Resolved at M1: a cylinder with a 5 mm fillet at 64 segments
   builds in ~0.7 s (114k triangles); no cap.
2. Rails for a board whose chosen edge pair faces the lid (side lid):
   slide-in along the rails may be the better assembly; decide at M2 with a
   printed test.
3. Whether the heat-set insert hole should get a slight taper (some inserts
   want 0.1–0.2 mm larger at the mouth); check against a printed sample at
   M4.
4. ~~Hebrew font for the label: Rubik covers Hebrew; whether a second Hebrew
   face is worth 50 KB — decide at M6.~~ Resolved at M6: Rubik's Hebrew subset
   is 5 KB; no second face — Oswald falls back to Rubik for Hebrew letters.

---

## 12. Deviations from the plan (recorded as they happen)

The improvements after the review (I1…I9: the lid's print view, preset
names, the mobile view, mounting holes in the ghosts, arranging boards,
closed keyholes, printed screws, magnets, ears) have their own plan and
deviations: `PLAN-IMPROVEMENTS.md`.

Status: M0…M8 done. Open: question 2 (rails facing a side lid / rails and
pin headers) and question 3 (insert taper) wait for printed tests; boards
marked ≈ wait for measurements; Hebrew and Ukrainian texts got an agent
review pass and wait for the user's.


- **M0.** `shape.segments` is not in the state: the preview resolution is a
  constant in `main.ts` (12 per quarter arc); only the export resolution
  (`state.resolution`: 12 / 24 / 48 / 64) travels in a project file.
- **M0.** The loft is not meshed by hand: `loft.ts` gives the ring points and
  the worker takes their convex hull (every shell is convex). Watertight by
  construction, no special case where a radius reaches zero.
- **M0.** Every exported STL is in print orientation, the body too: with a
  bottom or side lid "the body as is" would print its closed face as a
  bridge over the whole cavity. The body stands opening up, the lid lies on
  its outer face.
- **M0.** The lid depth clamp depends on the computed case size, so it is
  applied at build time (`effectiveLid`), not in `sanitizeState`; the panel
  warns when it clamps.
- **M0.** `geo/bytes.ts` is not copied — nothing needs base64 without a
  share link. The skirt section comes from the loft formula (`section.ts`)
  rather than a mesh slice.
- **M2.** Default state: a Raspberry Pi 4B with "Size from boards" on.
- **M2.** A side lid's skirt leaves out its floor strip (it would hit the
  standoffs and rails); the band along the lid side of the floor is added to
  the cavity when the lid has depth (`lidBand`), so supports stay on the
  body. Supports are assigned to the part owning the floor under them and
  trimmed by the other part, not split by the plane.
- **M2.** Nut slots point towards the board's centre, not outwards (an
  outward slot cuts the wall by a corner standoff). The nut bore is a
  clearance hole (d + 0.4), not a tap hole: the screw must reach the nut.
- **M2.** The split runs 0.01 mm into the body (`SPLIT_OFFSET`): splitting
  exactly on the cavity ceiling left a zero-thickness membrane.
- **M2.** Open question 2 (rails facing a side lid) stays open; rails grip
  1.5 mm. The ESP32-DevKitC's soldered headers sit within the grip zone —
  noted in docs/boards.md, to be settled with a printed test.
- **M3.** Port cutouts are channels along each port's own edge normal from
  the connector face outwards, not 2D shapes projected onto a face frame: the
  same code serves the box, the cylinder (no `sideFrameAt` needed) and the
  console. Face frames are used for user cuts. Top elements are vertical
  columns starting above the element. Extra warning codes for user cuts
  (`info.extraSplit`, `warn.extraUnderSkirt`).
- **M4.** The effective lid depth is at least the walls' rounded zone (the
  inner corner radius for a side lid, the inner edge fillet for a top or
  bottom lid): with the parting plane inside it the skirt cannot touch the
  walls and snaps grip nothing. Snaps that would land in a port opening are
  dropped; posts in an opening get `warn.postInOpening`. Posts end 0.3 mm
  below the body rim where they hug the walls and rise into a deep lid only
  inside its narrowest section.
- **M4.** Board ghosts: the PCB green and its ports amber, both see-through
  (asked by the user).
- **M6.** The label is not a height-map relief (`geo/bottom.ts` is not
  copied): the raster's row runs are unioned into a CrossSection and
  extruded — exact, and no grid. Fan and label positions are offsets from
  the face's centre (they survive a change of size); user cuts keep absolute
  face coordinates. Ears always sit on the left and right; `spacing` is for
  keyholes. Vents are dropped across the skirt band, around floor supports
  and inside port openings.
- **M8.** The preview stays exact for every preset (≤ 250 ms), so nothing is
  dropped from it. On a phone the view is centred above the settings sheet.
  Slots with fully rounded ends are stadiums (hull of two circles): a
  rounded rectangle kept a 0.02 mm straight piece and slivers. The
  translation pass fixed Hebrew screw-head and keyhole terms and the
  Ukrainian word for snaps (клямки).
- **Review after M8.** The view controls moved from the top bar into the
  export card ("View and export"), with a caption over the canvas saying what
  is shown; Both is the first tab. A console with a bottom lid prints lying
  on its slope.
