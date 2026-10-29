// The Boards card: one box per placed board — position, height, rotation,
// how it is held — and a remove button. The list is rebuilt when boards are
// added or removed; otherwise only synced, so a slider keeps its focus.
// With two boards or more: arrange buttons for all of them on top, and in
// each box a way to line it up with another board (geo/arrange.ts).

import { make } from './dom';
import type { Control, ControlsHandle } from './controls';
import { renderControls } from './controls';
import { t } from '../i18n';
import type { BackPlacement, BoardPlacement } from '../boards/placement';
import {
  BACK_STANDOFF_MAX, BACK_STANDOFF_MIN, CEILING_GAP, NEW_BOARD_GAP, backPortDefault, backStandoffMin, withBackCut, POSITION_MAX, ROTATIONS, SIDES, WALL_OFFSET_MAX, WALL_OFFSET_MIN, Z_MAX, boardOf, entryOf, floorZ, pinsDown, placementMinZ,
  ownPortDefault, portCut, withPortCut, withSide, withTopCut, KEY_FIT_MAX, capStyle, holdChoices, keyFit, keysOpen, pressedOn, sanitizePlacement,
} from '../boards/placement';
import type { BoardDef } from '../boards/schema';
import { KEYS_OPEN, keyFields, resolveVariant } from '../boards/schema';
import { CAP_FIT, CAP_R_MAX, CAP_R_MIN, CAP_SHAPES, capSizeRange, capSizes } from '../geo/capSize';
import { CATALOG, catalogBoard } from '../boards/catalog';
import { attachTurns } from '../geo/attach';
import type { BatterySpec } from '../boards/battery';
import { BATTERY_KINDS, CELL_COUNT_MAX, PACK_MAX, PACK_MIN, PRESS_MAX, PRESS_MIN, defaultBattery, sanitizeBattery } from '../boards/battery';
import { EDGES } from '../boards/schema';
import type { Align, ArrangeMode } from '../geo/arrange';
import { caseLayout, hangs } from '../geo/layout';
import { ALIGN_X, ALIGN_Y, ARRANGE_MODES, alignBoard, arrangeBoards } from '../geo/arrange';
import type { Key } from '../i18n';
import { tDynamic } from '../i18n';
import type { CustomEditorHandle } from './customBoard';
import { customSignature, renderCustomEditor } from './customBoard';
import { HOLE_KINDS, SCREW_SIZES } from '../geo/fasteners';
import { RAIL_EARS, railScrewSpec, railsScrewed } from '../geo/rails';
import type { AppState } from '../state/schema';

/** Whether the board could stand against this wall of the case (the layout would keep it). */
function wallPossible(state: AppState, index: number, side: string): boolean {
  const wall = EDGES.find((edge) => edge === side);
  if (!wall) return false;
  const boards = state.boards.map((one, i) => (i === index ? { ...one, walls: [wall] } : one));
  return (caseLayout({ ...state, boards }).boards[index]?.walls.length ?? 0) > 0;
}

function patchBoard(state: AppState, index: number, patch: Partial<BoardPlacement>): AppState {
  return { ...state, boards: state.boards.map((board, i) => (i === index ? { ...board, ...patch } : board)) };
}

