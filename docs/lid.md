# Lid

**Lid on** — the face the lid sits on: top, bottom, front, back, left or
right. A cylinder has its lid on the top or the bottom; a console on any face
except its sloped top. When the shape cannot have the face you chose, the
lid moves to an allowed one and the panel says so; the face you chose comes
back with a shape that allows it (box → console → box keeps a top lid on
top). With a bottom lid the case is an upturned cup and the floor plate is
the lid.

| Parameter | Range | Default | Notes |
|---|---|---|---|
| Lid depth | 0–60 mm | 0 | 0 = a flat plate; more = the lid takes this much of the walls. Never less than the rounded zone of the walls (the inner corner radius for a side lid, the inner edge fillet for a top or bottom lid): the parting line runs where the straight walls begin, so the skirt sits against them. Limited so the body keeps room for the skirt. The panel says when it raises or clamps the depth |
| Fastening | snaps / screws / magnets / printed screws | snaps | see below |
| Screw | M2 / M2.5 / M3 / M4 | M3 | screws only |
| Hole in the posts | tap / insert / nut | tap | as for board standoffs (docs/boards.md) |
| Head | flat / counterbore / countersunk | counterbore | flat — the head sits on the lid; counterbore — a pocket the head's diameter + 0.4 mm, its height deep; countersunk — a 90° cone |
| Magnet | 5 × 2 … 10 × 3 mm | 6 × 3 | magnets only: disc diameter × height |
| Magnet fit | 0–0.5 mm | 0.2 | magnets only: added to the magnet's diameter for its pocket |
| Thread | 4 × 1 / 6 × 1.5 / 8 × 2 / 10 × 2.5 mm | 6 × 1.5 | printed screws only: major diameter × pitch |
| Thread fit | 0.1–0.4 mm | 0.2 | printed screws only: radial clearance of the threaded hole |
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

## Magnets

The same corner posts as for screws, each with an open pocket for a disc
magnet (diameter + the magnet fit, as deep as the magnet is high, a 0.5 mm
chamfer at the mouth); the lid gets a matching pocket above every post — in
a boss under its plate where the plate is too thin to hold the magnet with
0.6 mm of plastic left over it. Both magnets sit flush, and their faces meet
across the fit clearance. The posts are thicker than screw posts (magnet +
2 × 1.6 mm), and "Size from boards" makes room for them.

Press the magnets in after printing (a drop of glue if they sit loose), each
pair attracting: mark one face of every magnet before inserting. Do not melt
them in like heat-set inserts: neodymium loses its strength for good above
~80 °C. The skirt still centres the lid; the magnets only hold it.

## Printed screws

The screws are printed too: thumb screws with a knurled head and a slot,
in the lid's STL (and in Both), standing on their heads next to the lid. The
corner posts get the matching thread; the lid a clearance hole (+ 0.6 mm),
and the head stands proud on it.

The thread is not ISO — both halves are printed, so it is a coarse 60°
profile half a pitch deep, with flat crests and roots, right-hand. 6 mm with
a 1.5 mm pitch is the smallest that holds reliably: below that a printed
thread wears out in a few turns and the shank, printed standing, snaps at
the head. 4 × 1 is offered at your own risk — its thread is half a
millimetre deep, at the limit of a 0.4 mm nozzle; the panel warns. Print it
slowly, in a tough plastic (PETG), and do not overtighten. The screw
goes 1.5 diameters into its post, so the posts are as long as that +
1.5 mm, at least 8 mm (10.5 mm for 6 mm screws), and thread + 2 × 2 mm
thick; the auto size makes room for them. The hole has a 45°
countersink at its mouth and the screw a chamfered tip, so the thread finds
its start. Raise *Thread fit* if the screw is tight on your printer.

The preview draws the threads with 16 points per turn; the export with
twice the resolution's segments (48 at the default 24, at most 64) — four
threaded holes make the body several times heavier, so a printed-screw case
takes about a second to export.

