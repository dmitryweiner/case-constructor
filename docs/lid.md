# Lid

**Lid on** — the face the lid sits on: top, bottom, front, back, left or
right. A cylinder has its lid on the top or the bottom; a console on any face
except its sloped top. With a bottom lid the case is an upturned cup and the
floor plate is the lid.

| Parameter | Range | Default | Notes |
|---|---|---|---|
| Lid depth | 0–60 mm | 0 | 0 = a flat plate; more = the lid takes this much of the walls. Never less than the rounded zone of the walls (the inner corner radius for a side lid, the inner edge fillet for a top or bottom lid): the parting line runs where the straight walls begin, so the skirt sits against them. Limited so the body keeps room for the skirt. The panel says when it raises or clamps the depth |
| Fastening | snaps / screws | snaps | see below |
| Screw | M2 / M2.5 / M3 / M4 | M3 | screws only |
| Hole in the posts | tap / insert / nut | tap | as for board standoffs (docs/boards.md) |
| Head | flat / counterbore / countersunk | counterbore | flat — the head sits on the lid; counterbore — a pocket the head's diameter + 0.4 mm, its height deep; countersunk — a 90° cone |
| Skirt height | 1.5–10 mm | 3 | how far the skirt drops into the body |
| Skirt thickness | 0.8–4 mm | 1.2 | |
| Fit clearance | 0–0.6 mm | 0.2 | gap between the skirt and the walls; raise it if the lid is too tight on your printer |

The skirt follows the opening of the body at the parting plane, so it fits
rounded corners and fillets and never makes an undercut.

## Snaps

Half-round bumps (0.6 mm high, 10 mm long, shorter on a small case) on the
outside of the skirt, 1.5 mm above its end; the body gets matching grooves,
grown by the fit clearance. Two per side longer than 40 mm, one otherwise; a
cylinder gets four at 90°; a side lid has none along the floor (its skirt has
no strip there — it would run into the standoffs). A snap that would land in
a port opening is left out. Snaps print without supports and rely on the
spring of the skirt and the walls.

## Screws

A post in every corner of the opening: a round boss as close to the corner as
it fits, filled out to the walls, 8 mm deep below the parting line with a 45°
taper under it (prints without supports). With a deep lid the post rises
inside the lid, a fit clearance away from its walls. The lid gets a through
hole (screw + 0.4 mm) above every post, with the chosen head seat. The skirt
steps around the posts. With "Size from boards" the case grows so the posts
clear the boards; a post that still runs into a board, or stands in the path
of a port opening, is reported.
