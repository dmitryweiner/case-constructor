// Types of scripts/lib/pcb.mjs for the tests (tests/drawing.test.ts).

export interface PcbElement {
  name: string; value: string; package: string;
  x: number; y: number; rot: number; side: 'top' | 'bottom';
  size: { w: number; d: number; cx: number; cy: number } | null;
  nets: string[];
}
export interface PcbBoard { outline: { w: number; d: number }; holes: { x: number; y: number; d: number }[]; elements: PcbElement[] }

export function readBrd(text: string): PcbBoard;
export function readKicad(text: string): PcbBoard;
export function turnBoard(board: PcbBoard, deg?: number, flip?: boolean): PcbBoard;
