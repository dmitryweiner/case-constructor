# Case Constructor — the wall mount's face, several labels on any face

**Status: done (2026-10-29).**

Written on 2026-10-29 from the user's notes. Items W1…W3 (the wall mount),
L1…L4 (labels); the order is at the end.

Same rules as PLAN.md: TDD, golden tests for new geometry (a new state per
feature, old ones untouched), `npm run check` and `npm run smoke` before
each commit, `docs/` and all four dictionaries in the same commit,
deviations recorded at the end of this file. The work goes on the branch
`mount-labels`, one commit (and push) per item, a pull request after the
first; the user merges.

## What the user ran into

1. **Keyholes jump to the back wall with a bottom lid.** `keyholeFace`
   (`extras.ts`) is the floor, or the back wall when the floor is the lid;
   the user cannot choose. Ears are always at floor level
   (`earSpecs`, `earSolids`: a tab `shape.floor` thick in the case xy), so
   a case with ears always hangs by its bottom.
2. **The label is one, and only on the lid.** `state.label` is a single
   `LabelState`, built on `lid.face` (`build.ts`, `labelPlacement`).

## Decisions (2026-10-29, with the user)

- **W.** One setting for both mounts: *the face against the wall* —
  bottom, back, front, left, right, top. Keyholes go through that face;
  ears stand flush with it, out of its neighbouring walls (today's ears are
  "bottom against the wall").
- **W.** The lid's face may be chosen: allowed, with a warning (the weight
  then hangs on the lid's fastening).
- **L.** A label goes on any flat face of the body or the lid: the
  cylinder's top and bottom only (a flat relief does not lie on its round
  wall), the console's top is its slope. A label across the parting line
  gets a warning.
- **L.** Up to 8 labels, a list like the openings: *Add label*, each with
  its own text, font, face, place and *Remove*. An old file's one label
  opens as a list of one.

---

## W1. The face against the wall (state, keyholes)

**Plan.**
- `wallMount.face: Face`. Missing in a file: `'bottom'`, but `'back'` when
  the file's lid is on the bottom, so an old file builds as it did — a
  cross-field rule in `sanitizeState` (it sees the lid), not in
  `sanitizeWallMount`.
- Faces offered (`mountFaces(kind)`): a box — all six; a console — all but
  its top (the slope); a cylinder — top, bottom, and its round wall seen
  from the four sides (keyholes through only, as today's back wall on a
  cylinder; no ears there); a hinged half — none (its wall mount is off).
  A face the shape does not allow (a shape change) is kept as the user's
  choice and built on the first allowed one, as `lid.chosen` / `lid.face`.
- `keyholeFace(lid)` goes; `keyholeCuts`, `closedKeyholes` take
  `mount.face`. The slot runs up when hanging: +v on every wall (v is up),
  +v on the top and bottom as today.
- Closed keyholes: pads on any face; feet next to them only on the bottom
  (the case stands level). The pads-on-the-bed warning generalises: pads on
  the face opposite the lid (the body prints on it).
- The owner of keyholes' pads is already "the part that owns the face's
  plate" (`build.ts`): nothing new for the lid's face.
- Warnings: `warn.mountOnLid` (the face is the lid's: its fastening holds
  the weight; with snaps — say that snaps are the weakest);
  `warn.keyholeNearStandoff` stays (any face: a hung board's support on the
  top, a side wall's port channel is `extrasCutters`' business already).
