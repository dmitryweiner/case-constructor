# Hinged case

A case of two halves joined by a hinge — a clamshell: a keyboard and the
main board below, a screen above (a cyberdeck, a Meshtastic communicator, a
handheld). **Case → Shape → Hinged.**

## Two halves

The **lower half** is the base, the **upper half** the cover, as the case
lies closed. Each is a box of its own with its own boards, lid, openings,
vents, fan and label. The cards that edit one half — Boards, Lid,
Openings, Mounting and label — stand in one frame headed by **Editing**:
*lower* or *upper* (it stays in sight while they scroll) picks the half
they all show. A board added goes to the half being edited.

The hinge runs along the lower half's **back** edge and the upper half's
**front** edge. Each half's **top** is its *inner face* — the face the other
half closes onto: the keyboard below, the screen above. Laid open flat, the
upper half lies behind the lower one with its inner face up, so its boards
are placed as you see them on the open screen: X to the right, Y up the
screen. Which side the hinge is on is chosen by the width and depth: a case
that opens like a book is narrow and deep.

| Parameter | Range | Default | Notes |
|---|---|---|---|
| Width, Depth | 20–400 mm | from the boards | shared: both halves have one footprint, the larger of what each half's boards need |
| Lower half height, Upper half height | 20–400 mm | from the boards | each half's own; with **Size from boards** on, what its boards need |
| Gap from what stands out | on/off | on | the gap below from what the inner faces carry |
| Gap when closed | 0–10 mm | 1 | between the inner faces of the closed case |

Corner radius, edge fillet, wall and floor are the same for both halves.
A hinged case has no wall mounting (keyholes, ears).

## Knuckles

The halves turn on knuckles printed with them: barrels behind the hinge
walls, each tied to its half's wall by a web, alternating lower, upper,
lower… A pin goes through each block of knuckles: a piece of 1.75 mm
filament (cut it to length, push it in, melt its ends with a soldering
iron), a rod or a nail — or a screw (below).

| Parameter | Range | Default | Notes |
|---|---|---|---|
| Knuckles on | the back, the sides | the back | the sides: see below |
| Knuckles | at the ends, along the edge | at the ends | two blocks near the ends (one in the middle when the edge is too short for two), or one block along the whole edge |
| Knuckles per block | 3, 5, 7 | 3 | odd: a block starts and ends on the lower half |
| Knuckle length | 4–40 mm | 10 | two blocks only; shorter when the edge is short |
| Knuckle diameter | 5–16 mm | 8 | never less than the pin's hole plus 1.2 mm of wall on each side |
| Knuckle clearance | 0.2–1 mm | 0.4 | between neighbouring knuckles, and between a barrel and the other half's wall |
| Axle | pin, screw, snap (cones: a printed hinge) | pin | |
| Pin diameter | 1–5 mm | 1.75 | a pin |
| Pin hole clearance | 0–0.5 mm | 0.15 | a pin; added to the pin's radius |
| Screw | M2, M2.5, M3 | M2.5 | a screw |

