// The export: maker-kit's gate (finite, whole, closed, outward, few slivers)
// plus the app's own limit, the largest part a printer bed is assumed to take;
// the app's name in an STL's header.

import { assessExport } from 'maker-kit/3d/validate';
import type { MeshReport } from 'maker-kit/3d/validate';
import type { Message } from './message';

/** The app's name first in an STL's header (the kit's encodeSTL writes the part's after it). */
export const STL_BRAND = 'Case Constructor';

/** Largest part a printer bed is assumed to take, mm. */
export const MAX_PART_MM = 400;

export interface PartAssessment {
  blockers: Message[];
  warnings: Message[];
}

/** What blocks a part's download and what is worth a warning: always a solid to print. */
export function assessPart(report: MeshReport): PartAssessment {
  const { blockers, warnings } = assessExport(report, true);
  if (report.extents.some((extent) => extent > MAX_PART_MM)) {
    return { blockers: [...blockers, { code: 'mesh.tooLarge', params: { max: MAX_PART_MM } }], warnings };
  }
  return { blockers, warnings };
}