function boardControls(index: number, entry: BoardDef): Control<AppState>[] {
  const at = (state: AppState): BoardPlacement => state.boards[index];
  // the screw and hole kind of the standoffs, or of a clamped panel's posts
  // (rails take them too when they are screwed down)
  const screwedRails = (state: AppState): boolean => railsScrewed(boardOf(at(state)), at(state));
  const holes = (state: AppState): boolean => boardOf(at(state)).mount.kind !== 'rails' || screwedRails(state);
  const railed = (state: AppState): boolean => boardOf(at(state)).mount.kind === 'rails' && battery(state) === undefined;
  const clamped = (state: AppState): boolean => boardOf(at(state)).mount.kind === 'clamp';
  const battery = (state: AppState): BatterySpec | undefined => at(state).battery;
  const hung = (state: AppState): boolean => hangs(at(state));
  const setBattery = (state: AppState, patch: Partial<BatterySpec>): AppState => {
    const spec = sanitizeBattery({ ...(battery(state) ?? defaultBattery()), ...patch });
    return patchBoard(state, index, { battery: spec });
  };
  return [
    {
      kind: 'select', key: 'battery', label: 'battery.kind', when: (state) => battery(state) !== undefined,
      options: BATTERY_KINDS.map((kind) => ({ value: kind, label: `battery.kind.${kind}` as const })),
      get: (state) => battery(state)?.kind ?? '',
      set: (state, value) => setBattery(state, { kind: BATTERY_KINDS.find((kind) => kind === value) ?? '18650' }),
    },
    {
      kind: 'segmented', key: 'cells', label: 'battery.count',
      when: (state) => battery(state) !== undefined && battery(state)?.kind !== 'pack',
      options: Array.from({ length: CELL_COUNT_MAX }, (_, i) => ({ value: String(i + 1), text: String(i + 1) })),
      get: (state) => String(battery(state)?.count ?? 1),
      set: (state, value) => setBattery(state, { count: Number(value) }),
    },
    ...(['w', 'd', 'h'] as const).map((dim): Control<AppState> => ({
      kind: 'range', key: `pack_${dim}`, label: `battery.pack.${dim}`, min: PACK_MIN[dim], max: PACK_MAX[dim], step: 0.5,
      when: (state) => battery(state)?.kind === 'pack',
      get: (state) => battery(state)?.pack[dim] ?? 0,
      set: (state, value) => {
        const spec = battery(state) ?? defaultBattery('pack');
        return setBattery(state, { pack: { ...spec.pack, [dim]: value } });
      },
    })),
    {
      kind: 'range', key: 'press', label: 'battery.press', hint: 'battery.press.hint', min: PRESS_MIN, max: PRESS_MAX, step: 0.1,
      when: (state) => battery(state) !== undefined,
      get: (state) => battery(state)?.press ?? 0,
      set: (state, value) => setBattery(state, { press: value }),
    },
    {
      kind: 'select', key: 'variant', label: 'board.variant', hint: 'board.variant.hint',
      when: () => (entry.variants?.length ?? 0) > 1,
      options: (entry.variants ?? []).map((variant) => ({ value: variant.id, text: variant.name })),
      get: (state) => at(state).variant ?? '',
      // the variant's parts may sit lower: the board keeps clear of them
      set: (state, value) => {
        const next = { ...at(state), variant: value };
        return patchBoard(state, index, { variant: value, z: Math.max(placementMinZ(next), next.z) });
      },
    },
    {
      kind: 'range', key: 'x', label: 'board.x', hint: 'board.xy.hint', min: 0, max: POSITION_MAX, step: 0.5,
      get: (state) => at(state).x,
      set: (state, value) => patchBoard(state, index, { x: value }),
    },
    {
      kind: 'range', key: 'y', label: 'board.y', hint: 'board.xy.hint', min: 0, max: POSITION_MAX, step: 0.5,
      get: (state) => at(state).y,
      set: (state, value) => patchBoard(state, index, { y: value }),
    },
    {
      // on the floor or hung from the ceiling (on a console: its slope)
      kind: 'segmented', key: 'on', label: 'board.on', hint: 'board.on.hint',
      // a clamped panel always hangs
      when: (state) => battery(state) === undefined && !clamped(state),
      options: SIDES.map((side) => ({ value: side, label: `board.on.${side}` as const })),
      get: (state) => at(state).on ?? 'floor',
      set: (state, value) => {
        const def = boardOf(at(state));
        const placement: BoardPlacement = value === 'ceiling'
          ? { ...withSide(at(state), 'ceiling'), z: CEILING_GAP }
          : { ...withSide(at(state), 'floor'), z: floorZ(def, pinsDown(def, at(state))) };
        return { ...state, boards: state.boards.map((one, i) => (i === index ? placement : one)) };
      },
    },
    {
      // a keyboard that hangs: its screws, rails, or clamp bars across its back
      kind: 'segmented', key: 'hold', label: 'board.hold', hint: 'board.hold.hint',
      when: () => holdChoices(entry).length > 1,
      options: holdChoices(entry).map((kind) => ({ value: kind, label: `board.hold.${kind}` as const })),
      get: (state) => boardOf(at(state)).mount.kind,
      set: (state, value) => {
        const next = sanitizePlacement({ ...at(state), hold: value });
        // bars press the board against the plate; anything else hangs it the gap below
        const placement = sanitizePlacement({ ...next, z: pressedOn(boardOf(next)) ? 0 : CEILING_GAP });
        return { ...state, boards: state.boards.map((one, i) => (i === index ? placement : one)) };
      },
    },
    {
      // a battery lies in cradles rather than on standoffs: the same height, its own words
      kind: 'range', key: 'z', label: entry.battery ? 'battery.z' : 'board.z', hint: entry.battery ? 'battery.z.hint' : 'board.z.hint',
      min: 0, max: Z_MAX, step: 0.5,
      when: (state) => !hung(state),
      get: (state) => at(state).z,
      set: (state, value) => patchBoard(state, index, { z: Math.max(placementMinZ(at(state)), value) }),
    },
    {
      kind: 'range', key: 'gap', label: 'board.gap', hint: 'board.gap.hint', min: 0, max: Z_MAX, step: 0.1,
      when: hung,
      get: (state) => at(state).z,
      set: (state, value) => patchBoard(state, index, { z: value }),
    },
    {
      // the battery's own press is `press`: a clamped panel's is another control
      kind: 'range', key: 'clampPress', label: 'board.press', hint: 'board.press.hint', min: PRESS_MIN, max: PRESS_MAX, step: 0.1,
      when: clamped,
      get: (state) => at(state).press ?? 0,
      set: (state, value) => patchBoard(state, index, { press: value }),
    },
    ...backControls(index, entry),
    ...topControls(index, entry),
    {
      // a keyboard: one window over its keys or a hole per key (holes need the entry's rows)
      kind: 'segmented', key: 'keys', label: 'board.keys', hint: 'board.keys.hint',
      when: (state) => keyFields(boardOf(at(state))).length > 0,
      options: KEYS_OPEN.map((open) => ({ value: open, label: `board.keys.${open}` as const })),
      optionDisabled: (state, value) => value !== 'window' && !keyFields(boardOf(at(state))).some((field) => field.rows !== undefined),
      get: (state) => keysOpen(boardOf(at(state)), at(state)),
      set: (state, value) => {
        const placement = sanitizePlacement({ ...at(state), keys: value });
        return { ...state, boards: state.boards.map((one, i) => (i === index ? placement : one)) };
      },
    },
    {
      kind: 'range', key: 'keyFit', label: 'board.keyFit', hint: 'board.keyFit.hint', min: 0, max: KEY_FIT_MAX, step: 0.05,
      when: (state) => keyFields(boardOf(at(state))).length > 0,
      get: (state) => {
        const field = keyFields(boardOf(at(state)))[0];
        return field ? keyFit(boardOf(at(state)), at(state), field) : 0;
      },
      set: (state, value) => patchBoard(state, index, { keyFit: value }),
    },
    {
      // printed caps: round, or square with rounded corners
      kind: 'segmented', key: 'capShape', label: 'board.capShape', hint: 'board.capShape.hint',
      when: (state) => keysOpen(boardOf(at(state)), at(state)) === 'caps',
      options: CAP_SHAPES.map((shape) => ({ value: shape, label: `board.capShape.${shape}` as const })),
      get: (state) => capStyle(at(state)).shape,
      set: (state, value) => {
        const placement: BoardPlacement = { ...at(state), capShape: 'square' };
        if (value !== 'square') delete placement.capShape;
        return { ...state, boards: state.boards.map((one, i) => (i === index ? placement : one)) };
      },
    },
    {
      // the caps' width: from covering the buttons to as wide as the neighbours leave room for
      kind: 'range', key: 'capSize', label: 'board.capSize', hint: 'board.capSize.hint',
      min: capRange(entry, CAP_FIT).min, max: capRange(entry, CAP_FIT).max, step: 0.1,
      when: (state) => keysOpen(boardOf(at(state)), at(state)) === 'caps',
      get: (state) => {
        const def = boardOf(at(state));
        const field = keyFields(def).find((one) => one.rows);
        const [cap] = field ? capSizes(field, { size: at(state).capSize, fit: keyFit(def, at(state), field) }) : [];
        return cap ? +(2 * cap.stemR).toFixed(2) : 0;
      },
      set: (state, value) => {
        const def = boardOf(at(state));
        const field = keyFields(def).find((one) => one.rows);
        const range = capRange(def, field ? keyFit(def, at(state), field) : CAP_FIT);
        return patchBoard(state, index, { capSize: Math.min(range.max, Math.max(range.min, value)) });
      },
    },
    {
      kind: 'range', key: 'capR', label: 'board.capR', hint: 'board.capR.hint', min: CAP_R_MIN, max: CAP_R_MAX, step: 0.1,
      when: (state) => keysOpen(boardOf(at(state)), at(state)) === 'caps' && capStyle(at(state)).shape === 'square',
      get: (state) => capStyle(at(state)).r,
      set: (state, value) => patchBoard(state, index, { capR: Math.max(CAP_R_MIN, value) }),
    },
    {
      kind: 'check', key: 'bevel', label: 'board.bevel', hint: 'board.bevel.hint',
      // a screen's window, or a keyboard's window over its keys
      when: (state) => hung(state) && boardOf(at(state)).ports.some((port) => port.edge === 'top'
        && (port.type === 'display' || (port.type === 'keys' && keysOpen(boardOf(at(state)), at(state)) === 'window'))),
      get: (state) => at(state).bevel !== false,
      set: (state, value) => {
        const placement: BoardPlacement = { ...at(state), bevel: false };
        if (value) delete placement.bevel;
        return { ...state, boards: state.boards.map((one, i) => (i === index ? placement : one)) };
      },
    },
    {
      kind: 'check', key: 'pins', label: 'board.pins', hint: 'board.pins.hint',
      when: (state) => boardOf(at(state)).pins !== undefined,
      get: (state) => pinsDown(boardOf(at(state)), at(state)),
      // soldered pins need the room under the board: the board goes up with them
      set: (state, value) => {
        const next = { ...at(state), pins: value };
        return patchBoard(state, index, { pins: value, z: Math.max(placementMinZ(next), next.z) });
      },
    },
    {
      kind: 'segmented', key: 'rot', label: 'board.rot',
      options: ROTATIONS.map((rot) => ({ value: String(rot), text: `${rot}°` })),
      get: (state) => String(at(state).rot),
      set: (state, value) => patchBoard(state, index, { rot: ROTATIONS.find((rot) => String(rot) === value) ?? 0 }),
    },
    {
      kind: 'toggles', key: 'wall', label: 'board.wall', hint: 'board.wall.hint',
      when: (state) => state.shape.kind !== 'cylinder',
      options: EDGES.map((edge) => ({ value: edge, label: `face.${edge}` as const })),
      // a wall the board cannot stand against: the side lid's face, a rail edge
      optionDisabled: (state, value) => !(at(state).walls ?? []).some((wall) => wall === value) && !wallPossible(state, index, value),
      get: (state) => at(state).walls ?? [],
      set: (state, values) => {
        const walls = EDGES.filter((edge) => values.includes(edge));
        const placement: BoardPlacement = { ...at(state), walls, wallOffset: at(state).wallOffset ?? 0 };
        if (walls.length === 0) {
          delete placement.walls;
          delete placement.wallOffset;
        }
        return { ...state, boards: state.boards.map((one, i) => (i === index ? placement : one)) };
      },
    },
    {
      kind: 'range', key: 'wallOffset', label: 'board.wallOffset', hint: 'board.wallOffset.hint',
      min: WALL_OFFSET_MIN, max: WALL_OFFSET_MAX, step: 0.1,
      // a battery has no connectors to bring to the surface
      when: (state) => state.shape.kind !== 'cylinder' && (at(state).walls ?? []).length > 0 && battery(state) === undefined,
      get: (state) => at(state).wallOffset ?? 0,
      set: (state, value) => patchBoard(state, index, { wallOffset: value }),
    },
    {
      kind: 'check', key: 'railScrews', label: 'board.railScrews', hint: 'board.railScrews.hint', when: railed,
      get: (state) => at(state).railScrews === true,
      set: (state, value) => patchBoard(state, index, { railScrews: value ? true : undefined, railEars: value ? at(state).railEars : undefined }),
    },
    {
      kind: 'segmented', key: 'railEars', label: 'board.railEars', hint: 'board.railEars.hint', when: screwedRails,
      options: RAIL_EARS.map((value) => ({ value, label: `board.railEars.${value}` as const })),
      get: (state) => at(state).railEars ?? 'out',
      set: (state, value) => patchBoard(state, index, { railEars: value === 'along' ? 'along' : undefined }),
    },
    {
      kind: 'select', key: 'screw', label: 'board.screw', when: holes,
      // an M1.6 holds no rail
      options: SCREW_SIZES.filter((size) => entry.mount.kind !== 'rails' || size !== 'M1.6').map((size) => ({ value: size, text: size })),
      get: (state) => (screwedRails(state) ? railScrewSpec(at(state).mount) : at(state).mount).size,
      set: (state, value) => patchBoard(state, index, {
        mount: { ...at(state).mount, size: SCREW_SIZES.find((size) => size === value) ?? at(state).mount.size },
      }),
    },
    {
      kind: 'segmented', key: 'hole', label: 'board.hole', hint: 'board.hole.hint', when: holes,
      options: HOLE_KINDS.map((value) => ({ value, label: `hole.${value}` as const })),
      get: (state) => at(state).mount.hole,
      set: (state, value) => patchBoard(state, index, {
        mount: { ...at(state).mount, hole: HOLE_KINDS.find((kind) => kind === value) ?? at(state).mount.hole },
      }),
    },
  ];
}

