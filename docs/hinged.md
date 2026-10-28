# Hinged case

A case of two halves joined by a hinge — a clamshell: a keyboard and the
main board below, a screen above (a cyberdeck, a Meshtastic communicator, a
handheld). **Case → Shape → Hinged.**

## Two halves

The **lower half** is the base, the **upper half** the cover, as the case
lies closed. Each is a box of its own with its own boards, lid, openings,
vents, fan and label. **Editing** (the bar above the Boards card, it stays
in sight while the panel scrolls) picks which half the cards below show:
*Lower half* or *Upper half*. A board added goes to the half being edited.

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
| Gap when closed | 0–10 mm | 1 | between the inner faces of the closed case |

Corner radius, edge fillet, wall and floor are the same for both halves.
A hinged case has no wall mounting (keyholes, ears).

## Knuckles

The halves turn on knuckles printed with them: barrels behind the hinge
walls, each tied to its half's wall by a web, alternating lower, upper,
lower… A pin goes through each block of knuckles: a piece of 1.75 mm
filament (cut it to length, push it in, melt its ends with a soldering
iron), a rod or a nail.

| Parameter | Range | Default | Notes |
|---|---|---|---|
| Knuckles | at the ends, along the edge | at the ends | two blocks near the ends (one in the middle when the edge is too short for two), or one block along the whole edge |
| Knuckles per block | 3, 5, 7 | 3 | odd: a block starts and ends on the lower half |
| Knuckle length | 4–40 mm | 10 | two blocks only; shorter when the edge is short |
| Knuckle diameter | 5–16 mm | 8 | never less than the pin's hole plus 1.2 mm of wall on each side |
| Knuckle clearance | 0.2–1 mm | 0.4 | between neighbouring knuckles, and between a barrel and the other half's wall |
| Pin diameter | 1–5 mm | 1.75 | |
| Pin hole clearance | 0–0.5 mm | 0.15 | added to the pin's radius |

The knuckles stay on the straight part of the hinge edge, clear of the
corner radius. Their web holds on to the body's part of the hinge wall —
never the lid's, so a lid on top still lifts off — and leans at 45° at
most under the barrel, so the body prints opening up without supports.

**How the halves print.** Each body prints opening up. A half whose lid is
on its **bottom** therefore lies on its inner face, and its knuckles must
not stand out of that face: its barrels stay inside its height, and the
other half's barrels take the whole gap and both radii. With **both** lids
on the bottom the knuckles cannot be printed with the halves at all — the
panel warns; put one half's lid on top.

A port or an opening through the hinge wall where knuckles stand behind it
is warned about: the opening cuts the knuckles, and a plug has no way out
there.

## Lids

Each half has its own lid on its **top** (the inner face) or its
**bottom** (the outer face): the Lid card shows the lid of the half being
edited. Everything else about the lid — depth, snaps, screws, magnets,
printed screws — is as for a single case ([Lid](lid.md)).

## The view

Both halves are drawn, the upper one open by **Open by** in the View and
export card (0° closed, 180° open flat; 110° by default — it is a view
setting and is not saved in the project). Exploded, each lid lifts off its
half. Warnings name their half (*Lower half: …*) and their badges move with
it.

## Export

The three parts tabs mean the same for both halves: **Both** is every
part, **Body** both bodies, **Lid** both lids — one STL each. In the print
layout and the STL the upper half's parts lie behind the lower half's, each
half laid out as a single case's (**Lid's place** and **Gap** apply to
both). The caption over the view says which parts, how far the case is
open, and in the print layout that the upper half is behind; **Open by**
is greyed out there.
