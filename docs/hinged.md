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
