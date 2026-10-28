# Case shape and size

**Shape** — four kinds:

- **Box** — a rectangular case with rounded vertical edges.
- **Cylinder** — a round case; *Diameter* sets its width and depth.
- **Console** — a box whose top slopes from *Front height* to *Back height*
  (for a panel you look at from the front).
- **Hinged** — two boxes joined by a hinge, a clamshell: see
  [Hinged case](hinged.md).

| Parameter | Range | Default | Notes |
|---|---|---|---|
| Corner radius | 0–50 mm | 4 | vertical edges; box and console; never more than half the smaller side |
| Edge fillet | 0–20 mm | 0 | top and bottom edges; box and cylinder; never more than the corner radius or half the height |
| Wall | 1.2–6 mm | 2 | side walls |
| Floor and ceiling | 1.2–6 mm | 2 | floor and the lid plate |
| Width, Depth, Height | 20–400 mm | 100 × 70 × 35 | the **outer** size |
| Front / back height | 10–400 mm | 20 / 40 | console only |

**Size from boards** (on by default) — the smallest case that fits every
board with its protruding ports and rails, plus the margins: 2 mm from the
boards to the walls (more if the lid skirt needs it, or the corner posts of
a top or bottom lid on screws, magnets or printed screws) and 3 mm from the
tallest part to the ceiling. With it off, the case takes your size but never
shrinks below that minimum; the sliders show the size the case is actually
built at. A cylinder is sized to hold the boards' diagonal; a console raises
both heights together until its slope clears the boards. With no boards the
minimum is a small empty cavity.
