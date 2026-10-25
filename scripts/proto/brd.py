#!/usr/bin/env python3
"""Summarise an Eagle .brd (XML): the outline bbox (layer 20), plain holes, and every
element with its package, position, rotation, holes and the package's pad/silk bbox
(package coordinates, not rotated). usage: brd.py board.brd"""
import sys, xml.etree.ElementTree as ET, math
t=ET.parse(sys.argv[1]); r=t.getroot()
b=r.find('drawing/board')
xs=[];ys=[]
for w in b.findall('plain/wire'):
    if w.get('layer')=='20':
        for k in ('x1','x2'): xs.append(float(w.get(k)))
        for k in ('y1','y2'): ys.append(float(w.get(k)))
print('plain outline bbox', min(xs) if xs else None, max(xs) if xs else None, min(ys) if ys else None, max(ys) if ys else None)
for h in b.findall('plain/hole'): print('hole', h.attrib)
# packages
pk={}
for lib in b.findall('libraries/library'):
    for p in lib.findall('packages/package'):
        pk[(lib.get('name'),p.get('name'))]=p
for e in b.findall('elements/element'):
    p=pk.get((e.get('library'),e.get('package')))
    holes=[]; dims=[]
    bb=None
    if p is not None:
        for h in p.findall('hole'): holes.append((h.get('x'),h.get('y'),h.get('drill')))
        for w in p.findall('wire'):
            if w.get('layer')=='20': dims.append(w.attrib)
        pts=[]
        for s in p.findall('smd'): pts.append((float(s.get('x')),float(s.get('y'))))
        for s in p.findall('pad'): pts.append((float(s.get('x')),float(s.get('y'))))
        for w in p.findall('wire'):
            if w.get('layer') in ('21','51','39','40'):
                pts.append((float(w.get('x1')),float(w.get('y1'))));pts.append((float(w.get('x2')),float(w.get('y2'))))
        if pts: bb=(min(a for a,_ in pts),max(a for a,_ in pts),min(b for _,b in pts),max(b for _,b in pts))
    print(e.get('name'),e.get('package'),e.get('value'),e.get('x'),e.get('y'),e.get('rot'),'holes',holes,'dim',len(dims),'bbox',bb)
