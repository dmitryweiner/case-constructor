// All the CSG of the app. The main thread only sends the state here and gets
// finished meshes back: the manifold WASM module never reaches the main
// thread, and the tab does not freeze even on a fine export. No DOM and no
// Three.js: the worker sees pure geometry only.

import type { CsgApi } from '../geo/csg';
import { initCSG } from '../geo/csg';
import type { CaseBuild } from '../geo/build';
import { BUILD_STAGES, buildCase } from '../geo/build';
import type { LabelRaster } from '../geo/label';
import type { HalfHinge } from '../geo/hinge';
import type { AppState } from '../state/schema';
import type { Half } from '../state/hinged';
import { casesOf, halfHinge } from '../state/hinged';
import type { Message } from '../geo/message';
import type { SurfaceMesh } from '../geo/surface';
import { meshBounds } from '../geo/surface';
import { assessExport, validateMesh } from '../geo/validate';
import { sanitizeState } from '../state/schema';
import { sanitizeLabelRaster } from '../geo/label';
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
  const cases = casesOf(state);
  const total = BUILD_STAGES.length * cases.length + (exporting ? 1 : 0);
  let step = 0;
  const stage = (label: Message): void => {
    send({ type: 'progress', jobId, step: step++, total, label });
  };
  const builds = cases.map(({ half, state: one }) => {
    const label = sanitizeLabelRaster(half === 'b' ? job.labelB : job.label);
    return { half, built: half ? cachedBuild(csg, half, one, halfHinge(state, half), segments, stage, label) : buildCase(csg, one, segments, stage, label) };
  });
  if (exporting) stage({ code: 'progress.check' });
  return builds.flatMap(({ half, built }) => {
    const parts = [
      part('body', built.body, exporting),
      part('lid', built.lid, exporting),
      ...(built.screw ? [part('screw', built.screw, exporting)] : []),
      ...(built.clamps ? [part('clamp', built.clamps, exporting)] : []),
      ...(built.lidClamps ? [part('lidClamp', built.lidClamps, exporting)] : []),
      ...(built.hinge ? [part('hinge', built.hinge, exporting)] : []),
      // the rails print as their print pose; screwed down they are only shown
      ...(built.rails ? [part('rail', built.rails, false)] : []),
      ...(built.lidRails ? [part('lidRail', built.lidRails, false)] : []),
      ...(built.railsPrint ? [part('railPrint', built.railsPrint, exporting)] : []),
      ...(built.lidRailsPrint ? [part('lidRailPrint', built.lidRailsPrint, exporting)] : []),
    ];
    return half ? parts.map((one): JobPart => ({ ...one, half })) : parts;
  });
}

/**
 * The last build of each half of a hinged case, and what it was built from:
 * editing one half does not rebuild the other (plans/PLAN-HINGED.md, P3).
 */
const lastHalves = new Map<Half, { key: string; built: CaseBuild }>();

function cachedBuild(
  csg: CsgApi, half: Half, state: AppState, hinge: HalfHinge | null, segments: number, stage: (label: Message) => void, label: LabelRaster | null,
): CaseBuild {
  const key = `${segments}|${rasterKey(label)}|${JSON.stringify(hinge)}|${JSON.stringify(state)}`;
  const last = lastHalves.get(half);
  if (last?.key === key) {
    for (const one of BUILD_STAGES) stage(one);
    return copyBuild(last.built);
  }
  const built = buildCase(csg, state, segments, stage, label, hinge);
  // the buffers sent are transferred away: the cache keeps copies
  lastHalves.set(half, { key, built: copyBuild(built) });
  return built;
}

function rasterKey(label: LabelRaster | null): string {
  if (!label) return '-';
  // FNV-1a over the pixels: the raster is derived from the label's state, but a font arriving late redraws it
  let hash = 0x811c9dc5;
  for (const value of label.pixels) hash = Math.imul(hash ^ value, 0x01000193);
  return `${label.w}x${label.h}@${label.mmPerPx}#${hash >>> 0}`;
}

function copyMesh(mesh: SurfaceMesh): SurfaceMesh {
  return { positions: mesh.positions.slice(), indices: mesh.indices.slice(), normals: mesh.normals.slice() };
}

function copyBuild(built: CaseBuild): CaseBuild {
  const optional = (mesh: SurfaceMesh | null): SurfaceMesh | null => (mesh ? copyMesh(mesh) : null);
  return {
    ...built,
    body: copyMesh(built.body),
    lid: copyMesh(built.lid),
    screw: optional(built.screw),
    clamps: optional(built.clamps),
    lidClamps: optional(built.lidClamps),
    hinge: optional(built.hinge),
  };
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
