# Export and printing

The **View and export** card (at the bottom of the panel) decides both what
the 3D view shows and what goes into the STL. The caption in the top-left
corner of the view always says what is shown; click it to jump to the card.

**Parts** — the same parts are shown and exported:

- **Both** (default) — body and lid side by side in one file, 10 mm apart.
- **Body** — the body alone (the view shows it with its boards).
- **Lid** — the lid alone.

Every file comes already oriented for printing without supports: the body
with its opening up, the lid on its outer face. A console with its lid on
the bottom lies on its slope — a flat face on the bed.

**Resolution** — segments per quarter of every rounded corner in the file
(12, 24, 48, 64; default 24). The preview always uses 12.

Below the button the panel shows the outer size, the mesh check (a
watertight mesh is required) and any warnings. Export is blocked only by a
broken mesh, an empty part or a part larger than 400 mm.

**View**: *exploded* (default) — the lid lifted off the case; *assembled* —
closed; *print layout* — the parts as they go into the STL. *Boards* — show
the boards (off in the print layout: they are not printed); *X-ray* — see
through the walls.
