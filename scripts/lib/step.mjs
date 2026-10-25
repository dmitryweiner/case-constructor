// A STEP assembly read as text (ISO 10303-21): the world bounding box of
// every part placement, from the vertices and circles its shape reaches, and
// the circles of a part (hole candidates). Enough to place a board's
// connectors from a vendor model without a CAD kernel (scripts/step.mjs).
//
// Standard library only (CLAUDE.md). A STEP kernel (occt-import-js) comes in
// only with the user's approval, for a file this reader cannot handle.

/** The entities of the DATA section: id → raw text after "=" (strings and all). */
export function readEntities(text) {
  const start = text.indexOf('DATA;');
  const end = text.lastIndexOf('ENDSEC;');
  const data = text.slice(start + 5, end > start ? end : text.length);
  const ent = new Map();
  // a statement ends at ';' outside a quoted string
  let i = 0;
  while (i < data.length) {
    const hash = data.indexOf('#', i);
    if (hash < 0) break;
    const eq = data.indexOf('=', hash);
    if (eq < 0) break;
    const id = Number(data.slice(hash + 1, eq).trim());
    let j = eq + 1;
    let quoted = false;
    for (; j < data.length; j++) {
      const c = data[j];
      if (c === "'") quoted = !quoted;
      else if (c === ';' && !quoted) break;
    }
    if (Number.isFinite(id)) ent.set(id, data.slice(eq + 1, j).replace(/\s+/g, ' ').trim());
    i = j + 1;
  }
  return ent;
}

const STRING = /'(?:[^']|'')*'/g;

function typeOf(s) {
  if (!s || s.startsWith('(')) return 'COMPLEX';
  const p = s.indexOf('(');
  return (p < 0 ? s : s.slice(0, p)).trim();
}

function refsOf(s) {
  return [...s.replace(STRING, '').matchAll(/#(\d+)/g)].map((m) => Number(m[1]));
}

function numbersOf(s) {
  return [...s.replace(STRING, '').replace(/#\d+/g, '').matchAll(/-?\d+\.?\d*(?:E[-+]?\d+)?/gi)].map((m) => Number(m[0]));
}

function nameOf(s) {
  return s.match(/^\w*\(\s*'((?:[^']|'')*)'/)?.[1] ?? '';
}

// 4×4 rigid transforms as row-major arrays of 12 (the last row is 0 0 0 1)
const I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];

function mmul(a, b) {
  const out = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      out.push(a[r * 4] * b[c] + a[r * 4 + 1] * b[4 + c] + a[r * 4 + 2] * b[8 + c] + (c === 3 ? a[r * 4 + 3] : 0));
    }
  }
  return out;
}

function inverse(m) {
  // rigid: the transpose of the rotation, and the translation brought back
  const R = [m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10]];
  const t = [m[3], m[7], m[11]];
  const nt = [0, 1, 2].map((i) => -(R[i * 3] * t[0] + R[i * 3 + 1] * t[1] + R[i * 3 + 2] * t[2]));
  return [R[0], R[1], R[2], nt[0], R[3], R[4], R[5], nt[1], R[6], R[7], R[8], nt[2]];
}

function applyM(m, p) {
  return [0, 1, 2].map((r) => m[r * 4] * p[0] + m[r * 4 + 1] * p[1] + m[r * 4 + 2] * p[2] + m[r * 4 + 3]);
}