- UI (Mounting card): `#mount_face_<face>` — a row of the six faces (the
  ones not offered disabled, as the lid's), shown when the kind is not
  *none*; its hint says the slot points up.
- Tests: `tests/extras.test.ts` — keyholes on every face of every shape
  stay inside that face's flat region and point up; an old file with a
  bottom lid comes back with `face: 'back'`; the sanitizer is idempotent
  with the new field (`state.test.ts` fuzzes it). Golden: through keyholes
  on the left wall, closed keyholes on the back with a top lid, keyholes in
  a bottom lid.
- Smoke: `#mount_face` to back and to the lid's face (the warning).

## W2. Ears flush with the face against the wall

**Plan.**
- `earSpecs` works in the mount face's frame: a tab in that face's plane,
  as thick as its plate, its outer side flush with the face, standing out
  of a neighbouring wall by `EAR_LENGTH`. Bottom: exactly today's ears.
- Which walls: `ears.walls` keeps `'leftRight' | 'frontBack' | 'one'` and
  adds `'topBottom'`; `ears.wall` takes all six faces. Only pairs and
  walls next to the mount face are offered (bottom: left/right,
  front/back; back: left/right, top/bottom; …); a stale one is built on the
  first pair offered (the user's choice kept, as above). Old files mean
  the same.
- Ears at the parting line: a tab split between the parts would split its
  screw hole, so ears stay off the skirt band (`along` positions skip it);
  when the band takes the whole wall, `warn.earsOnParting`.
- Printing: a tab on a wall stands out sideways in the body's print pose;
  each ear whose underside overhangs the bed gets a 45° gusset back to its
  wall (`earGusset`), so it prints with no supports. Ears on the face that
  lies on the bed need none.
- Cylinder: ears only with the top or the bottom against the wall (round,
  evenly around, as today, at that face's level).
- Tests: every face × every wall choice: the tab touches its wall, is flush
  with the mount face, its hole clear of the cavity; closed and no slivers
  (`fastening.test.ts` style); the gusset under every overhanging ear in
  the print pose (`print.ts`). Golden: ears on the back wall, four ears on
  top and bottom walls.
- Smoke: back against the wall, ears on left/right and top/bottom.

## W3. Docs and presets

- `docs/extras.md`: the face against the wall, ears flush with it, the
  lid's warning. `ha-wall-panel` (a wall panel) — check whether it should
  hang by its back now; changing a preset is the user's call, so only
  propose it.

---

## L1. A list of labels (state, migration)

**Plan.**
- `state.labels: LabelState[]` (≤ `LABELS_MAX` = 8), each with `face`
  (the lid's face by default for a new one). `on` goes: a label in the
  list is on. `sanitizeState` reads an old `label`: `on: true` → a list of
  one on the old file's lid face; `on: false` → an empty list.
- Hinged: each half's content (`HalfContent`) carries `labels`; the upper
  half's in `state.hinge.b`. `innerProtrusion` takes the raised labels on a
  top lid face of that half.
- Presets with a label (`pi4-desktop`, `cylinder-puck`, `ha-wall-panel`,
  `esp32-sensor-box`) and the fixture `korpus-1.json` move to `labels`
  (the file's state, not its geometry: goldens of those must not move).
- Tests: the migration both ways, the limit, the fuzz; the preset test
  (no key the sanitizer drops).

## L2. Labels on any face (geometry)

**Plan.**
- Rasters: one per label, cached by (text, font, size); the job carries
  `labels: (LabelRaster | null)[]` and `labelsB` for the upper half
  (`CsgJob`, `sanitizeLabelRaster` per entry).
- Faces offered (`labelFaces(kind)`): a box — all six; a cylinder — top and
  bottom; a console — all six, the top being its slope: the label lies in
  `slopeFrame`, its region the slope's flat part.
- Placement: `labelPlacement` takes the label's face; the anchor, margin
  and offset are in that face's (u, v) as now.
- Build: each relief in its face's frame. Engraved: subtracted from both
  parts (the depth ≤ that face's plate − 0.6). Raised: split by the
  parting (the same half-space as the lid, `SPLIT_OFFSET` into the body)
  and each piece added to its part. All labels of one part are unioned
  first, then added or subtracted once.
- Warnings (per label, the spot on it; the number in the message):
  `warn.labelTooBig` (off the flat part of *its face*, not the lid),
  `warn.labelOverScrew` (on the lid's face), new `warn.labelOnParting`
  (its box crosses the skirt band), `warn.labelOverOpening` (over a port,
  a vent, the fan, a keyhole or a user cut on the same face),
  `warn.labelsOverlap`, `warn.labelOnBed` (raised on the face its part
  prints on: the letters would be the first layer).
- Tests: `tests/label.test.ts` — placement on every face of every shape
  inside its flat region; a raised label across the parting line goes to
  both parts, no shared volume (`--overlap`), no slivers. Golden: two
  labels (a raised one on the front, an engraved one on the bottom), a
  label on the console's slope.

## L3. The Labels card

**Plan.**
- The *Mounting and label* section: the label's toggled card becomes a
  list card like Openings: `#labelAdd` (disabled at 8), per label
  `#label<i>_face` (select), `#label<i>_text|_font|_size|_raised|_depth`,
  `#label<i>_anchor_<anchor>`, `#label<i>_margin`, `#label<i>_x|_y`,
  `#label<i>_turn_0|90|180|270`, `#label<i>_angle`, `#label<i>_remove`.
  The card rebuilds only when the list's length changes (focus kept while
  typing, as the custom board's card).
- Fonts still load only when a label has text.
- Smoke: the label section rewritten for the list — two labels, one on the
  front, raised; one removed; the corner and the turn as now on `label0`;
  the overlap warning.
- CLAUDE.md's control ids updated.

## L4. Docs

- `docs/extras.md`: the list, the faces, the new warnings;
  `docs/hinged.md` (labels per half).

---

## Order

W1, W2, W3, then L1 (state first: the presets and fixtures move once),
L2, L3, L4.

## Deviations

- **W1.** The face is a row of buttons (`#mount_face_<face>`), as the lid's,
  not a select: the faces a shape does not offer show disabled.
- **W1.** `warn.keyholeNearStandoff` looked at every standoff in the case
  xy, which on a wall face compared x alone (a false alarm for any standoff
  in the keyhole's column): now only the supports on that face's plate —
  floor boards' under the bottom, hung boards' under a flat top.
- **W3.** `ha-wall-panel` stays as it is: the user changes it, if at all.
- **W2.** An ear goes with the part its root is in, each ear apart (before,
  all of them went with the floor's owner): with a side lid the ear out of
  the lid's wall was the body's minus the lid — a loose piece beside it.
  Now it is the lid's, and the panel warns that the lid holds the case.
- **W2.** The ear's root reaches `2 + r` into its wall (r the rounded edge
  between the face and the wall): on a rounded edge 2 mm left the tab
  touching the case only by a sliver.
- **W2.** Goldens `ears-four-ends` and `ears-three-cylinder` moved by 8 and 2
  triangles, their volumes did not: the tab's outline is rounded in the
  face's (u, v) now, not the case's xy.
- **W2.** `warn.earOnBed`: an ear out of the face its part prints on (a
  side lid's opposite wall, the top and bottom pair on the back). Not
  built otherwise — the panel says to choose other walls.
- **W2.** The wall select (`#mount_earWall`) disables the walls the face
  has not as neighbours: the select control got `optionDisabled`.
- **W3.** The docs went with W1 and W2 (`docs/extras.md`), as every item's
  do; nothing was left for W3.
- **L1–L3.** One commit: the state's `labels` could not land without the
  card, the rasters and the build that read it.
- **L1.** An old `label` is read only when the file has no `labels` list: a
  preset is laid over the default state, which has one, so the two presets
  with a label (`pi4-desktop`, `esp32-sensor-box`) moved to `labels` in
  their files.
- **L2.** No golden for labels: the goldens build without rasters (fonts
  live in the browser), as before; `tests/extras.test.ts` builds labels from
  a raster of blocks on every face of every shape, and one across the
  parting.
- **L2.** `caseNotices` passed the whole state to `extrasWarnings`, not the
  case it was about: the upper half of a hinged case had its fan checked as
  the lower half's. It passes the case now.
- **Found.** `esp32-sensor-box` (the lid on the bottom, ears, a raised
  label on the lid) now says that the mount is on the lid held by snaps,
  and that the raised label is on the face the lid prints on. Both were so
  before; the user changes the presets.
- **After the review (the user).** The wall mount and the labels were one
  card, "Mounting and labels", and nothing tied them together. Now two: the
  Labels card in the half frame (each half has its own), the Wall mount
  card (`#mountCard`) after it — the whole case's, hidden on a hinged case,
  which hangs on no wall. Its first row, "Wall mount" under the card of the
  same name, is "Kind".
