// The custom board: its catalog JSON reads back into the same board, it
// travels inside a project file, and it builds a closed case.

import { readFileSync } from 'node:fs';
import { catalogJson, customSignature, defaultCustomBoard } from '../src/ui/customBoard';
import { autoPortId, isAutoPortId, sanitizeBoard } from '../src/boards/schema';
import { sanitizePlacement, withPortType } from '../src/boards/placement';
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

  it('a port id follows its type', () => {
    expect(autoPortId('led', new Set())).toBe('led-1');
    expect(autoPortId('dc-jack-5.5', new Set(['dc-jack-5.5-1', 'led-2']))).toBe('dc-jack-5.5-2');
    expect(isAutoPortId('dc-jack-5.5-3', 'dc-jack-5.5')).toBe(true);
    // the dot in the type is a dot, not "any character"
    expect(isAutoPortId('dc-jack-5x5-3', 'dc-jack-5.5')).toBe(false);
    expect(isAutoPortId('usb', 'usb-c')).toBe(false);
  });

  it('a type change renames an automatic id and keeps its opening toggle', () => {
    const custom = sanitizeBoard({
      ...defaultCustomBoard(),
      ports: [
        { id: 'usb-c-1', type: 'usb-c', edge: 'front', along: 10 },
        { id: 'led-1', type: 'led', edge: 'back', along: 10 },
        { id: 'power', type: 'usb-c', edge: 'back', along: 20 },
      ],
    });
    const placement = sanitizePlacement({ board: 'custom', custom, cuts: { 'usb-c-1': false } });
    const next = withPortType(placement, 0, 'led');
    expect(next.custom?.ports.map((port) => [port.id, port.type])).toEqual([['led-2', 'led'], ['led-1', 'led'], ['power', 'usb-c']]);
    expect(next.cuts).toEqual({ 'led-2': false });
    // a name the user gave stays
    expect(withPortType(placement, 2, 'button').custom?.ports[2].id).toBe('power');
    expect(sanitizePlacement(next)).toEqual(next);
  });

  it('a file from before: usb-c-<n> on another type is renamed, its toggle with it', () => {
    const file: unknown = JSON.parse(readFileSync(new URL('./fixtures/korpus-1.json', import.meta.url), 'utf8'));
    const state = sanitizeState(Reflect.get(file ?? {}, 'state'));
    expect(state.boards.map((board) => board.custom?.ports.map((port) => port.id))).toEqual([
      ['button-1', 'dc-jack-5.5-1'],
      ['dc-jack-5.5-1', 'dc-jack-5.5-2'],
      ['button-1', 'button-2', 'button-3', 'display-1', 'led-1'],
    ]);
    const closed = sanitizePlacement({ board: 'custom', custom: { ...defaultCustomBoard(), ports: [
      { id: 'usb-c-1', type: 'usb-c', edge: 'front', along: 10 },
      { id: 'usb-c-2', type: 'led', edge: 'back', along: 10 },
    ] }, cuts: { 'usb-c-1': false, 'usb-c-2': false } });
    expect(closed.custom?.ports.map((port) => port.id)).toEqual(['usb-c-1', 'led-1']);
    expect(closed.cuts).toEqual({ 'usb-c-1': false, 'led-1': false });
    expect(sanitizeState(state)).toEqual(state);
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
