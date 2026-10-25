#!/usr/bin/env python3
"""Summarise a .kicad_pcb: Edge.Cuts bbox, footprints (ref, value, pos, rot, layer,
courtyard/fab bbox in board coords with y flipped to y-up from the outline's lower-left),
and drilled holes >= 2 mm."""
import math, re, sys

def tokenize(s):
    i, n = 0, len(s)
    while i < n:
        c = s[i]
        if c in '()':
            yield c; i += 1
        elif c.isspace():
            i += 1
        elif c == '"':
            j = i + 1; buf = []
            while s[j] != '"':
                if s[j] == '\\': j += 1
                buf.append(s[j]); j += 1
            yield ('S', ''.join(buf)); i = j + 1
        else:
            j = i
            while j < n and not s[j].isspace() and s[j] not in '()': j += 1
            yield s[i:j]; i = j

def parse(s):
    stack = [[]]
    for t in tokenize(s):
        if t == '(':
            stack.append([])
        elif t == ')':
            x = stack.pop(); stack[-1].append(x)
        else:
            stack[-1].append(t[1] if isinstance(t, tuple) else t)
    return stack[0][0]

def kids(node, name):
    return [k for k in node if isinstance(k, list) and k and k[0] == name]

def kid(node, name):
    k = kids(node, name)
    return k[0] if k else None

def pts_of(g):
    out = []
    for key in ('start', 'end', 'mid', 'center'):
        k = kid(g, key)
        if k: out.append((float(k[1]), float(k[2])))
    p = kid(g, 'pts')
    if p:
        for xy in kids(p, 'xy'): out.append((float(xy[1]), float(xy[2])))
    if g[0] in ('gr_circle', 'fp_circle'):
        c = kid(g, 'center'); e = kid(g, 'end')
        cx, cy = float(c[1]), float(c[2]); r = math.hypot(float(e[1]) - cx, float(e[2]) - cy)
        out += [(cx - r, cy - r), (cx + r, cy + r)]
    return out

def layer_of(g):
    l = kid(g, 'layer')
    return l[1] if l else None

def main():
    pcb = parse(open(sys.argv[1], encoding='utf-8').read())
    xs, ys = [], []
    for g in pcb:
        if isinstance(g, list) and g and g[0].startswith('gr_') and layer_of(g) == 'Edge.Cuts':
            for x, y in pts_of(g): xs.append(x); ys.append(y)
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    print(f'Edge.Cuts bbox: x {x0:.3f}..{x1:.3f} y {y0:.3f}..{y1:.3f}  -> {x1-x0:.3f} x {y1-y0:.3f}')
    def B(x, y): return (x - x0, y1 - y)
    for fp in kids(pcb, 'footprint'):
        name = fp[1]
        at = kid(fp, 'at'); fx, fy = float(at[1]), float(at[2]); rot = float(at[3]) if len(at) > 3 and at[3] != 'unlocked' else 0.0
        layer = layer_of(fp)
        ref = val = ''
        for p in kids(fp, 'property'):
            if p[1] == 'Reference': ref = p[2]
            if p[1] == 'Value': val = p[2]
        if not ref:
            for t in kids(fp, 'fp_text'):
                if t[1] == 'reference': ref = t[2]
                if t[1] == 'value': val = t[2]
        boxes = {}
        th = math.radians(rot)
        def tr(x, y):
            # KiCad: rotation is CCW in degrees with y down -> screen CW... use standard KiCad transform
            xr = x * math.cos(th) + y * math.sin(th)
            yr = -x * math.sin(th) + y * math.cos(th)
            return fx + xr, fy + yr
        for g in fp:
            if isinstance(g, list) and g and g[0].startswith('fp_'):
                l = layer_of(g)
                if l and (l.endswith('CrtYd') or l.endswith('Fab')):
                    for x, y in pts_of(g):
                        X, Y = tr(x, y); boxes.setdefault(l, []).append(B(X, Y))
        holes = []
        for pad in kids(fp, 'pad'):
            dr = kid(pad, 'drill')
            if dr and len(dr) > 1:
                try: dd = float(dr[1])
                except ValueError: dd = float(dr[2])
                if dd >= 2.0:
                    pa = kid(pad, 'at'); X, Y = tr(float(pa[1]), float(pa[2]))
                    holes.append((B(X, Y), dd, pad[2]))
        bx, by = B(fx, fy)
        line = f'{ref:10s} {val[:28]:28s} {layer:5s} at ({bx:8.3f},{by:8.3f}) rot {rot:6.1f}  {name[:50]}'
        print(line)
        for l, pts in boxes.items():
            px = [p[0] for p in pts]; py = [p[1] for p in pts]
            print(f'    {l:8s} x {min(px):8.3f}..{max(px):8.3f}  y {min(py):8.3f}..{max(py):8.3f}  ({max(px)-min(px):.2f} x {max(py)-min(py):.2f})')
        for (hx, hy), dd, kind in holes:
            print(f'    hole {kind} d {dd} at ({hx:.3f},{hy:.3f})')

main()
