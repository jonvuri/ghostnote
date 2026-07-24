#!/usr/bin/env python3
"""E12f setup — build a SAMPLE-LESS Sampler with surgically-authored LFO + Random
(Tier 1: no count stubs to relocate). This is the preset the user loads, then
drags a sample onto in the UI and saves — to test whether Bitwig materialises the
count stubs (0x129c/0x1422) with correct values (base + LFO 0x10 + Random 0x0d)
while keeping both modulators. Writes an absolute path for e11g-load.ts.

  python3 tools/bwformat/build_e12f_setup.py
  GN_FILE=/tmp/gn_ns_lfo_random.bwpreset npx tsx brain/src/probes/e11g-load.ts
"""
import os, struct, difflib

BASE = os.path.expanduser('~/Documents/Bitwig Studio/Library/Presets/Sampler')
LFO_GUID = 'ad947004-f1d3-40a1-bd15-3ec721ee7c65'
RAND_GUID = 'bf29a7b0-91dc-4851-8a94-c63f358f3cda'
SENT = b'\x00\x00\x00\x03\x00\x00\x00\x00'
OUT = '/tmp/gn_ns_lfo_random.bwpreset'

def load(p): return open(f'{BASE}/{p}.bwpreset', 'rb').read()
def ss(b): return int(b[16:24], 16) - 1

def mod_object(bare_name, one_name):
    bare = load(bare_name); sb = bare[ss(bare):]
    one = load(one_name); sv = one[ss(one):]
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
    return sv[j1:snap]

def set_id(obj, iid):
    o = bytearray(obj)
    m = o.find(b'\x00\x00\x02\xb9\x08\x00\x00\x00\x01'); o[m + 9] = ord(str(iid))
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

ns = load('gn_sampler_no_sample')
# insert point = the 0x1a46 modulator-list sentinel (empty list on no_sample)
j = ns.find(b'\x00\x00\x1a\x46\x12')
ins = ns.find(SENT, j)
lfo = retarget(set_id(mod_object('gn_sampler_bare', 'gn_sampler_one_lfo'), 0), 'CONTENTS/AMP_ATTACK_TIME')
rnd = retarget(set_id(mod_object('gn_sampler_bare', 'gn_sampler_one_random'), 1), 'CONTENTS/AMP_ATTACK_TIME')
built = ns[:ins] + lfo + rnd + ns[ins:]
built = add_ref(add_ref(built, LFO_GUID), RAND_GUID)
open(OUT, 'wb').write(built)

# sanity: count stubs should still be absent/empty (no sample)
c129 = built.find(b'\x00\x00\x12\x9c\x12\x00\x00\x00\x01')
c142 = built.find(b'\x00\x00\x14\x22\x12\x00\x00\x00\x01')
print(f'wrote {OUT} ({len(built)} bytes)')
print(f'  count-stub 0x129c present? {c129 != -1}   0x1422 stub present? {c142 != -1}  (both should be False)')
print(f'  meta refs: LFO+Random appended')
EOF_MARKER = None
