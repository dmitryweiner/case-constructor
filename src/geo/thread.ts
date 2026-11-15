// Printed screws for the lid and the threads they go into. Pure: sizes, the
// thread's form, where a screw stands. The worker turns them into solids
// (screwSolids.ts).
//
// Both the screw and its hole are printed: a 60° profile half a pitch deep,
// with flat crests and roots, on the ISO pitches (6 × 1, 8 × 1.25,
// 10 × 1.5). A test print (plans/PLAN-IMPROVEMENTS-2026-10-25.md, R4) chose
// them over the coarser 6 × 1.5 the case had at first (it needed a 0.45 mm
// fit and still felt rough) and over a shallower print-friendly flank (it
// went in loose); 6 × 1 held well at the 0.35 mm fit. Below 6 mm a printed
// thread wears out in a few turns and the shank, printed standing, snaps at
// the head: P6 is the smallest that holds reliably. P4 (4 × 1, a thread half
// a millimetre deep) is offered at the user's risk, with a warning.
//
// The form, its section and the rod and hole made of it are maker-kit's
// csg/thread (its form came from here); the sizes, the screw and its
// engagement are the app's.

import { minorRadius as formMinorRadius, symmetricForm } from 'maker-kit/csg/thread';
import type { ThreadDetail, ThreadForm } from 'maker-kit/csg/thread';

export const THREAD_SIZES = ['P4', 'P6', 'P8', 'P10'] as const;
export type ThreadSize = (typeof THREAD_SIZES)[number];

/** Major diameter and pitch, mm. */
export const THREADS: Readonly<Record<ThreadSize, { d: number; pitch: number }>> = {
  P4: { d: 4, pitch: 1 },
  P6: { d: 6, pitch: 1 },
  P8: { d: 8, pitch: 1.25 },
  P10: { d: 10, pitch: 1.5 },
};

/** Sizes below this may strip or snap: the panel warns. */
export const THREAD_RELIABLE_D = 6;

export function isThreadSize(value: unknown): value is ThreadSize {
  return typeof value === 'string' && THREAD_SIZES.some((size) => size === value);
}

/** Plastic around a threaded hole in a post, mm. */
export const THREAD_WALL = 2;

/** The form of a size: the symmetric 60° profile, half a pitch deep. */
export function threadForm(size: ThreadSize): ThreadForm {
  return symmetricForm(THREADS[size].d, THREADS[size].pitch);
}

/** A size, or a form given in full (the test prints of other forms). */
export type ThreadSpec = ThreadSize | ThreadForm;

export function formOf(spec: ThreadSpec): ThreadForm {
  return typeof spec === 'string' ? threadForm(spec) : spec;
}

/** Minor radius of a thread: the major one less the thread depth. */
export function minorRadius(spec: ThreadSpec): number {
  return formMinorRadius(formOf(spec));
}

/**
 * Points around one turn of a thread (and slices per turn), by resolution:
 * 16 at the preview's 12 — four threaded holes stay inside the preview's
 * time — twice the segments for an export, at most 64.
 */
export function threadPoints(segments: number): number {
  return segments <= 12 ? 16 : Math.min(64, segments * 2);
}

/** A slice per point of the section and turn: the vertices run along the helix. */
export function perPoint(points: number): ThreadDetail {
  return { points, slicesPerTurn: points };
}

/** How deep a printed screw goes into its post: one and a half diameters. */
export function threadEngagement(size: ThreadSize): number {
  return 1.5 * THREADS[size].d;
}

/** A printed screw: a knurled thumb head with a slot, the threaded shank. */
export interface ScrewShape {
  size: ThreadSize;
  form: ThreadForm;
  headD: number;
  headH: number;
  /** from under the head to the tip */
  shank: number;
  slotW: number;
  slotDepth: number;
}

/**
 * The screw for a lid: the shank crosses the plate and the fit gap and
 * reaches `threadEngagement` into the post. The head stands proud of the lid
 * — a thumb screw, no counterbore.
 */
export function screwShape(size: ThreadSize, plate: number, fit: number): ScrewShape {
  const { d } = THREADS[size];
  const headH = 0.6 * d + 1;
  return {
    size,
    form: threadForm(size),
    headD: 2 * d,
    headH,
    shank: plate + fit + threadEngagement(size),
    slotW: 0.2 * d + 0.6,
    slotDepth: 0.4 * headH,
  };
}

/** Gap between printed screws laid out next to the lid, mm. */
export const SCREW_GAP = 4;
