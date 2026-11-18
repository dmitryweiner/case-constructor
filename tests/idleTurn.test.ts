// The view's idle turn: after IDLE_MS with no input it turns the camera a
// step per frame, easing in; any input stops it at once and the wait starts
// again. Time, frames, timers and the motion preference are fakes here.

import { ACTIVITY_EVENTS, IDLE_EASE_MS, IDLE_MS, IDLE_TURN_S, idleTurn } from '../src/render/idleTurn';

function fakes(o: { reduced?: boolean } = {}) {
  let clock = 0;
  let frames = new Map<number, (now: number) => void>();
  let timers = new Map<number, { at: number; run: () => void }>();
  let nextId = 1;
  const listeners = new Map<string, () => void>();
  const turns: number[] = [];
  const stop = idleTurn({
    turn: (radians) => turns.push(radians),
    now: () => clock,
    requestFrame: (callback) => {
      frames.set(nextId, callback);
      return nextId++;
    },
    cancelFrame: (id) => frames.delete(id),
    setTimer: (run, ms) => {
      timers.set(nextId, { at: clock + ms, run });
      return nextId++;
    },
    clearTimer: (id) => timers.delete(id),
    target: {
      addEventListener: (type: string, listener: () => void) => listeners.set(type, listener),
      removeEventListener: (type: string) => listeners.delete(type),
    },
    reducedMotion: () => o.reduced ?? false,
  });
  /** Moves the clock on by `ms` in frames of `step` ms, firing timers and frames as they fall due. */
  const advance = (ms: number, step = 16): void => {
    const end = clock + ms;
    while (clock < end) {
      clock = Math.min(end, clock + step);
      for (const [id, timer] of timers) {
        if (timer.at > clock) continue;
        timers.delete(id);
        timer.run();
      }
      const due = frames;
      frames = new Map();
      for (const callback of due.values()) callback(clock);
    }
  };
  const input = (type: (typeof ACTIVITY_EVENTS)[number] = 'pointermove'): void => listeners.get(type)?.();
  return {
    turns,
    advance,
    input,
    stop,
    listeners,
    pending: () => frames.size + timers.size,
    reset: () => {
      frames = new Map();
      timers = new Map();
    },
  };
}

const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);

describe('idleTurn', () => {
  it('waits IDLE_MS with no input, then turns, easing in', () => {
    const f = fakes();
    f.advance(IDLE_MS - 100);
    expect(f.turns).toEqual([]);
    f.advance(1000);
    expect(f.turns.length).toBeGreaterThan(10);
    expect(f.turns.every((radians) => radians > 0)).toBe(true);
    // the first steps are slower than the ones after the ease
    f.advance(IDLE_EASE_MS);
    expect(f.turns[0]).toBeLessThan(f.turns.at(-1) ?? 0);
  });

  it('at full speed makes a turn in IDLE_TURN_S', () => {
    const f = fakes();
    f.advance(IDLE_MS + IDLE_EASE_MS + 100);
    const before = f.turns.length;
    f.advance(1000);
    expect(sum(f.turns.slice(before))).toBeCloseTo((2 * Math.PI) / IDLE_TURN_S, 3);
  });

  it('stops at once on any input and waits IDLE_MS again', () => {
    const f = fakes();
    f.advance(IDLE_MS + 500);
    for (const type of ACTIVITY_EVENTS) expect(f.listeners.has(type)).toBe(true);
    f.input('wheel');
    const count = f.turns.length;
    f.advance(IDLE_MS - 100);
    expect(f.turns.length).toBe(count);
    f.advance(500);
    expect(f.turns.length).toBeGreaterThan(count);
  });

  it('does not turn for a person who asked for less motion', () => {
    const f = fakes({ reduced: true });
    f.advance(IDLE_MS * 3);
    expect(f.turns).toEqual([]);
  });

  it('a long gap between frames (a hidden tab) does not jump the turn', () => {
    const f = fakes();
    f.advance(IDLE_MS + IDLE_EASE_MS + 100);
    const before = f.turns.length;
    f.advance(5000, 5000);
    expect(f.turns.slice(before).every((radians) => radians <= (2 * Math.PI * 0.1) / IDLE_TURN_S + 1e-9)).toBe(true);
  });

  it('stop() removes its listeners and leaves nothing scheduled', () => {
    const f = fakes();
    f.advance(IDLE_MS + 500);
    f.stop();
    expect(f.listeners.size).toBe(0);
    expect(f.pending()).toBe(0);
  });
});
