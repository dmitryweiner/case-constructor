// Printed screws for the lid and the threads they go into. Pure: sizes, the
// thread's cross-section, where a screw stands. The worker turns them into
// solids (screwSolids.ts).
//
// Both the screw and its hole are printed, so the thread is not ISO: a 60°
// profile, half a pitch deep, with flat crests and roots — coarse enough for
// a 0.4 mm nozzle. Below 6 mm (pitch 1.5) a printed thread wears out in a
// few turns and the shank, printed standing, snaps at the head: P6 is the
// smallest size.
//
// A single-start helical thread has the same horizontal cross-section at
// every height, turned by 360° per pitch: the thread is that section
// extruded with a twist — no helix mesh by hand, closed by construction.

import type { Vec2 } from './section';

export const THREAD_SIZES = ['P6', 'P8', 'P10'] as const;
export type ThreadSize = (typeof THREAD_SIZES)[number];

/** Major diameter and pitch, mm. */
export const THREADS: Readonly<Record<ThreadSize, { d: number; pitch: number }>> = {
  P6: { d: 6, pitch: 1.5 },
  P8: { d: 8, pitch: 2 },
  P10: { d: 10, pitch: 2.5 },
};

export function isThreadSize(value: unknown): value is ThreadSize {
  return typeof value === 'string' && THREAD_SIZES.some((size) => size === value);
}

/** Plastic around a threaded hole in a post, mm. */
export const THREAD_WALL = 2;

/** Thread depth (radial) as a share of the pitch. */
const DEPTH_SHARE = 0.5;
/** Axial width of one flank: 30° from the radial direction. */
const FLANK_SHARE = DEPTH_SHARE * Math.tan(Math.PI / 6);

/** Minor radius of a thread: the major one less the thread depth. */
export function minorRadius(size: ThreadSize): number {
  const { d, pitch } = THREADS[size];
  return d / 2 - DEPTH_SHARE * pitch;
}

/**
 * Radius of the thread at an axial phase t ∈ [0, 1) of the pitch: the
 * crest flat, the falling flank, the root flat, the rising flank.
 */
function profile(t: number, major: number, minor: number): number {
  const flat = (1 - 2 * FLANK_SHARE) / 2;
  if (t < flat) return major;
  if (t < flat + FLANK_SHARE) return major - ((t - flat) / FLANK_SHARE) * (major - minor);
  if (t < 2 * flat + FLANK_SHARE) return minor;
  return minor + ((t - 2 * flat - FLANK_SHARE) / FLANK_SHARE) * (major - minor);
}

/**
 * The thread's horizontal cross-section at z = 0, counter-clockwise, `n`
 * points: at angle θ the radius is the profile at phase −θ / 2π, so the
 * section turned by 360° · z / pitch is the section at height z — a
 * right-hand thread. `grow` widens it radially (a hole: the fit clearance).
 */
export function threadSection(size: ThreadSize, grow: number, n: number): Vec2[] {
  const major = THREADS[size].d / 2 + grow;
  const minor = minorRadius(size) + grow;
  return Array.from({ length: n }, (_, i): Vec2 => {
    const theta = (2 * Math.PI * i) / n;
    const t = (((-i / n) % 1) + 1) % 1;
    const r = profile(t, major, minor);
    return [r * Math.cos(theta), r * Math.sin(theta)];
  });
}

/**
 * Points around one turn of a thread (and slices per turn), by resolution:
 * 16 at the preview's 12 — four threaded holes stay inside the preview's
 * time — twice the segments for an export, at most 64.
 */
export function threadPoints(segments: number): number {
  return segments <= 12 ? 16 : Math.min(64, segments * 2);
}

/** How deep a printed screw goes into its post: one and a half diameters. */
export function threadEngagement(size: ThreadSize): number {
  return 1.5 * THREADS[size].d;
}

/** A printed screw: a knurled thumb head with a slot, the threaded shank. */
export interface ScrewShape {
  size: ThreadSize;
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
    headD: 2 * d,
    headH,
    shank: plate + fit + threadEngagement(size),
    slotW: 0.2 * d + 0.6,
    slotDepth: 0.4 * headH,
  };
}

/** Gap between printed screws laid out next to the lid, mm. */
export const SCREW_GAP = 4;
