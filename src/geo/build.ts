// The whole case: state → { body, lid }. Worker only — every step here is a
// boolean. The pipeline grows milestone by milestone (plans/PLAN.md §4); the order
// matters and is commented where it does.

import type { CsgApi } from './csg';
import type { Manifold } from 'manifold-3d';
import { CsgScope, fromManifold, transformSolid, unionAll } from './csg';
import type { Dims } from './face';
import { faceFrame } from './face';
import type { PlacedBoard } from './layout';
import { caseLayout, effectiveLid, flatFrame, heldByLid } from './layout';
import type { Message } from './message';
import { partingZ, skirtSolid, splitAtParting } from './parting';
import { plateOf, shapeSpec } from './shape';
import { outerSolid, shellSolid } from './shell';
import type { Support } from './standoffs';
import { SINK, cylinder, fromCeiling, rails, roundSegments, standoffs, upsideDown } from './standoffs';
import { REST_R, caseRests } from './rests';
import { batteryClamps, batterySupports } from './batterySolids';
import { glassKeepOut, rimSolids } from './rimSolids';
import { clampBars, clampPosts } from './clampSolids';
import { cuttersSolid } from './cut';
import { postSpots } from './fastening';
import { postSolids, snapSolids } from './lip';
import { headLimits } from './lidPosts';
import { headSeat } from './lidSpec';
import { openingPolygon } from './opening';
import { loftSlice } from './section';
import { extraCutters } from './cutters';
import { outerTopAt, portCutters } from './ports';
import { closedKeyholes, earSpecs, extrasCutters } from './extras';
import { earSolids, keyholePadSolids, labelSolid } from './extrasSolids';
import { screwSolid } from './screwSolids';
import type { HalfHinge } from './hinge';
import { bodyRange, cableCutters } from './hinge';
import { knuckleSolids, leafSolids } from './hingeSolids';
import { effectiveRadii } from './loft';
import { screwShape, threadPoints } from './thread';
import type { LabelRaster } from './label';
import { labelPlacement } from './label';
import { applyAffine, composeAffine, invertRigid } from './surface';
import type { SurfaceMesh } from './surface';
import type { AppState } from '../state/schema';

export interface CaseBuild {
  body: SurfaceMesh;
  lid: SurfaceMesh;
  /** printed screws: one screw in its own frame (head below z = 0, shank up); the main thread places the copies */
  screw: SurfaceMesh | null;
  /** the clamp bars that go with the body (batteries', a panel's the body holds), case frame, as screwed down; null without */
  clamps: SurfaceMesh | null;
  /** the clamp bars of panels the lid holds, case frame, as screwed down; null without */
  lidClamps: SurfaceMesh | null;
  /** a hinged half with a printed hinge: its leaf and knuckles, in the half's frame; null without */
  hinge: SurfaceMesh | null;
  dims: Dims;
}

/** Stages reported to the progress bar, in order. */
export const BUILD_STAGES: readonly Message[] = [
  { code: 'progress.shell' },
  { code: 'progress.split' },
  { code: 'progress.supports' },
  { code: 'progress.lid' },
  { code: 'progress.fastening' },
  { code: 'progress.cutouts' },
  { code: 'progress.extras' },
];

