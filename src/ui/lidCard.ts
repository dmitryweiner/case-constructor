// The Lid card: which face, how deep, how it holds, how it fits.

import type { Control } from './controls';
import { FACES } from '../geo/face';
import type { LidState } from '../geo/lidSpec';
import { DEPTH_MAX, FASTENINGS, lidFaces } from '../geo/lidSpec';
import { HEAD_KINDS, HOLE_KINDS, LID_SCREW_SIZES, MAGNETS, MAGNET_SIZES } from '../geo/fasteners';
import { THREADS, THREAD_SIZES } from '../geo/thread';
import type { AppState } from '../state/schema';

function lidOf(state: AppState, patch: Partial<LidState>): AppState {
  return { ...state, lid: { ...state.lid, ...patch } };
}

export function lidControls(): Control<AppState>[] {
  const screws = (state: AppState): boolean => state.lid.fastening === 'screws';
  const magnets = (state: AppState): boolean => state.lid.fastening === 'magnets';
  const printed = (state: AppState): boolean => state.lid.fastening === 'printed';
  return [
    {
      kind: 'segmented', key: 'face', label: 'lid.face',
      options: FACES.map((value) => ({ value, label: `face.${value}` as const })),
      optionDisabled: (state, value) => !lidFaces(state.shape.kind).some((face) => face === value),
      get: (state) => state.lid.face,
      set: (state, value) => lidOf(state, { face: FACES.find((face) => face === value) ?? state.lid.face }),
    },
    {
      kind: 'range', key: 'depth', label: 'lid.depth', hint: 'lid.depth.hint',
      min: 0, max: Math.min(DEPTH_MAX, 60), step: 0.5,
      get: (state) => state.lid.depth,
      set: (state, value) => lidOf(state, { depth: value }),
    },
    {
      kind: 'segmented', key: 'fastening', label: 'lid.fastening',
      options: FASTENINGS.map((value) => ({ value, label: `fastening.${value}` as const })),
      get: (state) => state.lid.fastening,
      set: (state, value) => lidOf(state, { fastening: FASTENINGS.find((f) => f === value) ?? state.lid.fastening }),
    },
    {
      kind: 'select', key: 'screw', label: 'lid.screw', when: screws,
      options: LID_SCREW_SIZES.map((size) => ({ value: size, text: size })),
      get: (state) => state.lid.screw.size,
      set: (state, value) => lidOf(state, { screw: { ...state.lid.screw, size: LID_SCREW_SIZES.find((size) => size === value) ?? state.lid.screw.size } }),
    },
    {
      kind: 'segmented', key: 'hole', label: 'lid.hole', hint: 'board.hole.hint', when: screws,
      options: HOLE_KINDS.map((value) => ({ value, label: `hole.${value}` as const })),
      get: (state) => state.lid.screw.hole,
      set: (state, value) => lidOf(state, { screw: { ...state.lid.screw, hole: HOLE_KINDS.find((kind) => kind === value) ?? state.lid.screw.hole } }),
    },
    {
      kind: 'segmented', key: 'head', label: 'lid.head', hint: 'lid.head.hint', when: screws,
      options: HEAD_KINDS.map((value) => ({ value, label: `head.${value}` as const })),
      get: (state) => state.lid.screw.head,
      set: (state, value) => lidOf(state, { screw: { ...state.lid.screw, head: HEAD_KINDS.find((kind) => kind === value) ?? state.lid.screw.head } }),
    },
    {
      kind: 'select', key: 'magnet', label: 'lid.magnet', hint: 'lid.magnet.hint', when: magnets,
      options: MAGNET_SIZES.map((size) => ({ value: size, text: `${MAGNETS[size].d} × ${MAGNETS[size].h}` })),
      get: (state) => state.lid.magnet.size,
      set: (state, value) => lidOf(state, { magnet: { ...state.lid.magnet, size: MAGNET_SIZES.find((size) => size === value) ?? state.lid.magnet.size } }),
    },
    {
      kind: 'range', key: 'magnetFit', label: 'lid.magnetFit', hint: 'lid.magnetFit.hint', when: magnets, min: 0, max: 0.5, step: 0.05,
      get: (state) => state.lid.magnet.fit,
      set: (state, value) => lidOf(state, { magnet: { ...state.lid.magnet, fit: value } }),
    },
    {
      kind: 'select', key: 'thread', label: 'lid.thread', hint: 'lid.thread.hint', when: printed,
      options: THREAD_SIZES.map((size) => ({ value: size, text: `${THREADS[size].d} × ${THREADS[size].pitch}` })),
      get: (state) => state.lid.thread.size,
      set: (state, value) => lidOf(state, { thread: { ...state.lid.thread, size: THREAD_SIZES.find((size) => size === value) ?? state.lid.thread.size } }),
    },
    {
      kind: 'range', key: 'threadFit', label: 'lid.threadFit', hint: 'lid.threadFit.hint', when: printed, min: 0.1, max: 0.4, step: 0.05,
      get: (state) => state.lid.thread.fit,
      set: (state, value) => lidOf(state, { thread: { ...state.lid.thread, fit: value } }),
    },
    {
      kind: 'range', key: 'lipH', label: 'lid.lipH', hint: 'lid.lipH.hint', min: 1.5, max: 10, step: 0.5,
      get: (state) => state.lid.lip.h,
      set: (state, value) => lidOf(state, { lip: { ...state.lid.lip, h: value } }),
    },
    {
      kind: 'range', key: 'lipT', label: 'lid.lipT', min: 0.8, max: 4, step: 0.1,
      get: (state) => state.lid.lip.t,
      set: (state, value) => lidOf(state, { lip: { ...state.lid.lip, t: value } }),
    },
    {
      kind: 'range', key: 'fit', label: 'lid.fit', hint: 'lid.fit.hint', min: 0, max: 0.6, step: 0.05,
      get: (state) => state.lid.fit,
      set: (state, value) => lidOf(state, { fit: value }),
    },
  ];
}
