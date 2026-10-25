// Types of scripts/lib/step.mjs for the tests (tests/drawing.test.ts).

export interface StepPart { path: string; name: string; lo: [number, number, number]; hi: [number, number, number] }
export interface StepCircle { path: string; centre: number[]; normal: number[]; r: number }

export function readEntities(text: string): Map<number, string>;
export function readStep(text: string): { parts(): StepPart[]; circles(name: string): StepCircle[] };