/** A display with a back pattern: the board on its back, its turn and the standoffs' length. */
function backControls(index: number, entry: BoardDef): Control<AppState>[] {
  const pattern = entry.back;
  if (!pattern) return [];
  const at = (state: AppState): BoardPlacement => state.boards[index];
  const fits = CATALOG.filter((def) => !def.battery && attachTurns(entry, resolveVariant(def, def.variants?.[0].id)).length > 0);
  const child = (state: AppState): BoardDef | undefined => {
    const back = at(state).back;
    const found = back ? catalogBoard(back.board) : undefined;
    return found && back ? resolveVariant(found, back.variant) : undefined;
  };
  const setBack = (state: AppState, back: BackPlacement | null): AppState => {
    const placement: BoardPlacement = { ...at(state) };
    if (back) placement.back = back;
    else delete placement.back;
    return { ...state, boards: state.boards.map((one, i) => (i === index ? placement : one)) };
  };
  return [
    {
      kind: 'select', key: 'back', label: 'board.back', hint: 'board.back.hint',
      options: [{ value: '', label: 'board.back.none' }, ...fits.map((def) => ({ value: def.id, text: def.name }))],
      get: (state) => at(state).back?.board ?? '',
      set: (state, value) => {
        const found = catalogBoard(value);
        if (!found) return setBack(state, null);
        const def = resolveVariant(found, found.variants?.[0].id);
        const turns = attachTurns(entry, def);
        return setBack(state, {
          board: found.id, rot: turns[0] ?? 0, standoff: Math.max(pattern.standoff, backStandoffMin(entry, def)), cuts: {},
          ...(found.variants ? { variant: found.variants[0].id } : {}),
        });
      },
    },
    {
      kind: 'segmented', key: 'back_rot', label: 'board.back.rot',
      when: (state) => at(state).back !== undefined,
      options: ROTATIONS.map((rot) => ({ value: String(rot), text: `${rot}°` })),
      optionDisabled: (state, value) => {
        const def = child(state);
        return !def || !attachTurns(entry, def).some((turn) => String(turn) === value);
      },
      get: (state) => String(at(state).back?.rot ?? ''),
      set: (state, value) => {
        const back = at(state).back;
        return back ? setBack(state, { ...back, rot: ROTATIONS.find((rot) => String(rot) === value) ?? back.rot }) : state;
      },
    },
    {
      kind: 'range', key: 'back_standoff', label: 'board.back.standoff', hint: 'board.back.standoff.hint',
      min: BACK_STANDOFF_MIN, max: BACK_STANDOFF_MAX, step: 0.5,
      when: (state) => at(state).back !== undefined,
      get: (state) => at(state).back?.standoff ?? pattern.standoff,
      set: (state, value) => {
        const back = at(state).back;
        const def = child(state);
        return back && def ? setBack(state, { ...back, standoff: Math.max(backStandoffMin(entry, def), value) }) : state;
      },
    },
  ];
}

