#!/usr/bin/env python3
"""pdftocairo -svg output -> R12 DXF (LWPOLYLINE per subpath, CIRCLE for circle-like subpaths), mm.
usage: svg2dxf.py in.svg out.dxf [scale]   (scale multiplies pt->mm, default 25.4/72)"""
import re, sys, math
import xml.etree.ElementTree as ET

src, dst = sys.argv[1], sys.argv[2]
k = float(sys.argv[3]) if len(sys.argv) > 3 else 25.4 / 72
NS = '{http://www.w3.org/2000/svg}'

def mul(a, b):
    a0, a1, a2, a3, a4, a5 = a; b0, b1, b2, b3, b4, b5 = b
    return (a0*b0 + a2*b1, a1*b0 + a3*b1, a0*b2 + a2*b3, a1*b2 + a3*b3, a0*b4 + a2*b5 + a4, a1*b4 + a3*b5 + a5)

def parse_tf(s):
    m = (1, 0, 0, 1, 0, 0)
    for name, args in re.findall(r'(\w+)\(([^)]*)\)', s or ''):
        v = [float(x) for x in re.split(r'[ ,]+', args.strip()) if x]
        if name == 'matrix': t = tuple(v)
        elif name == 'translate': t = (1, 0, 0, 1, v[0], v[1] if len(v) > 1 else 0)
        elif name == 'scale': t = (v[0], 0, 0, v[1] if len(v) > 1 else v[0], 0, 0)
        else: continue
        m = mul(m, t)
    return m

def ap(m, x, y):
    return (m[0]*x + m[2]*y + m[4], m[1]*x + m[3]*y + m[5])

out_polys, out_circles = [], []
seen = set()
def circ(a, b, c):
    ax, ay = a; bx, by = b; cx, cy = c
    d = 2 * (ax*(by-cy) + bx*(cy-ay) + cx*(ay-by))
    if abs(d) < 1e-9: return None
    ux = ((ax*ax+ay*ay)*(by-cy) + (bx*bx+by*by)*(cy-ay) + (cx*cx+cy*cy)*(ay-by)) / d
    uy = ((ax*ax+ay*ay)*(cx-bx) + (bx*bx+by*by)*(ax-cx) + (cx*cx+cy*cy)*(bx-ax)) / d
    return ux, uy, math.hypot(ax-ux, ay-uy)

def do_path(d, m):
    toks = re.findall(r'[MLCZHVmlczhv]|-?[\d.]+(?:e-?\d+)?', d)
    i = 0; cmd = None; subs = []; cur = []; pos = (0, 0); start = (0, 0); ncurve = 0
    def num():
        nonlocal i
        v = float(toks[i]); i += 1; return v
    while i < len(toks):
        t = toks[i]
        if re.match(r'[A-Za-z]', t): cmd = t; i += 1
        if cmd == 'M':
            if len(cur) > 1: subs.append((cur, ncurve))
            pos = (num(), num()); start = pos; cur = [pos]; ncurve = 0; cmd = 'L'
        elif cmd == 'L':
            pos = (num(), num()); cur.append(pos)
        elif cmd == 'C':
            p1 = (num(), num()); p2 = (num(), num()); p3 = (num(), num()); p0 = pos
            for s in range(1, 9):
                u = s / 8
                x = (1-u)**3*p0[0] + 3*(1-u)**2*u*p1[0] + 3*(1-u)*u*u*p2[0] + u**3*p3[0]
                y = (1-u)**3*p0[1] + 3*(1-u)**2*u*p1[1] + 3*(1-u)*u*u*p2[1] + u**3*p3[1]
                cur.append((x, y))
            pos = p3; ncurve += 1
        elif cmd == 'Z':
            if cur: cur.append(start)
            pos = start
            if len(cur) > 1: subs.append((cur, ncurve))
            cur = [start]; ncurve = 0; cmd = None
        else:
            i += 1
    if len(cur) > 1: subs.append((cur, ncurve))
    for pts, nc in subs:
        P = [ap(m, x, y) for x, y in pts]
        P = [(x * k, -y * k) for x, y in P]
        out_polys.append(P)
        if nc >= 2 and len(P) >= 9:
            c = circ(P[0], P[len(P)//2], P[-1] if math.dist(P[0], P[-1]) > 1e-6 else P[len(P)//4])
            if c:
                cx, cy, r = c
                rs = [math.hypot(p[0]-cx, p[1]-cy) for p in P]
                if r > 0.05 and max(rs) - min(rs) < 0.03 * r + 0.01:
                    key = (round(cx, 2), round(cy, 2), round(r, 2))
                    if key not in seen: seen.add(key); out_circles.append((cx, cy, r))

def walk(el, m):
    tag = el.tag.replace(NS, '')
    if tag in ('defs', 'clipPath', 'symbol', 'mask'): return
    m = mul(m, parse_tf(el.get('transform')))
    if tag == 'path' and el.get('d'): do_path(el.get('d'), m)
    elif tag == 'rect':
        x, y, w, h = (float(el.get(a, 0)) for a in ('x', 'y', 'width', 'height'))
        do_path(f'M {x} {y} L {x+w} {y} L {x+w} {y+h} L {x} {y+h} Z', m)
    for c in el: walk(c, m)

walk(ET.parse(src).getroot(), (1, 0, 0, 1, 0, 0))
with open(dst, 'w') as f:
    f.write('0\nSECTION\n2\nENTITIES\n')
    for P in out_polys:
        f.write(f'0\nLWPOLYLINE\n8\n0\n90\n{len(P)}\n70\n0\n')
        for x, y in P: f.write(f'10\n{x:.4f}\n20\n{y:.4f}\n')
    for cx, cy, r in out_circles:
        f.write(f'0\nCIRCLE\n8\n0\n10\n{cx:.4f}\n20\n{cy:.4f}\n40\n{r:.4f}\n')
    f.write('0\nENDSEC\n0\nEOF\n')
print(f'{len(out_polys)} polylines, {len(out_circles)} circles')