/** `hinge`: a half of a hinged case gets its knuckles (`state/hinged.ts`, `halfHinge`). */
export function buildCase(
  csg: CsgApi, state: AppState, segments: number, onStage: (stage: Message) => void = () => {}, label: LabelRaster | null = null,
  hinge: HalfHinge | null = null,
): CaseBuild {
  const scope = new CsgScope();
  try {
    const layout = caseLayout(state);
    const { dims } = layout;
    // the console's heights may have been raised to clear the boards
    const shape = { ...state.shape, console: layout.console };
    const spec = shapeSpec(shape, dims);
    const lid = effectiveLid(shape, state.lid, dims);
    const frame = faceFrame(lid.face, dims);
    const plate = plateOf(shape, lid.face);
    const zp = partingZ(plate, lid.depth);

    onStage(BUILD_STAGES[0]);
    const shell = shellSolid(csg, scope, spec, segments);

    onStage(BUILD_STAGES[1]);
    const parted = splitAtParting(scope, shell, frame, zp);
    let body = parted.body;
    let lidSolid = parted.lid;

    // Supports go on whichever part owns the plate they grow from — the
    // body, or the lid when the floor (or, for a hung board, the ceiling) is
    // the lid. After the split, so the parting
    // plane never cuts a standoff; before any cutout, so a vent under a
    // standoff does not open it.
    onStage(BUILD_STAGES[2]);
    // a hung board's supports are a floor board's in the case turned upside down
    const held = (board: PlacedBoard): Support[] => (board.def.mount.kind === 'holes'
      ? standoffs(csg, scope, board, shape.floor, segments)
      : board.def.mount.kind === 'clamp'
        ? clampPosts(csg, scope, board, shape.floor, segments)
        : rails(csg, scope, board, shape.floor));
    // and step aside for its glass, which a rim around it locates
    // built in its plate's frame (the top, or the console's slope), then turned into the case
    const hung = (board: PlacedBoard): Support[] => {
      const frame = board.frame ?? flatFrame(dims.h);
      const local = composeAffine(invertRigid(frame), board.toCase);
      const keepOut = glassKeepOut(csg, scope, board, segments);
      const own = fromCeiling(scope, held(upsideDown({ ...board, toCase: local, z0: local[11] }, 0)), 0)
        .map((support): Support => {
          const material = transformSolid(scope, support.material, frame);
          return {
            base: applyAffine(frame, support.base),
            material: keepOut ? scope.keep(material.subtract(keepOut)) : material,
            holes: support.holes ? transformSolid(scope, support.holes, frame) : null,
          };
        });
      return [...own, ...rimSolids(csg, scope, board, shape.floor, segments)];
    };
    // a board on a display's back rides on the display's own standoffs
    // (a carried display only gets the rim around its glass)
    const supports: Support[] = layout.boards.flatMap((board) => (board.attached !== undefined
      ? (board.carried ? rimSolids(csg, scope, board, shape.floor, segments) : []) : board.def.battery
      ? batterySupports(csg, scope, board, board.def.battery, shape.floor, segments)
      : board.hung ? hung(board) : held(board)));
    // rests under a keyboard's free corners grow from the floor, like a floor board's standoffs
    for (const rest of caseRests(layout, shape.floor)) {
      const material = cylinder(csg, scope, rest.cx, rest.cy, shape.floor - SINK, rest.top, REST_R, roundSegments(segments));
      supports.push({ base: [rest.cx, rest.cy, shape.floor / 2], material, holes: null });
    }
    // The owner is the part under the support's base; whatever of it reaches
    // into the other part's material (a deep side lid over a manually placed
    // board) is cut away, so the parts never overlap.
    const onLid = (support: Support): boolean => applyAffine(frame.toFace, support.base)[2] > zp;
    const forLid = supports.filter(onLid);
    const forBody = supports.filter((support) => !onLid(support));
    const rawBody = body;
    body = attach(csg, scope, body, forBody, lidSolid);
    lidSolid = attach(csg, scope, lidSolid, forLid, rawBody);
    // a hinged half's knuckles hold on to its body's part of the hinge wall;
    // before the openings, so a port through that wall cuts them too (and is warned about).
    // A printed hinge is a part of its own: the half gets the pads and holes for its screws.
    let leaf: Manifold | null = null;
    if (hinge?.kind === 'leaves') {
      const solids = leafSolids(csg, scope, hinge, dims, shape.wall, segments);
      if (solids) {
        leaf = solids.leaf;
        body = scope.keep(scope.keep(body.add(scope.keep(solids.pads.subtract(lidSolid)))).subtract(solids.holes));
      }
    } else if (hinge) {
      const range = bodyRange(dims.h, lid.face, plate, lid.depth);
      const knuckles = knuckleSolids(csg, scope, hinge, dims, effectiveRadii(spec.outer).edgeR, range, segments);
      if (knuckles) {
        body = scope.keep(body.add(scope.keep(knuckles.material.subtract(lidSolid))));
        if (knuckles.holes) body = scope.keep(body.subtract(knuckles.holes));
      }
    }

    onStage(BUILD_STAGES[3]);
    const outer = outerSolid(csg, scope, spec, segments);
    const top = outerTopAt(shape, dims, layout.console.frontH, layout.console.backH);
    const ports = portCutters(layout, shape);
    const cutters = [
      ...ports,
      ...extraCutters(state.extraCuts, shape, dims, top),
      ...extrasCutters(state, shape, layout, lid, top, ports),
      // a hinged half: the cables' slots through its hinge wall
      ...(hinge ? cableCutters(hinge, shape, dims, top) : []),
    ];
    let skirt = skirtSolid(csg, scope, spec, outer, frame, zp, lid, shape, segments);
    const opening = openingPolygon(spec, frame, zp, lid.lip.h, segments);

    // Fastening: snap rods on the skirt and grooves in the body, or corner
    // posts in the body with holes through the lid (screws) or pockets
    // facing pockets in the lid's bosses (magnets). The skirt steps aside
    // for the posts.
    onStage(BUILD_STAGES[4]);
    if (lid.fastening !== 'snaps') {
      const upper = loftSlice(spec.inner, spec.innerCut, frame, -plate - lid.fit, segments);
      const spots = postSpots(opening, lid, shape.wall);
      // a head's seat never reaches the lid's edge, whatever a file asks for
      const limits = headLimits(spots, shape, dims, lid);
      const seated = { ...lid, head: { d: Math.min(headSeat(lid).d, limits.d), depth: lid.head.depth } };
      const posts = postSolids(csg, scope, spots, opening, upper, frame, zp, plate, seated, segments);
      if (posts) {
        if (skirt) skirt = scope.keep(skirt.subtract(posts.skirtClearance));
        const material = scope.keep(scope.keep(posts.posts.intersect(outer)).subtract(lidSolid));
        body = scope.keep(scope.keep(body.add(material)).subtract(posts.postHoles));
        if (posts.lidBosses) lidSolid = scope.keep(lidSolid.add(posts.lidBosses));
      }
      if (skirt) lidSolid = scope.keep(lidSolid.add(skirt));
      // the holes last: the skirt reaches up into the plate, and added after
      // them it filled a deep counterbore back in, a crescent at the corner
      if (posts) lidSolid = scope.keep(lidSolid.subtract(posts.lidHoles));
    } else {
      if (skirt) lidSolid = scope.keep(lidSolid.add(skirt));
      const snaps = snapSolids(csg, scope, opening, frame, zp, lid, shape.kind === 'cylinder', cutters, segments);
      if (snaps.bumps) lidSolid = scope.keep(lidSolid.add(snaps.bumps));
      if (snaps.grooves) body = scope.keep(body.subtract(snaps.grooves));
    }

    // Openings last: through walls, skirt and plates of both parts alike, so
    // an opening on the parting plane is cut in both halves.
    onStage(BUILD_STAGES[5]);
    const holes = cuttersSolid(csg, scope, cutters, segments);
    if (holes) {
      body = scope.keep(body.subtract(holes));
      lidSolid = scope.keep(lidSolid.subtract(holes));
    }

    // Additive extras: ears on the part that owns the floor, the label on the lid.
    onStage(BUILD_STAGES[6]);
    const ears = earSolids(csg, scope, earSpecs(state.wallMount, shape, dims), shape.floor, segments);
    if (ears) {
      const floorOnLid = applyAffine(frame.toFace, [dims.w / 2, dims.d / 2, shape.floor / 2])[2] > zp;
      const material = scope.keep(ears.material.subtract(floorOnLid ? body : lidSolid));
      if (floorOnLid) lidSolid = scope.keep(scope.keep(lidSolid.add(material)).subtract(ears.holes));
      else body = scope.keep(scope.keep(body.add(material)).subtract(ears.holes));
    }
    // closed keyholes: pads and feet on the part that owns their face, then
    // the pockets — after the pads, or the pads would fill them back
    const closed = closedKeyholes(state.wallMount, shape, dims, lid);
    if (closed) {
      const pads = keyholePadSolids(csg, scope, closed, faceFrame(closed.face, dims), segments);
      const keyFrame = faceFrame(closed.face, dims);
      const inPlate = applyAffine(keyFrame.fromFace, [keyFrame.extent.w / 2, keyFrame.extent.h / 2, -plateOf(shape, closed.face) / 2]);
      const padsOnLid = applyAffine(frame.toFace, inPlate)[2] > zp;
      const material = scope.keep(pads.material.subtract(padsOnLid ? body : lidSolid));
      let owner = scope.keep((padsOnLid ? lidSolid : body).add(material));
      if (pads.holes) owner = scope.keep(owner.subtract(pads.holes));
      if (padsOnLid) lidSolid = owner;
      else body = owner;
    }
    if (state.label.on && label) {
      const place = labelPlacement(state.label, label, lid.face, dims, shape);
      // an engraving never goes through the plate
      const depth = state.label.raised ? state.label.depth : Math.min(state.label.depth, plate - 0.6);
      const relief = labelSolid(csg, scope, state.label, label, frame, place, depth);
      if (relief) lidSolid = scope.keep(state.label.raised ? lidSolid.add(relief) : lidSolid.subtract(relief));
    }

    const screw = lid.fastening === 'printed'
      ? fromManifold(screwSolid(csg, scope, screwShape(lid.thread.size, plate, lid.fit), threadPoints(segments)))
      : null;
    // clamp bars go with the part that holds what they clamp: battery bars with the body,
    // a panel's with the lid when the lid holds the panel
    const bars = layout.boards.flatMap((board) => (board.def.battery
      ? [{ onLid: false, solid: batteryClamps(csg, scope, board, board.def.battery, segments) }]
      : board.hung && board.def.mount.kind === 'clamp' ? [{ onLid: heldByLid(board, lid.face), solid: clampBars(csg, scope, board, segments) }] : []));
    const merged = (onLid: boolean): SurfaceMesh | null => {
      const solids = bars.filter((bar) => bar.onLid === onLid).map((bar) => bar.solid);
      return solids.length > 0 ? fromManifold(unionAll(csg, scope, solids)) : null;
    };
    return {
      body: fromManifold(body), lid: fromManifold(lidSolid), screw, clamps: merged(false), lidClamps: merged(true), hinge: leaf ? fromManifold(leaf) : null, dims,
    };
  } finally {
    scope.dispose();
  }
}

/**
 * Unions the supports' material with a part — minus whatever of it would
 * enter the other part — then drills their holes.
 */
function attach(csg: CsgApi, scope: CsgScope, part: Manifold, supports: readonly Support[], other: Manifold): Manifold {
  if (supports.length === 0) return part;
  const material = scope.keep(unionAll(csg, scope, supports.map((support) => support.material)).subtract(other));
  const grown = scope.keep(part.add(material));
  const holes = supports.flatMap((support) => (support.holes ? [support.holes] : []));
  if (holes.length === 0) return grown;
  return scope.keep(grown.subtract(unionAll(csg, scope, holes)));
}
