// The Boards card: one box per placed board — position, height, rotation,
// how it is held — and a remove button. The list is rebuilt when boards are
// added or removed; otherwise only synced, so a slider keeps its focus.

import { make } from './dom';
import type { Control, ControlsHandle } from './controls';
import { renderControls } from './controls';
import { t } from '../i18n';
import type { BoardPlacement } from '../boards/placement';
import { POSITION_MAX, ROTATIONS, Z_MAX, boardOf, minBoardZ, portCut } from '../boards/placement';
import { tDynamic } from '../i18n';
import { HOLE_KINDS, SCREW_SIZES } from '../geo/fasteners';
import type { AppState } from '../state/schema';

function patchBoard(state: AppState, index: number, patch: Partial<BoardPlacement>): AppState {
  return { ...state, boards: state.boards.map((board, i) => (i === index ? { ...board, ...patch } : board)) };
}

function boardControls(index: number): Control<AppState>[] {
  const at = (state: AppState): BoardPlacement => state.boards[index];
  const holes = (state: AppState): boolean => boardOf(at(state)).mount.kind === 'holes';
  return [
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
      kind: 'range', key: 'z', label: 'board.z', hint: 'board.z.hint', min: 0, max: Z_MAX, step: 0.5,
      get: (state) => at(state).z,
      set: (state, value) => patchBoard(state, index, { z: Math.max(minBoardZ(boardOf(at(state))), value) }),
    },
    {
      kind: 'segmented', key: 'rot', label: 'board.rot',
      options: ROTATIONS.map((rot) => ({ value: String(rot), text: `${rot}°` })),
      get: (state) => String(at(state).rot),
      set: (state, value) => patchBoard(state, index, { rot: ROTATIONS.find((rot) => String(rot) === value) ?? 0 }),
    },
    {
      kind: 'select', key: 'screw', label: 'board.screw', when: holes,
      options: SCREW_SIZES.map((size) => ({ value: size, text: size })),
      get: (state) => at(state).mount.size,
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

/** One checkbox per port: cut an opening for it or not. */
function portControls(index: number, state: AppState): Control<AppState>[] {
  const def = boardOf(state.boards[index]);
  return def.ports.map((port): Control<AppState> => ({
    kind: 'check',
    key: `cut_${port.id}`,
    label: { text: `${tDynamic(`port.${port.type}`)} · ${port.id}` },
    get: (current) => portCut(current.boards[index], port.id, port.cut),
    set: (current, value) => {
      const cuts = { ...current.boards[index].cuts };
      if (value === port.cut) delete cuts[port.id];
      else cuts[port.id] = value;
      return patchBoard(current, index, { cuts });
    },
  }));
}

export interface BoardsCardHandle {
  sync(state: AppState): void;
}

export function renderBoardsCard(
  container: HTMLElement, read: () => AppState, onChange: (next: AppState) => void,
): BoardsCardHandle {
  let handles: ControlsHandle<AppState>[] = [];
  let signature = '';

  function build(state: AppState): void {
    container.replaceChildren();
    handles = state.boards.map((placement, index) => {
      const def = boardOf(placement);
      const box = make('div', 'board-box');
      box.id = `board${index}`;
      const head = make('div', 'board-head');
      head.append(make('span', 'board-name', `${index + 1}. ${def.name}`));
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
      if (def.mount.kind === 'rails') box.append(make('p', 'board-note', t('board.rails')));
      const controls = make('div');
      box.append(controls);
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
      const main = renderControls(controls, boardControls(index), read, onChange, `board${index}`);
      return { sync: (current: AppState) => { main.sync(current); portRows?.sync(current); } };
    });
    if (state.boards.length === 0) container.append(make('p', 'board-note', t('boards.empty')));
  }

  function sync(state: AppState): void {
    const next = state.boards.map((board) => board.board).join('|');
    if (next !== signature) {
      signature = next;
      build(state);
    }
    for (const handle of handles) handle.sync(state);
  }

  signature = read().boards.map((board) => board.board).join('|');
  build(read());
  return { sync };
}
