// Builds a case in Node, without a browser, and reports on every part:
// triangles, degenerate triangles, watertightness, volume, size, build time;
// optionally where the assembled lid and body overlap. Run through
// scripts/inspect.mjs, which passes the options in INSPECT_ARGS.

import { it } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Manifold } from 'manifold-3d';
import { CsgScope, fromManifold, initCSG, toManifold } from '../src/geo/csg';
import type { CsgApi } from '../src/geo/csg';
import { screwSolid, threadHole } from '../src/geo/screwSolids';
import type { ThreadForm } from '../src/geo/thread';
import { minorRadius, screwShape, threadEngagement, threadForm } from '../src/geo/thread';
import { buildCase } from '../src/geo/build';
import { encodeSTL } from '../src/geo/stl';
import { validateMesh } from '../src/geo/validate';
import { decodePresetFile } from '../src/state/presetFile';
import { presetById } from '../src/state/presets';
import { defaultState, sanitizeState } from '../src/state/schema';

interface Args {
  state?: string;
  file?: string;
  preset?: string;
  segments?: number;
  stl?: string;
  overlap?: string;
  levels?: string;
  degenerate?: string;
  set?: string[];
  threadTest?: string;
}

function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let node: unknown = target;
  for (const key of keys.slice(0, -1)) {
    if (typeof node !== 'object' || node === null) return;
    let child: unknown = Reflect.get(node, key);
    if (typeof child !== 'object' || child === null) {
      child = {};
      Reflect.set(node, key, child);
    }
    node = child;
  }
  if (typeof node === 'object' && node !== null) Reflect.set(node, keys[keys.length - 1], value);
}

function parseValue(text: string): unknown {
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (text.startsWith('[') || text.startsWith('{')) return JSON.parse(text);
  return Number.isFinite(Number(text)) ? Number(text) : text;
}

/** Thread forms to print and compare (plans/PLAN-IMPROVEMENTS-2026-10-25.md, R4). */
const TEST_FORMS: { id: string; note: string; form: ThreadForm }[] = [
  { id: 'a', note: 'today: 6 × 1.5, 60°, half a pitch deep', form: threadForm('P6') },
  { id: 'b', note: 'print-friendly: 6 × 1.5, the overhanging flank at 45°, 0.4 pitch deep',
    form: { d: 6, pitch: 1.5, depth: 0.4, rise: 0.4, fall: 0.4 * Math.tan(Math.PI / 6) } },
  { id: 'c', note: 'fine ISO pitch: 6 × 1, 60°, half a pitch deep', form: { ...threadForm('P6'), pitch: 1 } },
];
/** The fits of the three holes in each test nut, 1, 2 and 3 dots. */
const TEST_FITS = [0.25, 0.35, 0.45];

/** Dimples on a face: `count` of them in a row along x, centred on (x, y), cut down from z. */
function dots(csg: CsgApi, scope: CsgScope, count: number, x: number, y: number, z: number): Manifold[] {
  return Array.from({ length: count }, (_, i) => {
    const dot = scope.keep(csg.Manifold.cylinder(1.2, 0.6, 0.6, 16));
    return scope.keep(dot.translate([x + (i - (count - 1) / 2) * 1.8, y, z - 0.6]));
  });
}

/**
 * Test prints of thread forms: per form a screw (as the case's, on its head,
 * the form's letter as dots on the head's bed face: a 1, b 2, c 3) and a
 * nut — a block with three through holes at the fits of TEST_FITS (1, 2, 3
 * dots by each mouth; the form's dots on the front face), printed mouth up
 * like a post.
 */
