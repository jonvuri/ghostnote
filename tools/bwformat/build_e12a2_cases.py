#!/usr/bin/env python3
"""E12a-2 — triangulate the count-stub relocation deltas on a sampled Sampler,
confirming the "new-type wall" is purely a wrong-delta artifact. Brackets three
ops around their predicted exact deltas:
  add 2nd LFO     -> +0x10   (LFO subtree footprint; sweep 0x0f..0x11)
  add Random      -> +0x0b   (Poly Random donor footprint; sweep 0x0a..0x0c)
  replace LFO->Rand-> -0x05   (= -0x10 + 0x0b; sweep -0x04..-0x06)
Each op should LOAD at exactly ONE delta and REJECT at its neighbours -> proves
the stub is an exact object-index reference, delta = inserted-minus-removed
object footprint. All modulators retargeted to CONTENTS/AMP_ATTACK_TIME for a
liveness readback.

Run:
  python3 tools/bwformat/build_e12a2_cases.py > /tmp/e12a2.json
  GN_MANIFEST=/tmp/e12a2.json GN_DIVERGE=1 npx tsx brain/src/probes/e11-load.ts
"""
import json, os, struct, tempfile, difflib

BASE = os.path.expanduser('~/Documents/Bitwig Studio/Library/Presets')
S = f'{BASE}/Sampler'; POLY = f'{BASE}/Polysynth'
OUT = tempfile.mkdtemp(prefix='gn-e12a2-')
LFO_GUID = 'ad947004-f1d3-40a1-bd15-3ec721ee7c65'
RAND_GUID = 'bf29a7b0-91dc-4851-8a94-c63f358f3cda'
SENT = b'\x00\x00\x00\x03\x00\x00\x00\x00'
COUNT_SIGS = [b'\x00\x00\x12\x9c\x12\x00\x00\x00\x01\x00\x00\x00',
              b'\x00\x00\x14\x22\x12\x00\x00\x00\x01\x00\x00\x00']
TARGET = 'CONTENTS/AMP_ATTACK_TIME'

def load(p): return open(p, 'rb').read()
def ss(b): return int(b[16:24], 16) - 1

def modulator_object(bare_p, one_p):
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
    assert len(hits) == 1
    j1, j2 = hits[0]
    snap = sv.find(SENT, j2 - 8, j2 + 8)
    return sv[j1:snap], ss(one) + j1, ss(one) + snap

def rename(obj, ch):
    o = bytearray(obj); m = o.find(b'\x00\x00\x02\xb9\x08\x00\x00\x00\x01'); o[m + 9] = ord(ch)
    n = o.find(b'\x00\x00\x1a\x1b\x01'); o[n + 5] = int(ch); return bytes(o)

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
def swap_ref(b, o, n): return b.replace(o.encode(), n.encode())

def bump(b, delta):
    for sig in COUNT_SIGS:
        i = b.find(sig)
        if i == -1: continue
        off = i + len(sig); v = struct.unpack_from('<I', b, off)[0]
        b = b[:off] + struct.pack('<I', v + delta) + b[off+4:]
    return b

def write(n, d): p = os.path.join(OUT, n + '.bwpreset'); open(p, 'wb').write(d); return p

one = load(f'{S}/gn_sampler_one_lfo.bwpreset')
lfo_obj, os_, oe = modulator_object(f'{S}/gn_sampler_bare.bwpreset', f'{S}/gn_sampler_one_lfo.bwpreset')
lfo_donor = retarget(lfo_obj, TARGET)
rand_obj, _, _ = modulator_object(f'{POLY}/mp_bare.bwpreset', f'{POLY}/mp_one_random.bwpreset')
rand_donor = retarget(rand_obj, TARGET)

cases = [('base_one_lfo', one, True)]

# add 2nd LFO: predict +0x10
add_lfo = add_ref(one[:oe] + rename(lfo_donor, '1') + one[oe:], LFO_GUID)
for d in (0x0f, 0x10, 0x11):
    cases.append((f'addLFO_d{d:02x}' + ('_PRED' if d == 0x10 else ''), bump(add_lfo, d), None))

# add Random: predict +0x0b
add_rnd = add_ref(one[:oe] + rename(rand_donor, '1') + one[oe:], RAND_GUID)
for d in (0x0a, 0x0b, 0x0c):
    cases.append((f'addRND_d{d:02x}' + ('_PRED' if d == 0x0b else ''), bump(add_rnd, d), None))

# replace LFO->Random: predict -0x05
rep = swap_ref(one[:os_] + rename(rand_donor, '0') + one[oe:], LFO_GUID, RAND_GUID)
for d in (-0x04, -0x05, -0x06):
    cases.append((f'repRND_dm{-d:02x}' + ('_PRED' if d == -0x05 else ''), bump(rep, d), None))

mani = {'dir': OUT, 'cases': [{'key': k, 'path': write(k, v), 'desc': k, 'expect_load': e, 'expect_page': None}
                              for k, v, e in cases]}
print(json.dumps(mani, indent=2))
