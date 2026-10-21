// The whole case: state → { body, lid }. Worker only — every step here is a
// boolean. The pipeline grows milestone by milestone (PLAN.md §4); the order
// matters and is commented where it does.

import type { CsgApi } from './csg';
import { CsgScope, fromManifold } from './csg';
import type { Dims } from './face';
import { faceFrame } from './face';
import { caseDims, effectiveLid } from './layout';
import type { Message } from './message';
import { partingZ, skirtSolid, splitAtParting } from './parting';
import { plateOf, shapeSpec } from './shape';
import { outerSolid, shellSolid } from './shell';
import type { SurfaceMesh } from './surface';
import type { AppState } from '../state/schema';

export interface CaseBuild {
  body: SurfaceMesh;
  lid: SurfaceMesh;
  dims: Dims;
}

/** Stages reported to the progress bar, in order. */
export const BUILD_STAGES: readonly Message[] = [
  { code: 'progress.shell' },
  { code: 'progress.split' },
  { code: 'progress.lid' },
];

export function buildCase(
  csg: CsgApi, state: AppState, segments: number, onStage: (stage: Message) => void = () => {},
): CaseBuild {
  const scope = new CsgScope();
  try {
    const { shape } = state;
    const dims = caseDims(shape);
    const spec = shapeSpec(shape, dims);
    const lid = effectiveLid(shape, state.lid, dims);
    const frame = faceFrame(lid.face, dims);
    const plate = plateOf(shape, lid.face);
    const zp = partingZ(plate, lid.depth);

    onStage(BUILD_STAGES[0]);
    const shell = shellSolid(csg, scope, spec, segments);

    onStage(BUILD_STAGES[1]);
    const parted = splitAtParting(scope, shell, frame, zp);

    onStage(BUILD_STAGES[2]);
    let lidSolid = parted.lid;
    const outer = outerSolid(csg, scope, spec, segments);
    const skirt = skirtSolid(csg, scope, spec, outer, frame, zp, lid, shape.wall, segments);
    if (skirt) lidSolid = scope.keep(lidSolid.add(skirt));

    return { body: fromManifold(parted.body), lid: fromManifold(lidSolid), dims };
  } finally {
    scope.dispose();
  }
}