/** A board on the floor: the HAT display it carries, its turn and the standoffs' length (D9). */
function topControls(index: number, entry: BoardDef): Control<AppState>[] {
  if (entry.battery || entry.mount.kind !== 'holes') return [];
  const at = (state: AppState): BoardPlacement => state.boards[index];
  const board = resolveVariant(entry, entry.variants?.[0].id);
  const fits = CATALOG.filter((def) => def.back?.facing === 'top' && attachTurns(resolveVariant(def, def.variants?.[0].id), board).length > 0);
  if (fits.length === 0) return [];
  const display = (state: AppState): BoardDef | undefined => {
    const top = at(state).top;
    const found = top ? catalogBoard(top.board) : undefined;
    return found && top ? resolveVariant(found, top.variant) : undefined;
  };
  const setTop = (state: AppState, top: BackPlacement | null): AppState => {
    const placement: BoardPlacement = { ...at(state) };
    if (top) placement.top = top;
    else delete placement.top;
    return { ...state, boards: state.boards.map((one, i) => (i === index ? placement : one)) };
  };
  const floor = (state: AppState): boolean => !hangs(at(state));
  return [
    {
      kind: 'select', key: 'top', label: 'board.top', hint: 'board.top.hint', when: floor,
      options: [{ value: '', label: 'board.back.none' }, ...fits.map((def) => ({ value: def.id, text: def.name }))],
      get: (state) => at(state).top?.board ?? '',
      set: (state, value) => {
        const found = catalogBoard(value);
        const def = found ? resolveVariant(found, found.variants?.[0].id) : undefined;
        if (!found || !def?.back) return setTop(state, null);
        const turns = attachTurns(def, resolveVariant(entry, at(state).variant));
        return setTop(state, {
          board: found.id, rot: turns[0] ?? 0, standoff: Math.max(def.back.standoff, backStandoffMin(def, board)), cuts: {},
          ...(found.variants ? { variant: found.variants[0].id } : {}),
        });
      },
    },
    {
      kind: 'segmented', key: 'top_rot', label: 'board.back.rot',
      when: (state) => floor(state) && at(state).top !== undefined,
      options: ROTATIONS.map((rot) => ({ value: String(rot), text: `${rot}°` })),
      optionDisabled: (state, value) => {
        const def = display(state);
        return !def || !attachTurns(def, boardOf(at(state))).some((turn) => String(turn) === value);
      },
      get: (state) => String(at(state).top?.rot ?? ''),
      set: (state, value) => {
        const top = at(state).top;
        return top ? setTop(state, { ...top, rot: ROTATIONS.find((rot) => String(rot) === value) ?? top.rot }) : state;
      },
    },
    {
      kind: 'range', key: 'top_standoff', label: 'board.back.standoff', hint: 'board.top.standoff.hint',
      min: BACK_STANDOFF_MIN, max: BACK_STANDOFF_MAX, step: 0.5,
      when: (state) => floor(state) && at(state).top !== undefined,
      get: (state) => at(state).top?.standoff ?? 0,
      set: (state, value) => {
        const top = at(state).top;
        const def = display(state);
        return top && def ? setTop(state, { ...top, standoff: Math.max(backStandoffMin(def, boardOf(at(state))), value) }) : state;
      },
    },
  ];
}

