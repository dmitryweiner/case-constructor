#!/usr/bin/env python3
"""STEP assembly -> world bounding box of every leaf part instance (from vertices and circles).
usage: stepbox.py file.stp"""
import re, sys, math
from functools import lru_cache
sys.setrecursionlimit(100000)

txt = open(sys.argv[1], encoding='latin1').read()
data = txt[txt.index('DATA;') + 5:]
ent = {}
for m in re.finditer(r'#(\d+)\s*=\s*(.*?);\s*(?=#\d+\s*=|ENDSEC)', data, re.S):
    ent[int(m.group(1))] = m.group(2).replace('\n', '').replace('\r', '')

def typ(s):
    s = s.strip()
    if s.startswith('('): return 'COMPLEX'
    return s[:s.index('(')]
refs_re = re.compile(r'#(\d+)')
str_re = re.compile(r"'[^']*'")
def refs(i): return [int(x) for x in refs_re.findall(str_re.sub('', ent[i]))]
def nums(s): return [float(x) for x in re.findall(r'-?\d+\.?\d*(?:E[-+]?\d+)?', s)]

types = {i: typ(s) for i, s in ent.items()}
def pt(i):
    s = ent[i]; inner = s[s.index('(', s.index(',')):]
    return nums(inner)[:3]

def axis(i):
    r = refs(i)
    p = pt(r[0])
    z = nums(ent[r[1]].split(',', 1)[1])[:3] if len(r) > 1 else [0, 0, 1]
    x = nums(ent[r[2]].split(',', 1)[1])[:3] if len(r) > 2 else [1, 0, 0]
    n = math.sqrt(sum(a*a for a in z)); z = [a/n for a in z]
    d = sum(a*b for a, b in zip(x, z)); x = [a - d*b for a, b in zip(x, z)]
    n = math.sqrt(sum(a*a for a in x)); x = [a/n for a in x]
    y = [z[1]*x[2]-z[2]*x[1], z[2]*x[0]-z[0]*x[2], z[0]*x[1]-z[1]*x[0]]
    return (x, y, z, p)

def mat(ax):  # 4x4 local->parent
    x, y, z, p = ax
    return [[x[0], y[0], z[0], p[0]], [x[1], y[1], z[1], p[1]], [x[2], y[2], z[2], p[2]], [0, 0, 0, 1]]
