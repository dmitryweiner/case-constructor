# Export and printing

The **View and export** card (at the bottom of the panel) decides both what
the 3D view shows and what goes into the STL. The caption in the top-left
corner of the view always says what is shown; click it to jump to the card.

**Parts** — the same parts are shown and exported:

- **Both** (default) — body and lid side by side in one file, 10 mm apart;
  with printed screws (docs/lid.md) the screws follow the lid in a row.
- **Body** — the body alone (the view shows it with its boards).
- **Lid** — the lid alone, with its printed screws if the lid holds on them.

Every file comes already oriented for printing without supports: the body
with its opening up, the lid on its outer face, printed screws standing on
their heads. A console with its lid on the bottom lies on its slope — a flat
face on the bed. One exception: closed keyholes on the bottom with the lid
on top — the body stands on their pads and feet, and the floor between them
needs supports (docs/extras.md; the panel says so).

**Resolution** — segments per quarter of every rounded corner in the file
(12, 24, 48, 64; default 24). The preview always uses 12.

Below the button the panel shows the outer size, the mesh check (a
watertight mesh is required) and any warnings. Export is blocked only by a
broken mesh, an empty part or a part larger than 400 mm.

**View** — only the choices that mean something for the parts shown:

- **Both**: *exploded* (default) — the lid lifted off the case (printed
  screws hover over it; a bottom lid floats under the case, both above the
  grid); *assembled* — closed (printed screws in their
  holes); *print layout* — the parts as they go into the STL.
- **Body**: *assembled* or *print layout* (a body alone has nothing to
  explode).
- **Lid**: no choice — the lid is shown as it prints and as it is in the
  STL: on its outer face, the skirt up, printed screws next to it.

*Boards* — show the boards, see-through: the PCB green with its mounting
holes and their pads, connectors and parts amber (off in the print layout:
they are not printed; hidden for the lid alone); *X-ray* — see through the
walls.

On a phone the settings are a sheet over the lower part of the view; the
case is centred in what the sheet leaves open, and hiding the sheet only
moves it back to the middle — the scale and the proportions stay.
