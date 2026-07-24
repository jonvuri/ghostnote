#!/usr/bin/env python3
"""E12e — surgery WITHIN a sampled >=2-type template (gn_sampler_lfo_random:
LFO id 0 + Random id 1). Confirms the slot-bank shape is fully surgery-reachable
on a sampled preset: duplicate each existing type at scale, delete, and retune —
all with the complete class-1 stub relocation (BE, every stub, every count list).

Footprints: native Sampler LFO=0x10, native Sampler Random=0x0d.

  python3 tools/bwformat/build_e12e_cases.py > /tmp/e12e.json
  GN_MANIFEST=/tmp/e12e.json GN_DIVERGE=1 npx tsx brain/src/probes/e11-load.ts
"""
import json, os, struct, tempfile, difflib

BASE = os.path.expanduser('~/Documents/Bitwig Studio/Library/Presets')
S = f'{BASE}/Sampler'
OUT = tempfile.mkdtemp(prefix='gn-e12e-')
LFO_GUID = 'ad947004-f1d3-40a1-bd15-3ec721ee7c65'
RAND_GUID = 'bf29a7b0-91dc-4851-8a94-c63f358f3cda'
SENT = b'\x00\x00\x00\x03\x00\x00\x00\x00'
COUNT_FIDS = [b'\x00\x00\x12\x9c\x12', b'\x00\x00\x14\x22\x12']
STUB = b'\x00\x00\x00\x01'

def load(p): return open(p, 'rb').read()
def ss(b): return int(b[16:24], 16) - 1

def mod_object(bare_p, one_p):
    bare = load(bare_p); sb = bare[ss(bare):]
    one = load(one_p); sv = one[ss(one):]
    mk = b'\x00\x00\x02\xb9\x08\x00\x00\x00\x01'
    ins = [(k1, k2) for t, i1, i2, k1, k2 in
           difflib.SequenceMatcher(a=sb, b=sv, autojunk=False).get_opcodes() if t == 'insert']
    hits = []
    nm = sv.find(mk)
    while nm != -1:
        if struct.unpack_from('>I', sv, nm - 4)[0] == 0x06c9:
            sp = next(((a, c) for a, c in ins if a <= nm < c), None)
            if sp: hits.append((nm - 4, sp[1]))
        nm = sv.find(mk, nm + 1)
    assert len(hits) == 1, len(hits)
    j1, j2 = hits[0]
    snap = sv.find(SENT, j2 - 8, j2 + 8)
    return sv[j1:snap], ss(one) + j1, ss(one) + snap

def set_id(obj, iid):
    o = bytearray(obj)
    m = o.find(b'\x00\x00\x02\xb9\x08\x00\x00\x00\x01'); o[m + 9] = ord(str(iid)) if iid < 10 else 0x30
    n = o.find(b'\x00\x00\x1a\x1b\x01'); o[n + 5] = iid
    return bytes(o)

def retarget(obj, newt):
    i = obj.find(b'\x00\x00\x0e\x3d\x08')
    if i == -1: return obj
    p = i + 5; L = struct.unpack_from('>I', obj, p)[0]
    return obj[:p] + struct.pack('>I', len(newt)) + newt.encode() + obj[p+4+L:]

def set_f4(b, s): return b[:16] + f'{s+1:08x}'.encode() + b[24:]
def add_ref(b, guid):
    nm = b'referenced_modulator_ids'; i = b.find(nm); p = i + len(nm); cnt = struct.unpack_from('>I', b, p+1)[0]; q = p+5
    for _ in range(cnt): q += 4 + struct.unpack_from('>I', b, q)[0]
    g = guid.encode(); nb = b[:p+1] + struct.pack('>I', cnt+1) + b[p+5:q] + struct.pack('>I', len(g)) + g + b[q:]
    return set_f4(nb, ss(nb) + (len(nb) - len(b)))
