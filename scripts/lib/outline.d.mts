// Types of scripts/lib/outline.mjs for the tests (tests/drawing.test.ts).

type Pt = [number, number];
export function arcThrough(a: Pt, m: Pt, b: Pt, maxStep?: number): Pt[];
export function arcSweep(a: Pt, b: Pt, sweepDeg: number): Pt[];
export function chainLoops(polylines: Pt[][], tol?: number, options?: { starts?: number; budget?: number }): Pt[][];
export function largestLoop(loops: Pt[][]): Pt[] | null;
export function simplifyLoop(pts: Pt[], eps: number): Pt[];
export function toOutline(loop: Pt[], origin?: { x0: number; y0: number }, eps?: number): Pt[];
