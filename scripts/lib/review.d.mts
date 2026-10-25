export function drawingFiles(def: unknown): { file: string; kind: string }[];
export function layersFor(def: unknown, boxes: [number, number, number, number][], outDir: string, log?: (line: string) => void): unknown[];
export function writeReview(outDir: string, boards: unknown[], layers: Record<string, unknown[]>): void;
