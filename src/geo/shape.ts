// The case shape: its parameters, their sanitizer, and the pure description
// of the outer and inner solids (loft specs plus, for the console, the
// sloped trimming plane). The worker turns these into solids (shell.ts); the
// main thread uses them for sizes and checks without touching WASM.

import type { Dims } from './face';
import type { LoftSpec } from './loft';
import type { Vec3 } from './surface';

export const SHAPE_KINDS = ['box', 'cylinder', 'console'] as const;
export type ShapeKind = (typeof SHAPE_KINDS)[number];

export interface ShapeState {
  kind: ShapeKind;
  /** radius of the vertical edges, mm (box, console) */
  cornerR: number;
  /** fillet of the top and bottom edges, mm (box, cylinder); 0 = sharp */
  edgeR: number;
  /** side wall thickness */
  wall: number;
  /** floor and ceiling (lid plate) thickness */
  floor: number;
  /** size from the boards; off = the manual size, never below the minimum */
  auto: boolean;
  /** manual outer size; for the cylinder w is the diameter and d is ignored */
  size: Dims;
  /** board edge → inner wall, tallest part → ceiling */
  margin: { side: number; top: number };
  /** console only: outer height at the front and at the back; the top slopes between them */
  console: { frontH: number; backH: number };
}

export const WALL_MIN = 1.2;
export const WALL_MAX = 6;
export const SIZE_MIN = 20;
export const SIZE_MAX = 400;
export const CORNER_MAX = 50;
export const EDGE_MAX = 20;

export function defaultShape(): ShapeState {
  return {
    kind: 'box',
    cornerR: 4,
    edgeR: 0,
    wall: 2,
    floor: 2,
    auto: false,
    size: { w: 100, d: 70, h: 35 },
    margin: { side: 2, top: 3 },
    console: { frontH: 20, backH: 40 },
  };
}

export function isShapeKind(value: unknown): value is ShapeKind {
  return typeof value === 'string' && SHAPE_KINDS.some((kind) => kind === value);
}

function rec(x: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof x === 'object' && x !== null) for (const [key, value] of Object.entries(x)) out[key] = value;
  return out;
}

export function clampNum(x: unknown, min: number, max: number, fallback: number): number {
  const value = typeof x === 'number' && Number.isFinite(x) ? x : fallback;
  return Math.min(max, Math.max(min, value));
}

export function sanitizeShape(raw: unknown): ShapeState {
  const d = defaultShape();
  const r = rec(raw);
  const size = rec(r.size);
  const margin = rec(r.margin);
  const console = rec(r.console);
  return {
    kind: isShapeKind(r.kind) ? r.kind : d.kind,
    cornerR: clampNum(r.cornerR, 0, CORNER_MAX, d.cornerR),
    edgeR: clampNum(r.edgeR, 0, EDGE_MAX, d.edgeR),
    wall: clampNum(r.wall, WALL_MIN, WALL_MAX, d.wall),
    floor: clampNum(r.floor, WALL_MIN, WALL_MAX, d.floor),
    auto: typeof r.auto === 'boolean' ? r.auto : d.auto,
    size: {
      w: clampNum(size.w, SIZE_MIN, SIZE_MAX, d.size.w),
      d: clampNum(size.d, SIZE_MIN, SIZE_MAX, d.size.d),
      h: clampNum(size.h, SIZE_MIN, SIZE_MAX, d.size.h),
    },
    margin: {
      side: clampNum(margin.side, 0, 20, d.margin.side),
      top: clampNum(margin.top, 0, 30, d.margin.top),
    },
    console: {
      frontH: clampNum(console.frontH, 10, SIZE_MAX, d.console.frontH),
      backH: clampNum(console.backH, 10, SIZE_MAX, d.console.backH),
    },
  };
}

/** Half-space `dot(p, n) ≥ offset`; n is a unit vector. */
export interface Plane {
  n: Vec3;
  offset: number;
}

export interface ShapeSpec {
  outer: LoftSpec;
  /** the closed cavity: floor below, ceiling above, walls around */
  inner: LoftSpec;
  /** console: the sloped top, applied to the outer loft */
  outerCut: Plane | null;
  /** console: the same plane moved in by the plate thickness */
  innerCut: Plane | null;
}

/** Thickness of the plate behind a face: floor/ceiling for top and bottom, the wall for the sides. */
export function plateOf(shape: ShapeState, face: string): number {
  return face === 'top' || face === 'bottom' ? shape.floor : shape.wall;
}

/**
 * The console's sloped top: z = frontH at y = 0 rising (or falling) to backH
 * at y = d. Returned as the half-space below it.
 */
export function slopePlane(frontH: number, backH: number, depth: number): Plane {
  const k = (backH - frontH) / depth;
  const len = Math.hypot(k, 1);
  return { n: [0, k / len, -1 / len], offset: -frontH / len };
}

export function shapeSpec(shape: ShapeState, dims: Dims): ShapeSpec {
  const { w, d, h } = dims;
  const { wall, floor } = shape;
  const round = shape.kind === 'cylinder';
  const cornerR = round ? w / 2 : shape.cornerR;
  const edgeR = shape.kind === 'console' ? 0 : shape.edgeR;
  const outer: LoftSpec = {
    cx: w / 2, cy: d / 2, hw: w / 2, hd: d / 2,
    cornerR, z0: 0, z1: h, edgeR, filletBottom: true, filletTop: true,
  };
  const inner: LoftSpec = {
    cx: w / 2, cy: d / 2, hw: w / 2 - wall, hd: d / 2 - wall,
    cornerR: Math.max(0, cornerR - wall),
    z0: floor,
    z1: h - floor,
    edgeR: Math.max(0, edgeR - Math.min(wall, floor)),
    filletBottom: true,
    filletTop: true,
  };
  if (shape.kind !== 'console') return { outer, inner, outerCut: null, innerCut: null };
  const cut = slopePlane(shape.console.frontH, shape.console.backH, d);
  return {
    outer,
    // the box part of the cavity reaches the outer top: the slope trims it
    inner: { ...inner, z1: h },
    outerCut: cut,
    innerCut: { n: cut.n, offset: cut.offset + floor },
  };
}
