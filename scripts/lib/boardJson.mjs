// The one layout of a catalog file (src/boards/data/<id>.json), so that a
// change to an entry is a plain text edit: top-level keys in a fixed order,
// one per line; small objects (size, pins, a hole, a port, a variant) on one
// line each; the hole, port and variant lists one item per line. Values are
// kept as written — this formats, it does not sanitize.
// `node scripts/board.mjs --format` rewrites the catalog; tests/boards.test.ts
// fails on a file that is not in this layout.

const ORDER = [
  'id', 'name', 'vendor', 'kind', 'size', 'outline', 'mount', 'topHeight', 'bottomHeight',
  'pins', 'back', 'ports', 'variants', 'source', 'verified',
];

/** A value on one line, `{ "a": 1 }` and `[1, 2]` style. */
export function inline(value) {
  if (Array.isArray(value)) return `[${value.map(inline).join(', ')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value);
    return entries.length === 0 ? '{}' : `{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${inline(v)}`).join(', ')} }`;
  }
  return JSON.stringify(value);
}

/** A list with one item per line, at the given indent. */
function list(items, indent) {
  if (items.length === 0) return '[]';
  const pad = ' '.repeat(indent + 2);
  return `[\n${items.map((item) => `${pad}${inline(item)}`).join(',\n')}\n${' '.repeat(indent)}]`;
}

function mountText(mount) {
  if (!mount || typeof mount !== 'object' || Array.isArray(mount)) return inline(mount);
  const holes = Array.isArray(mount.holes) ? mount.holes : [];
  // rails (no holes) stay on one line; holes get a line each
  if (holes.length === 0) return inline(mount);
  const lines = Object.entries(mount).map(([k, v]) => `    ${JSON.stringify(k)}: ${k === 'holes' ? list(v, 4) : inline(v)}`);
  return `{\n${lines.join(',\n')}\n  }`;
}

/** A port on one line; a key field's rows one per line under it. */
function portText(port, indent) {
  if (!port || typeof port !== 'object' || !Array.isArray(port.rows) || port.rows.length === 0) return inline(port);
  const fields = Object.entries(port).map(([k, v]) => `${JSON.stringify(k)}: ${k === 'rows' ? list(v, indent) : inline(v)}`);
  return `{ ${fields.join(', ')} }`;
}

/** The catalog layout of one entry, with a trailing newline. */
export function formatBoard(entry) {
  const keys = [...ORDER.filter((k) => k in entry), ...Object.keys(entry).filter((k) => !ORDER.includes(k))];
  const lines = keys.map((k) => {
    const v = entry[k];
    let text;
    if (k === 'mount') text = mountText(v);
    else if (k === 'ports' && Array.isArray(v)) text = v.length === 0 ? '[]' : `[\n${v.map((port) => `    ${portText(port, 4)}`).join(',\n')}\n  ]`;
    else if (k === 'variants' && Array.isArray(v)) text = list(v, 2);
    else text = inline(v);
    return `  ${JSON.stringify(k)}: ${text}`;
  });
  return `{\n${lines.join(',\n')}\n}\n`;
}
