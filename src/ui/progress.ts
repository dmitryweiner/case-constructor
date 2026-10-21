// Progress bar over the canvas — for anything slow, not only the export. On
// a fast machine a preview takes a blink and a bar would only flicker; on a
// slow one (and on a phone, where the panel with its status is hidden) it is
// the only sign the tab is working rather than dead. Hence the delay before
// it shows: only what is really slow gets a bar.

import type { JobProgress } from '../worker/protocol';
import type { Message } from '../geo/message';
import type { Key } from '../i18n';
import { t, tm } from '../i18n';

/** How long after a job starts the bar appears, if the job is still running. */
export const SHOW_DELAY_MS = 300;

export interface ProgressElements {
  wrap: HTMLElement;
  fill: HTMLElement;
  label: HTMLElement;
}

export interface TrackOptions {
  /** label until the job reports anything */
  label: Key;
  /** 0 — show at once: an export was asked for with a button and is awaited */
  delayMs?: number;
  /**
   * A bar without divisions — a running stripe. For one-stage jobs: a bar at
   * "0 of 1" would look stuck.
   */
  indeterminate?: boolean;
}

/** The label is kept as a code and translated on display: the language may change mid-job. */
interface Tracker {
  label: Key | Message;
  step: number | null;
  total: number | null;
  indeterminate: boolean;
  visible: boolean;
}

export interface ProgressHandle {
  /**
   * Tracks a job: `job` gets a progress callback and returns a promise; when
   * it settles (a null of eviction or an error included), the bar hides.
   */
  track<T>(job: (onProgress: (progress: JobProgress) => void) => Promise<T>, options: TrackOptions): Promise<T>;
  /** redraw the label — after a language switch */
  refresh(): void;
}

export function createProgress({ wrap, fill, label }: ProgressElements): ProgressHandle {
  /** running jobs; the last visible one is shown */
  const active: Tracker[] = [];
  let hideFrame = 0;

  function render(): void {
    const shown = active.filter((tracker) => tracker.visible).at(-1);
    if (!shown) {
      // Two jobs in a row — one ending and the next starting in the same
      // frame — must not blink the bar: hide a frame later.
      if (!hideFrame && !wrap.hidden) {
        hideFrame = requestAnimationFrame(() => {
          hideFrame = 0;
          if (active.some((tracker) => tracker.visible)) return;
          wrap.hidden = true;
          wrap.classList.remove('indeterminate');
          fill.style.width = '0%';
          label.textContent = '';
        });
      }
      return;
    }
    if (hideFrame) {
      cancelAnimationFrame(hideFrame);
      hideFrame = 0;
    }
    wrap.hidden = false;
    const indeterminate = shown.indeterminate || shown.total === null || shown.step === null;
    wrap.classList.toggle('indeterminate', indeterminate);
    fill.style.width = indeterminate
      ? ''
      : `${Math.round(((shown.step ?? 0) / Math.max(1, shown.total ?? 1)) * 100)}%`;
    label.textContent = typeof shown.label === 'string' ? t(shown.label) : tm(shown.label);
  }

  return {
    async track(job, options) {
      const tracker: Tracker = {
        label: options.label,
        step: null,
        total: null,
        indeterminate: options.indeterminate ?? false,
        visible: false,
      };
      active.push(tracker);
      const reveal = (): void => {
        tracker.visible = true;
        render();
      };
      const delay = options.delayMs ?? SHOW_DELAY_MS;
      const timer = delay > 0 ? setTimeout(reveal, delay) : null;
      if (!timer) reveal();
      try {
        return await job(({ step, total, label: text }) => {
          tracker.step = step;
          tracker.total = total;
          tracker.label = text;
          if (tracker.visible) render();
        });
      } finally {
        if (timer) clearTimeout(timer);
        active.splice(active.indexOf(tracker), 1);
        render();
      }
    },
    refresh: render,
  };
}
