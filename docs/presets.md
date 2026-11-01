# Presets and project files

The case you are working on is kept in this browser as you edit it: close
the tab or reload the page and it opens again where you left it, with the
name of the preset you opened. A first visit opens the first built-in
preset. Two tabs of the app share this one copy: the tab edited last wins.

The presets button shows a preset's name, and the list marks it, only while
the case is still that preset: change a parameter and it is a case of your
own (undo back, and it is the preset again). The parts tab, the resolution
and the lid's place in the Both STL are how you look at it and export it,
not the case, so they do not count.

If the browser cannot keep your work (a private window, blocked site data,
or the storage full), a red line under the top bar says so and stays until
saving works again: save the project to a file with ⬇️, or delete presets
you no longer need to free the space. A preset that could not be saved or
deleted is reported on the same line (✕ hides that note).

- **Presets…** opens the list: your presets and the built-in ones. 🗑 deletes
  one of yours (tap twice).
- 💾 saves the current case as a preset in this browser.
- ⬇️ saves the whole project to a JSON file; 📂 opens one (or drop the file
  onto the window). A file that is not a Case Constructor project is refused
  and nothing changes.
- ↩️ / ↪️ undo and redo (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z).

Built-in presets (their names are the same in every language; the
description in the tooltip is translated):

| Preset | What it shows |
|---|---|
| Pi 4 desktop case | a Raspberry Pi 4 against all four walls (its connectors flush with the outside), vents at the back, the lid on snaps, an engraved label |
| ESP32 sensor box | an ESP32-DevKitC hung from the top on rails on screws, printed caps over its buttons, hexagon vents front and back, the lid underneath on snaps, ears on the front and back walls to screw it to a wall, an engraved label |
| ESP32 on 18650 cells | an ESP32-DevKitC with its pins soldered on a pin bed and two 18650 cells behind it in cradles under printed clamps, both against the left wall; the lid on countersunk M3 screws |
| Arduino Uno box | an Arduino Uno against the left wall, the headers open for jumper wires, the lid on M3 screws, an engraved label |
| KlipperScreen console | a BTT Pi TFT50 on the console's slope on clamp tabs, a Pi 4 on its back, the lid underneath on screws, one hole at the back for the cables |
| Home Assistant wall panel | Touch Display 2 7-inch held by the lid, a Pi 5 on its back, vents on the sides, keyholes and a cable hole in the back for the wall |
| Repair station clamshell | a case that folds open like a laptop ([Hinged case](hinged.md)): an M5Stack CardKB with printed caps on rails on screws in the lower half, a 4-inch touch TFT (MSP4021) in the upper, a cable through the hinge, a round hole at the back of the upper half, a printed hinge on screw axles, both lids underneath on M3 screws |
| Plain box | an empty rounded box with a flat lid on snaps |

The interface language (🌐) is remembered by the browser and is not part of
a project file.
