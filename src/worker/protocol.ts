// The CSG worker's jobs and parts, and the guard of a job; the messages
// around them are maker-kit's worker/protocol. Both sides of the boundary
// (main and worker) see one description.
//
// What goes to the worker is the whole application state: the worker passes
// it through sanitizeState itself and decides what to build. The worker
// boundary is an outer boundary of the core, like a file or localStorage.

import type { AppState } from '../state/schema';
import type { Message } from '../geo/message';
import type { LabelRaster } from '../geo/label';
import type { Half } from '../state/hinged';

/**
 * A job. A preview builds the exact case at preview resolution; an export
 * builds it at `state.resolution` and checks every part.
 */
export type CsgJob = ({ kind: 'preview'; state: AppState; segments: number } | { kind: 'export'; state: AppState }) & {
  /**
   * The labels' texts as rasters, one per label in `state.labels`: fonts
   * live in the main thread, so it draws the texts; a raster is derived from
   * the state, not part of it, and the worker checks only its shape
   * (`sanitizeLabelRasters`).
   */
  labels?: (LabelRaster | null)[];
  /** a hinged case: the upper half's labels (`labels` are the lower half's) */
  labelsB?: (LabelRaster | null)[];
};

/**
 * 'screw': one printed screw in its own frame, when the lid holds on printed
 * screws; 'clamp': the clamp bars that go with the body (batteries', a
 * panel's the body holds), 'lidClamp': those of panels the lid holds — case
 * frame, screwed down; 'hinge': a hinged half's leaf of a printed hinge, in the half's frame;
 * 'rail' / 'lidRail': rails on screws on the body's posts / the lid's, case frame, screwed down,
 * and 'railPrint' / 'lidRailPrint': the same as they print (top down, from the origin)
 */
export type PartId = 'body' | 'lid' | 'screw' | 'clamp' | 'lidClamp' | 'hinge' | 'rail' | 'lidRail' | 'railPrint' | 'lidRailPrint';

/** A finished part: the mesh plus what the panel shows about it. */
export interface JobPart {
  id: PartId;
  /** "W×D×H" in mm, without units (the panel adds them) */
  note: string;
  positions: Float32Array;
  indices: Uint32Array;
  normals: Float32Array;
  /** what keeps the part out of the STL; always empty for a preview */
  blockers: Message[];
  /** a hinged case: the half the part belongs to, in that half's own frame */
  half?: Half;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isLabels = (value: unknown): boolean => value === undefined || Array.isArray(value);

/**
 * The worker's guard (maker-kit's serveJobs answers a refused job with an
 * error): the kind and the fields it needs. The state is sanitized and the
 * rasters' shapes checked by the worker itself (`sanitizeState`,
 * `sanitizeLabelRasters`).
 */
export function isCsgJob(job: unknown): job is CsgJob {
  if (!isRecord(job) || !isRecord(job.state) || !isLabels(job.labels) || !isLabels(job.labelsB)) return false;
  return job.kind === 'export' || (job.kind === 'preview' && typeof job.segments === 'number');
}
