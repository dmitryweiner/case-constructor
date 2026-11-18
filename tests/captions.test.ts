// Where the view's captions go on the canvas: port captions give way to the
// nearer ones and to the warnings' badges; a badge never gives way (every
// warning keeps its place on the model), but one behind the camera or off
// the canvas is not shown.

import { placeCaptions } from '../src/render/captions';
import type { CaptionPoint } from '../src/render/captions';

const W = 400;
const H = 300;

function point(o: Partial<CaptionPoint> & { x: number; y: number }): CaptionPoint {
  return { w: 40, h: 16, depth: 100, behind: false, warn: false, ...o };
}

describe('placeCaptions', () => {
  it('puts a caption above its point, centred', () => {
    expect(placeCaptions([point({ x: 100, y: 100 })], W, H)).toEqual([[80, 80, 40, 16]]);
  });

  it('a farther port caption gives way to a nearer one it would overlap', () => {
    const [far, near] = placeCaptions([point({ x: 100, y: 100, depth: 200 }), point({ x: 110, y: 104, depth: 50 })], W, H);
    expect(near).not.toBeNull();
    expect(far).toBeNull();
  });

  it('a port caption gives way to a badge, however near it is', () => {
    const [caption, badge] = placeCaptions([point({ x: 100, y: 100, depth: 10 }), point({ x: 105, y: 100, depth: 500, warn: true })], W, H);
    expect(badge).not.toBeNull();
    expect(caption).toBeNull();
  });

  it('badges never give way, to each other either', () => {
    const placed = placeCaptions(
      [point({ x: 100, y: 100, warn: true }), point({ x: 104, y: 102, warn: true, depth: 300 }), point({ x: 108, y: 98, warn: true })],
      W,
      H,
    );
    expect(placed.every((rect) => rect !== null)).toBe(true);
  });

  it('nothing behind the camera or off the canvas is shown, a badge neither', () => {
    const placed = placeCaptions(
      [point({ x: 100, y: 100, warn: true, behind: true }), point({ x: -5, y: 100, warn: true }), point({ x: 100, y: H + 1 })],
      W,
      H,
    );
    expect(placed).toEqual([null, null, null]);
  });
});
