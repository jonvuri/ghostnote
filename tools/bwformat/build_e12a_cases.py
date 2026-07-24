#!/usr/bin/env python3
"""E12a — break the sampled-Sampler "new-type wall" with the CORRECT count-stub
delta. Ground truth (planning recon) says the two count stubs are OBJECT-INDEX
references (a class-1 stub holding a u32), and the shift per modulator = that
modulator's object footprint:  LFO = +0x10, Random = +0x0d  (measured from real
gn_sampler_one_lfo/one_random). E11d only ever swept +0x10, so add-Random always
rejected — a WRONG-DELTA artifact, not a real wall.

Test: add a Random to gn_sampler_one_lfo, sweeping the stub delta around the
predicted +0x0d, with E11d's +0x10 and the no-fix +0x00 as REJECT controls, and
off-by-one neighbours to prove exactness. Also replace LFO->Random (predicted
delta 0x0d-0x10 = -0x03). Delete (-0x10) as a known-good sanity.

Reuses the E11d-recheck sentinel-correct extractor. Random donor is the
host-agnostic Polysynth mp_one_random object (E11d: the type-guid is the same
bytes on every host). The added modulator is retargeted to the Sampler amp
attack (CONTENTS/AMP_ATTACK_TIME, a known-valid Sampler route from E11d) so a
LOAD also shows liveness under GN_DIVERGE=1.

Run:
  python3 tools/bwformat/build_e12a_cases.py > /tmp/e12a.json
  GN_MANIFEST=/tmp/e12a.json GN_DIVERGE=1 npx tsx brain/src/probes/e11-load.ts
"""
import json, os, struct, tempfile, difflib

BASE = os.path.expanduser('~/Documents/Bitwig Studio/Library/Presets')
S = f'{BASE}/Sampler'; POLY = f'{BASE}/Polysynth'
OUT = tempfile.mkdtemp(prefix='gn-e12a-')
LFO_GUID = 'ad947004-f1d3-40a1-bd15-3ec721ee7c65'
RAND_GUID = 'bf29a7b0-91dc-4851-8a94-c63f358f3cda'
SENT = b'\x00\x00\x00\x03\x00\x00\x00\x00'
COUNT_SIGS = [b'\x00\x00\x12\x9c\x12\x00\x00\x00\x01\x00\x00\x00',
              b'\x00\x00\x14\x22\x12\x00\x00\x00\x01\x00\x00\x00']
SAMPLER_TARGET = 'CONTENTS/AMP_ATTACK_TIME'

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
    assert len(hits) == 1, f'{len(hits)} objects'
    j1, j2 = hits[0]
    snap = sv.find(SENT, j2 - 8, j2 + 8); assert snap != -1, 'no sentinel'
    obj = sv[j1:snap]
    assert obj[-4:] == b'\x00\x00\x00\x00'
    return obj, ss(one) + j1, ss(one) + snap

def rename(obj, ch):
    o = bytearray(obj); m = o.find(b'\x00\x00\x02\xb9\x08\x00\x00\x00\x01'); o[m + 9] = ord(ch)
    n = o.find(b'\x00\x00\x1a\x1b\x01'); o[n + 5] = int(ch); return bytes(o)

def retarget(obj, newt):
    """Rewrite the 0x0e3d route string (any length)."""
    o = obj; i = o.find(b'\x00\x00\x0e\x3d\x08')
    if i == -1: return o    # donor has no route
    p = i + 5; L = struct.unpack_from('>I', o, p)[0]
    return o[:p] + struct.pack('>I', len(newt)) + newt.encode() + o[p+4+L:]

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
    """Delta both count-stub u32s (little-endian value) by `delta`."""
    for sig in COUNT_SIGS:
        i = b.find(sig)
        if i == -1: continue
        off = i + len(sig); v = struct.unpack_from('<I', b, off)[0]
        b = b[:off] + struct.pack('<I', v + delta) + b[off+4:]
    return b

def stubvals(b):
    out = []
    for sig in COUNT_SIGS:
        i = b.find(sig)
        out.append(None if i == -1 else struct.unpack_from('<I', b, i+len(sig))[0])
    return out

def write(n, d): p = os.path.join(OUT, n + '.bwpreset'); open(p, 'wb').write(d); return p

one = load(f'{S}/gn_sampler_one_lfo.bwpreset')
_, os_, oe = modulator_object(f'{S}/gn_sampler_bare.bwpreset', f'{S}/gn_sampler_one_lfo.bwpreset')
lfo_obj, _, _ = modulator_object(f'{S}/gn_sampler_bare.bwpreset', f'{S}/gn_sampler_one_lfo.bwpreset')
rand_donor, _, _ = modulator_object(f'{POLY}/mp_bare.bwpreset', f'{POLY}/mp_one_random.bwpreset')
rand_donor = retarget(rand_donor, SAMPLER_TARGET)   # valid Sampler route -> liveness

cases = []
cases.append(('base_one_lfo', one, True))

# --- add Random to one_lfo: sweep the stub delta around predicted +0x0d ---
addn = one[:oe] + rename(rand_donor, '1') + one[oe:]
addn = add_ref(addn, RAND_GUID)
for delta in [0x00, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10]:
    tag = 'PREDICT' if delta == 0x0d else ('E11d' if delta == 0x10 else '')
    cases.append((f'addRand_d{delta:02x}' + (f'_{tag}' if tag else ''),
                  bump_count(addn, delta), None))

# --- replace LFO->Random: predicted delta = 0x0d - 0x10 = -0x03 ---
rep = swap_ref(one[:os_] + rename(rand_donor, '0') + one[oe:], LFO_GUID, RAND_GUID)
for delta in [0x00, -0x02, -0x03, -0x04]:
    tag = 'PREDICT' if delta == -0x03 else ('E11d' if delta == 0 else '')
    cases.append((f'repRand_d{delta:+03x}'.replace('+', 'p').replace('-', 'm') + (f'_{tag}' if tag else ''),
                  bump_count(rep, delta), None))

# --- delete LFO (known-good sanity: -0x10) ---
d = del_ref(one[:os_] + one[oe:], LFO_GUID)
cases.append(('delete_dm10', bump_count(d, -0x10), None))

mani = {'dir': OUT, 'cases': []}
for k, data, exp in cases:
    mani['cases'].append({'key': k, 'path': write(k, data), 'desc': f'{k} stubs={stubvals(data)}',
                          'expect_load': exp, 'expect_page': None})
# real lfo_random stubs for reference (should equal addRand_d0d)
real = stubvals(load(f'{S}/gn_sampler_lfo_random.bwpreset'))
mani['note'] = f'real lfo_random stubs={real} (addRand_d0d should match)'
print(json.dumps(mani, indent=2))
