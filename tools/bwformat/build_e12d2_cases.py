#!/usr/bin/env python3
"""E12d-2 — multisample relocation, done RIGHT. E12d rejected because the count
field is a 0x12 LIST of class-1 reference stubs terminated by the empty class-3
sentinel, and a multisample 0x1422 list holds TWO stubs (0x1c, 0x23) — the
signature-based bump relocated only the first. Complete rule: for each count
list (fid 0x129c / 0x1422, type 0x12), relocate EVERY class-1 item
(`00 00 00 01 <u32 LE>`) up to the sentinel `00 00 00 03 00 00 00 00`, by the
inserted/removed object footprint. Predict: every op now LOADS on multisample.

Run:
  python3 tools/bwformat/build_e12d2_cases.py > /tmp/e12d2.json
  GN_MANIFEST=/tmp/e12d2.json GN_DIVERGE=1 npx tsx brain/src/probes/e11-load.ts
"""
import json, os, struct, tempfile, difflib

BASE = os.path.expanduser('~/Documents/Bitwig Studio/Library/Presets')
S = f'{BASE}/Sampler'; POLY = f'{BASE}/Polysynth'
OUT = tempfile.mkdtemp(prefix='gn-e12d2-')
LFO_GUID = 'ad947004-f1d3-40a1-bd15-3ec721ee7c65'
RAND_GUID = 'bf29a7b0-91dc-4851-8a94-c63f358f3cda'
SENT = b'\x00\x00\x00\x03\x00\x00\x00\x00'
COUNT_FIDS = [b'\x00\x00\x12\x9c\x12', b'\x00\x00\x14\x22\x12']  # fid + type-0x12
STUB = b'\x00\x00\x00\x01'                                       # class-1 item head
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
def del_ref(b, guid):
    nm = b'referenced_modulator_ids'; i = b.find(nm); p = i + len(nm); cnt = struct.unpack_from('>I', b, p+1)[0]; q = p+5; g = guid.encode()
    for _ in range(cnt):
        L = struct.unpack_from('>I', b, q)[0]
        if b[q+4:q+4+L] == g:
            nb = b[:p+1] + struct.pack('>I', cnt-1) + b[p+5:q] + b[q+4+L:]
            return set_f4(nb, ss(nb) + (len(nb) - len(b)))
        q += 4 + L
    raise RuntimeError('ref')

def relocate_stubs(b, delta):
    """For every count-field list (fid 0x129c/0x1422, type 0x12), walk its
    class-1 items to the class-3 sentinel and delta each stub value. The stub is
    `classId(BE u32)=1` then `payload(BE u32)` — payload is BIG-endian."""
    ba = bytearray(b)
    changed = []
    for fidsig in COUNT_FIDS:
        i = ba.find(fidsig)
        while i != -1:
            p = i + len(fidsig)                    # just past the 0x12 type byte
            while ba[p:p+8] != SENT:
                if ba[p:p+4] != STUB:              # not a class-1 stub -> stop this list
                    break
                off = p + 4
                v = struct.unpack_from('>I', ba, off)[0]
                struct.pack_into('>I', ba, off, v + delta)
                changed.append((off, v, v + delta))
                p = off + 4
            i = ba.find(fidsig, i + 1)
    return bytes(ba), changed

def stubvals(b):
    out = []
    for fidsig in COUNT_FIDS:
        i = b.find(fidsig)
        while i != -1:
            p = i + len(fidsig)
            while b[p:p+8] != SENT and b[p:p+4] == STUB:
                out.append(struct.unpack_from('>I', b, p+4)[0]); p += 8
            i = b.find(fidsig, i+1)
    return out

def write(n, d): p = os.path.join(OUT, n + '.bwpreset'); open(p, 'wb').write(d); return p

rand_donor = retarget(mod_object(f'{POLY}/mp_bare.bwpreset', f'{POLY}/mp_one_random.bwpreset')[0], TARGET)
cases = []
for tag, bare_name, one_name in [('multi', 'gn_sampler_multi_bare', 'gn_sampler_multi_one_lfo')]:
    one = load(f'{S}/{one_name}.bwpreset')
    lfo_obj, os_, oe = mod_object(f'{S}/{bare_name}.bwpreset', f'{S}/{one_name}.bwpreset')
    lfo_donor = retarget(lfo_obj, TARGET)
    cases.append((f'{tag}_base', one, True))
    add_lfo, _ = relocate_stubs(add_ref(one[:oe] + rename(lfo_donor, '1') + one[oe:], LFO_GUID), +0x10)
    cases.append((f'{tag}_addLFO', add_lfo, None))
    add_rnd, _ = relocate_stubs(add_ref(one[:oe] + rename(rand_donor, '1') + one[oe:], RAND_GUID), +0x0b)
    cases.append((f'{tag}_addRND_newtype', add_rnd, None))
    dele, _ = relocate_stubs(del_ref(one[:os_] + one[oe:], LFO_GUID), -0x10)
    cases.append((f'{tag}_delete', dele, None))

mani = {'dir': OUT, 'cases': [{'key': k, 'path': write(k, v), 'desc': f'{k} stubs={stubvals(v)}', 'expect_load': e, 'expect_page': None}
                              for k, v, e in cases]}
print(json.dumps(mani, indent=2))
