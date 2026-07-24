#!/usr/bin/env python3
"""E11d RE-CHECK: was the sampled-Sampler "wall" (rejects add/delete without a
count fix; blocks new-type introduction) partly the same off-by-2 list-SENTINEL
bug that made E11i a phantom? Rebuild the Sampler matrix with SENTINEL-CORRECT
object bounds, and isolate the count-u32 requirement by testing each op with and
without the count fix.

Sampled Sampler mirrors modulator count in two little-endian u32s (E11d-2/E11c):
  sig 00 00 12 9c 12 00 00 00 01 00 00 00 <u32 LE>   value = 0x19 + 0x10*count
  sig 00 00 14 22 12 00 00 00 01 00 00 00 <u32 LE>   value = 0x1a + 0x10*count
add/delete must delta both by +/-0x10 per modulator.

Run:
  python3 tools/bwformat/build_e11d_recheck.py > /tmp/e11dr.json
  GN_MANIFEST=/tmp/e11dr.json GN_DIVERGE=1 npx tsx src/probes/e11-load.ts
"""
import json, os, struct, tempfile, difflib

BASE = os.path.expanduser('~/Documents/Bitwig Studio/Library/Presets')
S = f'{BASE}/Sampler'; POLY = f'{BASE}/Polysynth'
OUT = tempfile.mkdtemp(prefix='gn-e11dr-')
LFO_GUID = 'ad947004-f1d3-40a1-bd15-3ec721ee7c65'
RAND_GUID = 'bf29a7b0-91dc-4851-8a94-c63f358f3cda'
SENT = b'\x00\x00\x00\x03\x00\x00\x00\x00'
COUNT_SIGS = [b'\x00\x00\x12\x9c\x12\x00\x00\x00\x01\x00\x00\x00',
              b'\x00\x00\x14\x22\x12\x00\x00\x00\x01\x00\x00\x00']

def load(p): return open(p, 'rb').read()
def ss(b): return int(b[16:24], 16) - 1

def modulator_object(bare_p, one_p):
    """Sentinel-correct extraction (the E11h fix): end the object exactly at the
    empty cls-0x0003 list sentinel, not at difflib's insert boundary."""
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
    assert len(hits) == 1, f'{len(hits)} objects'
    j1, j2 = hits[0]
    snap = sv.find(SENT, j2 - 8, j2 + 8); assert snap != -1, 'no sentinel'
    obj = sv[j1:snap]
    assert obj[-4:] == b'\x00\x00\x00\x00'
    return obj, ss(one) + j1, ss(one) + snap   # abs bounds; obj ends AT sentinel

def rename(obj, ch):
    o = bytearray(obj); m = o.find(b'\x00\x00\x02\xb9\x08\x00\x00\x00\x01'); o[m + 9] = ord(ch)
    n = o.find(b'\x00\x00\x1a\x1b\x01'); o[n + 5] = int(ch); return bytes(o)

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
def swap_ref(b, o, n): return b.replace(o.encode(), n.encode())

def bump_count(b, delta):
    """Delta both little-endian count-u32s by delta (0x10 per modulator)."""
    for sig in COUNT_SIGS:
        i = b.find(sig)
        if i == -1: continue
        off = i + len(sig); v = struct.unpack_from('<I', b, off)[0]
        b = b[:off] + struct.pack('<I', v + delta) + b[off+4:]
    return b

def write(n, d): p = os.path.join(OUT, n + '.bwpreset'); open(p, 'wb').write(d); return p

one = load(f'{S}/gn_sampler_one_lfo.bwpreset')
obj, os_, oe = modulator_object(f'{S}/gn_sampler_bare.bwpreset', f'{S}/gn_sampler_one_lfo.bwpreset')
rand_donor, _, _ = modulator_object(f'{POLY}/mp_bare.bwpreset', f'{POLY}/mp_one_random.bwpreset')

cases = []
cases.append(('base', one, True))
# same-type add, with and without count fix
add2 = one[:oe] + rename(obj, '1') + one[oe:]
cases.append(('add_nofix', add_ref(add2, LFO_GUID), None))
cases.append(('add_fix', bump_count(add_ref(add2, LFO_GUID), +0x10), None))
# new-type add (the "blocked" op), with and without count fix
addn = one[:oe] + rename(rand_donor, '1') + one[oe:]
cases.append(('addnew_nofix', add_ref(addn, RAND_GUID), None))
cases.append(('addnew_fix', bump_count(add_ref(addn, RAND_GUID), +0x10), None))
# replace LFO->Random (count unchanged)
rep = swap_ref(one[:os_] + rename(rand_donor, '0') + one[oe:], LFO_GUID, RAND_GUID)
cases.append(('replace', rep, None))
# delete, with and without count fix
d = del_ref(one[:os_] + one[oe:], LFO_GUID)
cases.append(('delete_nofix', d, None))
cases.append(('delete_fix', bump_count(d, -0x10), None))

mani = {'dir': OUT, 'cases': []}
for k, data, exp in cases:
    mani['cases'].append({'key': k, 'path': write(k, data), 'desc': k, 'expect_load': exp, 'expect_page': None})
print(json.dumps(mani, indent=2))
