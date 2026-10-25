// Types of scripts/lib/drawing.mjs for the tests (tests/drawing.test.ts).

export interface ShapeBase { layer: string; block: string; instance: number }
export type Shape = ShapeBase & (
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { kind: 'circle'; x: number; y: number; r: number }
  | { kind: 'arc'; x: number; y: number; r: number; a0: number; a1: number }
  | { kind: 'poly'; pts: [number, number][]; closed: boolean }
);
export interface Box { x0: number; y0: number; x1: number; y1: number }

export function readDxf(text: string): Shape[];
export function readSvg(text: string, scale?: number): Shape[];
export function pdfToSvg(file: string, page?: number): string;
export function havePdftocairo(): boolean;
export function layerCounts(shapes: Shape[]): Map<string, number>;
export function extents(shapes: Shape[]): Box;
export function scaled(shapes: Shape[], k: number): Shape[];
export function shapeBox(shape: Shape): Box;
export function componentBoxes(shapes: Shape[], origin?: { x0: number; y0: number }): (Box & { name: string })[];
export function turned(shapes: Shape[], deg?: number, flip?: boolean): Shape[];
export function polylines(shapes: Shape[]): [number, number][][];
