// Bounded state history for undo and redo.
//
// Entries are recorded in batches, not on every change: dragging a slider
// end to end is one action, not two hundred. The caller does the batching in
// time (main.ts); this is only a stack with a limit, so a long session does
// not eat memory.

export class History<T> {
  private past: T[] = [];
  private future: T[] = [];
  private current: T;

  constructor(initial: T, private readonly limit = 80) {
    this.current = initial;
  }

  get value(): T {
    return this.current;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  /** Records a new state. A repeat of the current one is ignored. */
  push(state: T): void {
    if (equal(state, this.current)) return;
    this.past.push(this.current);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
    this.current = state;
  }

  /** Replaces the current state without an entry (intermediate frames). */
  replace(state: T): void {
    this.current = state;
  }

  undo(): T | null {
    const previous = this.past.pop();
    if (previous === undefined) return null;
    this.future.push(this.current);
    this.current = previous;
    return previous;
  }

  redo(): T | null {
    const next = this.future.pop();
    if (next === undefined) return null;
    this.past.push(this.current);
    this.current = next;
    return next;
  }
}

function equal(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
