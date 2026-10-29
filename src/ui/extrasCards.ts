// Cards of the extras: vents and the fan seat (in Openings), the wall mount
// (its own card). Vents and fan are toggled cards; the wall mount is a
// choice with "none".

import type { CardHandle } from './card';
import { createCard } from './card';
import type { Control, ControlsHandle } from './controls';
import { renderControls } from './controls';
import { make } from './dom';
import { FACES } from '../geo/face';
import type { FanState, VentState, WallMountState } from '../geo/extras';
import {
  EAR_ALONG, EAR_COUNT_MAX, EAR_SIDES, EAR_WALLS, FAN_SIZES, KEYHOLE_STYLES, MOUNT_KINDS, VENT_PATTERNS, earChoice, earSideFaces, earWallChoices, earWalls, mountFace, mountFaces,
} from '../geo/extras';
import type { AppState } from '../state/schema';

const vents = (state: AppState, patch: Partial<VentState>): AppState => ({ ...state, vents: { ...state.vents, ...patch } });
const fan = (state: AppState, patch: Partial<FanState>): AppState => ({ ...state, fan: { ...state.fan, ...patch } });
const mount = (state: AppState, patch: Partial<WallMountState>): AppState => ({ ...state, wallMount: { ...state.wallMount, ...patch } });

function ventControls(): Control<AppState>[] {
  return [
    {
      // a row of faces like the wall mount's, any number pressed
      kind: 'toggles', key: 'face', label: 'vents.faces', hint: 'vents.faces.hint',
      options: FACES.map((value) => ({ value, label: `face.${value}` as const })),
      get: (state) => state.vents.faces,
      set: (state, values) => vents(state, { faces: FACES.filter((face) => values.includes(face)) }),
    },
    {
      kind: 'segmented', key: 'pattern', label: 'vents.pattern',
      options: VENT_PATTERNS.map((value) => ({ value, label: `vents.${value}` as const })),
      get: (state) => state.vents.pattern,
      set: (state, value) => vents(state, { pattern: VENT_PATTERNS.find((p) => p === value) ?? state.vents.pattern }),
    },
    {
      kind: 'segmented', key: 'along', label: 'vents.along', when: (state) => state.vents.pattern === 'slots',
      options: [{ value: 'x', label: 'vents.horizontal' }, { value: 'y', label: 'vents.vertical' }],
      get: (state) => state.vents.along,
      set: (state, value) => vents(state, { along: value === 'x' ? 'x' : 'y' }),
    },
    {
      kind: 'range', key: 'size', label: 'vents.size', hint: 'vents.size.hint', min: 1, max: 10, step: 0.5,
      get: (state) => state.vents.size, set: (state, value) => vents(state, { size: value }),
    },
    {
      kind: 'range', key: 'pitch', label: 'vents.pitch', hint: 'vents.pitch.hint', min: 2, max: 30, step: 0.5,
      get: (state) => state.vents.pitch, set: (state, value) => vents(state, { pitch: value }),
    },
    {
      kind: 'range', key: 'margin', label: 'vents.margin', hint: 'vents.margin.hint', min: 1, max: 40, step: 0.5,
      get: (state) => state.vents.margin, set: (state, value) => vents(state, { margin: value }),
    },
  ];
}

function fanControls(): Control<AppState>[] {
  return [
    {
      kind: 'select', key: 'face', label: 'cut.face',
      options: FACES.map((value) => ({ value, label: `face.${value}` as const })),
      get: (state) => state.fan.face,
      set: (state, value) => fan(state, { face: FACES.find((f) => f === value) ?? state.fan.face }),
    },
    {
      kind: 'segmented', key: 'size', label: 'fan.size',
      options: FAN_SIZES.map((size) => ({ value: String(size), text: `${size}` })),
      get: (state) => String(state.fan.size),
      set: (state, value) => fan(state, { size: FAN_SIZES.find((size) => String(size) === value) ?? state.fan.size }),
    },
    {
      kind: 'range', key: 'x', label: 'fan.x', hint: 'fan.xy.hint', min: -100, max: 100, step: 0.5,
      get: (state) => state.fan.x, set: (state, value) => fan(state, { x: value }),
    },
    {
      kind: 'range', key: 'y', label: 'fan.y', hint: 'fan.xy.hint', min: -100, max: 100, step: 0.5,
      get: (state) => state.fan.y, set: (state, value) => fan(state, { y: value }),
    },
    {
      kind: 'range', key: 'screwD', label: 'fan.screwD', min: 2, max: 5, step: 0.1,
      get: (state) => state.fan.screwD, set: (state, value) => fan(state, { screwD: value }),
    },
  ];
}

const ears = (state: AppState, patch: Partial<WallMountState['ears']>): AppState => mount(state, { ears: { ...state.wallMount.ears, ...patch } });

/** Whether some wall gets two ears or more: only then does "along the wall" mean anything (a box; a cylinder spaces them evenly). */
function earsShareWall(state: AppState): boolean {
  const { count, walls } = state.wallMount.ears;
  return state.wallMount.kind === 'ears' && state.shape.kind !== 'cylinder' && count >= (walls === 'one' ? 2 : 3);
}

