# Openings

## Openings for ports

Every board card lists its connectors and parts under **Openings for ports**.
A ticked one gets an opening in the case; the defaults come from the part
type — connectors, headers, displays, ribbon connectors, buttons and LEDs are
cut, antenna connectors and other parts are not.

With **Boards** and **Connector names** on (both are by default), the view puts a caption with the same name over every
port of the board ghosts (a crossed-out one has no opening), so it is easy to
tell which line of the list is which connector. A click on a caption turns
its opening on or off, like its checkbox (undo brings it back); dragging over
a caption turns the view as anywhere else. Captions that would cover each
other give way to the nearer one — turn or zoom the view to see the rest.

- A connector on a board edge gets an opening where its plug goes in: the
  size of the connector plus a clearance per side that fits a common plug
  (1.8 mm for USB-C and micro-USB, 2 mm for micro-HDMI, 0.5 mm for Ethernet,
  …), rounded at the corners. The opening follows the connector's own
  direction, so it lands correctly on a flat wall, on the round wall of a
  cylinder and on the console.
- A part on the board's top (a GPIO header, a display, a button, an LED) gets
  an opening straight above it through the ceiling — in the lid when the lid
  is on top. The board itself is never touched.

## Your own openings

**+ Add opening** in the **Openings** card adds a cut on any face:

| Control | Range | Notes |
|---|---|---|
| Face | top, bottom, front, back, left, right | on a console the top is its slope; on a cylinder the four sides are the round wall seen from that side |
| Shape | rectangle / round | |
| X, Y on the face | 0–400 mm | centre, from the lower-left corner of the face as seen from outside (for the top: seen from above, the front at the bottom; for the bottom: seen from below) |
| Width, Height / Diameter | 1–200 mm | |
| Corner radius | up to half the smaller side | rectangles |

Up to 12 openings. An opening goes through the wall only, never deeper.

## Warnings

- *… is N mm from the wall* — a connector more than 12 mm from its wall: a
  plug may not reach it. Move the board or let the case size itself.
- *… crosses the parting line* — the opening is cut in both the body and the
  lid (information, not a problem).
- *… cuts through the lid skirt* — the skirt gets a notch there, the lid
  holds a little less.
- *Opening N reaches into a rounded corner* — usually a placement mistake.
