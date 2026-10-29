// Screw table: every diameter the case derives from a screw size. Defaults
// in mm; this table is the one place to tune fits after a test print (there
// is deliberately no global hole compensation parameter).

export const SCREW_SIZES = ['M1.6', 'M2', 'M2.5', 'M3', 'M4'] as const;
export type ScrewSize = (typeof SCREW_SIZES)[number];
/** The lid's posts take M2 and up: an M1.6 does not hold a lid. */
export const LID_SCREW_SIZES = ['M2', 'M2.5', 'M3', 'M4'] as const satisfies readonly ScrewSize[];

/** plain hole for a self-tapping screw | heat-set insert | embedded hex nut */
export const HOLE_KINDS = ['tap', 'insert', 'nut'] as const;
export type HoleKind = (typeof HOLE_KINDS)[number];

/** lid screws only: how the head sits in the lid plate */
export const HEAD_KINDS = ['none', 'counterbore', 'countersunk'] as const;
export type HeadKind = (typeof HEAD_KINDS)[number];

export interface FastenerSpec {
  size: ScrewSize;
  hole: HoleKind;
  head: HeadKind;
}

export interface ScrewDims {
  /** nominal diameter */
  d: number;
  /** pilot hole for a self-tapping screw */
  tap: number;
  /** hole for a heat-set insert */
  insert: number;
  /** insert length = depth of its hole */
  insertLen: number;
  /** hex nut across flats */
  nutAF: number;
  nutH: number;
  /** pan head */
  headD: number;
  headH: number;
}

export const SCREWS: Readonly<Record<ScrewSize, ScrewDims>> = {
  // M1.6: small boards' holes (a custom board); the insert is an estimate until a real one is measured
  'M1.6': { d: 1.6, tap: 1.3, insert: 2.4, insertLen: 3, nutAF: 3.2, nutH: 1.3, headD: 3.2, headH: 1.3 },
  'M2': { d: 2, tap: 1.7, insert: 3.2, insertLen: 4, nutAF: 4.0, nutH: 1.6, headD: 3.8, headH: 1.3 },
  'M2.5': { d: 2.5, tap: 2.2, insert: 3.5, insertLen: 4, nutAF: 5.0, nutH: 2.0, headD: 4.5, headH: 1.7 },
  'M3': { d: 3, tap: 2.6, insert: 4.0, insertLen: 5, nutAF: 5.5, nutH: 2.4, headD: 5.5, headH: 2.0 },
  'M4': { d: 4, tap: 3.5, insert: 5.6, insertLen: 6, nutAF: 7.0, nutH: 3.2, headD: 7.0, headH: 2.6 },
};

/**
 * Head diameter of a countersunk screw (DIN 7991 / ISO 10642; the smaller
 * cross-recess heads of DIN 965 sink a little deeper in the same seat).
 */
export const COUNTERSUNK_HEAD_D: Readonly<Record<ScrewSize, number>> = {
  'M1.6': 3.2, 'M2': 4, 'M2.5': 5, 'M3': 6, 'M4': 8,
};

/** Disc magnets for the lid, diameter × height. */
export const MAGNET_SIZES = ['5x2', '6x2', '6x3', '8x2', '8x3', '10x2', '10x3'] as const;
export type MagnetSize = (typeof MAGNET_SIZES)[number];

export const MAGNETS: Readonly<Record<MagnetSize, { d: number; h: number }>> = {
  '5x2': { d: 5, h: 2 },
  '6x2': { d: 6, h: 2 },
  '6x3': { d: 6, h: 3 },
  '8x2': { d: 8, h: 2 },
  '8x3': { d: 8, h: 3 },
  '10x2': { d: 10, h: 2 },
  '10x3': { d: 10, h: 3 },
};

export function isMagnetSize(value: unknown): value is MagnetSize {
  return typeof value === 'string' && MAGNET_SIZES.some((size) => size === value);
}

/** Wall around any hole in a standoff or post. */
export const BOSS_WALL = 1.6;
/** Smallest standoff or post diameter. */
export const BOSS_MIN_D = 5;
/** Clearance around a nut in its pocket, across flats. */
export const NUT_CLEARANCE = 0.4;
/** Clearance of a through hole for the screw shank. */
export const THROUGH_CLEARANCE = 0.4;

export function isScrewSize(value: unknown): value is ScrewSize {
  return typeof value === 'string' && SCREW_SIZES.some((size) => size === value);
}

export function isLidScrewSize(value: unknown): value is (typeof LID_SCREW_SIZES)[number] {
  return typeof value === 'string' && LID_SCREW_SIZES.some((size) => size === value);
}

export function isHoleKind(value: unknown): value is HoleKind {
  return typeof value === 'string' && HOLE_KINDS.some((kind) => kind === value);
}

export function isHeadKind(value: unknown): value is HeadKind {
  return typeof value === 'string' && HEAD_KINDS.some((kind) => kind === value);
}

export function defaultFastener(size: ScrewSize = 'M2.5'): FastenerSpec {
  return { size, hole: 'tap', head: 'none' };
}

export function sanitizeFastener(raw: unknown, fallback: FastenerSpec = defaultFastener()): FastenerSpec {
  if (typeof raw !== 'object' || raw === null) return { ...fallback };
  const size: unknown = Reflect.get(raw, 'size');
  const hole: unknown = Reflect.get(raw, 'hole');
  const head: unknown = Reflect.get(raw, 'head');
  return {
    size: isScrewSize(size) ? size : fallback.size,
    hole: isHoleKind(hole) ? hole : fallback.hole,
    head: isHeadKind(head) ? head : fallback.head,
  };
}

/** Diameter of the hole the screw goes into, by hole kind (a nut pocket still has a tap-sized bore above it). */
export function holeDiameter(spec: FastenerSpec): number {
  const dims = SCREWS[spec.size];
  return spec.hole === 'insert' ? dims.insert : dims.tap;
}

/** Outer diameter of a standoff or post carrying this fastener. */
export function bossDiameter(spec: FastenerSpec): number {
  const dims = SCREWS[spec.size];
  const inner = spec.hole === 'nut' ? dims.nutAF + NUT_CLEARANCE : holeDiameter(spec);
  return Math.max(BOSS_MIN_D, inner + 2 * BOSS_WALL);
}
