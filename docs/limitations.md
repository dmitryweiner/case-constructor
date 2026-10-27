# What is not in v1

Decided on purpose, so nobody wonders:

- A lid on the sloped top of the console.
- An edge fillet on the console; fillets on cutout edges and post tops.
- Cantilever snap hooks, hinges, sliding side panels — snaps are half-round
  bumps in grooves.
- HATs sharing standoffs with the board below: each board has its own
  standoffs; place a HAT as a second board at its height.
- Light pipes, button caps, battery compartments, DIN-rail
  clips, recesses for rubber feet.
- Sacrificial bridges over wall openings: the openings are small and
  slicers bridge them.
- Share links (projects travel as JSON files) and multi-file export (3MF,
  STEP): one STL per export.
- Translated README and user guide (the interface is in four languages).

- A display on a wall of the case (a 1602 on the front of a box): displays
  hang from the top or the console's slope only.

Known limits of the current version:

- Most display entries are ≈: their active area is taken as centred where
  the drawing does not place it, and a hung panel's thickness is often an
  estimate. The window's clearance and the rim's fit wait for a test print.

- Boards marked **≈** in the catalog are transcribed from specifications or
  typical layouts and wait for a measurement.
- Rails grip the board edge 1.5 mm: boards with pin headers soldered along the
  gripped edges (an ESP32-DevKitC as shipped, a Nano with headers) collide
  with the lower lip — remove the headers or use a custom board on standoffs.
- Vents are left out wherever they would hit something (the skirt band, a
  standoff, a rail, a port opening); a dense board can leave a face with few
  vents.
- A fan larger than the flat part of its face still cuts through the rim; the
  panel warns.
- Printed screws and their threads, magnet pockets and closed keyholes wait
  for a printed test: the fits (thread 0.2 mm, magnet + 0.2 mm) are
  defaults to tune with *Thread fit* and *Magnet fit*.
- Closed keyholes on the bottom with the lid on top: the body prints on the
  pads and feet, and the floor between them needs supports (the panel says
  so).
