#!/usr/bin/env python3
"""Build E11i test presets: does modulator surgery hold on a VST3 host, and does
it differ from the SAME plugin as CLAP?

The user has Zebra 3 (u-he) installed as BOTH clap and vst3, and authored a
minimal bare/one_lfo pair for each format (all in Presets/Zebra3/). This gives a
clean CLAP-vs-VST3 control on the *same* plugin — the E11i question is whether a
VST3's opaque embedded state chunk mirrors modulator state (like the sample did in
E11d-2, blocking new-type introduction), or whether the plain recipe holds as it
did for the CLAP Repro-5.

Note (observed in the bare->one_lfo diff): Zebra 3 carries a NON-ZERO header f6
that CHANGES when a modulator is added, plus scattered device-body byte changes —
the fingerprint of an embedded state blob. So this host is the prime suspect. The
behavioural load test below is the actual verdict; if a case rejects, diff
bare<->one_lfo for a mirrored count field (the E11d-2 method).

Per host (clap, vst), five cases — modelled on build_e11d_cases.py. We always work
from one_lfo and never reconstruct from bare (the bare->one diff also churns the
plugin-state blob, E11d):
  <h>_base     one_lfo unmodified                               (control, must load)
  <h>_add      + a 2nd LFO (its OWN LFO object duplicated)      -> same-type add
  <h>_addnew   + a Polysynth Random donor (a NEW type)          -> TYPE INTRODUCTION
  <h>_replace  LFO replaced by a Polysynth Random donor         -> type swap
  <h>_delete   the LFO removed (object + meta ref)              -> delete

Run:
  python3 tools/bwformat/build_e11i_cases.py > /tmp/e11i_manifest.json
  GN_MANIFEST=/tmp/e11i_manifest.json GN_DIVERGE=1 npx tsx src/probes/e11-load.ts
"""
import json, os, struct, tempfile, difflib

BASE = os.path.expanduser('~/Documents/Bitwig Studio/Library/Presets')
POLY = f'{BASE}/Polysynth'
ZEB = f'{BASE}/Zebra3'
OUT = tempfile.mkdtemp(prefix='gn-e11i-')

HOSTS = {
    'zclap': (f'{ZEB}/gn_zebra3clap_bare.bwpreset', f'{ZEB}/gn_zebra3clap_one_lfo.bwpreset'),
    'zvst':  (f'{ZEB}/gn_zebra3vst_bare.bwpreset',  f'{ZEB}/gn_zebra3vst_one_lfo.bwpreset'),
}
LFO_GUID = 'ad947004-f1d3-40a1-bd15-3ec721ee7c65'
RAND_GUID = 'bf29a7b0-91dc-4851-8a94-c63f358f3cda'


def load(p): return open(p, 'rb').read()
def stream_start(b): return int(b[16:24], 16) - 1
def set_f4(b, new_start): return b[:16] + f'{new_start+1:08x}'.encode('ascii') + b[24:]


def modulator_object(bare_p, one_p):
    """Extract the single newly-added modulator object's exact stream-relative
    bounds (obj, j1, j2).

    Two hazards make the naive "largest bare->one insert" wrong:
      - churny hosts (Zebra3): the LARGEST insert is plugin-state-blob growth
        (E11i: +1773B on CLAP when one modulator is added), not the object;
      - native hosts (Polysynth): several single-digit 0x02b9 markers exist in
        shared regions (macro/param names), so a bare name-marker search is ambiguous.
    Robust rule: the object's 0x02b9 single-digit name marker is the UNIQUE one
    that (a) has a 0x06c9 classId 4 bytes before it AND (b) lies inside a bare->one
    INSERT block. Its object end is that insert block's end (the shared list
    terminator after the object realigns difflib exactly there)."""
    bare = load(bare_p); sb = bare[stream_start(bare):]
    one = load(one_p); sv = one[stream_start(one):]
    marker = b'\x00\x00\x02\xb9\x08\x00\x00\x00\x01'
    inserts = [(k1, k2) for tag, i1, i2, k1, k2 in
               difflib.SequenceMatcher(a=sb, b=sv, autojunk=False).get_opcodes()
               if tag == 'insert']
    hits = []
    nm = sv.find(marker)
    while nm != -1:
        if struct.unpack_from('>I', sv, nm - 4)[0] == 0x06c9:
            span = next(((k1, k2) for k1, k2 in inserts if k1 <= nm < k2), None)
            if span is not None:
                hits.append((nm - 4, span[1]))
        nm = sv.find(marker, nm + 1)
    assert len(hits) == 1, f'expected 1 newly-inserted modulator object, found {len(hits)}'
    j1, j2 = hits[0]
    # E11h: the 0x1a46 list ends with an empty cls-0x0003 SENTINEL object
    # (00 00 00 03 00 00 00 00). difflib's insert end can land a couple bytes INTO
    # that sentinel (the object's trailing 00s alias the sentinel's leading 00s),
    # which corrupts it and rejects the whole preset (the phantom "Zebra wall").
    # Snap j2 to the sentinel start so the object ends exactly at its terminator.
    SENT = b'\x00\x00\x00\x03\x00\x00\x00\x00'
    snap = sv.find(SENT, j2 - 8, j2 + 8)
    assert snap != -1, f'no list sentinel near difflib end {j2:#x}'
    j2 = snap
    obj = sv[j1:j2]
    assert obj[-4:] == b'\x00\x00\x00\x00', f'object does not end on a terminator (ends {obj[-4:].hex()})'
    return obj, j1, j2