def mmul(a, b): return [[sum(a[i][k]*b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]
def inv(m):
    R = [[m[j][i] for j in range(3)] for i in range(3)]; t = [m[i][3] for i in range(3)]
    nt = [-sum(R[i][k]*t[k] for k in range(3)) for i in range(3)]
    return [R[0]+[nt[0]], R[1]+[nt[1]], R[2]+[nt[2]], [0, 0, 0, 1]]
def apply(m, p): return [sum(m[i][k]*p[k] for k in range(3)) + m[i][3] for i in range(3)]
I4 = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]

# memo: points from VERTEX_POINT and CIRCLE (centre +- r) reachable from an entity
memo = {}
def pts(i):
    if i in memo: return memo[i]
    memo[i] = []
    t = types.get(i)
    if t == 'VERTEX_POINT':
        out = [tuple(pt(refs(i)[0]))]
    elif t == 'CIRCLE':
        r = refs(i); c = pt(refs(r[0])[0]); rad = nums(ent[i].split(',')[-1])[0]
        out = [(c[0]-rad, c[1]-rad, c[2]), (c[0]+rad, c[1]+rad, c[2])] if rad < 10 else []
    elif t in ('CARTESIAN_POINT', 'DIRECTION', 'AXIS2_PLACEMENT_3D'):
        out = []
    else:
        out = set()
        for r in refs(i):
            if r in ent: out.update(pts(r))
        out = list(out)
    memo[i] = out
    return out

# product structure
pdname = {}
for i, t in types.items():
    if t == 'PRODUCT_DEFINITION':
        f = refs(i)[0]; p = refs(f)[0]
        pdname[i] = re.match(r"PRODUCT\('([^']*)'", ent[p]).group(1)
pd_shape = {}  # pds id -> pd
for i, t in types.items():
    if t == 'PRODUCT_DEFINITION_SHAPE':
        r = refs(i)
        if r and r[0] in pdname: pd_shape[i] = r[0]
pd_rep = {}
for i, t in types.items():
    if t == 'SHAPE_DEFINITION_REPRESENTATION':
        a, b = refs(i)[:2]
        if a in pd_shape: pd_rep[pd_shape[a]] = b
# rep -> other reps (brep) via SHAPE_REPRESENTATION_RELATIONSHIP without transform
rep_links = {}
for i, t in types.items():
    if t == 'SHAPE_REPRESENTATION_RELATIONSHIP':
        r = refs(i); rep_links.setdefault(r[0], []).append(r[1]); rep_links.setdefault(r[1], []).append(r[0])
children = {}  # parent pd -> [(child pd, transform, name)]
nauo_pds = {}
for i, t in types.items():
    if t == 'PRODUCT_DEFINITION_SHAPE':
        r = refs(i)
        if r and types.get(r[0]) == 'NEXT_ASSEMBLY_USAGE_OCCURRENCE': nauo_pds[i] = r[0]
for i, t in types.items():
    if t == 'CONTEXT_DEPENDENT_SHAPE_REPRESENTATION':
        rr, pds = refs(i)[:2]
        nauo = nauo_pds[pds]; nr = refs(nauo); parent, child = nr[0], nr[1]
        s = ent[rr]
        m = re.search(r'REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION\(#(\d+)\)', s)
        idt = int(m.group(1)); a1, a2 = refs(idt)[:2]
        T = mmul(mat(axis(a2)), inv(mat(axis(a1))))
        nm = re.match(r"NEXT_ASSEMBLY_USAGE_OCCURRENCE\('([^']*)'", ent[nauo]).group(1)
        children.setdefault(parent, []).append((child, T, nm))

def rep_points(rep):
    seen = {rep}; stack = [rep]; out = []
    while stack:
        r = stack.pop()
        s = str_re.sub('', ent[r])
        # items of the representation: refs inside the first list
        items = [int(x) for x in refs_re.findall(s[s.index('('):s.rindex(',')])]
        for it in items:
            if types.get(it) not in ('AXIS2_PLACEMENT_3D',): out.extend(pts(it))
        for o in rep_links.get(r, []):
            if o not in seen: seen.add(o); stack.append(o)
    return out

allpd = set(pdname); childset = {c for v in children.values() for c, _, _ in v}
roots = [p for p in allpd if p not in childset]
rows = []
def walk(pd, T, path):
    kids = children.get(pd, [])
    rep = pd_rep.get(pd)
    P = rep_points(rep) if rep else []
    if P:
        W = [apply(T, p) for p in P]
        lo = [min(w[k] for w in W) for k in range(3)]; hi = [max(w[k] for w in W) for k in range(3)]
        rows.append((path, lo, hi))
    for c, Tc, nm in kids:
        walk(c, mmul(T, Tc), path + '/' + pdname[c])
for r in roots: walk(r, I4, pdname[r])
for path, lo, hi in rows:
    print(f'{path:70s} x {lo[0]:8.2f}..{hi[0]:8.2f}  y {lo[1]:8.2f}..{hi[1]:8.2f}  z {lo[2]:7.2f}..{hi[2]:7.2f}')

if len(sys.argv) > 2:
    target = sys.argv[2]
    def find(pd, T):
        for c, Tc, nm in children.get(pd, []):
            TT = mmul(T, Tc)
            if pdname[c] == target:
                rep = pd_rep[c]; reps = [rep] + rep_links.get(rep, [])
                for r in reps:
                    s = str_re.sub('', ent[r])
                    for it in [int(x) for x in refs_re.findall(s[s.index('('):s.rindex(',')])]:
                        P = pts(it)
                        if not P: continue
                        W = [apply(TT, p) for p in P]
                        lo = [min(w[k] for w in W) for k in range(3)]; hi = [max(w[k] for w in W) for k in range(3)]
                        X0, X1 = 50 - hi[1], 50 - lo[1]; Y0, Y1 = 37.5 - hi[0], 37.5 - lo[0]
                        print(f'  {types[it]:24s} X {X0:7.2f}..{X1:7.2f} Y {Y0:7.2f}..{Y1:7.2f} z {lo[2]:6.2f}..{hi[2]:6.2f}')
            find(c, TT)
    for r in roots: find(r, I4)
