// The labels' rasters: each text in a <canvas>, one line. The worker turns
// them into reliefs on their faces (geo/extrasSolids.ts). Hebrew runs right to left
// by the canvas's own bidi; the layout of the line stays as typed.

import type { LabelState } from '../geo/extras';
import type { LabelRaster } from '../geo/label';
import { LABEL_FONT_FILES, fontReady, loadFont } from './fonts';

/** Pixels per millimetre on the face: a 0.8 mm stroke is eight pixels. */
const PX_PER_MM = 10;
/** Margin around the line, px. */
const PAD_PX = 2;

/** The rasters drawn for the last call, by font, size and text: the next call reuses them. */
let cache = new Map<string, LabelRaster | null>();
const waiting = new Set<string>();

/**
 * The rasters of the labels, one per label, null where there is no text or
 * the font is still loading — then `onReady` is called when it is in, to
 * rebuild with the letters. Never drawn in a stand-in font: the preview would
 * jump when the real one arrives.
 */
export function labelRasters(labels: readonly LabelState[], onReady: () => void): (LabelRaster | null)[] {
  const next = new Map<string, LabelRaster | null>();
  const out = labels.map((label) => {
    const text = label.text.trim();
    if (!text) return null;
    if (!fontReady(label.font)) {
      if (!waiting.has(label.font)) {
        waiting.add(label.font);
        const done = (): void => {
          waiting.delete(label.font);
        };
        void loadFont(label.font).then(() => {
          done();
          onReady();
        }, done);
      }
      return null;
    }
    const key = `${label.font}|${label.sizeMm}|${text}`;
    const raster = next.get(key) ?? cache.get(key) ?? render(text, label);
    next.set(key, raster);
    return raster;
  });
  cache = next;
  return out;
}

function render(text: string, label: LabelState): LabelRaster | null {
  const spec = LABEL_FONT_FILES[label.font];
  const family = `"${spec.family}", "${LABEL_FONT_FILES.rubik.family}"`;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  // the size is the height of a capital: measured on the font itself
  const probe = 100;
  ctx.font = `${spec.weight} ${probe}px ${family}`;
  const cap = ctx.measureText('H').actualBoundingBoxAscent / probe;
  const px = (label.sizeMm * PX_PER_MM) / Math.max(cap, 0.3);
  ctx.font = `${spec.weight} ${px}px ${family}`;
  const metrics = ctx.measureText(text);
  const ascent = Math.ceil(metrics.actualBoundingBoxAscent);
  const descent = Math.ceil(metrics.actualBoundingBoxDescent);
  const left = Math.ceil(metrics.actualBoundingBoxLeft);
  const width = Math.ceil(Math.max(metrics.width, left + metrics.actualBoundingBoxRight)) + 2 * PAD_PX;
  const height = ascent + descent + 2 * PAD_PX;
  if (width < 1 || height < 1 || width > 4096 || height > 4096) return null;
  canvas.width = width;
  canvas.height = height;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#fff';
  ctx.font = `${spec.weight} ${px}px ${family}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, PAD_PX + left, PAD_PX + ascent);
  const rgba = ctx.getImageData(0, 0, width, height).data;
  const pixels = new Uint8Array(width * height);
  for (let i = 0; i < pixels.length; i++) pixels[i] = rgba[i * 4];
  return { w: width, h: height, pixels, mmPerPx: 1 / PX_PER_MM };
}