def rename_slot(obj, idx_char):
    obj = bytearray(obj)
    m = obj.find(b'\x00\x00\x02\xb9\x08\x00\x00\x00\x01'); obj[m + 9] = ord(idx_char)
    n = obj.find(b'\x00\x00\x1a\x1b\x01'); assert n >= 0; obj[n + 5] = int(idx_char)
    return bytes(obj)


def route_of(obj):
    fb = b'\x00\x00\x0e\x3d\x08'; i = obj.find(fb)
    if i < 0: return None
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
    return set_f4(nb, stream_start(nb) + (len(nb) - len(b)))


def remove_mod_ref(b, guid):
    """Remove ONE matching GUID from referenced_modulator_ids; decrement count; f4."""
    name = b'referenced_modulator_ids'; i = b.find(name); p = i + len(name)
    assert b[p] == 0x19
    cnt = struct.unpack_from('>I', b, p + 1)[0]; q = p + 5
    target = guid.encode()
    for _ in range(cnt):
        L = struct.unpack_from('>I', b, q)[0]
        if b[q + 4:q + 4 + L] == target:
            nb = b[:p + 1] + struct.pack('>I', cnt - 1) + b[p + 5:q] + b[q + 4 + L:]
            return set_f4(nb, stream_start(nb) + (len(nb) - len(b)))
        q += 4 + L
    raise RuntimeError(f'{guid} not in referenced_modulator_ids')


def swap_mod_ref(b, old_guid, new_guid):
    o, n = old_guid.encode(), new_guid.encode()
    assert len(o) == len(n) and b.count(o) == 1, 'meta guid not unique / len mismatch'
    return b.replace(o, n)


def write(name, data):
    p = os.path.join(OUT, name + '.bwpreset'); open(p, 'wb').write(data); return p


# Polysynth Random donor (host-agnostic modulator identity), unrouted — for the
# NEW-TYPE and REPLACE tests (do NOT synthesize a route where none exists, E10).
rand_donor, _, _ = modulator_object(f'{POLY}/mp_bare.bwpreset', f'{POLY}/mp_one_random.bwpreset')
assert route_of(rand_donor) is None, 'expected the Polysynth Random donor to be unrouted'

manifest = {'dir': OUT, 'cases': []}
for h, (bare_p, one_p) in HOSTS.items():
    one = load(one_p)
    ss = stream_start(one)
    lfo_obj, j1, j2 = modulator_object(bare_p, one_p)
    host_target = route_of(lfo_obj)                     # the host's own valid LFO route path
    obj_start, obj_end = ss + j1, ss + j2               # absolute bounds of the LFO object
    insert_at = obj_end                                 # list terminator sits right after it

    # base (control)
    manifest['cases'].append({'key': f'{h}_base', 'path': write(f'{h}_base', one),
        'desc': f'{h} one_lfo unmodified (route {host_target})',
        'expect_load': True, 'expect_page': 'LFO'})

    # add: duplicate the host's own LFO as a 2nd modulator (id 1) -> same-type add
    lfo2 = rename_slot(lfo_obj, '1')
    add_full = append_mod_ref(one[:insert_at] + lfo2 + one[insert_at:], LFO_GUID)
    manifest['cases'].append({'key': f'{h}_add', 'path': write(f'{h}_add', add_full),
        'desc': f'{h} + 2nd LFO (same type, duplicate); ids [0,1]',
        'expect_load': None, 'expect_page': 'LFO'})

    # addnew: introduce a Polysynth Random (a type NOT present) -> TYPE INTRODUCTION
    rand1 = rename_slot(rand_donor, '1')
    addnew_full = append_mod_ref(one[:insert_at] + rand1 + one[insert_at:], RAND_GUID)
    manifest['cases'].append({'key': f'{h}_addnew', 'path': write(f'{h}_addnew', addnew_full),
        'desc': f'{h} + Random (a NEW type, unrouted); ids [0,1] — the sample-blocked op',
        'expect_load': None, 'expect_page': 'Random'})

    # replace: swap the LFO for a Polysynth Random donor (cross-host type-swap)
    rand0 = rename_slot(rand_donor, '0')
    rep_full = swap_mod_ref(one[:obj_start] + rand0 + one[obj_end:], LFO_GUID, RAND_GUID)
    manifest['cases'].append({'key': f'{h}_replace', 'path': write(f'{h}_replace', rep_full),
        'desc': f'{h} LFO replaced by Polysynth Random donor (unrouted)',
        'expect_load': None, 'expect_page': 'Random'})

    # delete: remove the LFO object + its meta ref -> 0 modulators
    del_full = remove_mod_ref(one[:obj_start] + one[obj_end:], LFO_GUID)
    manifest['cases'].append({'key': f'{h}_delete', 'path': write(f'{h}_delete', del_full),
        'desc': f'{h} LFO deleted (object + meta ref); 0 modulators',
        'expect_load': None, 'expect_page': None})

print(json.dumps(manifest, indent=2))
