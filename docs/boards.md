# Boards

The **Boards** card lists the boards in the case. **+ Add board** opens the
catalog: type to search, boards are grouped by vendor; a **≈** mark means the
dimensions have not yet been checked against an official drawing.

Each board has:

| Control | Range | Notes |
|---|---|---|
| X, Y | 0–300 mm | position relative to the other boards; the layout as a whole is centred in the case, so with one board these do nothing |
| Standoff height | the board's underside parts + 1 mm … 60 mm | PCB underside above the floor |
| Rotation | 0° / 90° / 180° / 270° | |
| Screw | M2 / M2.5 / M3 / M4 | boards with mounting holes; the default comes from the board |
| Hole | tap / insert / nut | see below |

Up to 8 boards; boards that overlap, or a standoff that runs into another
board, are reported under the export button.

## Standoffs

A board with mounting holes stands on a standoff per hole. The standoff
diameter follows the screw (hole + 2 × 1.6 mm, at least 5 mm):

- **tap** — a pilot hole for a self-tapping screw (M2 1.7, M2.5 2.2, M3 2.6,
  M4 3.5 mm).
- **insert** — a hole for a heat-set insert (M2 3.2, M2.5 3.5, M3 4.0, M4
  5.6 mm), as deep as the insert, with a 0.5 mm chamfer.
- **nut** — a hexagonal pocket for a nut, 2 mm above the floor (lower if the
  standoff is short), with a slot towards the board's centre to slide the nut
  in before the board goes on; the screw goes through a clearance hole.

Every hole stops 0.8 mm above the outer bottom, so the floor stays closed.
With a bottom lid the floor is the lid, and the standoffs stand on it.

## Rails

A board without mounting holes (ESP32-DevKitC, Heltec) is held by two rails
along its long edges: bars 3 mm thick with a groove the board's thickness +
0.3 mm wide that grips the edge 1.5 mm deep. The rails are open at both ends
and 2 mm shorter than the edge at each end: put the board in at an angle and
click it into both grooves.

Boards with soldered pin headers along the gripped edges (the
ESP32-DevKitC as shipped) collide with the lower rail lip — remove the
headers or mount the board another way. This is open for a printed test
(PLAN.md §11).

## Catalog

| Board | Vendor | Size, mm | Mount | Source | Checked |
|---|---|---|---|---|---|
| Raspberry Pi 4 Model B | Raspberry Pi | 85 × 56 | 4 × M2.5 | [drawing](https://datasheets.raspberrypi.com/rpi4/raspberry-pi-4-mechanical-drawing.pdf) | yes |
| ESP32-DevKitC V4 | Espressif | 54.4 × 27.9 | rails | [guide](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/hw-reference/esp32/get-started-devkitc.html) | ≈ |
| Arduino Uno R3 / R4 | Arduino | 68.58 × 53.34 | 4 × M3 | [datasheet](https://docs.arduino.cc/resources/datasheets/A000066-datasheet.pdf) | ≈ |
| Heltec WiFi LoRa 32 V3 | Heltec | 50.2 × 25.5 | rails | [datasheet](https://resource.heltec.cn/download/WiFi_LoRa_32_V3/HTIT-WB32LA_V3.2.pdf) | yes |
