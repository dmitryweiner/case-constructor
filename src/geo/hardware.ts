// Through bolts and their nuts as the view draws them: bought hardware,
// never printed, so never in the print layout or an STL. Pure meshes, no
// CSG, built by the main thread like the board ghosts.

import type { ThroughBolt } from './bolts';
import { throughBolt } from './bolts';
import { COUNTERSUNK_HEAD_D, SCREWS } from './fasteners';
import { lidPosts } from './lidPosts';
import type { LidState } from './lidSpec';
import { nutSize } from './lidSpec';
import { meshNormals } from './normals';
import type { Affine, SurfaceMesh } from './surface';
import { composeAffine, mergeMeshes, transformMesh, translation } from './surface';
import type { AppState } from '../state/schema';

/** Points around a bolt's round parts. */
const ROUND = 24;

/**
 * A solid of revolution (or a prism, with few sides) along z: a ring of
 * `sides` points of radius r at each height, bottom to top, closed by a
 * centre vertex at either end.
 */
function latheMesh(rings: readonly [number, number][], sides: number, turn = 0): SurfaceMesh {
  const positions: number[] = [0, 0, rings[0][1], 0, 0, rings[rings.length - 1][1]];
  for (const [r, z] of rings) {
    for (let i = 0; i < sides; i++) {
      const a = turn + (2 * Math.PI * i) / sides;
      positions.push(r * Math.cos(a), r * Math.sin(a), z);
    }
  }
  const at = (ring: number, i: number): number => 2 + ring * sides + (i % sides);
  const indices: number[] = [];
  for (let i = 0; i < sides; i++) {
    indices.push(0, at(0, i + 1), at(0, i));
    for (let ring = 0; ring < rings.length - 1; ring++) {
      indices.push(at(ring, i), at(ring, i + 1), at(ring + 1, i + 1), at(ring, i), at(ring + 1, i + 1), at(ring + 1, i));
    }
    indices.push(1, at(rings.length - 1, i), at(rings.length - 1, i + 1));
  }
  const pos = new Float32Array(positions);
  const index = new Uint32Array(indices);
  return { positions: pos, indices: index, normals: meshNormals(pos, index) };
}

/**
 * A bolt in the lid's face frame, its axis at u = v = 0: the shank from
 * the bolt's end up to under its head, a pan head over that, or a 90°
 * countersunk head flush with the lid's face.
 */
export function boltMesh(lid: LidState, bolt: ThroughBolt): SurfaceMesh {
  const screw = SCREWS[lid.screw.size];
  const r = screw.d / 2;
  const end = bolt.underHead - bolt.length;
  if (lid.screw.head === 'countersunk') {
    const head = COUNTERSUNK_HEAD_D[lid.screw.size] / 2;
    return latheMesh(
      [
        [r, end],
        [r, -(head - r)],
        [head, 0],
      ],
      ROUND,
    );
  }
  return latheMesh(
    [
      [r, end],
      [r, bolt.underHead],
      [screw.headD / 2, bolt.underHead],
      [screw.headD / 2, bolt.underHead + screw.headH],
    ],
    ROUND,
  );
}

/** A hex nut in the lid's face frame, its axis at u = v = 0, from z0 down to z0 − h, `turn` radians about its axis. */
export function nutMesh(lid: LidState, z0: number, turn: number): SurfaceMesh {
  const { af, h } = nutSize(lid);
  const corner = af / Math.sqrt(3);
  return latheMesh(
    [
      [corner, z0 - h],
      [corner, z0],
    ],
    6,
    turn,
  );
}

/**
 * The bolts and nuts of a state's through bolts in the case frame, as
 * tightened: each bolt in its column, each nut on the far face or in its
 * pocket, a flat towards the corner. Null for any other fastening.
 */
export function throughHardware(state: AppState): { bolts: SurfaceMesh; nuts: SurfaceMesh } | null {
  const { frame, plate, lid, spots } = lidPosts(state);
  if (lid.fastening !== 'through' || spots.length === 0) return null;
  const bolt = throughBolt(lid, plate, frame.depth);
  const one = boltMesh(lid, bolt);
  // a recessed nut's bearing face is the pocket's roof; a nut on the face bears on the far face
  const bearing = -frame.depth + bolt.pocket;
  const at = (u: number, v: number): Affine => composeAffine(frame.fromFace, translation(u, v, 0));
  const bolts = mergeMeshes(spots.map((spot) => transformMesh(one, at(spot.centre[0], spot.centre[1]))));
  const nuts = mergeMeshes(
    spots.map((spot) => {
      const towards = Math.atan2(spot.centre[1] - spot.anchor[1], spot.centre[0] - spot.anchor[0]);
      return transformMesh(nutMesh(lid, bearing, towards + Math.PI / 6), at(spot.centre[0], spot.centre[1]));
    }),
  );
  return { bolts, nuts };
}
