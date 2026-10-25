# Batteries

**+ Add board** lists the batteries after the boards, under *Batteries*:

| Kind | Size of one cell | Notes |
|---|---|---|
| 18650 cells | ⌀ 18.6 × 69 mm | room for a protected cell |
| 21700 cells | ⌀ 21.6 × 71 mm | |
| AA / 14500 cells | ⌀ 14.6 × 51 mm | |
| AAA / 10440 cells | ⌀ 10.6 × 45 mm | |
| Flat pack (LiPo, power bank) | your size | length 10–200, width 10–150, thickness 2–40 mm |

A battery is placed like a board: X / Y, *Above the floor* (1 mm by default),
rotation, *Against the wall*, alignment and *Arrange* take it as one, and an
overlap with a board is reported. Cells lie side by side along their length
with a 1.2 mm rib between them (1–4 cells). The case leaves 6 mm above the
battery and 8 mm in front of it and behind it for the clamp that holds it.

In the view a battery is drawn see-through, like a board: its cells as
cylinders, a pack as a block.

## How it is held

- **Cells** lie in two **cradles** on the floor (6 mm wide, near the ends of
  the cells): seats 0.3 mm larger than a cell, up to 35 % of its diameter.
- **A pack** sits between four **corner stops** (L-shaped, 1.6 mm thick, up
  to 5 mm high); raised above the floor it also stands on a pad under each
  corner.
- Over the battery go **printed clamp bars** — one, or two for cells 55 mm
  or longer — each on two posts in front of the battery and behind it. A bar
  wraps the cells by up to 30 % of their diameter; on a pack it lies flat.
- The posts take the board card's **Screw** and **Hole** (tap / insert /
  nut, as for standoffs); the bar has a through hole over each post.

| Control | Range | Default | Notes |
|---|---|---|---|
| Battery | the kinds above | — | |
| Cells | 1–4 | 2 | cells only |
| Length, width, thickness | see above | 60 × 35 × 8 | a pack only |
| Clamp presses | −3 … 1 mm | 0.3 | how far a tightened clamp presses into the battery; negative leaves that much room for a foam pad |
| Above the floor | 1–60 mm | 1 | the battery's underside; the cradles fill the room under it |

The clamps print with the body: turned over, their flat tops on the bed, to
the right of the other parts — in *Both* and in *Body* (view and STL).

## Ready-made holders

Holders with wire leads, screwed down like a board: the picker lists them
under *Battery holders* — MPD BH-18650-W (one 18650 cell), BH2AA-W and
BH4AA-W (two and four AA cells), BH2AAA-W (two AAA cells). They stand on
standoffs at their own two mounting holes (2-56 in the datasheet; M3 for the
18650 holder, M2 for the others), and the caption on each end shows where
the wires leave. No clamp is needed: the holder holds the cells.
