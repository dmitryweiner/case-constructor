// The label on the lid: the text is rasterised by the main thread (fonts
// live there) and travels to the worker as a raster; this module checks it
// and places it. The worker turns it into a relief (extrasSolids.ts).

import type { Dims, Face } from './face';
import { faceFrame } from './face';
import type { LabelState } from './extras';
import { flatRegion } from './extras';
import type { ShapeState } from './shape';

export interface LabelRaster {
  w: number;
  h: number;
  /** one byte per pixel, row by row from the top; ≥ 128 is ink */
  pixels: Uint8Array;
  /** pixel size on the lid, mm */
  mmPerPx: number;
}

export const LABEL_RASTER_MAX_PX = 4096;

/** A raster from across the worker boundary, or null when anything is off. */
export function sanitizeLabelRaster(raw: unknown): LabelRaster | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const w: unknown = Reflect.get(raw, 'w');
  const h: unknown = Reflect.get(raw, 'h');
  const pixels: unknown = Reflect.get(raw, 'pixels');
  const mmPerPx: unknown = Reflect.get(raw, 'mmPerPx');
  if (typeof w !== 'number' || typeof h !== 'number' || typeof mmPerPx !== 'number') return null;
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || w > LABEL_RASTER_MAX_PX || h > LABEL_RASTER_MAX_PX) return null;
  if (!Number.isFinite(mmPerPx) || mmPerPx <= 0 || mmPerPx > 1) return null;
  if (!(pixels instanceof Uint8Array) || pixels.length !== w * h) return null;
  return { w, h, pixels, mmPerPx };
}

/** Ink as rectangles: runs of ink pixels per row, in mm, centred on the text box. */
export function rasterRuns(raster: LabelRaster): [number, number][][] {
  const out: [number, number][][] = [];
  const s = raster.mmPerPx;
  const cx = (raster.w * s) / 2;
  const cy = (raster.h * s) / 2;
  for (let row = 0; row < raster.h; row++) {
    let start = -1;
    for (let col = 0; col <= raster.w; col++) {
      const ink = col < raster.w && raster.pixels[row * raster.w + col] >= 128;
      if (ink && start < 0) start = col;
      if (!ink && start >= 0) {
        // raster rows run down, the face's v runs up
        const x0 = start * s - cx;
        const x1 = col * s - cx;
        const y1 = cy - row * s;
        const y0 = y1 - s;
        out.push([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
        start = -1;
      }
    }
  }
  return out;
}

/** Half the size of the label's box once turned by `angle`, mm. */
export function labelBox(w: number, h: number, angle: number): { hw: number; hh: number } {
  const c = Math.abs(Math.cos((angle * Math.PI) / 180));
  const s = Math.abs(Math.sin((angle * Math.PI) / 180));
  return { hw: (c * w + s * h) / 2, hh: (s * w + c * h) / 2 };
}

/**
 * Where the label sits: its centre on the lid face (u, v) and its size in mm.
 * The anchor puts its turned box against an edge or into a corner of the
 * face's flat part, `margin` in; the offset moves it from there.
 */
export function labelPlacement(label: LabelState, raster: LabelRaster, face: Face, dims: Dims, shape: ShapeState): { u: number; v: number; w: number; h: number } {
  const extent = faceFrame(face, dims).extent;
  const w = raster.w * raster.mmPerPx;
  const h = raster.h * raster.mmPerPx;
  const { hw, hh } = labelBox(w, h, label.angle);
  const flat = flatRegion(shape, dims, face, label.margin);
  const anchor = label.anchor;
  const u = anchor.endsWith('Left') || anchor === 'left' ? flat.u0 + hw
    : anchor.endsWith('Right') || anchor === 'right' ? flat.u1 - hw
      : extent.w / 2;
  const v = anchor.startsWith('top') ? flat.v1 - hh
    : anchor.startsWith('bottom') ? flat.v0 + hh
      : extent.h / 2;
  return { u: u + label.x, v: v + label.y, w, h };
}