def del_ref(b, guid):
    nm = b'referenced_modulator_ids'; i = b.find(nm); p = i + len(nm); cnt = struct.unpack_from('>I', b, p+1)[0]; q = p+5; g = guid.encode()
    for _ in range(cnt):
        L = struct.unpack_from('>I', b, q)[0]
        if b[q+4:q+4+L] == g:
            nb = b[:p+1] + struct.pack('>I', cnt-1) + b[p+5:q] + b[q+4+L:]
            return set_f4(nb, ss(nb) + (len(nb) - len(b)))
        q += 4 + L
    raise RuntimeError('ref')

def relocate(b, delta):
    ba = bytearray(b)
    for fidsig in COUNT_FIDS:
        i = ba.find(fidsig)
        while i != -1:
            p = i + len(fidsig)
            while ba[p:p+8] != SENT and ba[p:p+4] == STUB:
                v = struct.unpack_from('>I', ba, p+4)[0]; struct.pack_into('>I', ba, p+4, v + delta); p += 8
            i = ba.find(fidsig, i + 1)
    return bytes(ba)

def write(n, d): p = os.path.join(OUT, n + '.bwpreset'); open(p, 'wb').write(d); return p

base = load(f'{S}/gn_sampler_lfo_random.bwpreset')
# insert point = end of the last (Random) modulator object = the list sentinel start
_, ros, roe = mod_object(f'{S}/gn_sampler_one_lfo.bwpreset', f'{S}/gn_sampler_lfo_random.bwpreset')
INS = roe  # insert new modulator objects here, before the 0x1a46 list sentinel
lfo_donor = retarget(mod_object(f'{S}/gn_sampler_bare.bwpreset', f'{S}/gn_sampler_one_lfo.bwpreset')[0], 'CONTENTS/AMP_ATTACK_TIME')
rnd_donor = retarget(mod_object(f'{S}/gn_sampler_bare.bwpreset', f'{S}/gn_sampler_one_random.bwpreset')[0], 'CONTENTS/AMP_ATTACK_TIME')

cases = [('base', base, True)]

# --- duplicate: +2 LFO (id 2,3) +2 Random (id 4,5) ---
blob = set_id(lfo_donor, 2) + set_id(lfo_donor, 3) + set_id(rnd_donor, 4) + set_id(rnd_donor, 5)
dup = base[:INS] + blob + base[INS:]
for g in (LFO_GUID, LFO_GUID, RAND_GUID, RAND_GUID): dup = add_ref(dup, g)
dup = relocate(dup, 2*0x10 + 2*0x0d)
cases.append(('dup_2lfo_2rnd', dup, None))

# --- scale: +6 LFO duplicates (ids 6..11) ---
blob = b''.join(set_id(lfo_donor, i) for i in range(6, 12))
scale = base[:INS] + blob + base[INS:]
for _ in range(6): scale = add_ref(scale, LFO_GUID)
scale = relocate(scale, 6*0x10)
cases.append(('scale_plus6lfo', scale, None))

# --- delete the original Random (id 1) ---
_, drs, dre = mod_object(f'{S}/gn_sampler_one_lfo.bwpreset', f'{S}/gn_sampler_lfo_random.bwpreset')
dele = del_ref(base[:drs] + base[dre:], RAND_GUID)
dele = relocate(dele, -0x0d)
cases.append(('delete_random', dele, None))

# --- retune: retarget the LFO route (stream-only, NO relocation: no object change) ---
lfo_here, los, loe = mod_object(f'{S}/gn_sampler_bare.bwpreset', f'{S}/gn_sampler_one_lfo.bwpreset')
# locate & retarget the existing LFO's 0x0e3d inside `base` directly (find first route)
def retarget_in_place(b, newt):
    i = b.find(b'\x00\x00\x0e\x3d\x08'); p = i + 5; L = struct.unpack_from('>I', b, p)[0]
    return b[:p] + struct.pack('>I', len(newt)) + newt.encode() + b[p+4+L:]
retune = retarget_in_place(base, 'CONTENTS/AMP_DECAY_TIME')  # any-length; f4 unaffected (stream-only)
cases.append(('retune_retarget', retune, None))

mani = {'dir': OUT, 'cases': [{'key': k, 'path': write(k, v), 'desc': k, 'expect_load': e, 'expect_page': None}
                              for k, v, e in cases]}
print(json.dumps(mani, indent=2))
