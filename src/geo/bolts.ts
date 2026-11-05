// Through bolts: which bolt to buy and how deep a recessed nut sits. Pure,
// in the lid's face frame (z = 0 on the lid's outer face, the far face at
// −depth): the worker cuts the pocket by it, the main thread names the bolt
// and draws the hardware.
//
// A recessed nut sits as deep as the longest standard bolt that does not
// stick out of the far face needs: the bolt's end is flush with the nut's
// outer face, and the pocket is never shallower than the nut and its
// clearance. A nut on the face takes the shortest standard bolt through it.

import { NUT_CLEARANCE, SCREWS } from './fasteners';
import type { LidState } from './lidSpec';
import { HEAD_FLOOR, headSeat, nutSize } from './lidSpec';

/** ISO 4762's preferred lengths up to 100 mm (ISO 7380 and ISO 10642 share them). */
export const BOLT_LENGTHS = [5, 6, 8, 10, 12, 16, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 80, 90, 100] as const;

/** Plastic a recessed pocket keeps under the top of its column, mm. */
const POCKET_ROOF = 2;

export interface ThroughBolt {
  /** the bolt's length, mm: under the head, or overall for a countersunk head */
  length: number;
  /** one of BOLT_LENGTHS; false = longer than all of them (a threaded rod) */
  standard: boolean;
  /** where the length is measured from, face frame z: under the head, or the lid's face for a countersunk head */
  underHead: number;
  /** a recessed nut's pocket: from the far face to the nut's bearing face, mm; 0 for a nut on the face */
  pocket: number;
  /** how far the bolt's end stands out past a nut on the face, mm; 0 for a recessed nut */
  out: number;
}

export function throughBolt(lid: LidState, plate: number, depth: number): ThroughBolt {
  const seat = headSeat(lid);
  const underHead = lid.screw.head === 'counterbore' ? -Math.min(seat.depth, plate - HEAD_FLOOR) : 0;
  // from where the length is measured to the far face
  const span = depth + underHead;
  const { h } = nutSize(lid);
  if (lid.nut.place === 'surface') {
    const need = span + h;
    const length = BOLT_LENGTHS.find((one) => one >= need - 1e-9);
    return length === undefined
      ? { length: Math.ceil(need), standard: false, underHead, pocket: 0, out: Math.ceil(need) - need }
      : { length, standard: true, underHead, pocket: 0, out: length - need };
  }
  const shallowest = h + NUT_CLEARANCE;
  const deepest = Math.max(shallowest, depth - plate - lid.fit - POCKET_ROOF);
  const pocketFor = (length: number): number => Math.max(shallowest, span - length + h);
  const fits = (length: number): boolean => length <= span + 1e-9 && pocketFor(length) <= deepest + 1e-9;
  const length = [...BOLT_LENGTHS].reverse().find(fits);
  if (length !== undefined) return { length, standard: true, underHead, pocket: pocketFor(length), out: 0 };
  // no standard bolt fits: the whole length, the nut just inside the face
  const whole = Math.floor(span - NUT_CLEARANCE);
  return { length: whole, standard: false, underHead, pocket: pocketFor(whole), out: 0 };
}

/**
 * How far the hardware stands out of the lid's face and of the far face,
 * mm: a pan head on a flat seat or over a shallow counterbore (a
 * countersunk head is flush), a nut on the face and the bolt's end past it.
 */
export function hardwareProud(lid: LidState, plate: number, depth: number): { lid: number; far: number } {
  const bolt = throughBolt(lid, plate, depth);
  const headH = SCREWS[lid.screw.size].headH;
  const head = lid.screw.head === 'countersunk' ? 0 : Math.max(0, headH + bolt.underHead);
  return { lid: head, far: lid.nut.place === 'surface' ? nutSize(lid).h + bolt.out : 0 };
}
