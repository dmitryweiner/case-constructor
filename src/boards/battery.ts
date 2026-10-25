// Batteries in the case: cylindrical cells side by side, or a flat pack
// (a LiPo pouch, a power bank) of the user's size. Pure. A battery is placed
// like a board — the layout, the alignment, the walls and the overlap checks
// take it as one — through a board entry made from its spec (`batteryDef`):
// no PCB, no ports, no mounting holes; the worker holds it with cradles on
// the floor and a clamp screwed over it (batterySolids.ts).

import type { ScrewSize } from '../geo/fasteners';
import type { BoardDef } from './schema';

export const CELL_KINDS = ['18650', '21700', '14500', '10440'] as const;
export type CellKind = (typeof CELL_KINDS)[number];
export const BATTERY_KINDS = [...CELL_KINDS, 'pack'] as const;
export type BatteryKind = (typeof BATTERY_KINDS)[number];

/**
 * Cells, diameter × length, mm: the largest common ones (a protected 18650
 * is up to 69 mm long; AA is 14500, AAA 10440).
 */
export const CELLS: Readonly<Record<CellKind, { d: number; l: number }>> = {
  '18650': { d: 18.6, l: 69 },
  '21700': { d: 21.6, l: 71 },
  '14500': { d: 14.6, l: 51 },
  '10440': { d: 10.6, l: 45 },
};

export interface BatterySpec {
  kind: BatteryKind;
  /** cells side by side (a pack: 1) */
  count: number;
  /** a pack's size, mm: w along its length, d across, h high */
  pack: { w: number; d: number; h: number };
}

export const CELL_COUNT_MAX = 4;
export const PACK_MIN = { w: 10, d: 10, h: 2 } as const;
export const PACK_MAX = { w: 200, d: 150, h: 40 } as const;

/** Rib between two cells' seats, and outside the outer ones, mm. */
export const CELL_RIB = 1.2;
/** Room around a cell in its seat, mm. */
export const SEAT_CLEARANCE = 0.3;
/**
 * Room the clamp takes over the battery: the bar and a screw head, mm. The
 * case grows by it, so the clamp never meets the lid.
 */
export const CLAMP_ABOVE = 6;
/** Where the clamp posts go: this far beyond the battery on its front and back, mm. */
export const CLAMP_POST_ZONE = 8;
/** Default screw for the clamp. */
export const CLAMP_SCREW: ScrewSize = 'M3';

export function defaultBattery(kind: BatteryKind = '18650'): BatterySpec {
  return { kind, count: kind === 'pack' ? 1 : 2, pack: { w: 60, d: 35, h: 8 } };
}

function num(x: unknown, min: number, max: number, fallback: number): number {
  const value = typeof x === 'number' && Number.isFinite(x) ? x : fallback;
  return Math.min(max, Math.max(min, value)) + 0;
}

export function sanitizeBattery(raw: unknown): BatterySpec {
  const r = typeof raw === 'object' && raw !== null ? raw : {};
  const kindRaw: unknown = Reflect.get(r, 'kind');
  const kind = BATTERY_KINDS.find((one) => one === kindRaw) ?? '18650';
  const d = defaultBattery(kind);
  const packRaw: unknown = Reflect.get(r, 'pack');
  const pack = typeof packRaw === 'object' && packRaw !== null ? packRaw : {};
  return {
    kind,
    count: kind === 'pack' ? 1 : Math.round(num(Reflect.get(r, 'count'), 1, CELL_COUNT_MAX, d.count)),
    pack: {
      w: num(Reflect.get(pack, 'w'), PACK_MIN.w, PACK_MAX.w, d.pack.w),
      d: num(Reflect.get(pack, 'd'), PACK_MIN.d, PACK_MAX.d, d.pack.d),
      h: num(Reflect.get(pack, 'h'), PACK_MIN.h, PACK_MAX.h, d.pack.h),
    },
  };
}

/** The battery's own box, mm: length along x, across y, height; cells with their seats' ribs. */
export function batterySize(spec: BatterySpec): { w: number; d: number; h: number } {
  if (spec.kind === 'pack') return { ...spec.pack };
  const cell = CELLS[spec.kind];
  return { w: cell.l, d: spec.count * (cell.d + CELL_RIB) + CELL_RIB, h: cell.d };
}

/** Cell axes across the battery (y in its own frame), mm; none for a pack. */
export function cellCentres(spec: BatterySpec): number[] {
  if (spec.kind === 'pack') return [];
  const { d } = CELLS[spec.kind];
  return Array.from({ length: spec.count }, (_, i) => CELL_RIB + (d + CELL_RIB) * i + d / 2);
}

/** The name in the card and the picker: "2 × 18650"; a pack by its size. */
export function batteryName(spec: BatterySpec): string {
  if (spec.kind === 'pack') return `${spec.pack.w} × ${spec.pack.d} × ${spec.pack.h}`;
  return spec.count > 1 ? `${spec.count} × ${spec.kind}` : spec.kind;
}

/**
 * The board entry a battery is placed by: its box as the outline, no PCB
 * (t = 0), its height plus the clamp's room as the parts on top, nothing
 * underneath; the clamp posts as reach beyond its front and back.
 */
export function batteryDef(spec: BatterySpec): BoardDef {
  const size = batterySize(spec);
  return {
    id: 'battery',
    name: batteryName(spec),
    vendor: '',
    kind: 'battery',
    size: { w: size.w, d: size.d, t: 0 },
    mount: { kind: 'holes', holes: [], screw: CLAMP_SCREW, rails: 'long' },
    topHeight: size.h + CLAMP_ABOVE,
    bottomHeight: 0,
    ports: [],
    source: '',
    verified: true,
    battery: spec,
  };
}
