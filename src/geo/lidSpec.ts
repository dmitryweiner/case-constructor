// Lid parameters and their sanitizer. Pure: the main thread reads them for
// the panel and the checks; the worker's parting.ts builds the solids.

import type { Face } from './face';
import { isFace } from './face';
import type { FastenerSpec, MagnetSize } from './fasteners';
import { BOSS_MIN_D, BOSS_WALL, MAGNETS, bossDiameter, defaultFastener, isLidScrewSize, isMagnetSize, sanitizeFastener } from './fasteners';
import type { ShapeKind } from './shape';
import type { ThreadSize } from './thread';
import { THREADS, THREAD_WALL, isThreadSize } from './thread';
import { clampNum } from './shape';

export const FASTENINGS = ['snaps', 'screws', 'magnets', 'printed'] as const;
export type Fastening = (typeof FASTENINGS)[number];

export interface LidState {
  /** the face the lid is built on: the chosen one, or an allowed one when the shape cannot have it */
  face: Face;
  /** the face the user chose last: it comes back when the shape allows it again */
  chosen: Face;
  /** 0 = a flat plate; more = the lid takes this much of the walls, mm */
  depth: number;
  fastening: Fastening;
  screw: FastenerSpec;
  /** magnets: the disc size and what its pocket adds to its diameter, mm */
  magnet: { size: MagnetSize; fit: number };
  /** printed screws: the thread size and the radial clearance of its hole, mm */
  thread: { size: ThreadSize; fit: number };
  /** skirt height and thickness */
  lip: { h: number; t: number };
  /** printing clearance between the skirt and the walls */
  fit: number;
}

export const DEPTH_MAX = 200;

export function defaultLid(): LidState {
  return {
    face: 'top',
    chosen: 'top',
    depth: 0,
    fastening: 'snaps',
    screw: { ...defaultFastener('M3'), head: 'counterbore' },
    magnet: { size: '6x3', fit: 0.2 },
    thread: { size: 'P6', fit: 0.2 },
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

/**
 * The lid when the shape changes to `kind`: on the face the user chose if
 * the shape allows it (box → console → box brings a top lid back on top),
 * else where it is, else on the first allowed face.
 */
export function lidForKind(lid: LidState, kind: ShapeKind): LidState {
  const allowed = lidFaces(kind);
  const face = allowed.includes(lid.chosen) ? lid.chosen : allowed.includes(lid.face) ? lid.face : allowed[0];
  return { ...lid, face };
}

function isFastening(value: unknown): value is Fastening {
  return typeof value === 'string' && FASTENINGS.some((kind) => kind === value);
}

/** A lid screw from a file may be a board size: the lid falls back to its default. */
function lidFastener(spec: FastenerSpec, fallback: FastenerSpec): FastenerSpec {
  return isLidScrewSize(spec.size) ? spec : { ...spec, size: fallback.size };
}

export function sanitizeLid(raw: unknown, kind: ShapeKind): LidState {
  const d = defaultLid();
  const r = typeof raw === 'object' && raw !== null ? raw : {};
  const face: unknown = Reflect.get(r, 'face');
  const chosen: unknown = Reflect.get(r, 'chosen');
  const lip: unknown = Reflect.get(r, 'lip');
  const lipRec = typeof lip === 'object' && lip !== null ? lip : {};
  const fastening: unknown = Reflect.get(r, 'fastening');
  const magnet: unknown = Reflect.get(r, 'magnet');
  const magnetRec = typeof magnet === 'object' && magnet !== null ? magnet : {};
  const magnetSize: unknown = Reflect.get(magnetRec, 'size');
  const thread: unknown = Reflect.get(r, 'thread');
  const threadRec = typeof thread === 'object' && thread !== null ? thread : {};
  const threadSize: unknown = Reflect.get(threadRec, 'size');
  const allowed = lidFaces(kind);
  return {
    face: isFace(face) && allowed.includes(face) ? face : allowed[0],
    // an old file has no choice: its face is the choice
    chosen: isFace(chosen) ? chosen : isFace(face) ? face : d.chosen,
    depth: clampNum(Reflect.get(r, 'depth'), 0, DEPTH_MAX, d.depth),
    fastening: isFastening(fastening) ? fastening : d.fastening,
    screw: lidFastener(sanitizeFastener(Reflect.get(r, 'screw'), d.screw), d.screw),
    magnet: {
      size: isMagnetSize(magnetSize) ? magnetSize : d.magnet.size,
      fit: clampNum(Reflect.get(magnetRec, 'fit'), 0, 0.5, d.magnet.fit),
    },
    thread: {
      size: isThreadSize(threadSize) ? threadSize : d.thread.size,
      fit: clampNum(Reflect.get(threadRec, 'fit'), 0.1, 0.4, d.thread.fit),
    },
    lip: {
      h: clampNum(Reflect.get(lipRec, 'h'), 1.5, 10, d.lip.h),
      t: clampNum(Reflect.get(lipRec, 't'), 0.8, 4, d.lip.t),
    },
    fit: clampNum(Reflect.get(r, 'fit'), 0, 0.6, d.fit),
  };
}

/** Outer diameter of a corner post: around the screw's hole, a magnet's pocket or a printed thread. */
export function postDiameter(lid: LidState): number {
  if (lid.fastening === 'magnets') return Math.max(BOSS_MIN_D, MAGNETS[lid.magnet.size].d + lid.magnet.fit + 2 * BOSS_WALL);
  if (lid.fastening === 'printed') return THREADS[lid.thread.size].d + 2 * lid.thread.fit + 2 * THREAD_WALL;
  return bossDiameter(lid.screw);
}
