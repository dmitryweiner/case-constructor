// Types of scripts/lib/compare.mjs for the tests (tests/drawing.test.ts).

interface Hole { x: number; y: number; d: number }
export function readEntry(id: string): { size: { w: number; d: number }; mount?: { holes?: Hole[] } };
export function compareHoles(
  entry: { size: { w: number; d: number }; mount?: { holes?: Hole[] } },
  found: Hole[],
  options?: { minD?: number; maxD?: number; tol?: number; size?: { w: number; d: number } },
): string[];
