// Where the view's captions go on the canvas, each frame: the warnings'
// badges first, then the port captions nearest first. A port caption gives
// way to anything it would overlap; a badge never does (every warning keeps
// its place on the model, at any zoom), though one behind the camera or off
// the canvas is not shown. Pure: the scene projects, this places.

/** Room kept between two captions, and between a caption and its point, CSS px. */
const CAPTION_GAP = 2;
const CAPTION_LIFT = 4;

/** A caption's point on the canvas (CSS px), its size and how far its point is from the eye. */
export interface CaptionPoint {
  x: number;
  y: number;
  w: number;
  h: number;
  depth: number;
  /** behind the camera */
  behind: boolean;
  /** a warning's badge */
  warn: boolean;
}

/** [x, y, w, h] of a shown caption, CSS px from the canvas's top-left. */
export type CaptionRect = [number, number, number, number];

/** Each caption's rectangle, in the order given, or null where it is not shown. */
export function placeCaptions(points: readonly CaptionPoint[], w: number, h: number): (CaptionRect | null)[] {
  const order = points
    .map((_, i) => i)
    .sort((a, b) => Number(points[b].warn) - Number(points[a].warn) || points[a].depth - points[b].depth);
  const taken: CaptionRect[] = [];
  const placed: (CaptionRect | null)[] = points.map(() => null);
  for (const i of order) {
    const p = points[i];
    if (p.behind || p.x < 0 || p.x > w || p.y < 0 || p.y > h) continue;
    const rect: CaptionRect = [p.x - p.w / 2, p.y - p.h - CAPTION_LIFT, p.w, p.h];
    const clash = taken.some(
      (r) =>
        rect[0] < r[0] + r[2] + CAPTION_GAP &&
        r[0] < rect[0] + rect[2] + CAPTION_GAP &&
        rect[1] < r[1] + r[3] + CAPTION_GAP &&
        r[1] < rect[1] + rect[3] + CAPTION_GAP,
    );
    if (clash && !p.warn) continue;
    taken.push(rect);
    placed[i] = rect;
  }
  return placed;
}
