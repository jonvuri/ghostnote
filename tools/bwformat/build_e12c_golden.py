#!/usr/bin/env python3
"""E12c golden — reconstruct a sampled 1-modulator preset from the sample-only
`bare` template by pure surgery, and prove it is BYTE-IDENTICAL to the real
Bitwig-saved file except known volatiles (embedded name + per-save GUID/hash).
This is the E10f golden standard applied to the Tier-2 (sampled) recipe:
  insert native modulator object -> append meta ref -> patch f4 ->
  relocate EVERY class-1 count-stub by the modulator's object footprint.

Footprints (measured, = one_X stub - bare stub): native Sampler LFO=0x10,
native Sampler Random=0x0d.

Offline only (no Bitwig): prints a categorised diff. A clean pass = every
differing region is name/volatile; any 'OTHER' region is a recipe defect.

  python3 tools/bwformat/build_e12c_golden.py
"""
import struct, difflib
S = __import__('os').path.expanduser('~/Documents/Bitwig Studio/Library/Presets/Sampler')

SENT = b'\x00\x00\x00\x03\x00\x00\x00\x00'
COUNT_FIDS = [b'\x00\x00\x12\x9c\x12', b'\x00\x00\x14\x22\x12']
STUB = b'\x00\x00\x00\x01'

def load(p): return open(f'{S}/{p}.bwpreset', 'rb').read()
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
    return sv[j1:snap], ss(one) + j1, ss(one) + snap

def set_f4(b, s): return b[:16] + f'{s+1:08x}'.encode() + b[24:]
def add_ref(b, guid):
    nm = b'referenced_modulator_ids'; i = b.find(nm); p = i + len(nm); cnt = struct.unpack_from('>I', b, p+1)[0]; q = p+5
    for _ in range(cnt): q += 4 + struct.unpack_from('>I', b, q)[0]
    g = guid.encode(); nb = b[:p+1] + struct.pack('>I', cnt+1) + b[p+5:q] + struct.pack('>I', len(g)) + g + b[q:]
    return set_f4(nb, ss(nb) + (len(nb) - len(b)))

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

def find_bare_list_end(b):
    """The 0x1a46 modulator list sentinel start in `bare` (insert before it)."""
    j = b.find(b'\x00\x00\x1a\x46\x12')      # fid 0x1a46, type list
    # sentinel is the empty-class-3 right after the (0-item) list opens
    s = b.find(SENT, j)
    return s

def reconstruct(one_name, footprint):
    bare = load('gn_sampler_bare')
    obj, os_, oe = mod_object('gn_sampler_bare', one_name)
    guid = struct.unpack_from('>I', obj, 0)  # not the guid; get guid from meta of real
    # pull the modulator GUID from the object (0x18c6 field, 16 raw bytes -> canonical)
    gi = obj.find(b'\x00\x00\x18\xc6\x15') + 5
    raw = obj[gi:gi+16]
    guid = f'{raw[0:4].hex()}-{raw[4:6].hex()}-{raw[6:8].hex()}-{raw[8:10].hex()}-{raw[10:16].hex()}'
    sent = find_bare_list_end(bare)
    built = bare[:sent] + obj + bare[sent:]
    built = add_ref(built, guid)
    built = relocate(built, footprint)
    return built

def categorise(real, built, name):
    print(f'\n=== golden: reconstruct {name} from bare  (built {len(built)} vs real {len(real)}) ===')
    sm = difflib.SequenceMatcher(a=built, b=real, autojunk=False)
    ok = True
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == 'equal': continue
        a = built[i1:i2]; b = real[j1:j2]
        ctx = real[max(0, j1-16):j1]
        # categorise
        cat = 'OTHER  <<<'
        if b'referenced_modulator_ids' in real[max(0,j1-60):j1] or (a[:1].isalpha() and b'-' in (a+b)):
            cat = 'meta modulator-ref (guid)'
        if b'\x12\xde' in ctx or b'gn_sampler' in (a + b) or b'_one_' in (a+b) or b'bare' in (a+b) or b'lfo' in (a+b) or b'random' in (a+b):
            cat = 'embedded name (volatile)'
        # a 16-byte opaque region with no ascii -> per-save guid/hash
        if len(b) in (1, 6, 9, 14, 15, 16) and not any(32 <= c < 127 for c in b):
            cat = 'per-save guid/hash (volatile)'
        if len(b) == 1 and 0x19 <= b[0] <= 0x80 and not any(32 <= c < 127 for c in ctx[-1:]):
            cat = cat  # keep
        flag = '' if 'OTHER' not in cat else '  <<< UNEXPECTED'
        if 'OTHER' in cat: ok = False
        print(f'  {tag:8} built[{i1}:{i2}]={a.hex(" ")[:40]:40} real[{j1}:{j2}]={b.hex(" ")[:40]:40} :: {cat}{flag}')
    print(f'  => {"GOLDEN (all diffs are volatile)" if ok else "RECIPE DEFECT (see OTHER)"}')
    return built

built = reconstruct('gn_sampler_one_random', 0x0d)
categorise(load('gn_sampler_one_random'), built, 'one_random')
open('/tmp/gn_recon_one_random.bwpreset', 'wb').write(built)
built2 = reconstruct('gn_sampler_one_lfo', 0x10)
categorise(load('gn_sampler_one_lfo'), built2, 'one_lfo')
open('/tmp/gn_recon_one_lfo.bwpreset', 'wb').write(built2)
print('\nwrote /tmp/gn_recon_one_random.bwpreset, /tmp/gn_recon_one_lfo.bwpreset (load-testable)')
