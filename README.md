# Case Constructor

A web app that builds a 3D-printable enclosure for a PCB and exports STL:
pick a case shape, size it, choose where the lid goes and how it holds — the
app splits the shell, adds the lid skirt and lays both parts out for
printing.

**Live:** https://dmitryweiner.github.io/case-constructor/

![A Raspberry Pi 4 desktop case with the lid lifted](docs/img/pi4-desktop.png)

| | |
|---|---|
| ![A round LoRa puck](docs/img/cylinder-puck.png) | ![Body and lid laid out for printing](docs/img/print-layout.png) |

## Features so far

- Box with rounded corners and edge fillets, cylinder, console with a sloped
  top, sized automatically around the boards.
- A catalog of 34 boards — Raspberry Pi, Banana Pi, Orange Pi, Radxa, Repka
  Pi, Walnut Pi, Espressif ESP32, Arduino, Heltec — or your own board, on
  standoffs with tap, heat-set insert or nut holes, or held by grooved rails.
- Openings for every connector, your own cutouts, ventilation, a fan seat.
- A lid on any face, on snaps or screws; wall mounting; a label on the lid.
- A lid on any face (the cylinder: top or bottom; the console: any face but
  the slope), flat or taking part of the walls, with a skirt and a printing
  clearance.
- Exact preview: the same CSG pipeline as the export, in a web worker.
- STL export of the body, the lid, or both in one file, already oriented for
  printing.
- Presets in the browser, project files (JSON), undo/redo.
- English, Russian, Ukrainian, Hebrew.

User documentation: [docs/](docs/README.md).

## Development

```bash
npm install
npm run dev       # http://localhost:5173
npm run check     # tsc + eslint + vitest
npm run smoke     # browser smoke (Playwright)
npm run build
```

Stack: Vite, TypeScript, Three.js, [manifold-3d](https://github.com/elalish/manifold)
(WASM, in a worker), vitest, Playwright. A sibling of
[ClayForm](https://github.com/dmitryweiner/clayform).

## License

GPL-3.0, see [LICENSE](LICENSE).
