// Protocol of the CSG worker. Types only: both sides of the boundary (main
// and worker) must see one description of the messages.
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
export type CsgJob = (
  | { kind: 'preview'; state: AppState; segments: number }
  | { kind: 'export'; state: AppState }
) & {
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
  blocking: Message[];
  /** a hinged case: the half the part belongs to, in that half's own frame */
  half?: Half;
}

/**
 * Progress by stages. Manifold says nothing about itself inside one boolean,
 * and we will not pretend it does: the bar counts stages, the label names
 * the current one.
 */
export interface JobProgress {
  step: number;
  total: number;
  label: Message;
}

export interface WorkerIn {
  jobId: number;
  job: CsgJob;
}

export type WorkerOut =
  | ({ type: 'progress'; jobId: number } & JobProgress)
  | { type: 'done'; jobId: number; parts: JobPart[]; ms: number }
  | { type: 'error'; jobId: number; message: string };