function normalise(v) {
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/**
 * Reads a STEP assembly. `parts()` lists every placed part with its world
 * box; `circles(name)` the circles of the parts whose name contains `name`.
 */
export function readStep(text) {
  const ent = readEntities(text);
  const types = new Map();
  for (const [id, s] of ent) types.set(id, typeOf(s));
  const refs = (id) => refsOf(ent.get(id) ?? '');

  /** A CARTESIAN_POINT, 3D (a 2D one gets z = 0). */
  const point = (id) => {
    const v = numbersOf(ent.get(id) ?? '');
    return [v[0] ?? 0, v[1] ?? 0, v[2] ?? 0];
  };
  const direction = (id, fallback) => {
    if (id === undefined || !ent.has(id)) return fallback;
    const v = numbersOf(ent.get(id));
    return normalise([v[0] ?? 0, v[1] ?? 0, v[2] ?? 0]);
  };
  /** An AXIS2_PLACEMENT_3D as a local → parent transform and its axes. */
  const axis = (id) => {
    const [p, zr, xr] = refs(id);
    const o = point(p);
    const z = direction(zr, [0, 0, 1]);
    let x = direction(xr, Math.abs(z[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]);
    const d = x[0] * z[0] + x[1] * z[1] + x[2] * z[2];
    x = normalise([x[0] - d * z[0], x[1] - d * z[1], x[2] - d * z[2]]);
    const y = cross(z, x);
    return { o, x, y, z, m: [x[0], y[0], z[0], o[0], x[1], y[1], z[1], o[1], x[2], y[2], z[2], o[2]] };
  };

  /** Points of a shape: VERTEX_POINTs, and eight points around every CIRCLE in its own plane. */
  const shapePoints = (roots, withCircles) => {
    const out = [];
    const circles = [];
    const seen = new Set();
    const stack = [...roots];
    while (stack.length) {
      const id = stack.pop();
      if (seen.has(id) || !ent.has(id)) continue;
      seen.add(id);
      const t = types.get(id);
      if (t === 'VERTEX_POINT') {
        const r = refs(id)[0];
        if (r !== undefined) out.push(point(r));
        continue;
      }
      if (t === 'CIRCLE') {
        const [placement] = refs(id);
        const nums = numbersOf(ent.get(id));
        const r = nums[nums.length - 1];
        if (placement !== undefined && types.get(placement) === 'AXIS2_PLACEMENT_3D' && Number.isFinite(r)) {
          const a = axis(placement);
          for (let k = 0; k < 8; k++) {
            const u = (k * Math.PI) / 4;
            out.push([0, 1, 2].map((i) => a.o[i] + r * (Math.cos(u) * a.x[i] + Math.sin(u) * a.y[i])));
          }
          if (withCircles) circles.push({ centre: a.o, normal: a.z, r });
        }
        continue;
      }
      if (t === 'CARTESIAN_POINT' || t === 'DIRECTION' || t === 'AXIS2_PLACEMENT_3D') continue;
      for (const r of refs(id)) stack.push(r);
    }
    return { points: out, circles };
  };

  // the product structure: product definitions, their shapes, the assembly links
  const pdName = new Map();
  for (const [id, t] of types) {
    if (t !== 'PRODUCT_DEFINITION') continue;
    const formation = refs(id)[0];
    const product = formation !== undefined ? refs(formation)[0] : undefined;
    pdName.set(id, product !== undefined ? nameOf(ent.get(product) ?? '') : `#${id}`);
  }
  const pdsOf = new Map();
  for (const [id, t] of types) {
    if (t !== 'PRODUCT_DEFINITION_SHAPE') continue;
    const r = refs(id)[0];
    if (r !== undefined) pdsOf.set(id, r);
  }
  const repOf = new Map();
  for (const [id, t] of types) {
    if (t !== 'SHAPE_DEFINITION_REPRESENTATION') continue;
    const [pds, rep] = refs(id);
    const pd = pdsOf.get(pds);
    if (pd !== undefined && pdName.has(pd)) repOf.set(pd, rep);
  }
  const repLinks = new Map();
  const link = (a, b) => {
    if (!repLinks.has(a)) repLinks.set(a, []);
    repLinks.get(a).push(b);
  };
  for (const [id, t] of types) {
    if (t !== 'SHAPE_REPRESENTATION_RELATIONSHIP') continue;
    const [a, b] = refs(id).slice(-2);
    link(a, b);
    link(b, a);
  }
  const children = new Map();
  for (const [id, t] of types) {
    if (t !== 'CONTEXT_DEPENDENT_SHAPE_REPRESENTATION') continue;
    const [rr, pds] = refs(id);
    const nauo = pdsOf.get(pds);
    if (nauo === undefined || types.get(nauo) !== 'NEXT_ASSEMBLY_USAGE_OCCURRENCE') continue;
    const [parent, child] = refs(nauo).slice(-2);
    const rel = ent.get(rr) ?? '';
    const idt = rel.match(/REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION\s*\(\s*#(\d+)\s*\)/)?.[1];
    let T = I4;
    if (idt) {
      const [a1, a2] = refs(Number(idt));
      if (a1 !== undefined && a2 !== undefined) T = mmul(axis(a2).m, inverse(axis(a1).m));
    }
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push({ child, T, instance: nameOf(ent.get(nauo) ?? '') });
  }

  /** The items of a representation and of the representations linked to it. */
  const repItems = (rep) => {
    const items = [];
    const seen = new Set([rep]);
    const stack = [rep];
    while (stack.length) {
      const r = stack.pop();
      const s = (ent.get(r) ?? '').replace(STRING, '');
      const open = s.indexOf('(');
      const close = s.lastIndexOf(',');
      if (open >= 0 && close > open) {
        for (const m of s.slice(open, close).matchAll(/#(\d+)/g)) {
          const it = Number(m[1]);
          if (types.get(it) !== 'AXIS2_PLACEMENT_3D') items.push(it);
        }
      }
      for (const o of repLinks.get(r) ?? []) {
        if (!seen.has(o)) {
          seen.add(o);
          stack.push(o);
        }
      }
    }
    return items;
  };

  const childSet = new Set([...children.values()].flatMap((list) => list.map((c) => c.child)));
  const roots = [...pdName.keys()].filter((pd) => !childSet.has(pd));

  /** Every placement of every product: { path, name, pd, T }. */
  const placements = () => {
    const out = [];
    const stack = roots.map((pd) => ({ pd, T: I4, path: pdName.get(pd) }));
    while (stack.length) {
      const { pd, T, path } = stack.pop();
      out.push({ path, name: pdName.get(pd), pd, T });
      for (const { child, T: Tc } of children.get(pd) ?? []) stack.push({ pd: child, T: mmul(T, Tc), path: `${path}/${pdName.get(child)}` });
    }
    return out;
  };

  const box = (points, T) => {
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    for (const p of points) {
      const w = applyM(T, p);
      for (let k = 0; k < 3; k++) {
        lo[k] = Math.min(lo[k], w[k]);
        hi[k] = Math.max(hi[k], w[k]);
      }
    }
    return { lo, hi };
  };

  return {
    /** Every placed part whose own shape has geometry, with its world box. */
    parts() {
      const out = [];
      const cache = new Map();
      for (const { path, name, pd, T } of placements()) {
        const rep = repOf.get(pd);
        if (rep === undefined) continue;
        if (!cache.has(rep)) cache.set(rep, shapePoints(repItems(rep), false).points);
        const points = cache.get(rep);
        if (points.length === 0) continue;
        out.push({ path, name, ...box(points, T) });
      }
      return out;
    },
    /** The circles of every placed part whose name contains `name`, in world coordinates. */
    circles(name) {
      const out = [];
      for (const { path, name: part, pd, T } of placements()) {
        if (!part.includes(name)) continue;
        const rep = repOf.get(pd);
        if (rep === undefined) continue;
        for (const c of shapePoints(repItems(rep), true).circles) {
          const centre = applyM(T, c.centre);
          const n = applyM([...T.slice(0, 3), 0, ...T.slice(4, 7), 0, ...T.slice(8, 11), 0], c.normal);
          out.push({ path, centre, normal: n, r: c.r });
        }
      }
      return out;
    },
  };
}
