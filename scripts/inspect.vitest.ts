// Builds a case in Node, without a browser, and reports on every part:
// triangles, degenerate triangles, watertightness, volume, size, build time;
// optionally where the assembled lid and body overlap. Run through
// scripts/inspect.mjs, which passes the options in INSPECT_ARGS.

import { it } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { initCSG, toManifold } from '../src/geo/csg';
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
  set?: string[];
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

it('inspect', async () => {
  const args: Args = JSON.parse(process.env.INSPECT_ARGS ?? '{}');
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
  for (const [id, mesh] of Object.entries({ body: built.body, lid: built.lid })) {
    const r = validateMesh(mesh);
    console.log(`${id}: ${r.triangleCount} tri, ${r.degenerateTriangles} degenerate, watertight ${r.watertight}, `
      + `volume ${(r.volume / 1000).toFixed(2)} cm³, bbox ${r.bbox.min.map((v) => v.toFixed(2))} … ${r.bbox.max.map((v) => v.toFixed(2))}`);
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
