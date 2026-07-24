#!/usr/bin/env python3
"""Build E11d test presets: does modulator surgery hold on NON-Polysynth hosts?

User-authored minimal pairs (bare / one_lfo) for three hosts:
  Sampler   (native instrument)  route form  CONTENTS/AMP_ATTACK_TIME
  Delay+    (native FX)          route form  CONTENTS/BLUR
  Repro-5   (CLAP plugin)        route form  CONTENTS/ROOT_GENERIC_MODULE/PID3c

Parsing already showed structure holds on all three (0x075f wrapper, 0x1a46 list,
0x06c9 objects, 0x1a1b/0x18c6/0x0e3d, meta referenced_modulator_ids, f4) and the
LFO modulator is host-agnostic (0x18c6 = ad947004 everywhere). The CLAP uses a
deeper route path (a plugin-param id), and its bare->one_lfo diff also mutates the
plugin state blob — so we work from one_lfo (never reconstruct from bare) to keep
the plugin state intact.

Per host, three cases:
  <h>_base     one_lfo unmodified                                   (control)
  <h>_add      one_lfo + a 2nd LFO (its OWN LFO object duplicated)  -> add recipe
  <h>_replace  one_lfo's LFO replaced by a Polysynth Random donor,
               retargeted to the host's OWN param path             -> replace +
               cross-host donor + host routing path

Run:
  python3 tools/bwformat/build_e11d_cases.py > /tmp/e11d_manifest.json
  GN_MANIFEST=/tmp/e11d_manifest.json GN_DIVERGE=1 npx tsx src/probes/e11-load.ts
"""
import json, os, struct, tempfile, difflib

BASE = os.path.expanduser('~/Documents/Bitwig Studio/Library/Presets')
POLY = f'{BASE}/Polysynth'
OUT = tempfile.mkdtemp(prefix='gn-e11d-')

HOSTS = {
    'sampler': (f'{BASE}/Sampler/gn_sampler_bare.bwpreset', f'{BASE}/Sampler/gn_sampler_one_lfo.bwpreset'),
    'delay':   (f'{BASE}/Delay+/gn_delayplus_bare.bwpreset', f'{BASE}/Delay+/gn_delayplus_one_lfo.bwpreset'),
    'repro':   (f'{BASE}/Repro-5/gn_repro5_bare.bwpreset', f'{BASE}/Repro-5/gn_repro5_one_lfo.bwpreset'),
}
LFO_GUID = 'ad947004-f1d3-40a1-bd15-3ec721ee7c65'
RAND_GUID = 'bf29a7b0-91dc-4851-8a94-c63f358f3cda'

def load(p): return open(p, 'rb').read()
def stream_start(b): return int(b[16:24], 16) - 1
def set_f4(b, new_start): return b[:16] + f'{new_start+1:08x}'.encode('ascii') + b[24:]

def largest_insert(bare_p, one_p):
    """Biggest bare->one insert = the modulator object. Returns (obj, j1, j2)
    stream-relative into `one`. Robust to unrelated plugin-state edits (CLAP)."""
    bare = load(bare_p); sb = bare[stream_start(bare):]
    one = load(one_p); sv = one[stream_start(one):]
    sm = difflib.SequenceMatcher(a=sb, b=sv, autojunk=False)
    best = max((j2 - j1, j1, j2) for tag, i1, i2, j1, j2 in sm.get_opcodes() if tag == 'insert')
    _, j1, j2 = best
    obj = sv[j1:j2]
    assert struct.unpack_from('>I', obj, 0)[0] == 0x06c9, 'insert is not a 0x06c9 object'
    assert obj[-4:] == b'\x00\x00\x00\x00', 'object does not end on a terminator'
    return obj, j1, j2

def rename_slot(obj, idx_char):
    obj = bytearray(obj)
    m = obj.find(b'\x00\x00\x02\xb9\x08\x00\x00\x00\x01'); obj[m + 9] = ord(idx_char)
    n = obj.find(b'\x00\x00\x1a\x1b\x01'); assert n >= 0; obj[n + 5] = int(idx_char)
    return bytes(obj)

