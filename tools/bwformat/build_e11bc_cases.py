#!/usr/bin/env python3
"""Build E11b (name/id independence) + E11c (scale) test presets.

E11c is aimed at the Sampler slot-bank concern: a slot-bank needs one modulator of
every TYPE, and (E11d) surgery cannot ADD a new type to a Sampler — so a Sampler
slot-bank must be human-authored. What surgery CAN do on a Sampler is duplicate an
already-present type (maintaining the two count-u32s, byte = base + 0x10*count).
This tests whether that scales: many modulators on a Sampler, and whether the count
value carries correctly past the single-byte boundary (0x19 + 0x10*count overflows
one byte at count 15 -> needs a real u32). If a Sampler holds 32 modulators, its
capacity is not the slot-bank blocker (the type-introduction wall, E11d, is).

Cases:
  Sampler scale:  N LFO duplicates + count-u32 = base+0x10*N,  N in {8,16,32}
  Polysynth scale: N modulators cycling REAL distinct types,   N in {8,16,32}
  E11b name/id:   modtest slot1 name!=id (both directions), ids kept unique

Run:
  python3 tools/bwformat/build_e11bc_cases.py > /tmp/e11bc.json
  GN_MANIFEST=/tmp/e11bc.json npx tsx src/probes/e11-load.ts
"""
import json, os, struct, tempfile, difflib

BASE = os.path.expanduser('~/Documents/Bitwig Studio/Library/Presets')
POLY = f'{BASE}/Polysynth'
OUT = tempfile.mkdtemp(prefix='gn-e11bc-')

def load(p): return open(p, 'rb').read()
def ss(b): return int(b[16:24], 16) - 1
def set_f4(b, n): return b[:16] + f'{n+1:08x}'.encode() + b[24:]
def fmt_guid(g): h = g.hex(); return f'{h[0:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}'
def W(n, d): p = os.path.join(OUT, n + '.bwpreset'); open(p, 'wb').write(d); return p

def bare_diff(bare_p, one_p):
    bare = load(bare_p); one = load(one_p); sm = difflib.SequenceMatcher(a=bare[ss(bare):], b=one[ss(one):], autojunk=False)
    L, j1, j2 = max((y2-y1, y1, y2) for t, x1, x2, y1, y2 in sm.get_opcodes() if t == 'insert')
    return one[ss(one):][j1:j2], j1, j2

def obj_guid(obj):
    i = obj.find(b'\x00\x00\x18\xc6\x15'); return fmt_guid(obj[i+5:i+21])

def rename(obj, idx):
    obj = bytearray(obj)
    m = obj.find(b'\x00\x00\x02\xb9\x08\x00\x00\x00\x01'); obj[m+9] = ord(str(idx)[-1])  # name digit (last)
    n = obj.find(b'\x00\x00\x1a\x1b\x01'); obj[n+5] = idx & 0xff
    return bytes(obj)

def append_ref(b, guid):
    nm = b'referenced_modulator_ids'; i = b.find(nm); p = i+len(nm); cnt = struct.unpack_from('>I', b, p+1)[0]; q = p+5
    for _ in range(cnt): Ln = struct.unpack_from('>I', b, q)[0]; q += 4+Ln
    g = guid.encode(); elem = struct.pack('>I', len(g))+g
    nb = b[:p+1]+struct.pack('>I', cnt+1)+b[p+5:q]+elem+b[q:]
    return set_f4(nb, ss(nb)+(len(nb)-len(b)))

SIG_A = b'\x00\x00\x12\x9c\x12\x00\x00\x00\x01\x00\x00\x00'
SIG_B = b'\x00\x00\x14\x22\x12\x00\x00\x00\x01\x00\x00\x00'
def set_sampler_count(b, count):
    b = bytearray(b)
    for sig, base in [(SIG_A, 0x19), (SIG_B, 0x1a)]:
        p = b.find(sig)
        assert p >= 0 and b.find(sig, p+1) == -1, 'count signature not unique'
        p += len(sig)                                  # low byte of the u32
        struct.pack_into('>I', b, p-3, base + 0x10*count)   # write full u32 (carries)
    return bytes(b)

manifest = {'dir': OUT, 'cases': []}

# ---------- Sampler scale: N LFO duplicates + count-u32 ----------
SO = f'{BASE}/Sampler/gn_sampler_one_lfo.bwpreset'; SB = f'{BASE}/Sampler/gn_sampler_bare.bwpreset'
sone = load(SO); s0 = ss(sone)
lfo, sj1, sj2 = bare_diff(SB, SO)
LFO_GUID = obj_guid(lfo)
manifest['cases'].append({'key': 'sampler_base_N1', 'path': W('sampler_base_N1', sone),
    'desc': 'sampler one_lfo (N=1 control)', 'expect_load': True, 'expect_page': 'LFO'})
