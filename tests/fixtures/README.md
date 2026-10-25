# Test fixtures

Tiny drawings for `tests/drawing.test.ts`, each made with known boxes:

- `blocks.dxf` — a 30 × 20 outline; block PAD (2 × 2 square, Ø1 circle, on
  layer 0); block CONN (4 × 2 rectangle with PAD at (1, 1)) inserted at
  (10, 5) turned 90° on layer SILK; PAD inserted at (25, 15) scaled 2.
  Written by hand as R12 group codes.
- `two-boxes.pdf` — Chrome's print of an SVG on a 60 × 40 mm page: a 30 × 20
  outline at (5, 5), a Ø3 circle at (10, 10), a 6 × 3 box at (25, 12) (y down
  on the page). Chrome sizes the page 171.12 × 114 pt instead of 170.08 × 113.39:
  the content comes 0.6 % large, which is what `dxf.mjs --fit` is for.
  `two-boxes.svg` is `pdftocairo -svg two-boxes.pdf two-boxes.svg`, so the
  test runs where poppler is not installed (CI).
- `two-parts.step` — an assembly ASM with BOARD (vertices (0, 0, −1.6) and
  (20, 10, 0), a Ø3 circle at (3, 3)) placed at (10, 20, 0), and
  "USB-C; side" (vertices (0, 0, 0) and (4, 3, 2)) placed at (12, 25, 0)
  turned 90° about z. Written by hand.
- `tiny.brd`, `tiny.kicad_pcb` — a 30 × 20 outline with two footprints, one
  turned 90°, one on the bottom, nets on the pads.
