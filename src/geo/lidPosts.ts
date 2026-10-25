// The lid's corner posts as the worker builds them, and how big a screw
// head's seat may be over them. Pure: the main thread warns and limits the
// sliders with it, the worker clamps what a file asks for.

import type { Dims, Face } from './face';
import { faceFrame } from './face';
import type { PostSpot } from './fastening';
import { postSpots } from './fastening';
import { THROUGH_CLEARANCE } from './fasteners';
import { caseLayout, effectiveLid } from './layout';
import type { LidState } from './lidSpec';
import { HEAD_FLOOR } from './lidSpec';
import { openingPolygon } from './opening';
import type { ShapeState } from './shape';
import { plateOf, shapeSpec } from './shape';
import type { AppState } from '../state/schema';

/** Plastic a head's seat keeps from the edge of the lid's face, mm. */
export const SEAT_WALL = 0.8;

/** The lid's corner posts (in the lid's face frame), its plate and parting depth. */
export function lidPosts(state: AppState) {
  const layout = caseLayout(state);
  const { dims } = layout;
  const shape = { ...state.shape, console: layout.console };
  const lid = effectiveLid(shape, state.lid, dims);
  const frame = faceFrame(lid.face, dims);
  const plate = plateOf(shape, lid.face);
  const zp = -(plate + lid.depth);
  const opening = openingPolygon(shapeSpec(shape, dims), frame, zp, lid.lip.h, 8);
  return { frame, plate, zp, shape, dims, lid, spots: lid.fastening === 'snaps' ? [] : postSpots(opening, lid, shape.wall) };
}

/**
 * How far the nearest post centre is from the edge of the lid's face: its
 * outline, with the case's rounded corners on the top and the bottom (a
 * disc on a cylinder). A seat may run into an edge fillet, as it always
 * could; it must not cut through the lid's side.
 */
export function seatRoom(spots: readonly PostSpot[], shape: ShapeState, dims: Dims, face: Face): number {
  const { w, h } = faceFrame(face, dims).extent;
  const roundFace = face === 'top' || face === 'bottom';
  return Math.min(Infinity, ...spots.map(({ centre: [u, v] }) => {
    if (roundFace && shape.kind === 'cylinder') return dims.w / 2 - Math.hypot(u - w / 2, v - h / 2);
    const r = roundFace && shape.kind !== 'cylinder' ? Math.min(shape.cornerR, w / 2, h / 2) : 0;
    const cu = Math.min(Math.max(u, r), w - r);
    const cv = Math.min(Math.max(v, r), h - r);
    if (Math.abs(u - cu) < 1e-9 && Math.abs(v - cv) < 1e-9) return Math.min(u, w - u, v, h - v);
    return r - Math.hypot(u - cu, v - cv);
  }));
}

/** The largest head seat the lid takes: its diameter (the screw head's, the seat adds the clearance) and depth. */
export function headLimits(spots: readonly PostSpot[], shape: ShapeState, dims: Dims, lid: LidState): { d: number; depth: number } {
  const plate = plateOf(shape, lid.face);
  return {
    d: 2 * (seatRoom(spots, shape, dims, lid.face) - SEAT_WALL) - THROUGH_CLEARANCE,
    depth: plate - HEAD_FLOOR,
  };
}

/** Head limits for a state, as the lid card and the warnings need them. */
export function headLimitsOf(state: AppState): { d: number; depth: number } {
  const { spots, shape, dims, lid } = lidPosts(state);
  return headLimits(spots, shape, dims, lid);
}
