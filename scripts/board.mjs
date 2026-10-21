#!/usr/bin/env node
// Catalog tools.
//
//   node scripts/board.mjs --check                      # validate every catalog file
//   node scripts/board.mjs --svg raspberry-pi-4b        # top view → shots/<id>.svg
//   node scripts/board.mjs --svg <id> --out shots/x.svg
//   node scripts/board.mjs --svg <id> --png             # also a PNG next to it (rendered by Playwright)

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { parseArgs } from './lib/harness.mjs';

const flags = parseArgs(process.argv.slice(2), ['svg', 'out']);
const args = Object.fromEntries(flags);
const result = spawnSync('npx', ['vitest', 'run', '--config', 'scripts/vitest.board.config.ts', '--silent=false', '--reporter=dot'], {
  env: { ...process.env, BOARD_ARGS: JSON.stringify(args) },
  encoding: 'utf8',
});
const lines = `${result.stdout}\n${result.stderr}`.split('\n')
  .filter((line) => line.trim() && !/^(stdout \||\s*RUN|\s*Test Files|\s*Tests|\s*Start at|\s*Duration|·|×|⎯|\s*FAIL\s+scripts|\s*❯)/.test(line.trim()));
console.log(lines.join('\n'));
if (flags.has('png') && flags.has('svg') && result.status === 0) {
  const svg = args.out ?? `shots/${args.svg}.svg`;
  const png = svg.replace(/\.svg$/, '.png');
  const text = readFileSync(svg, 'utf8');
  const [, w, h] = text.match(/width="([\d.]+)" height="([\d.]+)"/) ?? [];
  const browser = await chromium.launch({ executablePath: process.env.CASE_BROWSER || undefined });
  const page = await browser.newPage({ viewport: { width: Math.ceil(Number(w) || 800), height: Math.ceil(Number(h) || 600) } });
  await page.setContent(`<body style="margin:0">${text}</body>`);
  await page.screenshot({ path: png });
  await browser.close();
  console.log(`png → ${png}`);
}
process.exit(result.status ?? 1);
