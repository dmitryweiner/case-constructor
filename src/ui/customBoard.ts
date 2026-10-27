// The custom board editor: lives inside the board card of a placement whose
// board is 'custom'. Size, how it is held, a table of mounting holes, a table
// of ports and parts, and "Save as catalog JSON" in the catalog's format, so
// a measured board can be contributed.
//
// Table cells are number inputs: a value edit only changes the state, while
// adding or removing a row (or changing a port's edge, which changes its
// fields) rebuilds the editor — the card decides that by a signature.

import { make } from './dom';
import type { Key } from '../i18n';
import { t, tDynamic } from '../i18n';
import type { BoardDef, PortDef, PortType } from '../boards/schema';
import { EDGES, PORT_TYPES, PORT_TYPE_IDS, autoPortId, isPortType, onFace, sanitizePort } from '../boards/schema';
import type { BoardPlacement } from '../boards/placement';
import { withPortType } from '../boards/placement';
import { SCREW_SIZES } from '../geo/fasteners';
import type { AppState } from '../state/schema';

/** A fresh custom board: a 50 × 30 mm PCB with four M2.5 holes 3 mm in. */
export function defaultCustomBoard(): BoardDef {
  return {
    id: 'custom',
    name: 'Custom board',
    vendor: '',
    kind: 'mcu',
    size: { w: 50, d: 30, t: 1.6 },
    mount: {
      kind: 'holes',
      holes: [{ x: 3, y: 3, d: 2.7 }, { x: 47, y: 3, d: 2.7 }, { x: 3, y: 27, d: 2.7 }, { x: 47, y: 27, d: 2.7 }],
      screw: 'M2.5',
      rails: 'long',
    },
    topHeight: 8,
    bottomHeight: 2,
    ports: [],
    source: '',
    verified: false,
  };
}

/** What the editor's layout depends on: a change here rebuilds it. */
export function customSignature(def: BoardDef): string {
  return JSON.stringify([def.mount.kind, def.mount.holes.length, def.ports.map((port) => [port.id, port.edge])]);
}

/** The board in the catalog's JSON format (plans/PLAN.md §2.2), ready to contribute. */
export function catalogJson(def: BoardDef): string {
  const slug = def.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'custom-board';
  const ports = def.ports.map((port) => {
    const base: PortType = PORT_TYPES[port.type];
    const common = { id: port.id, type: port.type };
    const size = {
      w: port.w, h: port.h, ...(port.shape === 'rect' ? { d: port.d } : {}),
      ...(port.cutH !== undefined && port.cutH !== base.cutH ? { cutH: port.cutH } : {}),
    };
    return onFace(port)
      ? { ...common, edge: port.edge, x: port.x, y: port.y, ...size }
      : { ...common, edge: port.edge, along: port.along, z: port.z, ...size, protrude: port.protrude };
  });
  return `${JSON.stringify({
    id: slug,
    name: def.name,
    vendor: def.vendor,
    kind: def.kind,
    size: def.size,
    ...(def.outline ? { outline: def.outline } : {}),
    mount: def.mount.kind === 'holes'
      ? { kind: 'holes', holes: def.mount.holes, screw: def.mount.screw }
      : { kind: 'rails', holes: [], screw: def.mount.screw, rails: def.mount.rails },
    topHeight: def.topHeight,
    bottomHeight: def.bottomHeight,
    ...(def.pins ? { pins: def.pins } : {}),
    ports,
    source: def.source,
    verified: false,
  }, null, 2)}\n`;
}

function numberInput(id: string, value: number, step: number, onInput: (value: number) => void): HTMLInputElement {
  const input = make('input', 'num');
  input.type = 'number';
  input.id = id;
  input.step = String(step);
  input.value = String(+value.toFixed(2));
  input.addEventListener('input', () => {
    const next = Number(input.value);
    if (input.value !== '' && Number.isFinite(next)) onInput(next);
  });
  return input;
}

function selectInput(id: string, options: readonly { value: string; text: string }[], value: string, onChange: (value: string) => void): HTMLSelectElement {
  const select = make('select');
  select.id = id;
  for (const option of options) {
    const node = make('option', undefined, option.text);
    node.value = option.value;
    select.append(node);
  }
  select.value = value;
  select.addEventListener('change', () => onChange(select.value));
  return select;
}

function labelled(label: Key, control: HTMLElement): HTMLElement {
  const row = make('label', 'row');
  row.append(make('span', 'row-label', t(label)), control);
  return row;
}

function headerRow(keys: readonly Key[]): HTMLElement {
  const row = make('div', 'table-row table-head');
  for (const key of keys) row.append(make('span', undefined, t(key)));
  row.append(make('span'));
  return row;
}

