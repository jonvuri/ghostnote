#!/usr/bin/env python3
"""E12d — boundary check: does the relocation rule hold on (a) a DIFFERENT single
sample and (b) a MULTISAMPLE preset (the "count-field completeness" question,
DECISIONS Q1, flagged highest-suspicion for mirroring MORE state)?

Planning recon found:
  gn_sampler2  (different sample): stubs 0x129c=0x19, 0x1422=0x1a  -> SAME base
  gn_sampler_multi (>=2 zones):    TWO 0x129c stubs (0x1b, 0x22) + ONE 0x1422 (0x1c)
So multisample introduces MORE reference stubs. Rule under test: relocate EVERY
count-stub by the inserted/removed object footprint (LFO=+0x10, Poly Random donor
=+0x0b). If every op loads with all stubs relocated, the Sampler is fully general
(no per-type state) regardless of sample count.

Run:
  python3 tools/bwformat/build_e12d_cases.py > /tmp/e12d.json
  GN_MANIFEST=/tmp/e12d.json GN_DIVERGE=1 npx tsx brain/src/probes/e11-load.ts
"""
import json, os, struct, tempfile, difflib

BASE = os.path.expanduser('~/Documents/Bitwig Studio/Library/Presets')
S = f'{BASE}/Sampler'; POLY = f'{BASE}/Polysynth'
OUT = tempfile.mkdtemp(prefix='gn-e12d-')
LFO_GUID = 'ad947004-f1d3-40a1-bd15-3ec721ee7c65'
RAND_GUID = 'bf29a7b0-91dc-4851-8a94-c63f358f3cda'
SENT = b'\x00\x00\x00\x03\x00\x00\x00\x00'
COUNT_SIGS = [b'\x00\x00\x12\x9c\x12\x00\x00\x00\x01\x00\x00\x00',
              b'\x00\x00\x14\x22\x12\x00\x00\x00\x01\x00\x00\x00']
TARGET = 'CONTENTS/AMP_ATTACK_TIME'

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
    assert len(hits) == 1, f'{len(hits)}'
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
def del_ref(b, guid):
    nm = b'referenced_modulator_ids'; i = b.find(nm); p = i + len(nm); cnt = struct.unpack_from('>I', b, p+1)[0]; q = p+5; g = guid.encode()
    for _ in range(cnt):
        L = struct.unpack_from('>I', b, q)[0]
        if b[q+4:q+4+L] == g:
            nb = b[:p+1] + struct.pack('>I', cnt-1) + b[p+5:q] + b[q+4+L:]
            return set_f4(nb, ss(nb) + (len(nb) - len(b)))
        q += 4 + L
    raise RuntimeError('ref')

def bump_all(b, delta):
    """Relocate EVERY occurrence of EVERY count-stub by delta (multisample-safe)."""
    for sig in COUNT_SIGS:
        i = b.find(sig)
        while i != -1:
            off = i + len(sig); v = struct.unpack_from('<I', b, off)[0]
            b = b[:off] + struct.pack('<I', v + delta) + b[off+4:]
            i = b.find(sig, off)
    return b

def stubs(b):
    out = []
    for sig in COUNT_SIGS:
        i = b.find(sig)
        while i != -1:
            out.append(struct.unpack_from('<I', b, i+len(sig))[0]); i = b.find(sig, i+len(sig))
    return out

def write(n, d): p = os.path.join(OUT, n + '.bwpreset'); open(p, 'wb').write(d); return p

rand_donor = retarget(mod_object(f'{POLY}/mp_bare.bwpreset', f'{POLY}/mp_one_random.bwpreset')[0], TARGET)
cases = []

for tag, bare_name, one_name in [('s2', 'gn_sampler2_bare', 'gn_sampler2_one_lfo'),
                                  ('multi', 'gn_sampler_multi_bare', 'gn_sampler_multi_one_lfo')]:
    one = load(f'{S}/{one_name}.bwpreset')
    lfo_obj, os_, oe = mod_object(f'{S}/{bare_name}.bwpreset', f'{S}/{one_name}.bwpreset')
    lfo_donor = retarget(lfo_obj, TARGET)
    cases.append((f'{tag}_base', one, True))
    # add 2nd LFO (+0x10 on every stub)
    add_lfo = bump_all(add_ref(one[:oe] + rename(lfo_donor, '1') + one[oe:], LFO_GUID), +0x10)
    cases.append((f'{tag}_addLFO_d10', add_lfo, None))
    # add Random NEW TYPE (+0x0b on every stub) — the op E11d called impossible
    add_rnd = bump_all(add_ref(one[:oe] + rename(rand_donor, '1') + one[oe:], RAND_GUID), +0x0b)
    cases.append((f'{tag}_addRND_d0b', add_rnd, None))
    # delete the LFO (-0x10 on every stub)
    dele = bump_all(del_ref(one[:os_] + one[oe:], LFO_GUID), -0x10)
    cases.append((f'{tag}_delete_dm10', dele, None))

mani = {'dir': OUT, 'cases': [{'key': k, 'path': write(k, v), 'desc': f'{k} stubs={stubs(v)}', 'expect_load': e, 'expect_page': None}
                              for k, v, e in cases]}
print(json.dumps(mani, indent=2))
