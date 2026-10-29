# Ventilation, fan, wall mounting, label

## Ventilation

Turn on **Ventilation** in the Openings card and tick the faces.

| Control | Range | Default | Notes |
|---|---|---|---|
| Pattern | slots / hexagons / holes | slots | slots are rounded, 4 × their width long; hexagons and holes sit on a staggered grid |
| Slots | horizontal / vertical | vertical | |
| Size | 1–10 mm | 2 | slot width, hole diameter, hexagon across its flats |
| Pitch | size + 0.8 … 30 mm | 4 | centre to centre |
| Margin | 1–40 mm | 4 | from the face's rounded edges |

The pattern fills the flat part of each face and is centred on it. Vents
are left out where they would do harm: across the band where the lid skirt
sits, under a standoff or a rail (a vent there would open it), inside a port
opening. On a cylinder the four sides are the round wall seen from four
directions.

## Fan seat

**Fan seat**: a round opening of the fan's size − 2 mm and four screw holes
on the standard square (25 → 20, 30 → 24, 40 → 32, 50 → 40, 60 → 50 mm), on
any face, shifted from the face's centre by X / Y. Screw holes default to
3.2 mm. The panel warns when the fan does not fit the flat part of the face.

## Wall mount

*Against the wall* picks the face the case rests on: bottom (the default),
back, front, left, right or top — the console's slope is not offered. The
lid's face may be chosen too: then whatever holds the lid holds the case,
and the panel warns (more sharply on snaps, which let go). A file saved
before this choice hung by its floor, or by its back wall when the floor was
the lid, and opens so.

- **keyholes** — two keyholes, *Spacing* apart, through the face against the
  wall: a hole for the screw head (2 × screw + 1 mm) and a 6 mm slot for the
  shank (screw + 0.6 mm), running up from the head hole on a wall. Hang the
  case on two screws and slide it down. Keep them away from standoffs (the
  panel warns).

  *Keyholes: through / closed.* A through keyhole opens into the case. A
  closed one is a blind pocket the screw head slides in, in a pad standing
  out of the face (the plate alone is too thin for it), so the case stays
  closed: the head hole and the slot from outside, the head's channel
  behind the slot, 1 mm of the plate left towards the cavity. On the bottom
  the pads go to its far end and two feet of the same height to the near
  end, so the case stands level on four; on a short case each pad and its
  foot merge into one strip. On any other face there are no feet. Pads on
  the face the body prints on (the one opposite the lid) stand on the bed,
  and the plate between them needs supports (the panel says so). A
  cylinder's round wall has no flat place for a pad: there the keyholes go
  through. Vents are left out under pads and feet. A standoff right above a
  pocket would open it (its hole goes into the plate) — the panel warns.
- **ears** — tabs at floor level, 10 × 8 mm, as thick as the floor, with a
  hole for the screw (+ 0.4 mm). *Ears*: 1–4. *On the walls*: left and
  right, front and back (an odd ear goes to the first wall: 3 = 2 + 1) or
  one wall of your choice. *Along the wall* (when a wall gets two or more):
  centred, *Spacing* apart, or at the ends — spread out to the corners. Ears
  stay on the flat part of a wall, clear of the rounded corners. A cylinder
  has no walls: its ears go evenly around, the first towards the first wall
  named.

## Label

**Label** puts a line of text on the lid's outer face.

| Control | Range | Default | Notes |
|---|---|---|---|
| Text | up to 40 characters | — | Latin, Cyrillic and Hebrew |
| Font | Rubik / Oswald | Rubik | Oswald has no Hebrew letters; they come out in Rubik |
| Size | 3–30 mm | 6 | the height of a capital letter |
| Raised | on / off | off | off — engraved |
| Depth | 0.4–1.5 mm | 0.6 | an engraving never goes deeper than the lid plate − 0.6 mm |
| Place | centre / an edge / a corner | centre | a 3 × 3 grid, as seen from outside the lid |
| From the edge | 0–30 mm | 3 | an edge or a corner only: how far the label's box keeps from the lid's rounded edges and corners |
| Shift X, Y | −100 … 100 mm | 0 | a fine shift from the chosen place; a new place resets it |
| Turn | 0 / 90 / 180 / 270° | 0 | quarter turns; *Angle* takes any other |
| Angle | −180 … 180° | 0 | |

The text reads from outside the lid. Against an edge or in a corner the
label's box — turned, if it is — stays *From the edge* inside the lid's flat
part. The panel warns when the label runs off the flat part of the lid or
over a screw head on it. Fonts load only when a label is on.
