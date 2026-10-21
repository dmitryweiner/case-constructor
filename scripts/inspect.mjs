#!/usr/bin/env node
// Builds a case in Node (no browser) and prints a report per part:
// triangles, degenerate triangles, watertightness, volume, bounding box,
// stage timings. Optionally writes the raw parts (case frame) as STL.
//
//   node scripts/inspect.mjs                              # the default state
//   node scripts/inspect.mjs --preset plain-box --segments 64
//   node scripts/inspect.mjs --set shape.kind=cylinder --set lid.face=bottom --set lid.depth=6
//   node scripts/inspect.mjs --file my-case.json --stl shots/parts
//   node scripts/inspect.mjs --state '{"shape":{"edgeR":5}}'
//   node scripts/inspect.mjs --set lid.face=back --overlap   # where lid and body intersect
//   node scripts/inspect.mjs --levels    # horizontal face areas per z: a membrane has equal up and down
//
// --set takes a dotted path into AppState; numbers and true/false are parsed.

import { spawnSync } from 'node:child_process';
import { parseArgs } from './lib/harness.mjs';

const flags = parseArgs(process.argv.slice(2), ['state', 'file', 'preset', 'segments', 'stl'], ['set']);
const args = Object.fromEntries(flags);
if (args.segments) args.segments = Number(args.segments);
const result = spawnSync('npx', ['vitest', 'run', '--config', 'scripts/vitest.inspect.config.ts', '--silent=false', '--reporter=dot'], {
  env: { ...process.env, INSPECT_ARGS: JSON.stringify(args) },
  encoding: 'utf8',
});
const lines = `${result.stdout}\n${result.stderr}`.split('\n')
  .filter((line) => line.trim() && !/^(stdout \||\s*RUN|\s*Test Files|\s*Tests|\s*Start at|\s*Duration|·)/.test(line.trim()));
console.log(lines.join('\n'));
process.exit(result.status ?? 1);
