// The view turns on its own when nobody has touched anything for a while: a
// showcase, slow, easing in, stopped at once by any input. maker-kit's
// viewer draws on demand and only turns the camera when asked (`turn`):
// this is the app's loop of turns, a frame each while it runs, nothing at
// rest. Time, frames, timers and the motion preference are parameters.

/** With no mouse, touch or key for this long, the view starts turning on its own, ms. */
export const IDLE_MS = 30_000;
/** One turn of the idle rotation, s: slow enough to read as a showcase, not a spin. */
export const IDLE_TURN_S = 120;
/** The idle rotation gathers speed over this long, ms (it stops at once). */
export const IDLE_EASE_MS = 3000;
/** Anything a person does that ends the idle rotation. */
export const ACTIVITY_EVENTS = ['pointermove', 'pointerdown', 'wheel', 'keydown', 'touchstart', 'input'] as const;
/** A longer gap between frames (a hidden tab) counts as this much, s: the turn must not jump. */
const MAX_STEP_S = 0.1;

export interface IdleTurnDeps {
  /** turns the camera about the vertical: the viewer's `turn` */
  turn(radians: number): void;
  now(): number;
  requestFrame(callback: (now: number) => void): number;
  cancelFrame(id: number): void;
  setTimer(callback: () => void, ms: number): number;
  clearTimer(id: number): void;
  /** where a person's input is heard: the window */
  target: {
    addEventListener(type: string, listener: () => void, options: AddEventListenerOptions): void;
    removeEventListener(type: string, listener: () => void, options: EventListenerOptions): void;
  };
  /** `prefers-reduced-motion: reduce` */
  reducedMotion(): boolean;
}

/** Starts watching for idleness; returns the stop. */
export function idleTurn(d: IdleTurnDeps): () => void {
  let timer = 0;
  let frame = 0;
  /** when the turn started, and the last frame's time */
  let started = 0;
  let last = 0;

  const step = (now: number): void => {
    const dt = Math.min(MAX_STEP_S, Math.max(0, (now - last) / 1000));
    last = now;
    const ease = Math.min(1, (now - started) / IDLE_EASE_MS);
    const radians = ((2 * Math.PI) / IDLE_TURN_S) * ease * dt;
    if (radians > 0) d.turn(radians);
    frame = d.requestFrame(step);
  };
  const begin = (): void => {
    timer = 0;
    // asked for less motion: look again after another wait (the setting may change)
    if (d.reducedMotion()) {
      wait();
      return;
    }
    started = last = d.now();
    frame = d.requestFrame(step);
  };
  function wait(): void {
    timer = d.setTimer(begin, IDLE_MS);
  }
  const halt = (): void => {
    if (frame) d.cancelFrame(frame);
    if (timer) d.clearTimer(timer);
    frame = timer = 0;
  };
  const onActivity = (): void => {
    halt();
    wait();
  };

  for (const type of ACTIVITY_EVENTS) d.target.addEventListener(type, onActivity, { capture: true, passive: true });
  wait();
  return () => {
    halt();
    for (const type of ACTIVITY_EVENTS) d.target.removeEventListener(type, onActivity, { capture: true });
  };
}
