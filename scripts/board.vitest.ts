// Catalog tools, run through scripts/board.mjs (options in BOARD_ARGS):
// --check validates every catalog file strictly (the same rules as
// tests/boards.test.ts, readable output); --svg <id> draws a board's top view
// with holes, ports and dimensions, to compare against the drawing by eye;
// --review writes the review page: every entry over its cached vendor
// drawing (scripts/lib/review.mjs).

import { it } from 'vitest';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { CATALOG, RAW_BOARDS, catalogBoard } from '../src/boards/catalog';
import { layersFor, writeReview } from './lib/review.mjs';
import { OVERRIDE_NUMBERS, insidePolygon, isPortType, onFace, resolveVariant, sanitizeBoard } from '../src/boards/schema';
import type { BoardDef } from '../src/boards/schema';

interface Args { check?: string; svg?: string; out?: string; variant?: string; review?: string; only?: string }

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
  if (r.outline !== undefined) {
    const outline = board.outline;
    if (!outline) out.push('outline dropped: fewer than 3 points, crossing edges or no area');
    else if (JSON.stringify(outline) !== JSON.stringify(r.outline)) out.push('outline changed by the sanitizer: outside the size, or clockwise');
    else {
      for (const hole of board.mount.holes) if (!insidePolygon(outline, hole.x, hole.y)) out.push(`hole at ${hole.x},${hole.y} is outside the outline`);
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
  // every variant is built as resolved: check its ports as the entry's
  const variants = Array.isArray(r.variants) ? r.variants : [];
  const portIds = new Set(board.ports.map((port) => port.id));
  const known = new Set<string>([...OVERRIDE_NUMBERS, 'cut', 'edge', 'shape']);
  for (const rawVariant of variants) {
    const v = rec(rawVariant);
    for (const [portId, override] of Object.entries(rec(v.ports))) {
      if (!portIds.has(portId)) out.push(`variant ${String(v.id)}: no port ${portId} to override`);
      for (const key of Object.keys(rec(override))) if (!known.has(key)) out.push(`variant ${String(v.id)}: ${portId}.${key} cannot be overridden`);
    }
    for (const portId of Array.isArray(v.remove) ? v.remove : []) {
      if (!portIds.has(String(portId))) out.push(`variant ${String(v.id)}: no port ${String(portId)} to remove`);
    }
    const added = Array.isArray(v.add) ? v.add : [];
    for (const rawPort of added) {
      const p = rec(rawPort);
      if (!isPortType(p.type)) out.push(`variant ${String(v.id)}: port ${String(p.id)}: unknown type ${String(p.type)}`);
      if (typeof p.id !== 'string' || portIds.has(p.id)) out.push(`variant ${String(v.id)}: port id ${String(p.id)} missing or taken`);
    }
  }
  if (variants.length !== (board.variants?.length ?? 0)) out.push('variants dropped or renamed by the sanitizer');
  const builds = board.variants ? board.variants.map((variant) => resolveVariant(board, variant.id)) : [board];
  for (const port of builds.flatMap((build) => build.ports)) {
    if (onFace(port)) {
      if (port.x - port.w / 2 < -0.5 || port.x + port.w / 2 > w + 0.5 || port.y - port.d / 2 < -0.5 || port.y + port.d / 2 > d + 0.5) {
        out.push(`${port.edge} part ${port.id} leaves the outline`);
      }
    } else {
      const length = port.edge === 'front' || port.edge === 'back' ? w : d;
      if (port.along - port.w / 2 < -0.5 || port.along + port.w / 2 > length + 0.5) out.push(`port ${port.id} runs off its edge`);
    }
  }
  return out;
}

/** A port's box in the board frame, seen from above: [x0, y0, x1, y1]. */
function portBox(def: BoardDef, port: BoardDef['ports'][number]): [number, number, number, number] {
  if (onFace(port)) return [port.x - port.w / 2, port.y - port.d / 2, port.x + port.w / 2, port.y + port.d / 2];
  const inward = port.d;
  const out = port.protrude;
  if (port.edge === 'front') return [port.along - port.w / 2, -out, port.along + port.w / 2, inward - out];
  if (port.edge === 'back') return [port.along - port.w / 2, def.size.d - inward + out, port.along + port.w / 2, def.size.d + out];
  if (port.edge === 'left') return [-out, port.along - port.w / 2, inward - out, port.along + port.w / 2];
  return [def.size.w - inward + out, port.along - port.w / 2, def.size.w + out, port.along + port.w / 2];
}

const esc = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** Where a click on the scheme snaps when a drawing is aligned by hand: holes, outline corners, port corners and centres (display mm). */
function snapPoints(def: BoardDef): [number, number][] {
  const out: [number, number][] = def.mount.holes.map((hole) => [hole.x, -hole.y]);
  for (const [x, y] of def.outline ?? [[0, 0], [def.size.w, 0], [def.size.w, def.size.d], [0, def.size.d]]) out.push([x, -y]);
  for (const port of def.ports) {
    const [x0, y0, x1, y1] = portBox(def, port);
    out.push([x0, -y0], [x1, -y0], [x1, -y1], [x0, -y1], [(x0 + x1) / 2, -(y0 + y1) / 2]);
  }
  return out.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
}

/** The entry's top view for the review page, in display mm (x, -y). */
function schemeMarkup(def: BoardDef): string {
  const n = (v: number): number => Math.round(v * 100) / 100;
  const parts: string[] = [];
  const board = def.outline ?? [[0, 0], [def.size.w, 0], [def.size.w, def.size.d], [0, def.size.d]];
  parts.push(`<polygon class="pcb" points="${board.map(([x, y]) => `${n(x)},${n(-y)}`).join(' ')}"/>`);
  if (def.outline) parts.push(`<rect class="box" x="0" y="${-def.size.d}" width="${def.size.w}" height="${def.size.d}"/>`);
  for (const port of def.ports) {
    const [x0, y0, x1, y1] = portBox(def, port);
    const where = onFace(port) ? `${port.x}, ${port.y}` : `${port.edge} @${port.along}`;
    parts.push(`<rect class="port ${port.edge}" x="${n(x0)}" y="${n(-y1)}" width="${n(x1 - x0)}" height="${n(y1 - y0)}"><title>${esc(port.id)} (${port.type}) ${where}</title></rect>`);
    parts.push(`<text class="label" x="${n((x0 + x1) / 2)}" y="${n(-(y0 + y1) / 2)}">${esc(port.id)}</text>`);
  }
  for (const hole of def.mount.holes) {
    parts.push(`<circle class="hole" cx="${n(hole.x)}" cy="${n(-hole.y)}" r="${n(hole.d / 2)}"><title>${hole.x}, ${hole.y} Ø${hole.d}</title></circle>`);
  }
  return parts.join('');
}

function svg(def: BoardDef, variant?: string): string {
  const s = 6; // px per mm
  const pad = 30;
  const reach = 12;
  const W = (def.size.w + 2 * reach) * s + 2 * pad;
  const H = (def.size.d + 2 * reach) * s + 2 * pad;
  // board frame → svg: x right, y up → svg y down
  const X = (x: number): number => pad + (x + reach) * s;
  const Y = (y: number): number => H - pad - (y + reach) * s;
  const parts: string[] = [];
  if (def.outline) {
    // the rectangle the case is sized by, and the real outline in it
    parts.push(`<rect x="${X(0)}" y="${Y(def.size.d)}" width="${def.size.w * s}" height="${def.size.d * s}" fill="none" stroke="#555" stroke-dasharray="4 3"/>`);
    parts.push(`<polygon points="${def.outline.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ')}" fill="#2f7d4a" stroke="#1d4d2e"/>`);
  } else {
    parts.push(`<rect x="${X(0)}" y="${Y(def.size.d)}" width="${def.size.w * s}" height="${def.size.d * s}" fill="#2f7d4a" stroke="#1d4d2e"/>`);
  }
  for (const hole of def.mount.holes) {
    parts.push(`<circle cx="${X(hole.x)}" cy="${Y(hole.y)}" r="${(hole.d / 2) * s}" fill="#fff" stroke="#000"/>`);
    parts.push(`<text x="${X(hole.x) + 8}" y="${Y(hole.y) - 8}" font-size="10" fill="#fff">${hole.x}, ${hole.y}</text>`);
  }
  for (const port of def.ports) {
    const [x0, y0, x1, y1] = portBox(def, port);
    // a part on the underside is seen through the board: dashed, paler
    const fill = port.edge === 'top' ? '#d9b45a' : port.edge === 'bottom' ? '#c9a0dc' : '#9aa7b4';
    const dash = port.edge === 'bottom' ? ' stroke-dasharray="4 3"' : '';
    parts.push(`<rect x="${X(x0)}" y="${Y(y1)}" width="${(x1 - x0) * s}" height="${(y1 - y0) * s}" fill="${fill}" fill-opacity="${port.edge === 'bottom' ? 0.5 : 0.8}" stroke="#333"${dash}/>`);
    const where = onFace(port) ? `${port.x}, ${port.y}${port.edge === 'bottom' ? ', under' : ''}` : `${port.edge} @${port.along}`;
    parts.push(`<text x="${X((x0 + x1) / 2)}" y="${Y((y0 + y1) / 2) + 3}" font-size="9" text-anchor="middle" fill="#000">${port.id} (${where})</text>`);
  }
  parts.push(`<text x="${X(def.size.w / 2)}" y="${Y(def.size.d) - 6 - reach * s + 20}" font-size="12" text-anchor="middle" fill="#ddd">${def.name}${variant ? ` · ${variant}` : ''}: ${def.size.w} × ${def.size.d} × ${def.size.t} mm${def.verified ? '' : ' (unverified)'}</text>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="#15181c"/>${parts.join('')}</svg>\n`;
}

it('board', { timeout: 30 * 60_000 }, () => {
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
  if (args.review) {
    const out = args.out ?? 'shots/review';
    const only = args.only ? new Set(args.only.split(',')) : null;
    mkdirSync(out, { recursive: true });
    writeFileSync(`${out}/review.log`, '');
    const boards = [];
    const layers: Record<string, unknown[]> = {};
    for (const entry of CATALOG) {
      if (only && !only.has(entry.id)) continue;
      const variants = entry.variants?.map((variant) => ({ id: variant.id, name: variant.name, markup: schemeMarkup(resolveVariant(entry, variant.id)) }));
      boards.push({
        id: entry.id, name: entry.name, vendor: entry.vendor, size: entry.size, verified: entry.verified, source: entry.source,
        holes: entry.mount.holes, outline: entry.outline, snaps: snapPoints(resolveVariant(entry, undefined)),
        schemes: variants ?? [{ id: '', name: '', markup: schemeMarkup(entry) }],
      });
      const def = resolveVariant(entry, undefined);
      // vitest holds a test's console until it ends: the progress goes to a file too
      layers[entry.id] = layersFor(def, def.ports.map((port) => portBox(def, port)), out, (line: string) => {
        console.log(line);
        appendFileSync(`${out}/review.log`, `${line}\n`);
      });
    }
    writeReview(out, boards, layers);
    console.log(`review → ${out}/index.html (${boards.length} boards)`);
  }
  if (args.svg) {
    const entry = catalogBoard(args.svg);
    if (!entry) throw new Error(`no board ${args.svg}`);
    if (args.variant && !entry.variants?.some((variant) => variant.id === args.variant)) {
      throw new Error(`${args.svg} has no variant ${args.variant}: ${(entry.variants ?? []).map((variant) => variant.id).join(', ') || 'none'}`);
    }
    const def = resolveVariant(entry, args.variant);
    const out = args.out ?? `shots/${def.id}.svg`;
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, svg(def, entry.variants?.find((variant) => variant.id === args.variant)?.name));
    console.log(`svg → ${out}`);
  }
});