**A screw for an axle.** One screw per block, through every knuckle: its
pan head sunk into the block's first knuckle, its hex nut into the last
(the pocket's roof is a 60° peak, printable as the body lies). Tightened,
it squeezes the knuckles together and holds the upper half at any angle —
the friction a screen needs. The knuckles grow to hold the head and the
nut with a millimetre of wall around them. A note says which screws to
buy: as long as the block less the head's seat, or the nearest shorter.

**A snap.** Nothing to buy: the lower half's knuckles are joined by a
printed bar on the axis, and the upper half's knuckles are split rings —
the slit outwards, away from their wall — that click onto the bars. Lay the
upper half closed, a little forward of its place, and push it back onto
the hinge. The ring's wall is 1.4 mm, so it springs open; PETG springs
better than PLA. The ring's fit and the slit's grip wait for a test print.

The knuckles stay on the straight part of the hinge edge, clear of the
corner radius. Their web holds on to the body's part of the hinge wall —
never the lid's, so a lid on top still lifts off — and leans at 45° at
most under the barrel, so the body prints opening up without supports.

**How the halves print.** Each body prints opening up. A half whose lid is
on its **bottom** therefore lies on its inner face, and its knuckles must
not stand out of that face: its barrels stay inside its height, and the
other half's barrels take the whole gap and both radii. With **both** lids
on the bottom the knuckles cannot be printed with the halves at all — the
panel warns; put one half's lid on top, or take the printed hinge (below).

A port or an opening through the hinge wall where knuckles stand behind it
is warned about: the opening cuts the knuckles, and a plug has no way out
there.

## Knuckles on the sides

**Knuckles on → the sides**: instead of blocks along the back edge, a pivot
on each side wall at the back corners. The lower half's cheek lies on its
side wall and reaches back to a disc on the axis; the upper half's cheek
lies one layer further out, on a spacer from its own side wall, with its
disc over the lower one's. The axle goes across both discs: a pin, a screw
(its head in the outer disc, its nut in the inner one, put in from behind
the case) or a snap (the lower disc's bar through the upper disc's split
ring). The axis stays along the back edge, a clearance behind the back
walls; the discs stand out of the width by two cheeks, and the back wall
is free for ports and cables.

Both kinds work on the sides: cheeks printed with the halves (a vertical
plate on the wall prints opening up), or a printed hinge — four separate
cheeks screwed onto the side walls into pads inside them, each printed on
a flat face (the lower half's on the face that goes on the wall, the upper
half's on its outer face, its spacer up). Cones are not offered there: one
cheek printed over the other with a 0.35 mm gap needs supports.

## A printed hinge on screws

**Hinge → printed hinge**: instead of knuckles printed with the halves, a
hinge of its own — per block of knuckles, two leaves, each a plate that
lies on its half's hinge wall with its knuckles on it — screwed onto the
walls. It works with any lids (both on the bottom, like a laptop's covers,
included) and can be replaced.

It prints in one piece, as the case is closed: both plates side by side on
the bed (the faces that go on the walls down), the knuckles over them. Its
axle is any of the knuckles' — a pin, a screw, a snap — or **cones**,
printed in place: each upper-half knuckle carries a cone (45°) on each end
inside a socket of the lower-half knuckle next to it, 0.35 mm apart; break
it loose with a few turns after printing.

| Parameter | Choice | Default | Notes |
|---|---|---|---|
| Leaf screws | M2, M2.5, M3 | M2.5 | two per leaf and block (one on a short block), through the plate and the wall |
| Into | tap, insert, nut | insert | inside the wall each screw goes into a pad: a tapped hole, a heat-set insert pressed in from inside, or a nut dropped into its pocket from inside |

The pads are wedges on the inside of the hinge wall (45° above and below,
so they print either way up), clear of the lid's skirt; the screws stay on
the body's part of the wall. A note says which screws to buy and how long;
a pad that runs into a board is warned about.

## Cables

**+ Add cable** in the Hinge card (up to four): a flat cable (an FFC, an
IDC ribbon: its width and thickness) or a round one (a bundle of wires, a
USB cable: its diameter), and where it crosses the hinge — the slot's
middle from the left end, the same number in both halves. Each half gets a
rounded slot through its hinge wall, its top half a millimetre under the
inner face's plate, as close to the axis as the wall allows; the knuckles
step aside from it (a block moves inwards, or one block along the edge
becomes one per stretch between the cables). The cable runs outside,
between the blocks, from slot to slot.

| Parameter | Range | Default | Notes |
|---|---|---|---|
| Through | hinge wall, inner face | hinge wall | where the slot is |
| Along the hinge | 0–400 mm | the middle | the slot's middle |
| Width / Thickness | 1–60 / 0.1–5 mm | 16 / 0.3 | a flat cable |
| Diameter | 1–60 mm | — | a round cable |
| Plug width, Plug height | 0–40 mm | 0 | a plug that has to pass through the slot; 0 = the cable alone |

**Through the inner face** instead: the slot goes through each half's
inner face plate, right inside the hinge wall (clear of a top lid's skirt);
closed, the two slots face each other across the gap and the cable crosses
it straight, open it bends over the hinge line.

The slot is the cable (or its plug, whichever is larger) plus 0.5 mm on
every side. A note gives the cable's length from slot to slot as the case
opens from closed to flat — leave the difference as slack inside. A slot
that runs into the rounded corner, or into another slot, is warned about.

## The gap and keeping it closed

**Gap from what stands out** (on by default): the gap between the closed
halves takes whatever stands out of both inner faces — key tops, printed
caps, a knob's shaft, a socket standing up out of its slot, a raised label
on a lid on top — added up (closed, they may face each other) and half a
millimetre more; with nothing standing out it is 1 mm. A note says the gap
when it is more than that. Off, the gap is yours; less than what stands
out is warned about: the case will not close.

**Magnets to keep it closed** (off by default): a pair at the front edge,
a quarter in from each side — the lower half's front, the upper half's far
edge: closed, they meet. Each sits in a boss under its inner face's plate,
its pocket open into the case, with 0.6 mm of plate left outside: nothing
shows. Glue them in, poles facing. Sizes as for the lid's magnets; the boss
goes with the plate's part (the lid's, when the lid is on top) and keeps
off the skirt. A boss that runs into a board is warned about.

## Lids

Each half has its own lid on its **top** (the inner face) or its
**bottom** (the outer face): the Lid card shows the lid of the half being
edited. Everything else about the lid — depth, snaps, screws, magnets,
printed screws — is as for a single case ([Lid](lid.md)).

## The view

Both halves are drawn. Assembled, the upper one is open by **Open by** in
the View and export card (0° closed, 180° open flat; 110° by default — it
is a view setting and is not saved in the project). Exploded, the case
lies open flat and each lid lifts off its own half; **Open by** shows in
the assembled view only. Warnings name their half (*Lower half: …*) and their badges move with
it.

## Export

The three parts tabs mean the same for both halves: **Both** is every
part, **Body** both bodies (and a printed hinge), **Lid** both lids — one
STL each. A printed hinge lies behind everything, as it prints. In the print
layout and the STL the upper half's parts lie behind the lower half's, each
half laid out as a single case's (**Lid's place** and **Gap** apply to
both). The caption over the view says which parts, how far the case is
open, and in the print layout that the upper half is behind; **Open by**
is greyed out there.
