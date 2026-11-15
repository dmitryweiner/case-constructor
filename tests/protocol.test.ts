// The worker's guard: what comes through postMessage is checked before the
// worker takes it (maker-kit's serveJobs answers a refused job with an error).

import { isCsgJob } from '../src/worker/protocol';
import { defaultState } from '../src/state/schema';

describe('isCsgJob', () => {
  const state = defaultState();

  it('takes a preview with its segments and an export, with or without label rasters', () => {
    expect(isCsgJob({ kind: 'preview', state, segments: 12 })).toBe(true);
    expect(isCsgJob({ kind: 'export', state })).toBe(true);
    expect(isCsgJob({ kind: 'export', state, labels: [null], labelsB: [] })).toBe(true);
  });

  it('refuses an unknown kind, a missing state, a preview without segments and labels that are not a list', () => {
    expect(isCsgJob({ kind: 'mesh', state })).toBe(false);
    expect(isCsgJob({ kind: 'export' })).toBe(false);
    expect(isCsgJob({ kind: 'export', state: [] })).toBe(false);
    expect(isCsgJob({ kind: 'preview', state })).toBe(false);
    expect(isCsgJob({ kind: 'preview', state, segments: '12' })).toBe(false);
    expect(isCsgJob({ kind: 'export', state, labels: 'a' })).toBe(false);
    expect(isCsgJob(null)).toBe(false);
    expect(isCsgJob([])).toBe(false);
  });
});