/** One checkbox per port: cut an opening for it or not; then the ports of the board on a display's back. */
function portControls(index: number, state: AppState): Control<AppState>[] {
  const def = boardOf(state.boards[index]);
  const own = def.ports.map((port): Control<AppState> => ({
    kind: 'check',
    key: `cut_${port.id}`,
    label: { text: `${tDynamic(`port.${port.type}`)} · ${port.id}` },
    get: (current) => portCut(current.boards[index], port.id, ownPortDefault(current.boards[index], port)),
    set: (current, value) => patchBoard(current, index, {
      cuts: withPortCut(current.boards[index], { id: port.id, cut: ownPortDefault(current.boards[index], port) }, value).cuts,
    }),
  }));
  const top = state.boards[index].top;
  const topEntry = top ? catalogBoard(top.board) : undefined;
  if (top && topEntry) {
    const display = resolveVariant(topEntry, top.variant);
    return [...own, ...display.ports.map((port): Control<AppState> => ({
      kind: 'check',
      key: `top_cut_${port.id}`,
      label: { text: `${display.name} · ${tDynamic(`port.${port.type}`)} · ${port.id}` },
      get: (current) => current.boards[index].top?.cuts[port.id] ?? port.cut,
      set: (current, value) => {
        const now = current.boards[index].top;
        return now ? patchBoard(current, index, { top: { ...now, cuts: withTopCut(now, port, value) } }) : current;
      },
    }))];
  }
  const back = state.boards[index].back;
  const entry = back ? catalogBoard(back.board) : undefined;
  if (!back || !entry) return own;
  const child = resolveVariant(entry, back.variant);
  return [...own, ...child.ports.map((port): Control<AppState> => ({
    kind: 'check',
    key: `back_cut_${port.id}`,
    label: { text: `${child.name} · ${tDynamic(`port.${port.type}`)} · ${port.id}` },
    get: (current) => current.boards[index].back?.cuts[port.id] ?? backPortDefault(port),
    set: (current, value) => {
      const now = current.boards[index].back;
      return now ? patchBoard(current, index, { back: { ...now, cuts: withBackCut(now, port, value) } }) : current;
    },
  }))];
}

