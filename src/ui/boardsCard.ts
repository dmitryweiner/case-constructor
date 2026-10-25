// The Boards card: one box per placed board — position, height, rotation,
// how it is held — and a remove button. The list is rebuilt when boards are
// added or removed; otherwise only synced, so a slider keeps its focus.
// With two boards or more: arrange buttons for all of them on top, and in
// each box a way to line it up with another board (geo/arrange.ts).

import { make } from './dom';
import type { Control, ControlsHandle } from './controls';
import { renderControls } from './controls';
import { t } from '../i18n';
import type { BoardPlacement } from '../boards/placement';
import { NEW_BOARD_GAP, POSITION_MAX, ROTATIONS, Z_MAX, boardOf, entryOf, pinsDown, placementMinZ, portCut, withPortCut } from '../boards/placement';
import type { BoardDef } from '../boards/schema';
import type { Align, ArrangeMode } from '../geo/arrange';
import { ALIGN_X, ALIGN_Y, ARRANGE_MODES, alignBoard, arrangeBoards } from '../geo/arrange';
import type { Key } from '../i18n';
import { tDynamic } from '../i18n';
import type { CustomEditorHandle } from './customBoard';
import { customSignature, renderCustomEditor } from './customBoard';
import { HOLE_KINDS, SCREW_SIZES } from '../geo/fasteners';
import type { AppState } from '../state/schema';

function patchBoard(state: AppState, index: number, patch: Partial<BoardPlacement>): AppState {
  return { ...state, boards: state.boards.map((board, i) => (i === index ? { ...board, ...patch } : board)) };
}

function boardControls(index: number, entry: BoardDef): Control<AppState>[] {
  const at = (state: AppState): BoardPlacement => state.boards[index];
  const holes = (state: AppState): boolean => boardOf(at(state)).mount.kind === 'holes';
  return [
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
      kind: 'range', key: 'z', label: 'board.z', hint: 'board.z.hint', min: 0, max: Z_MAX, step: 0.5,
      get: (state) => at(state).z,
      set: (state, value) => patchBoard(state, index, { z: Math.max(placementMinZ(at(state)), value) }),
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
    set: (current, value) => patchBoard(current, index, { cuts: withPortCut(current.boards[index], port, value).cuts }),
  }));
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

/** What the card's layout depends on; a change rebuilds it (a value edit does not). */
function signatureOf(state: AppState): string {
  // a variant brings its own ports, and so its own cut toggles
  return state.boards.map((board) => (board.board === 'custom' ? `custom:${customSignature(boardOf(board))}` : `${board.board}:${board.variant ?? ''}`)).join('|');
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
