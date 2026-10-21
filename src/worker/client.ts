// Main-thread side: one worker, a queue one job deep.
//
// A running job cannot be interrupted — WASM does not stop mid-boolean. A
// waiting one can be replaced, which is exactly what the preview needs:
// while a slider moves, only the freshest request matters. A replaced job
// resolves to null — "no longer wanted", not an error: a rejection would
// have to be caught and told apart from a real failure on every call.

import type { CsgJob, JobPart, JobProgress, WorkerIn, WorkerOut } from './protocol';

export interface JobResult {
  parts: JobPart[];
  /** time the worker spent on the job */
  ms: number;
}

interface Pending {
  id: number;
  job: CsgJob;
  onProgress?: (progress: JobProgress) => void;
  settle(result: JobResult | null): void;
  fail(message: string): void;
}

export class CsgClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private running: Pending | null = null;
  private waiting: Pending | null = null;

  /** null — a fresher job replaced this one. */
  run(job: CsgJob, onProgress?: (progress: JobProgress) => void): Promise<JobResult | null> {
    return new Promise((resolve, reject) => {
      const pending: Pending = {
        id: this.nextId++,
        job,
        onProgress,
        settle: resolve,
        fail: (message) => reject(new Error(message)),
      };

      if (!this.running) {
        this.start(pending);
        return;
      }
      // An export is never evicted: it was asked for with a button and will
      // not come again. A preview will, with the next edit.
      if (this.waiting?.job.kind === 'export' && job.kind !== 'export') {
        resolve(null);
        return;
      }
      this.waiting?.settle(null);
      this.waiting = pending;
    });
  }

  private start(pending: Pending): void {
    this.running = pending;
    const message: WorkerIn = { jobId: pending.id, job: pending.job };
    this.ensure().postMessage(message);
  }

  private next(): void {
    this.running = null;
    const waiting = this.waiting;
    this.waiting = null;
    if (waiting) this.start(waiting);
  }

  private receive(data: unknown): void {
    if (!isWorkerOut(data)) return;
    const running = this.running;
    // A reply to a job nobody waits for any more: drop it.
    if (!running || running.id !== data.jobId) return;

    if (data.type === 'progress') {
      running.onProgress?.({ step: data.step, total: data.total, label: data.label });
      return;
    }
    if (data.type === 'done') running.settle({ parts: data.parts, ms: data.ms });
    else running.fail(data.message);
    this.next();
  }

  /** The worker itself broke: the module did not load, WASM crashed. */
  private broke(message: string): void {
    this.running?.fail(message);
    this.waiting?.fail(message);
    this.waiting = null;
    this.running = null;
    // The next job starts a fresh worker: a one-off failure must not bury
    // the app until the page is reloaded.
    this.worker?.terminate();
    this.worker = null;
  }

  private ensure(): Worker {
    if (!this.worker) {
      const worker = new Worker(new URL('./csg.worker.ts', import.meta.url), { type: 'module' });
      worker.addEventListener('message', (event) => this.receive(event.data));
      worker.addEventListener('error', (event) => this.broke(event.message || 'the worker failed to start'));
      worker.addEventListener('messageerror', () => this.broke('the worker reply is unreadable'));
      this.worker = worker;
    }
    return this.worker;
  }
}

function isWorkerOut(data: unknown): data is WorkerOut {
  if (typeof data !== 'object' || data === null) return false;
  if (!('jobId' in data) || typeof data.jobId !== 'number') return false;
  if (!('type' in data)) return false;
  return data.type === 'progress' || data.type === 'done' || data.type === 'error';
}
