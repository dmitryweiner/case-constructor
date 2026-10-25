# Prototypes: drawing readers from the Tier A boards

Throw-away readers that the transcription agents wrote on 2026-10-23…25.
They are kept only as the reference for B7 in
`PLAN-IMPROVEMENTS-NEW-BOARDS.md`: rewrite each one into a permanent Node
script, as a flag on an existing script where one fits (CLAUDE.md), then
delete it from here. They are not wired into npm, eslint or the tests. They
use the standard library only (Python 3, Node), and `pdftocairo` from
poppler, which the repo already uses.

| File | Reads | Gives | Used for | Becomes (B7) |
|---|---|---|---|---|
| `stepbox.py` | STEP assembly (text) | the world bbox of every part instance, from its vertices and circles; with a second argument, one part in detail | Orange Pi 5 Plus | `scripts/step.mjs` |
| `pdfboxes.mjs` | `pdftocairo -svg` output of a vector PDF | the bbox of every subpath, with fill and stroke width | ROCK 5B (holes, connector outlines) | `dxf.mjs` reading `.pdf` |
| `svg2dxf.py` | `pdftocairo -svg` output | an R12 DXF (polylines, circles) for `dxf.mjs` | Orange Pi 5 Max, 5 Pro | the same `dxf.mjs` path |
| `kpcb.py` | KiCad `.kicad_pcb` | the Edge.Cuts bbox, footprints (ref, value, position, rotation, layer, courtyard bbox), drills ≥ 2 mm | CM5 IO Board | `board.mjs --kicad` |
| `brd.py` | Eagle `.brd` (XML) | the outline bbox, holes, elements with their package bbox | Adafruit Feather (both) | `board.mjs --brd` |

Not kept, because they need packages that were installed without the user's
approval:
- **`ezdxf` (Python):** used to expand INSERT blocks of Allegro DXFs (ROCK
  4D). B7 does that in `dxf.mjs`.
- **`occt-import-js` (npm):** used to triangulate STEP models (BTT Pi holes;
  it gave 0 triangles on the ROCK 5B+ Creo export). `stepbox.py` shows that
  the text format is enough for boxes and holes. Add a STEP kernel only with
  the user's approval, and only for a file the text parser cannot read.