function threadTest(csg: CsgApi, dir: string): void {
  mkdirSync(dir, { recursive: true });
  const n = 64;
  TEST_FORMS.forEach(({ id, note, form }, index) => {
    const scope = new CsgScope();
    try {
      const shape = { ...screwShape('P6', 2, 0.35), form };
      const screw = screwSolid(csg, scope, shape, n);
      // the head's bed face is z = −headH; dots in a row beside the slot (along x)
      const marks = dots(csg, scope, index + 1, 0, shape.headD / 4 + 0.6, -shape.headH);
      const marked = scope.keep(screw.subtract(scope.keep(csg.Manifold.union(marks))));
      const screwMesh = fromManifold(scope.keep(marked.translate([0, 0, shape.headH])));

      const h = threadEngagement('P6') + 1;
      const pitch = form.d + 6;
      const w = pitch * TEST_FITS.length;
      const d = form.d + 9;
      let nut = scope.keep(csg.Manifold.cube([w, d, h]));
      TEST_FITS.forEach((fit, k) => {
        const x = pitch * (k + 0.5);
        const y = form.d / 2 + 3;
        const hole = scope.keep(threadHole(csg, scope, form, fit, h + 1, 1, n).translate([x, y, h]));
        // a 0.5 mm chamfer at the mouth, as on the case's posts
        const R = form.d / 2;
        const sink = R - minorRadius(form) + 0.5;
        const cone = scope.keep(scope.keep(csg.Manifold.cylinder(sink + 0.05, minorRadius(form) + fit, R + fit + 0.55, n)).translate([x, y, h - sink]));
        nut = scope.keep(nut.subtract(scope.keep(hole.add(cone))));
        nut = scope.keep(nut.subtract(scope.keep(csg.Manifold.union(dots(csg, scope, k + 1, x, d - 2, h)))));
      });
      // the form's dots on the front face (y = 0): dimples along y, 0.6 deep
      const front = Array.from({ length: index + 1 }, (_, i) => {
        const dot = scope.keep(scope.keep(csg.Manifold.cylinder(1.2, 0.6, 0.6, 16)).rotate([90, 0, 0]));
        return scope.keep(dot.translate([w / 2 + (i - index / 2) * 1.8, 0.6, h / 2]));
      });
      nut = scope.keep(nut.subtract(scope.keep(csg.Manifold.union(front))));
      const nutMesh = fromManifold(nut);

      for (const [part, mesh] of [['screw', screwMesh], ['nut', nutMesh]] as const) {
        const r = validateMesh(mesh);
        const file = join(dir, `thread-${id}-${part}.stl`);
        writeFileSync(file, new Uint8Array(encodeSTL(mesh, { name: `thread-${id}-${part}` })));
        console.log(`${file}: ${r.triangleCount} tri, watertight ${r.watertight}, ${r.degenerateTriangles} degenerate`);
      }
      console.log(`  ${id} (${index + 1} dot${index ? 's' : ''}): ${note}; holes ${TEST_FITS.map((fit, k) => `${k + 1} dot${k ? 's' : ''} = ${fit}`).join(', ')} mm`);
    } finally {
      scope.dispose();
    }
  });
}

