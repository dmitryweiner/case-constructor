// Builds a case in Node, without a browser, and reports on every part:
// triangles, degenerate triangles, watertightness, volume, size, build time.
// Run through scripts/inspect.mjs, which passes the options in INSPECT_ARGS.

import { it } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { initCSG } from '../src/geo/csg';
import { buildCase } from '../src/geo/build';
import { encodeSTL } from '../src/geo/stl';
import { validateMesh } from '../src/geo/validate';
import { decodePresetFile } from '../src/state/presetFile';
import { presetById } from '../src/state/presets';
import { defaultState, sanitizeState } from '../src/state/schema';

interface Args { state?: string; file?: string; preset?: string; segments?: number; stl?: string }

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

it('inspect', async () => {
  const args: Args & { set?: string[] } = JSON.parse(process.env.INSPECT_ARGS ?? '{}');
  let raw: Record<string, unknown> = JSON.parse(JSON.stringify(defaultState()));
  if (args.preset) raw = JSON.parse(JSON.stringify(presetById(args.preset)?.build() ?? defaultState()));
  if (args.file) raw = JSON.parse(JSON.stringify(decodePresetFile(readFileSync(args.file, 'utf8'))?.state ?? defaultState()));
  if (args.state) raw = { ...raw, ...JSON.parse(args.state) };
  for (const pair of args.set ?? []) {
    const eq = pair.indexOf('=');
    const text = pair.slice(eq + 1);
    const value: unknown = text === 'true' ? true : text === 'false' ? false : Number.isFinite(Number(text)) ? Number(text) : text;
    setPath(raw, pair.slice(0, eq), value);
  }
  const state = sanitizeState(raw);
  const segments = args.segments ?? state.resolution;
  const csg = await initCSG();
  const started = performance.now();
  const stages: string[] = [];
  let last = started;
  const built = buildCase(csg, state, segments, (stage) => {
    const now = performance.now();
    stages.push(`${stage.code} @${(now - started).toFixed(0)}`);
    last = now;
  });
  const total = performance.now() - started;
  console.log(`state: ${JSON.stringify({ shape: state.shape.kind, lid: state.lid.face, depth: state.lid.depth })}`);
  console.log(`dims ${built.dims.w}×${built.dims.d}×${built.dims.h}, segments ${segments}, ${total.toFixed(0)} ms (last stage ${(performance.now() - last).toFixed(0)} ms)`);
  console.log(`stages: ${stages.join(', ')}`);
  for (const [id, mesh] of Object.entries({ body: built.body, lid: built.lid })) {
    const r = validateMesh(mesh);
    console.log(`${id}: ${r.triangleCount} tri, ${r.degenerateTriangles} degenerate, watertight ${r.watertight}, `
      + `volume ${(r.volume / 1000).toFixed(2)} cm³, bbox ${r.bbox.min.map((v) => v.toFixed(2))} … ${r.bbox.max.map((v) => v.toFixed(2))}`);
    if (args.stl) {
      mkdirSync(args.stl, { recursive: true });
      writeFileSync(join(args.stl, `${id}.stl`), new Uint8Array(encodeSTL(mesh, { name: id })));
    }
  }
});