def set_route(obj, new_target):
    """Rewrite the object's single 0x0e3d routing-target string (any length)."""
    fb = b'\x00\x00\x0e\x3d\x08'
    i = obj.find(fb); assert i >= 0, 'no 0x0e3d in object'
    assert obj.find(fb, i + 1) == -1, 'multiple 0x0e3d in object'
    L = struct.unpack_from('>I', obj, i + 5)[0]
    nt = new_target.encode()
    return obj[:i + 5] + struct.pack('>I', len(nt)) + nt + obj[i + 9 + L:]

def route_of(obj):
    fb = b'\x00\x00\x0e\x3d\x08'; i = obj.find(fb)
    L = struct.unpack_from('>I', obj, i + 5)[0]
    return obj[i + 9:i + 9 + L].decode()

def append_mod_ref(b, guid):
    name = b'referenced_modulator_ids'; i = b.find(name); p = i + len(name)
    assert b[p] == 0x19
    cnt = struct.unpack_from('>I', b, p + 1)[0]; q = p + 5
    for _ in range(cnt):
        L = struct.unpack_from('>I', b, q)[0]; q += 4 + L
    g = guid.encode(); elem = struct.pack('>I', len(g)) + g
    nb = b[:p + 1] + struct.pack('>I', cnt + 1) + b[p + 5:q] + elem + b[q:]
    nb = set_f4(nb, stream_start(nb) + (len(nb) - len(b)))
    return nb

def swap_mod_ref(b, old_guid, new_guid):
    """Replace one meta GUID (same length -> no f4 change)."""
    o, n = old_guid.encode(), new_guid.encode()
    assert len(o) == len(n) and b.count(o) == 1, 'meta guid not unique / len mismatch'
    return b.replace(o, n)

def write(name, data):
    p = os.path.join(OUT, name + '.bwpreset'); open(p, 'wb').write(data); return p

# Polysynth Random donor (host-agnostic modulator identity), for the REPLACE test.
rand_donor, _, _ = largest_insert(f'{POLY}/mp_bare.bwpreset', f'{POLY}/mp_one_random.bwpreset')

manifest = {'dir': OUT, 'cases': []}
for h, (bare_p, one_p) in HOSTS.items():
    one = load(one_p)
    ss = stream_start(one)
    lfo_obj, j1, j2 = largest_insert(bare_p, one_p)
    host_target = route_of(lfo_obj)                     # the host's own valid param path
    insert_at = ss + j2                                 # list terminator after the LFO object

    # base (control)
    manifest['cases'].append({'key': f'{h}_base', 'path': write(f'{h}_base', one),
        'desc': f'{h} one_lfo unmodified (route {host_target})', 'expect_load': True, 'expect_page': 'LFO'})

    # add: duplicate the host's own LFO as a 2nd modulator (id 1), append meta ref, patch f4
    lfo2 = rename_slot(lfo_obj, '1')
    add_stream = one[:insert_at] + lfo2 + one[insert_at:]
    add_full = append_mod_ref(add_stream, LFO_GUID)
    manifest['cases'].append({'key': f'{h}_add', 'path': write(f'{h}_add', add_full),
        'desc': f'{h} + 2nd LFO (duplicate); ids [0,1]', 'expect_load': None, 'expect_page': 'LFO'})

    # replace: swap the LFO for a Polysynth Random donor (cross-host type-swap).
    # The donor is unrouted (mp_one_random's Random has no 0x0e3d); retarget it to
    # the host param ONLY if it already carries a route (do NOT synthesize a route
    # where none exists — E10 flagged that as the untested crash-prone edge).
    rand = rename_slot(rand_donor, '0')
    routed = b'\x00\x00\x0e\x3d\x08' in rand
    if routed:
        rand = set_route(rand, host_target)
    rep_stream = one[:ss + j1] + rand + one[ss + j2:]
    rep_full = swap_mod_ref(rep_stream, LFO_GUID, RAND_GUID)
    manifest['cases'].append({'key': f'{h}_replace', 'path': write(f'{h}_replace', rep_full),
        'desc': f'{h} LFO replaced by Polysynth Random donor'
                + (f', retargeted to {host_target}' if routed else ' (donor unrouted)'),
        'expect_load': None, 'expect_page': 'Random'})

print(json.dumps(manifest, indent=2))