function mountControls(): Control<AppState>[] {
  return [
    {
      kind: 'segmented', key: 'kind', label: 'mount.kind',
      // a hinged case hangs on no wall
      when: (state) => state.shape.kind !== 'hinged',
      options: MOUNT_KINDS.map((value) => ({ value, label: `mount.${value}` as const })),
      get: (state) => state.wallMount.kind,
      set: (state, value) => mount(state, { kind: MOUNT_KINDS.find((k) => k === value) ?? state.wallMount.kind }),
    },
    {
      kind: 'segmented', key: 'face', label: 'mount.face', hint: 'mount.face.hint',
      options: FACES.map((value) => ({ value, label: `face.${value}` as const })),
      optionDisabled: (state, value) => !mountFaces(state.shape.kind, state.wallMount.kind).some((face) => face === value),
      when: (state) => state.wallMount.kind !== 'none',
      get: (state) => mountFace(state.wallMount, state.shape.kind),
      set: (state, value) => mount(state, { face: FACES.find((face) => face === value) ?? state.wallMount.face }),
    },
    {
      kind: 'segmented', key: 'keyhole', label: 'mount.keyhole', hint: 'mount.keyhole.hint',
      options: KEYHOLE_STYLES.map((value) => ({ value, label: `keyhole.${value}` as const })),
      when: (state) => state.wallMount.kind === 'keyholes',
      get: (state) => state.wallMount.keyhole,
      set: (state, value) => mount(state, { keyhole: KEYHOLE_STYLES.find((k) => k === value) ?? state.wallMount.keyhole }),
    },
    {
      kind: 'segmented', key: 'earCount', label: 'mount.earCount',
      options: Array.from({ length: EAR_COUNT_MAX }, (_, i) => ({ value: String(i + 1), text: String(i + 1) })),
      when: (state) => state.wallMount.kind === 'ears',
      get: (state) => String(state.wallMount.ears.count),
      set: (state, value) => ears(state, { count: Number(value) }),
    },
    {
      kind: 'segmented', key: 'earWalls', label: 'mount.earWalls', hint: 'mount.earWalls.hint',
      options: EAR_WALLS.map((value) => ({ value, label: `earWalls.${value}` as const })),
      optionDisabled: (state, value) => !earWallChoices(mountFace(state.wallMount, state.shape.kind), state.shape.kind).some((walls) => walls === value),
      when: (state) => state.wallMount.kind === 'ears',
      get: (state) => earChoice(state.wallMount, state.shape.kind),
      set: (state, value) => ears(state, { walls: EAR_WALLS.find((w) => w === value) ?? state.wallMount.ears.walls }),
    },
    {
      kind: 'select', key: 'earWall', label: 'mount.earWall',
      options: EAR_SIDES.map((value) => ({ value, label: `face.${value}` as const })),
      optionDisabled: (state, value) => !earSideFaces(mountFace(state.wallMount, state.shape.kind), state.shape.kind).some((side) => side === value),
      when: (state) => state.wallMount.kind === 'ears' && state.wallMount.ears.walls === 'one',
      get: (state) => earWalls(state.wallMount, state.shape.kind)[0],
      set: (state, value) => ears(state, { wall: EAR_SIDES.find((w) => w === value) ?? state.wallMount.ears.wall }),
    },
    {
      kind: 'segmented', key: 'earAlong', label: 'mount.earAlong', hint: 'mount.earAlong.hint',
      options: EAR_ALONG.map((value) => ({ value, label: `earAlong.${value}` as const })),
      when: earsShareWall,
      get: (state) => state.wallMount.ears.along,
      set: (state, value) => ears(state, { along: EAR_ALONG.find((a) => a === value) ?? state.wallMount.ears.along }),
    },
    {
      kind: 'range', key: 'spacing', label: 'mount.spacing', min: 10, max: 300, step: 1,
      when: (state) => state.wallMount.kind === 'keyholes' || (earsShareWall(state) && state.wallMount.ears.along === 'centre'),
      get: (state) => state.wallMount.spacing, set: (state, value) => mount(state, { spacing: value }),
    },
    {
      kind: 'range', key: 'screwD', label: 'mount.screwD', hint: 'mount.screwD.hint', min: 2.5, max: 6, step: 0.1,
      when: (state) => state.wallMount.kind !== 'none',
      get: (state) => state.wallMount.screwD, set: (state, value) => mount(state, { screwD: value }),
    },
  ];
}

export interface ExtrasHandle {
  sync(state: AppState): void;
}

export function renderExtras(
  openings: HTMLElement, mounting: HTMLElement, read: () => AppState, onChange: (next: AppState) => void,
): ExtrasHandle {
  openings.replaceChildren();
  mounting.replaceChildren();
  const cards: { card: CardHandle; on: (state: AppState) => boolean; rows: ControlsHandle<AppState> }[] = [];
  const toggled = (
    container: HTMLElement, id: string, title: 'panel.vents' | 'panel.fan',
    on: (state: AppState) => boolean, set: (state: AppState, value: boolean) => AppState, controls: Control<AppState>[],
  ): void => {
    const card = createCard(container, { id, title, enabled: on(read()), onToggle: (value) => onChange(set(read(), value)) });
    cards.push({ card, on, rows: renderControls(card.body, controls, read, onChange, id) });
  };
  toggled(openings, 'vents', 'panel.vents', (s) => s.vents.on, (s, v) => vents(s, { on: v }), ventControls());
  toggled(openings, 'fan', 'panel.fan', (s) => s.fan.on, (s, v) => fan(s, { on: v }), fanControls());
  const mountBox = make('div');
  mounting.append(mountBox);
  const mountRows = renderControls(mountBox, mountControls(), read, onChange, 'mount');
  return {
    sync(state: AppState): void {
      for (const { card, on, rows } of cards) {
        card.setEnabled(on(state));
        rows.sync(state);
      }
      mountRows.sync(state);
    },
  };
}