for N in (8, 16, 32):
    extra = b''.join(rename(lfo, k) for k in range(1, N))     # ids 1..N-1
    body = sone[:s0+sj2] + extra + sone[s0+sj2:]
    for _ in range(N-1): body = append_ref(body, LFO_GUID)
    body = set_sampler_count(body, N)
    manifest['cases'].append({'key': f'sampler_scale_{N}', 'path': W(f'sampler_scale_{N}', body),
        'desc': f'Sampler with {N} LFOs, count-u32={hex(0x19+0x10*N)} (byte overflow if N>=15)',
        'expect_load': None, 'expect_page': None})

# ---------- Polysynth scale: cycle REAL distinct types ----------
lfo_p, pj1, pj2 = bare_diff(f'{POLY}/mp_bare.bwpreset', f'{POLY}/mp_one_lfo.bwpreset')
rand_p, _, _ = bare_diff(f'{POLY}/mp_bare.bwpreset', f'{POLY}/mp_one_random.bwpreset')
modzoo = load(f'{POLY}/modzoo.bwpreset'); clfo = modzoo[6013:6592]
# Vibrato + Expressions from modtest (adjacent object bounds)
modtest = load(f'{POLY}/modtest.bwpreset')
def find_mod_starts(b):
    mk = b'\x00\x00\x02\xb9\x08\x00\x00\x00\x01'; out = []; i = b.find(mk)
    while i != -1:
        if 0x30 <= b[i+len(mk)] <= 0x39: out.append(i-4)
        i = b.find(mk, i+1)
    return out
mstarts = find_mod_starts(modtest)
vibrato = modtest[mstarts[0]:mstarts[1]]; express = modtest[mstarts[1]:mstarts[2]]
DONORS = [(lfo_p, obj_guid(lfo_p)), (rand_p, obj_guid(rand_p)), (clfo, obj_guid(clfo)),
          (vibrato, obj_guid(vibrato)), (express, obj_guid(express))]
pone = load(f'{POLY}/mp_one_lfo.bwpreset'); p0 = ss(pone)
manifest['cases'].append({'key': 'poly_base_N1', 'path': W('poly_base_N1', pone),
    'desc': 'polysynth one_lfo (N=1 control)', 'expect_load': True, 'expect_page': 'LFO'})
for N in (8, 16, 32):
    parts = b''; refs = []
    for k in range(1, N):
        obj, guid = DONORS[k % len(DONORS)]
        parts += rename(obj, k); refs.append(guid)
    body = pone[:p0+pj2] + parts + pone[p0+pj2:]
    for g in refs: body = append_ref(body, g)
    manifest['cases'].append({'key': f'poly_scale_{N}', 'path': W(f'poly_scale_{N}', body),
        'desc': f'Polysynth with {N} modulators cycling {len(DONORS)} distinct types',
        'expect_load': None, 'expect_page': None})

# ---------- E11b: name != id (ids kept unique) ----------
NM = b'\x00\x00\x02\xb9\x08\x00\x00\x00\x01'; IM = b'\x00\x00\x1a\x1b\x01'
def mod_markers(b):
    out = []; i = b.find(NM)
    while i != -1:
        no = i+len(NM)
        if 0x30 <= b[no] <= 0x39:
            n = b.find(IM, i); out.append((no, n+5))
        i = b.find(NM, i+1)
    return out
mk = mod_markers(modtest)
# B1: slot1 name -> "5", id stays 1  (ids [0,1,2], name says 5)
b1 = bytearray(modtest); b1[mk[1][0]] = ord('5')
manifest['cases'].append({'key': 'b_name5_id1', 'path': W('b_name5_id1', bytes(b1)),
    'desc': 'modtest slot1 NAME="5" but 0x1a1b id=1 (ids unique [0,1,2])',
    'expect_load': None, 'expect_page': None})
# B2: slot1 id -> 5, name stays "1"  (ids [0,5,2] unique, name says 1)
b2 = bytearray(modtest); b2[mk[1][1]] = 5
manifest['cases'].append({'key': 'b_name1_id5', 'path': W('b_name1_id5', bytes(b2)),
    'desc': 'modtest slot1 id=5 but NAME="1" (ids unique [0,5,2])',
    'expect_load': None, 'expect_page': None})

print(json.dumps(manifest, indent=2))
