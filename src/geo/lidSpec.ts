// Lid parameters and their sanitizer. Pure: the main thread reads them for
// the panel and the checks; the worker's parting.ts builds the solids.

import type { Face } from './face';
import { isFace } from './face';
import type { FastenerSpec } from './fasteners';
import { defaultFastener, sanitizeFastener } from './fasteners';
import type { ShapeKind } from './shape';
import { clampNum } from './shape';

export const FASTENINGS = ['snaps', 'screws'] as const;
export type Fastening = (typeof FASTENINGS)[number];

export interface LidState {
  face: Face;
  /** 0 = a flat plate; more = the lid takes this much of the walls, mm */
  depth: number;
  fastening: Fastening;
  screw: FastenerSpec;
  /** skirt height and thickness */
  lip: { h: number; t: number };
  /** printing clearance between the skirt and the walls */
  fit: number;
}

export const DEPTH_MAX = 200;

export function defaultLid(): LidState {
  return {
    face: 'top',
    depth: 0,
    fastening: 'snaps',
    screw: { ...defaultFastener('M3'), head: 'counterbore' },
    lip: { h: 3, t: 1.2 },
    fit: 0.2,
  };
}

/** Faces a lid may sit on for this shape (the cylinder's side and the console's slope cannot). */
export function lidFaces(kind: ShapeKind): readonly Face[] {
  if (kind === 'cylinder') return ['top', 'bottom'];
  if (kind === 'console') return ['bottom', 'front', 'back', 'left', 'right'];
  return ['top', 'bottom', 'front', 'back', 'left', 'right'];
}

function isFastening(value: unknown): value is Fastening {
  return typeof value === 'string' && FASTENINGS.some((kind) => kind === value);
}

export function sanitizeLid(raw: unknown, kind: ShapeKind): LidState {
  const d = defaultLid();
  const r = typeof raw === 'object' && raw !== null ? raw : {};
  const face: unknown = Reflect.get(r, 'face');
  const lip: unknown = Reflect.get(r, 'lip');
  const lipRec = typeof lip === 'object' && lip !== null ? lip : {};
  const fastening: unknown = Reflect.get(r, 'fastening');
  const allowed = lidFaces(kind);
  return {
    face: isFace(face) && allowed.includes(face) ? face : allowed[0],
    depth: clampNum(Reflect.get(r, 'depth'), 0, DEPTH_MAX, d.depth),
    fastening: isFastening(fastening) ? fastening : d.fastening,
    screw: sanitizeFastener(Reflect.get(r, 'screw'), d.screw),
    lip: {
      h: clampNum(Reflect.get(lipRec, 'h'), 1.5, 10, d.lip.h),
      t: clampNum(Reflect.get(lipRec, 't'), 0.8, 4, d.lip.t),
    },
    fit: clampNum(Reflect.get(r, 'fit'), 0, 0.6, d.fit),
  };
}