export interface CustomEditorHandle {
  /** writes current values into inputs that are not being edited */
  sync(def: BoardDef): void;
}

/**
 * Renders the editor for board `index`. `update` gets a function that turns
 * the current definition into the next one.
 */
export function renderCustomEditor(
  container: HTMLElement, index: number, read: () => AppState, onChange: (next: AppState) => void,
  download: (text: string, name: string) => void,
): CustomEditorHandle {
  const prefix = `board${index}_custom`;
  const current = (): BoardDef => read().boards[index].custom ?? defaultCustomBoard();
  const updatePlacement = (change: (placement: BoardPlacement) => BoardPlacement): void => {
    const state = read();
    onChange({ ...state, boards: state.boards.map((board, i) => (i === index ? change(board) : board)) });
  };
  const update = (change: (def: BoardDef) => BoardDef): void => updatePlacement((board) => ({
    ...board, custom: change(board.custom ?? defaultCustomBoard()),
  }));
  const def = current();
  const box = make('div', 'custom-editor');
  const inputs = new Map<string, (def: BoardDef) => number | string>();
  const track = (input: HTMLInputElement, get: (def: BoardDef) => number | string): HTMLInputElement => {
    inputs.set(input.id, get);
    return input;
  };

  const name = make('input');
  name.type = 'text';
  name.id = `${prefix}_name`;
  name.maxLength = 60;
  name.value = def.name;
  name.dir = 'auto';
  name.addEventListener('input', () => update((d) => ({ ...d, name: name.value })));
  inputs.set(name.id, (d) => d.name);
  box.append(labelled('custom.name', name));

  const size = make('div', 'table-row');
  const sizeField = (key: 'w' | 'd' | 't', label: Key, step: number): void => {
    const cell = make('label', 'cell');
    cell.append(make('span', undefined, t(label)), track(
      numberInput(`${prefix}_${key}`, def.size[key], step, (value) => update((d) => ({ ...d, size: { ...d.size, [key]: value } }))),
      (d) => d.size[key],
    ));
    size.append(cell);
  };
  sizeField('w', 'custom.w', 0.5);
  sizeField('d', 'custom.d', 0.5);
  sizeField('t', 'custom.t', 0.1);
  box.append(size);

  const heights = make('div', 'table-row');
  for (const [key, label] of [['topHeight', 'custom.top'], ['bottomHeight', 'custom.bottom']] as const) {
    const cell = make('label', 'cell');
    cell.append(make('span', undefined, t(label)), track(
      numberInput(`${prefix}_${key}`, def[key], 0.5, (value) => update((d) => ({ ...d, [key]: value }))),
      (d) => d[key],
    ));
    heights.append(cell);
  }
  box.append(heights);

  box.append(labelled('custom.mount', selectInput(`${prefix}_mount`, [
    { value: 'holes', text: t('mount.holes') }, { value: 'rails', text: t('mount.rails') },
  ], def.mount.kind, (value) => update((d) => ({
    ...d,
    mount: { ...d.mount, kind: value === 'rails' ? 'rails' : 'holes', holes: value === 'rails' ? [] : (d.mount.holes.length ? d.mount.holes : defaultCustomBoard().mount.holes) },
  })))));

  if (def.mount.kind === 'rails') {
    box.append(labelled('custom.rails', selectInput(`${prefix}_rails`, [
      { value: 'long', text: t('rails.long') }, { value: 'short', text: t('rails.short') },
    ], def.mount.rails, (value) => update((d) => ({ ...d, mount: { ...d.mount, rails: value === 'short' ? 'short' : 'long' } })))));
  } else {
    box.append(labelled('board.screw', selectInput(`${prefix}_screw`, SCREW_SIZES.map((s) => ({ value: s, text: s })), def.mount.screw,
      (value) => update((d) => ({ ...d, mount: { ...d.mount, screw: SCREW_SIZES.find((s) => s === value) ?? d.mount.screw } })))));
    box.append(make('p', 'sub-title', t('custom.holes')));
    box.append(headerRow(['col.x', 'col.y', 'col.d']));
    def.mount.holes.forEach((hole, h) => {
      const row = make('div', 'table-row');
      for (const key of ['x', 'y', 'd'] as const) {
        row.append(track(numberInput(`${prefix}_hole${h}_${key}`, hole[key], key === 'd' ? 0.1 : 0.5, (value) => update((d) => ({
          ...d, mount: { ...d.mount, holes: d.mount.holes.map((item, i) => (i === h ? { ...item, [key]: value } : item)) },
        }))), (d) => d.mount.holes[h]?.[key] ?? 0));
      }
      const del = make('button', 'tb-btn row-del', '✕');
      del.type = 'button';
      del.id = `${prefix}_hole${h}_remove`;
      del.title = t('custom.remove');
      del.addEventListener('click', () => update((d) => ({ ...d, mount: { ...d.mount, holes: d.mount.holes.filter((_, i) => i !== h) } })));
      row.append(del);
      box.append(row);
    });
    const add = make('button', 'tb-btn', t('custom.hole.add'));
    add.type = 'button';
    add.id = `${prefix}_hole_add`;
    add.addEventListener('click', () => update((d) => ({
      ...d, mount: { ...d.mount, holes: [...d.mount.holes, { x: d.size.w / 2, y: d.size.d / 2, d: 2.7 }] },
    })));
    box.append(add);
  }

  box.append(make('p', 'sub-title', t('custom.ports')));
  def.ports.forEach((port, p) => box.append(portRow(port, p)));
  const addPort = make('button', 'tb-btn', t('custom.port.add'));
  addPort.type = 'button';
  addPort.id = `${prefix}_port_add`;
  addPort.addEventListener('click', () => update((d) => {
    const port: unknown = { id: autoPortId('usb-c', new Set(d.ports.map((item) => item.id))), type: 'usb-c', edge: 'front', along: d.size.w / 2 };
    return { ...d, ports: [...d.ports, portFrom(port, d.size)] };
  }));
  box.append(addPort);

  const save = make('button', 'tb-btn wide', t('custom.save'));
  save.type = 'button';
  save.id = `${prefix}_save`;
  save.title = t('custom.save.title');
  save.addEventListener('click', () => {
    const board = current();
    const text = catalogJson(board);
    const parsed: unknown = JSON.parse(text);
    const id = typeof parsed === 'object' && parsed !== null ? String(Reflect.get(parsed, 'id')) : 'custom-board';
    download(text, `${id}.json`);
  });
  box.append(save);
  container.append(box);

  function portRow(port: PortDef, p: number): HTMLElement {
    const wrap = make('div', 'port-edit');
    const head = make('div', 'table-row');
    const setPort = (change: (item: Record<string, unknown>) => Record<string, unknown>): void => update((d) => ({
      ...d, ports: d.ports.map((item, i) => (i === p ? portFrom(change({ ...item }), d.size) : item)),
    }));
    head.append(selectInput(`${prefix}_port${p}_type`, PORT_TYPE_IDS.map((id) => ({ value: id, text: tDynamic(`port.${id}`) })), port.type,
      // a new type brings its own sizes, and an automatic id follows it
      (value) => { if (isPortType(value)) updatePlacement((board) => withPortType(board, p, value)); }));
    head.append(selectInput(`${prefix}_port${p}_edge`, [...EDGES, 'top', 'bottom'].map((edge) => ({ value: edge, text: tDynamic(`face.${edge}`) })), port.edge,
      (value) => setPort((item) => ({ ...item, edge: value }))));
    const del = make('button', 'tb-btn row-del', '✕');
    del.type = 'button';
    del.id = `${prefix}_port${p}_remove`;
    del.title = t('custom.remove');
    del.addEventListener('click', () => update((d) => ({ ...d, ports: d.ports.filter((_, i) => i !== p) })));
    head.append(del);
    wrap.append(head);

    const fields: readonly [string, Key][] = onFace(port)
      ? [['x', 'col.x'], ['y', 'col.y'], ['w', 'col.w'], ['d', 'col.depth'], ['h', 'col.h']]
      : [['along', 'col.along'], ['z', 'col.z'], ['w', 'col.w'], ['h', 'col.h'], ['protrude', 'col.protrude']];
    const values = make('div', 'table-row');
    for (const [key, label] of fields) {
      const cell = make('label', 'cell');
      const value = Number(Reflect.get(port, key) ?? 0);
      cell.append(make('span', undefined, t(label)), track(numberInput(`${prefix}_port${p}_${key}`, value, 0.1,
        (next) => setPort((item) => ({ ...item, [key]: next }))), (d) => Number(Reflect.get(d.ports[p] ?? {}, key) ?? 0)));
      values.append(cell);
    }
    wrap.append(values);
    return wrap;
  }

  return {
    sync(next: BoardDef): void {
      for (const [id, get] of inputs) {
        const input = document.getElementById(id);
        if (!(input instanceof HTMLInputElement) || input === document.activeElement) continue;
        const value = get(next);
        input.value = typeof value === 'number' ? String(+value.toFixed(2)) : value;
      }
    },
  };
}

/** A port from loose fields, through the board schema: missing sizes come from the type. */
function portFrom(raw: unknown, size: { w: number; d: number }): PortDef {
  return sanitizePort(raw, size, 0) ?? {
    id: 'generic', type: 'generic', w: 5, h: 3, d: 5, clearance: 0.5, shape: 'rect', cut: false,
    edge: 'front', along: size.w / 2, z: 0, protrude: 0,
  };
}
