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
  path.in.state=value` (repeatable), `--segments <n>`.
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

Case card: `#case_kind_box|cylinder|console`, `#case_cornerR`, `#case_edgeR`,
`#case_wall`, `#case_floor`, `#case_auto`, `#case_w`, `#case_diameter`,
`#case_d`, `#case_h`, `#case_frontH`, `#case_backH`.
Lid card: `#lid_face_<face>`, `#lid_depth`, `#lid_fastening_snaps|screws`,
`#lid_lipH`, `#lid_lipT`, `#lid_fit`.
Export: `#tabBody`, `#tabLid`, `#tabBoth`, `#resolution`, `#exportBtn`.
Top bar: `#presetBtn` (list `#presetList [data-preset="b:<id>"|"u:<name>"]`),
`#saveBtn`, `#fileOpenBtn`, `#fileSaveBtn`, `#fileInput`, `#undoBtn`,
`#redoBtn`, `#viewLid` (assembled / lifted / hidden), `#viewXray`,
`#langSel`, `#panelBtn`, `#panelBackdrop`.
