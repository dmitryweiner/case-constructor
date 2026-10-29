// Labels on the faces: the text is rasterised by the main thread (fonts
// live there) and travels to the worker as a raster; this module checks it
// and places it. The worker turns it into a relief (extrasSolids.ts).

import type { CutterSpec } from './cutters';
import type { Dims, Face } from './face';
import { faceFrame } from './face';
import type { LabelState } from './extras';
import { LABELS_MAX, flatRegion, labelFace } from './extras';
import { slopeFrame } from './layout';
import type { LidState } from './lidSpec';
import type { Message } from './message';
import { boxAround, boxSpot } from './message';
import { cutterCorners } from './ports';
import type { ShapeState } from './shape';
import { plateOf } from './shape';
import type { Affine, Vec3 } from './surface';
import { applyAffine, invertRigid } from './surface';

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

/** Rasters from across the worker boundary: a list, each checked; anything else is no labels. */
export function sanitizeLabelRasters(raw: unknown): (LabelRaster | null)[] {
  return Array.isArray(raw) ? raw.slice(0, LABELS_MAX).map((one) => sanitizeLabelRaster(one)) : [];
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

/** Where a label lies: its face's frame (the console's top is its slope), the face's size and its flat part. */
export interface LabelSurface {
  face: Face;
  /** face (u, v, w) → case, w = 0 on the outer surface */
  fromFace: Affine;
  toFace: Affine;
  extent: { w: number; h: number };
  flat(margin: number): { u0: number; v0: number; u1: number; v1: number };
}

export function labelSurface(face: Face, shape: ShapeState, dims: Dims): LabelSurface {
  if (shape.kind === 'console' && face === 'top') {
    // the slope, seen from outside: u along x, v up the slope towards the back
    const fromFace = slopeFrame(shape.console.frontH, shape.console.backH, dims.d);
    const length = Math.hypot(dims.d, shape.console.backH - shape.console.frontH);
    return {
      face, fromFace, toFace: invertRigid(fromFace), extent: { w: dims.w, h: length },
      flat: (margin) => ({ u0: margin, v0: margin, u1: dims.w - margin, v1: length - margin }),
    };
  }
  const frame = faceFrame(face, dims);
  return { face, fromFace: frame.fromFace, toFace: frame.toFace, extent: frame.extent, flat: (margin) => flatRegion(shape, dims, face, margin) };
}

/**
 * Where the label sits: its centre on its face (u, v) and its size in mm.
 * The anchor puts its turned box against an edge or into a corner of the
 * face's flat part, `margin` in; the offset moves it from there.
 */
export function labelPlacement(label: LabelState, raster: LabelRaster, surface: LabelSurface): { u: number; v: number; w: number; h: number } {
  const { extent } = surface;
  const w = raster.w * raster.mmPerPx;
  const h = raster.h * raster.mmPerPx;
  const { hw, hh } = labelBox(w, h, label.angle);
  const flat = surface.flat(label.margin);
  const anchor = label.anchor;
  const u = anchor.endsWith('Left') || anchor === 'left' ? flat.u0 + hw
    : anchor.endsWith('Right') || anchor === 'right' ? flat.u1 - hw
      : extent.w / 2;
  const v = anchor.startsWith('top') ? flat.v1 - hh
    : anchor.startsWith('bottom') ? flat.v0 + hh
      : extent.h / 2;
  return { u: u + label.x, v: v + label.y, w, h };
}

/** A screw head on the lid's face (u, v) and how far a label keeps from its centre, mm. */
export interface LabelHead {
  u: number;
  v: number;
  r: number;
}

/** The face across the case from each face. */
const OPPOSITE: Readonly<Record<Face, Face>> = { top: 'bottom', bottom: 'top', front: 'back', back: 'front', left: 'right', right: 'left' };

/**
 * Warnings about the labels, each naming its label: off the flat part of
 * its face, over a screw head on the lid, across the parting (a seam through
 * the letters), over an opening on its face, raised on the face its part
 * prints on (the letters would be the first layer), two on one face over
 * each other.
 */
export function labelWarnings(
  labels: readonly LabelState[], rasters: readonly (LabelRaster | null)[], shape: ShapeState, dims: Dims, lid: LidState,
  cutters: readonly CutterSpec[], heads: readonly LabelHead[],
): Message[] {
  const lidFrame = faceFrame(lid.face, dims);
  const zp = -(plateOf(shape, lid.face) + lid.depth);
  // the face each part lies on in print: the lid on its outer face, the body on the opposite one (a console with a bottom lid on its slope)
  const bodyBed: Face = shape.kind === 'console' && lid.face === 'bottom' ? 'top' : OPPOSITE[lid.face];
  const placed = labels.flatMap((label, index) => {
    const raster = rasters[index];
    if (!raster) return [];
    const surface = labelSurface(labelFace(label, shape.kind), shape, dims);
    const place = labelPlacement(label, raster, surface);
    const { hw, hh } = labelBox(place.w, place.h, label.angle);
    const box = { u0: place.u - hw, v0: place.v - hh, u1: place.u + hw, v1: place.v + hh };
    const plate = plateOf(shape, surface.face);
    const corners: Vec3[] = [];
    for (const u of [box.u0, box.u1]) for (const v of [box.v0, box.v1]) for (const w of [-plate, 0]) corners.push(applyAffine(surface.fromFace, [u, v, w]));
    const depths = corners.map((p) => applyAffine(lidFrame.toFace, p)[2]);
    const onLid = Math.min(...depths) > zp;
    return [{ label, n: index + 1, surface, box, corners, depths, spot: boxSpot(boxAround(corners), onLid ? 'lid' : 'body') }];
  });
  const out: Message[] = [];
  for (const { label, n, surface, box, depths, spot } of placed) {
    const flat = surface.flat(0);
    const eps = 1e-6;
    if (box.u0 < flat.u0 - eps || box.u1 > flat.u1 + eps || box.v0 < flat.v0 - eps || box.v1 > flat.v1 + eps) {
      out.push({ code: 'warn.labelTooBig', params: { n }, spot });
    }
    if (surface.face === lid.face && heads.some((head) => {
      const du = Math.max(0, Math.abs(head.u - (box.u0 + box.u1) / 2) - (box.u1 - box.u0) / 2);
      const dv = Math.max(0, Math.abs(head.v - (box.v0 + box.v1) / 2) - (box.v1 - box.v0) / 2);
      return Math.hypot(du, dv) < head.r;
    })) {
      out.push({ code: 'warn.labelOverScrew', params: { n }, spot });
    }
    if (Math.min(...depths) < zp && Math.max(...depths) > zp) out.push({ code: 'warn.labelOnParting', params: { n }, spot });
    // an opening through the plate under the label: its corners on the face, where it crosses the plate
    const normal = [surface.fromFace[2], surface.fromFace[6], surface.fromFace[10]];
    const plate = plateOf(shape, surface.face);
    const opened = cutters.some((cutter) => {
      if (Math.abs(cutter.ez[0] * normal[0] + cutter.ez[1] * normal[1] + cutter.ez[2] * normal[2]) < 0.9) return false;
      const local = cutterCorners(cutter).map((p) => applyAffine(surface.toFace, p));
      const ws = local.map((p) => p[2]);
      if (Math.max(...ws) < -plate || Math.min(...ws) > 0) return false;
      const us = local.map((p) => p[0]);
      const vs = local.map((p) => p[1]);
      return Math.min(...us) < box.u1 && Math.max(...us) > box.u0 && Math.min(...vs) < box.v1 && Math.max(...vs) > box.v0;
    });
    if (opened) out.push({ code: 'warn.labelOverOpening', params: { n }, spot });
    const bed = surface.face === lid.face ? lid.face : bodyBed;
    if (label.raised && surface.face === bed) out.push({ code: 'warn.labelOnBed', params: { n }, spot });
  }
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const [a, b] = [placed[i], placed[j]];
      if (a.surface.face !== b.surface.face) continue;
      if (a.box.u0 < b.box.u1 && b.box.u0 < a.box.u1 && a.box.v0 < b.box.v1 && b.box.v0 < a.box.v1) {
        out.push({ code: 'warn.labelsOverlap', params: { a: a.n, b: b.n }, spot: b.spot });
      }
    }
  }
  return out;
}
