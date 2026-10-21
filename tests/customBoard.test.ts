// The custom board: its catalog JSON reads back into the same board, it
// travels inside a project file, and it builds a closed case.

import { catalogJson, customSignature, defaultCustomBoard } from '../src/ui/customBoard';
import { sanitizeBoard } from '../src/boards/schema';
import { decodePresetFile, encodePresetFile } from '../src/state/presetFile';
import { defaultState, sanitizeState } from '../src/state/schema';
import { initCSG } from '../src/geo/csg';
import { buildCase } from '../src/geo/build';
import { validateMesh } from '../src/geo/validate';

function customBoard() {
  return sanitizeBoard({
    ...defaultCustomBoard(),
    name: 'My Sensor Board',
    vendor: 'Me',
    size: { w: 60, d: 40, t: 1.2 },
    ports: [
      { id: 'usb', type: 'usb-c', edge: 'left', along: 20, protrude: 1 },
      { id: 'jack', type: 'audio-3.5', edge: 'front', along: 30 },
      { id: 'oled', type: 'display', edge: 'top', x: 30, y: 25, w: 25, d: 12, h: 4 },
      { id: 'led', type: 'led', edge: 'top', x: 5, y: 35, d: 2 },
    ],
  });
}

describe('custom board', () => {
  it('the catalog JSON reads back into the same board', () => {
    const board = customBoard();
    const parsed: unknown = JSON.parse(catalogJson(board));
    expect(sanitizeBoard(parsed)).toEqual({ ...board, id: 'my-sensor-board' });
  });

  it('a board with rails exports rails', () => {
    const board = sanitizeBoard({ ...customBoard(), mount: { kind: 'rails', holes: [], screw: 'M2', rails: 'short' } });
    const back = sanitizeBoard(JSON.parse(catalogJson(board)));
    expect(back.mount).toEqual({ kind: 'rails', holes: [], screw: 'M2', rails: 'short' });
  });

  it('travels inside the project file', () => {
    const state = sanitizeState({ ...defaultState(), boards: [{ board: 'custom', custom: customBoard(), x: 0, y: 0, z: 5 }] });
    const decoded = decodePresetFile(encodePresetFile('mine', state));
    expect(decoded?.state).toEqual(state);
    expect(decoded?.state.boards[0].custom?.name).toBe('My Sensor Board');
  });

  it('the signature changes with the structure, not with values', () => {
    const board = customBoard();
    const moved = { ...board, ports: board.ports.map((port) => ({ ...port, w: port.w + 1 })) };
    expect(customSignature(moved)).toBe(customSignature(board));
    expect(customSignature({ ...board, ports: board.ports.slice(1) })).not.toBe(customSignature(board));
  });

  it('builds a closed case with its openings', async () => {
    const csg = await initCSG();
    const state = sanitizeState({ ...defaultState(), boards: [{ board: 'custom', custom: customBoard() }] });
    const built = buildCase(csg, state, 8);
    for (const mesh of [built.body, built.lid]) {
      const report = validateMesh(mesh);
      expect(report.watertight).toBe(true);
      expect(report.degenerateTriangles).toBe(0);
    }
  });
});
