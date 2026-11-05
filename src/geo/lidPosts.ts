// The lid's corner posts as the worker builds them, how big a screw head's
// seat may be over them, whether a through bolt's nut fits the far face.
// Pure: the main thread warns and limits the sliders with it, the worker
// clamps what a file asks for (a head's seat; a nut only gets a warning).

import { throughBolt } from './bolts';
import type { Dims, Face } from './face';
import { OPPOSITE, faceFrame } from './face';
import type { PostSpot } from './fastening';
import { postSpots } from './fastening';
import { NUT_CLEARANCE, THROUGH_CLEARANCE } from './fasteners';
import { caseLayout, effectiveLid } from './layout';
import type { LidState } from './lidSpec';
import { HEAD_FLOOR, nutSize } from './lidSpec';
import type { LabelHead } from './label';
import type { Message } from './message';
import { openingPolygon } from './opening';
import type { ShapeState } from './shape';
import { applyAffine } from './surface';
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

/**
 * Whether a through bolt's nut runs past the far face's edge: its corners
 * (a recessed one's pocket's) within SEAT_WALL of it. A recessed nut's
 * column grows with the nut, so it is mostly a nut on the face, wider than
 * its column, that does.
 */
export function nutOverEdge(spots: readonly PostSpot[], shape: ShapeState, dims: Dims, lid: LidState): boolean {
  const corner = (nutSize(lid).af + (lid.nut.place === 'recessed' ? NUT_CLEARANCE : 0)) / Math.sqrt(3);
  return corner > seatRoom(spots, shape, dims, OPPOSITE[lid.face]) - SEAT_WALL + 1e-6;
}

/** Through bolts' nuts on the far face, in that face's frame: the labels there keep clear of them. */
export function nutHeads(state: AppState): LabelHead[] {
  const { frame, spots, lid, dims } = lidPosts(state);
  if (lid.fastening !== 'through') return [];
  const face = OPPOSITE[lid.face];
  const far = faceFrame(face, dims);
  const r = (nutSize(lid).af + NUT_CLEARANCE) / Math.sqrt(3) + 0.5;
  return spots.map((spot) => {
    const [u, v] = applyAffine(far.toFace, applyAffine(frame.fromFace, [spot.centre[0], spot.centre[1], -frame.depth]));
    return { u, v, r, face };
  });
}

/**
 * What to buy for through bolts and where the nuts sit; a bolt longer than
 * the standard ones, a nut over the far face's edge, a case standing on
 * its nuts.
 */
export function throughNotes(state: AppState): Message[] {
  const { frame, plate, shape, dims, lid, spots } = lidPosts(state);
  if (lid.fastening !== 'through' || spots.length === 0) return [];
  const bolt = throughBolt(lid, plate, frame.depth);
  const out: Message[] = [];
  const n = spots.length;
  const size = lid.screw.size;
  out.push(lid.nut.place === 'recessed'
    ? { code: 'info.boltsRecessed', params: { n, size, length: bolt.length, depth: bolt.pocket.toFixed(1) } }
    : { code: 'info.boltsOnFace', params: { n, size, length: bolt.length, out: bolt.out.toFixed(1) } });
  if (!bolt.standard) out.push({ code: 'warn.boltTooLong', params: { length: bolt.length } });
  if (nutOverEdge(spots, shape, dims, lid)) out.push({ code: 'warn.nutOverEdge' });
  // a hinged half's far face may be its inner one: the gap takes the nuts there
  if (lid.nut.place === 'surface' && lid.face === 'top' && shape.kind !== 'hinged') out.push({ code: 'info.standsOnNuts' });
  return out;
}