it('inspect', async () => {
  const args: Args = JSON.parse(process.env.INSPECT_ARGS ?? '{}');
  if (args.threadTest) {
    threadTest(await initCSG(), args.threadTest);
    return;
  }
  let raw: Record<string, unknown> = JSON.parse(JSON.stringify(defaultState()));
  if (args.preset) raw = JSON.parse(JSON.stringify(presetById(args.preset)?.build() ?? defaultState()));
  if (args.file) raw = JSON.parse(JSON.stringify(decodePresetFile(readFileSync(args.file, 'utf8'))?.state ?? defaultState()));
  if (args.state) raw = { ...raw, ...JSON.parse(args.state) };
  for (const pair of args.set ?? []) {
    const eq = pair.indexOf('=');
    setPath(raw, pair.slice(0, eq), parseValue(pair.slice(eq + 1)));
  }
  const state = sanitizeState(raw);
  const segments = args.segments ?? state.resolution;
  const csg = await initCSG();
  const started = performance.now();
  const stages: string[] = [];
  const built = buildCase(csg, state, segments, (stage) => {
    stages.push(`${stage.code} @${(performance.now() - started).toFixed(0)}`);
  });
  const total = performance.now() - started;
  console.log(`state: ${JSON.stringify({ shape: state.shape.kind, lid: state.lid.face, depth: state.lid.depth, boards: state.boards.map((b) => b.board) })}`);
  console.log(`dims ${built.dims.w.toFixed(2)}×${built.dims.d.toFixed(2)}×${built.dims.h.toFixed(2)}, segments ${segments}, ${total.toFixed(0)} ms`);
  console.log(`stages: ${stages.join(', ')}`);
  for (const [id, mesh] of Object.entries({ body: built.body, lid: built.lid, ...(built.screw ? { screw: built.screw } : {}) })) {
    const r = validateMesh(mesh);
    console.log(`${id}: ${r.triangleCount} tri, ${r.degenerateTriangles} degenerate, watertight ${r.watertight}, `
      + `volume ${(r.volume / 1000).toFixed(2)} cm³, bbox ${r.bbox.min.map((v) => v.toFixed(2))} … ${r.bbox.max.map((v) => v.toFixed(2))}`);
    if (args.degenerate) {
      // zero-area triangles: where they are, grouped to a 0.5 mm grid
      const spots = new Map<string, number>();
      const exact: string[] = [];
      const p = mesh.positions;
      for (let t = 0; t < mesh.indices.length; t += 3) {
        const [a, b, c] = [mesh.indices[t] * 3, mesh.indices[t + 1] * 3, mesh.indices[t + 2] * 3];
        const ab = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]];
        const ac = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]];
        const area = Math.hypot(ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]) / 2;
        if (area >= 1e-12) continue;
        const key = [p[a], p[a + 1], p[a + 2]].map((v) => (Math.round(v * 2) / 2).toFixed(1)).join(',');
        spots.set(key, (spots.get(key) ?? 0) + 1);
        // the first few in full: which vertices collapse, and along what
        if (exact.length < 6) exact.push([a, b, c].map((i) => `(${[p[i], p[i + 1], p[i + 2]].map((v) => v.toFixed(4)).join(', ')})`).join(' '));
      }
      for (const [key, count] of [...spots].slice(0, 20)) console.log(`  degenerate ×${count} at ${key}`);
      for (const line of exact) console.log(`    ${line}`);
    }
    if (args.levels) {
      // horizontal faces by z level: up/down areas; a membrane shows as equal up and down at one level
      const levels = new Map<string, { up: number; down: number }>();
      const p = mesh.positions;
      for (let t = 0; t < mesh.indices.length; t += 3) {
        const [a, b, c] = [mesh.indices[t] * 3, mesh.indices[t + 1] * 3, mesh.indices[t + 2] * 3];
        if (Math.abs(p[a + 2] - p[b + 2]) > 1e-4 || Math.abs(p[a + 2] - p[c + 2]) > 1e-4) continue;
        const cross = (p[b] - p[a]) * (p[c + 1] - p[a + 1]) - (p[b + 1] - p[a + 1]) * (p[c] - p[a]);
        const key = p[a + 2].toFixed(3);
        const entry = levels.get(key) ?? { up: 0, down: 0 };
        if (cross > 0) entry.up += cross / 2;
        else entry.down -= cross / 2;
        levels.set(key, entry);
      }
      for (const [z, { up, down }] of [...levels].sort((x, y) => Number(x[0]) - Number(y[0]))) {
        console.log(`  z ${z}: up ${up.toFixed(1)} mm², down ${down.toFixed(1)} mm²`);
      }
    }
    if (args.stl) {
      mkdirSync(args.stl, { recursive: true });
      writeFileSync(join(args.stl, `${id}.stl`), new Uint8Array(encodeSTL(mesh, { name: id })));
    }
  }
  if (args.overlap) {
    // the assembled lid and body must not share any volume: report where they do
    const body = toManifold(csg, built.body);
    const lid = toManifold(csg, built.lid);
    const common = body.intersect(lid);
    console.log(`overlap: ${common.volume().toFixed(4)} mm³`);
    for (const piece of common.decompose()) {
      const b = piece.boundingBox();
      console.log(`  piece ${piece.volume().toFixed(4)} mm³ at ${b.min.map((v) => v.toFixed(2))} … ${b.max.map((v) => v.toFixed(2))}`);
      piece.delete();
    }
    common.delete();
    body.delete();
    lid.delete();
  }
});
