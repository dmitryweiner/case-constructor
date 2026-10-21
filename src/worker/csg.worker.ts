// All the CSG of the app. The main thread only sends the state here and gets
// finished meshes back: the manifold WASM module never reaches the main
// thread, and the tab does not freeze even on a fine export. No DOM and no
// Three.js: the worker sees pure geometry only.

import type { CsgApi } from '../geo/csg';
import { initCSG } from '../geo/csg';
import { BUILD_STAGES, buildCase } from '../geo/build';
import type { Message } from '../geo/message';
import type { SurfaceMesh } from '../geo/surface';
import { meshBounds } from '../geo/surface';
import { assessExport, validateMesh } from '../geo/validate';
import { sanitizeState } from '../state/schema';
import type { CsgJob, JobPart, PartId, WorkerIn, WorkerOut } from './protocol';

/**
 * WASM starts loading as soon as the worker exists: the client creates it
 * lazily, and by then it is clear there will be work.
 */
const ready = initCSG();
/** Whether the module is in. The first job waits for it, and says so. */
let loaded = false;
void ready.then(() => {
  loaded = true;
});

addEventListener('message', (event) => {
  if (isJobMessage(event.data)) void handle(event.data);
});

async function handle(message: WorkerIn): Promise<void> {
  const { jobId, job } = message;
  try {
    if (!loaded) send({ type: 'progress', jobId, step: 0, total: 1, label: { code: 'progress.loading' } });
    const csg = await ready;
    const started = performance.now();
    const parts = run(csg, jobId, job);
    const ms = performance.now() - started;
    // Buffers are transferred, not copied.
    send({ type: 'done', jobId, parts, ms }, transferable(parts));
  } catch (error) {
    send({ type: 'error', jobId, message: error instanceof Error ? error.message : String(error) });
  }
}

function run(csg: CsgApi, jobId: number, job: CsgJob): JobPart[] {
  // The worker boundary is an outer boundary, like a file or the UI.
  const state = sanitizeState(job.state);
  const exporting = job.kind === 'export';
  if (!exporting && job.kind !== 'preview') throw new Error('the worker does not know this job');
  const segments = exporting ? state.resolution : previewSegments(job.segments);
  const total = BUILD_STAGES.length + (exporting ? 1 : 0);
  let step = 0;
  const stage = (label: Message): void => {
    send({ type: 'progress', jobId, step: step++, total, label });
  };
  const built = buildCase(csg, state, segments, stage);
  if (exporting) stage({ code: 'progress.check' });
  return [
    part('body', built.body, exporting),
    part('lid', built.lid, exporting),
  ];
}

/** Segments of a preview: whatever came in, as a sane integer. */
function previewSegments(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 8;
  return Math.min(64, Math.max(2, n));
}

function part(id: PartId, mesh: SurfaceMesh, check: boolean): JobPart {
  const blocking = check ? assessExport(validateMesh(mesh), true).blocking : [];
  return { id, note: sizeNote(mesh), positions: mesh.positions, indices: mesh.indices, normals: mesh.normals, blocking };
}

function sizeNote(mesh: SurfaceMesh): string {
  const { min, max } = meshBounds(mesh);
  return max.map((value, axis) => Math.round(value - min[axis])).join('×');
}

function send(message: WorkerOut, transfer: Transferable[] = []): void {
  postMessage(message, { transfer });
}

function transferable(parts: JobPart[]): Transferable[] {
  const list: Transferable[] = [];
  for (const item of parts) {
    for (const view of [item.positions, item.indices, item.normals]) {
      if (view.buffer instanceof ArrayBuffer) list.push(view.buffer);
    }
  }
  return list;
}

/**
 * Only the shape of the message is checked, not the list of job kinds: an
 * unknown kind is answered by `run` with an error. Silence is never an
 * answer — the client waits for exactly one reply per job.
 */
function isJobMessage(data: unknown): data is WorkerIn {
  if (typeof data !== 'object' || data === null) return false;
  if (!('jobId' in data) || typeof data.jobId !== 'number') return false;
  if (!('job' in data) || typeof data.job !== 'object' || data.job === null) return false;
  return 'kind' in data.job && typeof data.job.kind === 'string';
}