/** A row of plain action buttons under a label, styled like a segmented control. */
function actionRow(label: Key, hint: Key | null, buttons: { id: string; text: string; title?: string; run(): void }[]): HTMLElement {
  const row = make('div', 'row');
  const name = make('span', 'row-label', t(label));
  if (hint) name.title = t(hint);
  const group = make('div', 'segmented');
  for (const spec of buttons) {
    const button = make('button', 'seg-btn', spec.text);
    button.type = 'button';
    button.id = spec.id;
    if (spec.title) button.title = spec.title;
    button.addEventListener('click', spec.run);
    group.append(button);
  }
  row.append(name, group);
  return row;
}

const ARRANGE_LABELS: Record<ArrangeMode, Key> = {
  row: 'boards.arrange.row', column: 'boards.arrange.column', compact: 'boards.arrange.compact',
};

const ALIGN_LABELS: Record<Align, Key> = {
  left: 'align.left', centreX: 'align.centre', right: 'align.right', nextX: 'align.nextX',
  front: 'align.front', centreY: 'align.centre', back: 'align.back', nextY: 'align.nextY', height: 'align.height',
};

export interface BoardsCardHandle {
  sync(state: AppState): void;
}

/** The cap widths a keyboard's every field allows at a fit: the widest key at least, the tightest field's room at most. */
function capRange(def: BoardDef, fit: number): { min: number; max: number } {
  const ranges = keyFields(def).flatMap((field) => capSizeRange(field, fit) ?? []);
  if (ranges.length === 0) return { min: 0, max: 0 };
  const min = Math.max(...ranges.map((range) => range.min));
  return { min, max: Math.max(min, Math.min(...ranges.map((range) => range.max))) };
}

