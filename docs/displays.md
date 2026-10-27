# Displays

A screen goes in the case face up, its front against the inside of the top,
so the picture sits right behind its window. The catalog has the displays
sold on their own in a group of their own (**Displays** in the picker; search
finds them by "display" or "screen"), and boards with a screen on them (the
CYD, the Sunton boards, T-Display) under their vendors.

## Hung from the ceiling

**Held → From the ceiling** (in the board's box) hangs a board from the top
of the case instead of standing it on the floor. Its top still faces up; the
standoffs (or the rails) come down from the top plate to the board's top,
and the screws go in from below, through the board, into them — a pilot
hole, an insert or a nut pocket near the plate, as on the floor.

- A display, or a board with a display on top, is hung when added. A
  project file from before keeps its boards where they were.
- **Gap to the ceiling** is from the board's front — the glass — to the
  inside of the top, 0.3 mm by default: the drawings and the print are only
  that exact, and a glass thicker than drawn would otherwise be pressed
  against the plate and bend the board. Less is allowed; the panel warns.
- The standoffs go to the part the top belongs to: with the lid on top,
  the lid holds the screen (it prints face down, the standoffs pointing
  up); with the lid at the bottom, the body does. In the exploded view a
  board the lid holds goes up with it.
- The case is tall enough for the hung board and everything under it: where
  a board on the floor is under a hung one, their heights add up, with the
  top margin between them.
- A part on the board's top that lands on a standoff or a rail it hangs
  from is reported, as a part under a floor board is.
- On a console the board hangs from the slope: parallel to it, the gap
  below its inside; its standoffs, rim and window go along the slope's
  normal. The console's heights rise together (the slope keeps its angle)
  until the board clears the floor and the boards under it by the top
  margin. Its tilted front and back edges cannot stand against the front
  or back wall; the left and right walls work as usual. The case is sized
  by the board's flat outline, so it is a little deeper than the tilted
  board needs.

## The window and the glass

A display part in the catalog gives two outlines: the **window** — the
active area of a TFT or OLED (the whole picture shows, the panel's black
border hides behind the plate), the visible area of a character LCD — and
the **glass** around it (the lens, the LCD module or the metal bezel).

- The window is cut through the top with its part's clearance (0.3 mm).
  On a hung board it widens 45° outwards through the plate, so the plate's
  edge does not shade the picture when you look at it from the side;
  **Chamfered window** in the board's box turns that off.
- A **rim** around the glass (0.2 mm of room, a 1.2 mm wall) comes down
  from the plate as far as the glass is thick, at most 3 mm, plus the gap.
  It locates the glass; the plate between the window and the rim hides the
  border. The rim steps aside for the board's other parts on top (a round
  panel's ribbon tail).
- The board's own standoffs step aside for the glass: a 1602's holes are
  only 1.85 mm from its bezel, so their standoffs are trimmed along it.
  Only a screw hole under the glass is reported.
- A hung board keeps clear of the rounded edge of the top (its standoffs
  and rim need the flat ceiling): the case grows with the edge radius.
  Only a board set against a wall can bring its window over the rounded
  edge; that is reported.

## Clamp bars

A panel with nothing to screw into from the front — Touch Display 2, a bare
e-paper panel, a module screwed from behind — is held by clamp bars: two
posts from the plate beyond its long edges, a printed bar across its back
along the short side (shorter and stiffer), screwed onto the posts with the
hole kind of the board's box (pilot hole, insert or nut).

- Such a panel always hangs, and lies against the plate (gap 0): the rim
  locates it, the bars hold it.
- A panel with threaded holes on its back (Touch Display 2's brackets) gets
  a bar along each row of them, with a hole for a screw into the panel.
- One without gets two bars at a fifth of its length from each end; a bar
  moves along the panel to keep off the parts on its back, and the panel
  says so when it finds no room.
- **Clamp gap**: how far the bars press into the back, −3 … 1 mm; −1 by
  default for a bare panel (room for foam tape — e-paper glass is about a
  millimetre thick, and a printed bar is not flat), 0 for one the bars are
  screwed to.
- The bars are a part of their own: with the lid when the lid holds the
  panel (the Lid tab and its STL show and export them), with the body when
  the body does; exploded, they float under the panel.

