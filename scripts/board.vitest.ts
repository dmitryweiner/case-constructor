// Catalog tools, run through scripts/board.mjs (options in BOARD_ARGS):
// --check validates every catalog file strictly (the same rules as
// tests/boards.test.ts, readable output); --svg <id> draws a board's top view
// with holes, ports and dimensions, to compare against the drawing by eye.

import { it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { RAW_BOARDS, catalogBoard } from '../src/boards/catalog';
import { isPortType, sanitizeBoard } from '../src/boards/schema';
import type { BoardDef } from '../src/boards/schema';

interface Args { check?: string; svg?: string; out?: string }

function rec(x: unknown): Record<string, unknown> {
  return typeof x === 'object' && x !== null ? Object.fromEntries(Object.entries(x)) : {};
}

function problems(raw: unknown): string[] {
  const out: string[] = [];
  const r = rec(raw);
  const board = sanitizeBoard(raw);
  if (typeof r.id !== 'string' || !/^[a-z0-9]+(-[a-z0-9.]+)*$/.test(r.id)) out.push('id must be kebab-case');
  if (typeof r.source !== 'string' || !/^https:\/\//.test(r.source)) out.push('source must be an https URL');
  if (typeof r.verified !== 'boolean') out.push('verified must be true or false');
  if (JSON.stringify(board.size) !== JSON.stringify(r.size)) out.push(`size changed by the sanitizer: ${JSON.stringify(r.size)} → ${JSON.stringify(board.size)}`);
  const mount = rec(r.mount);
  if (board.mount.kind !== mount.kind) out.push(`mount.kind ${String(mount.kind)} → ${board.mount.kind}`);
  const { w, d } = board.size;
  for (const hole of board.mount.holes) {
    if (hole.x - hole.d / 2 < 0 || hole.x + hole.d / 2 > w || hole.y - hole.d / 2 < 0 || hole.y + hole.d / 2 > d) {
      out.push(`hole at ${hole.x},${hole.y} leaves the outline`);
    }
  }
  const ports = Array.isArray(r.ports) ? r.ports : [];
  if (board.ports.length !== ports.length) out.push(`${ports.length - board.ports.length} port(s) dropped by the sanitizer`);
  const ids = new Set<string>();
  for (const raw2 of ports) {
    const p = rec(raw2);
    if (!isPortType(p.type)) out.push(`port ${String(p.id)}: unknown type ${String(p.type)}`);
    if (typeof p.id !== 'string' || ids.has(p.id)) out.push(`port id ${String(p.id)} missing or repeated`);
    ids.add(String(p.id));
  }
  for (const port of board.ports) {
    if (port.edge === 'top') {
      if (port.x - port.w / 2 < -0.5 || port.x + port.w / 2 > w + 0.5 || port.y - port.d / 2 < -0.5 || port.y + port.d / 2 > d + 0.5) {
        out.push(`top part ${port.id} leaves the outline`);
      }
    } else {
      const length = port.edge === 'front' || port.edge === 'back' ? w : d;
      if (port.along - port.w / 2 < -0.5 || port.along + port.w / 2 > length + 0.5) out.push(`port ${port.id} runs off its edge`);
    }
  }
  return out;
}

function svg(def: BoardDef): string {
  const s = 6; // px per mm
  const pad = 30;
  const reach = 12;
  const W = (def.size.w + 2 * reach) * s + 2 * pad;
  const H = (def.size.d + 2 * reach) * s + 2 * pad;
  // board frame → svg: x right, y up → svg y down
  const X = (x: number): number => pad + (x + reach) * s;
  const Y = (y: number): number => H - pad - (y + reach) * s;
  const parts: string[] = [];
  parts.push(`<rect x="${X(0)}" y="${Y(def.size.d)}" width="${def.size.w * s}" height="${def.size.d * s}" fill="#2f7d4a" stroke="#1d4d2e"/>`);
  for (const hole of def.mount.holes) {
    parts.push(`<circle cx="${X(hole.x)}" cy="${Y(hole.y)}" r="${(hole.d / 2) * s}" fill="#fff" stroke="#000"/>`);
    parts.push(`<text x="${X(hole.x) + 8}" y="${Y(hole.y) - 8}" font-size="10" fill="#fff">${hole.x}, ${hole.y}</text>`);
  }
  for (const port of def.ports) {
    let x0: number;
    let y0: number;
    let x1: number;
    let y1: number;
    if (port.edge === 'top') {
      [x0, y0, x1, y1] = [port.x - port.w / 2, port.y - port.d / 2, port.x + port.w / 2, port.y + port.d / 2];
    } else {
      const inward = port.d;
      const out = port.protrude;
      if (port.edge === 'front') [x0, y0, x1, y1] = [port.along - port.w / 2, -out, port.along + port.w / 2, inward - out];
      else if (port.edge === 'back') [x0, y0, x1, y1] = [port.along - port.w / 2, def.size.d - inward + out, port.along + port.w / 2, def.size.d + out];
      else if (port.edge === 'left') [x0, y0, x1, y1] = [-out, port.along - port.w / 2, inward - out, port.along + port.w / 2];
      else [x0, y0, x1, y1] = [def.size.w - inward + out, port.along - port.w / 2, def.size.w + out, port.along + port.w / 2];
    }
    const fill = port.edge === 'top' ? '#d9b45a' : '#9aa7b4';
    parts.push(`<rect x="${X(x0)}" y="${Y(y1)}" width="${(x1 - x0) * s}" height="${(y1 - y0) * s}" fill="${fill}" fill-opacity="0.8" stroke="#333"/>`);
    const where = port.edge === 'top' ? `${port.x}, ${port.y}` : `${port.edge} @${port.along}`;
    parts.push(`<text x="${X((x0 + x1) / 2)}" y="${Y((y0 + y1) / 2) + 3}" font-size="9" text-anchor="middle" fill="#000">${port.id} (${where})</text>`);
  }
  parts.push(`<text x="${X(def.size.w / 2)}" y="${Y(def.size.d) - 6 - reach * s + 20}" font-size="12" text-anchor="middle" fill="#ddd">${def.name}: ${def.size.w} × ${def.size.d} × ${def.size.t} mm${def.verified ? '' : ' (unverified)'}</text>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="#15181c"/>${parts.join('')}</svg>\n`;
}

it('board', () => {
  const args: Args = JSON.parse(process.env.BOARD_ARGS ?? '{}');
  if (args.check) {
    let bad = 0;
    for (const raw of RAW_BOARDS) {
      const list = problems(raw);
      const id = String(rec(raw).id);
      if (list.length === 0) console.log(`ok    ${id}`);
      else {
        bad++;
        console.log(`FAIL  ${id}\n${list.map((p) => `      - ${p}`).join('\n')}`);
      }
    }
    console.log(`${RAW_BOARDS.length} boards, ${bad} with problems`);
    if (bad > 0) throw new Error('catalog check failed');
  }
  if (args.svg) {
    const def = catalogBoard(args.svg);
    if (!def) throw new Error(`no board ${args.svg}`);
    const out = args.out ?? `shots/${def.id}.svg`;
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, svg(def));
    console.log(`svg → ${out}`);
  }
});