/** What the card's layout depends on; a change rebuilds it (a value edit does not). */
function signatureOf(state: AppState): string {
  // a variant brings its own ports, and so its own cut toggles
  // a battery's kind decides its controls, its cell count its name; how a board is held, its note
  return state.boards.map((board) => (board.board === 'custom' ? `custom:${customSignature(boardOf(board))}`
    : board.battery ? `battery:${board.battery.kind}:${board.battery.count}`
      : `${board.board}:${board.variant ?? ''}:${board.back?.board ?? ''}:${board.back?.variant ?? ''}:${board.top?.board ?? ''}:${board.hold ?? ''}:${board.railScrews ?? ''}`)).join('|');
}

export function renderBoardsCard(
  container: HTMLElement, read: () => AppState, onChange: (next: AppState) => void,
  download: (text: string, name: string) => void,
): BoardsCardHandle {
  let handles: ControlsHandle<AppState>[] = [];
  let signature = '';
  /** the gap the arrange and "beside" buttons keep between footprints, mm — a tool setting, not part of the case */
  let gap = NEW_BOARD_GAP;

  /** Arrange buttons for all the boards, and the gap they keep. */
  function arrangeBox(): HTMLElement {
    const box = make('div', 'board-arrange');
    box.id = 'boardsArrange';
    box.append(actionRow('boards.arrange', 'boards.arrange.hint', ARRANGE_MODES.map((mode) => ({
      id: `boardsArrange_${mode}`,
      text: t(ARRANGE_LABELS[mode]),
      title: mode === 'compact' ? t('boards.arrange.compact.title') : undefined,
      run: () => {
        const current = read();
        onChange({ ...current, boards: arrangeBoards(current, mode, gap) });
      },
    }))));
    const gapRow = make('div');
    box.append(gapRow);
    renderControls<{ gap: number }>(gapRow, [{
      kind: 'range', key: 'gap', label: 'boards.gap', hint: 'boards.gap.hint', min: 0, max: 30, step: 0.5,
      get: (local) => local.gap,
      set: (_local, value) => ({ gap: value }),
    }], () => ({ gap }), (next) => {
      gap = next.gap;
    }, 'boards');
    return box;
  }

  /** In a board's box: line it up with another board. */
  function alignBox(index: number, state: AppState): HTMLElement {
    const details = make('details', 'custom-details');
    details.id = `board${index}_align`;
    details.append(make('summary', undefined, t('board.align')));
    const refRow = make('label', 'row');
    refRow.append(make('span', 'row-label', t('board.align.ref')));
    const select = make('select');
    select.id = `board${index}_alignRef`;
    state.boards.forEach((other, i) => {
      if (i === index) return;
      const option = make('option', undefined, `${i + 1}. ${boardOf(other).name}`);
      option.value = String(i);
      select.append(option);
    });
    // the board above it by default: the one it was most likely placed after
    select.value = String(index > 0 ? index - 1 : 1);
    refRow.append(select);
    const run = (how: Align) => (): void => {
      const current = read();
      onChange({ ...current, boards: alignBoard(current, index, Number(select.value), how, gap) });
    };
    const buttons = (list: readonly Align[]) => list.map((how) => ({ id: `board${index}_align_${how}`, text: t(ALIGN_LABELS[how]), run: run(how) }));
    details.append(
      refRow,
      actionRow('board.align.x', 'board.align.hint', buttons(ALIGN_X)),
      actionRow('board.align.y', 'board.align.hint', buttons(ALIGN_Y)),
      actionRow('board.z', null, buttons(['height'])),
    );
    return details;
  }

  function build(state: AppState): void {
    container.replaceChildren();
    if (state.boards.length >= 2) container.append(arrangeBox());
    handles = state.boards.map((placement, index) => {
      const def = boardOf(placement);
      const box = make('div', 'board-box');
      box.id = `board${index}`;
      const head = make('div', 'board-head');
      head.append(make('span', 'board-name', `${index + 1}. ${def.battery?.kind === 'pack' ? t('battery.kind.pack') : def.name}`));
      if (!def.verified) {
        const mark = make('span', 'unverified', '≈');
        mark.title = t('board.unverified');
        head.append(mark);
      }
      const remove = make('button', 'tb-btn board-del', '✕');
      remove.type = 'button';
      remove.id = `board${index}_remove`;
      remove.title = t('board.remove');
      remove.setAttribute('aria-label', t('board.remove'));
      remove.addEventListener('click', () => {
        const current = read();
        onChange({ ...current, boards: current.boards.filter((_, i) => i !== index) });
      });
      head.append(remove);
      box.append(head);
      if (def.mount.kind === 'rails') box.append(make('p', 'board-note', t(railsScrewed(def, placement) ? 'board.rails.screwed' : 'board.rails')));
      if (def.battery) box.append(make('p', 'board-note', t('battery.note')));
      const controls = make('div');
      box.append(controls);
      if (state.boards.length >= 2) box.append(alignBox(index, state));
      let editor: CustomEditorHandle | null = null;
      if (placement.board === 'custom') {
        const details = make('details', 'custom-details');
        details.open = true;
        details.id = `board${index}_editor`;
        details.append(make('summary', undefined, t('custom.edit')));
        box.append(details);
        editor = renderCustomEditor(details, index, read, onChange, download);
      }
      const ports = portControls(index, state);
      let portRows: ControlsHandle<AppState> | null = null;
      if (ports.length > 0) {
        const title = make('p', 'sub-title', t('board.ports'));
        title.title = t('board.ports.hint');
        const list = make('div', 'port-list');
        box.append(title, list);
        portRows = renderControls(list, ports, read, onChange, `board${index}`);
      }
      container.append(box);
      const main = renderControls(controls, boardControls(index, entryOf(placement)), read, onChange, `board${index}`);
      return {
        sync: (current: AppState) => {
          main.sync(current);
          portRows?.sync(current);
          editor?.sync(boardOf(current.boards[index]));
        },
      };
    });
    if (state.boards.length === 0) container.append(make('p', 'board-note', t('boards.empty')));
  }

  function sync(state: AppState): void {
    const next = signatureOf(state);
    if (next !== signature) {
      signature = next;
      build(state);
    }
    for (const handle of handles) handle.sync(state);
  }

  signature = signatureOf(read());
  build(read());
  return { sync };
}
