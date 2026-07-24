#!/usr/bin/env python3
"""E11i control: does Zebra3 reject a WITHIN-OBJECT retarget (no modulator-count
change, no meta/f4 change), or only modulator-SET edits (add/replace/delete)?

If retarget_same (a same-length in-place route byte-swap — zero size change, zero
f4/meta/f6 change) LOADS while add/delete REJECT, the reject is specifically
modulator-topology mirroring in the plugin state. If even retarget_same REJECTS,
the plugin validates its whole object stream against embedded state (a stronger
wall). retarget_len additionally shifts the stream (length change) without touching
meta/f4/f6, to separate "any size change" from "count change".

Run:
  python3 tools/bwformat/build_e11i_retarget.py > /tmp/e11ir.json
  GN_MANIFEST=/tmp/e11ir.json npx tsx src/probes/e11-load.ts
"""
import json, os, struct, tempfile

ZEB = os.path.expanduser('~/Documents/Bitwig Studio/Library/Presets/Zebra3')
OUT = tempfile.mkdtemp(prefix='gn-e11ir-')
HOSTS = {'zclap': f'{ZEB}/gn_zebra3clap_one_lfo.bwpreset',
         'zvst':  f'{ZEB}/gn_zebra3vst_one_lfo.bwpreset'}


def set_f4(b, new_start): return b[:16] + f'{new_start+1:08x}'.encode('ascii') + b[24:]
def stream_start(b): return int(b[16:24], 16) - 1


def retarget(b, new_target):
    """Rewrite the single 0x0e3d route string; return new buffer (f4 untouched:
    the route lives in the OBJECT stream, not meta)."""
    fb = b'\x00\x00\x0e\x3d\x08'
    i = b.find(fb); assert i >= 0 and b.find(fb, i + 1) == -1, 'route not unique'
    L = struct.unpack_from('>I', b, i + 5)[0]
    nt = new_target.encode()
    return b[:i + 5] + struct.pack('>I', len(nt)) + nt + b[i + 9 + L:]


def route_of(b):
    fb = b'\x00\x00\x0e\x3d\x08'; i = b.find(fb)
    L = struct.unpack_from('>I', b, i + 5)[0]
    return b[i + 9:i + 9 + L].decode()


def write(name, data):
    p = os.path.join(OUT, name + '.bwpreset'); open(p, 'wb').write(data); return p


manifest = {'dir': OUT, 'cases': []}
for h, one_p in HOSTS.items():
    one = open(one_p, 'rb').read()
    cur = route_of(one)                                 # CONTENTS/ROOT_GENERIC_MODULE/PID411
    # same-length swap: last hex digit 1 -> 2 (PID411 -> PID412). Zero size change.
    same = retarget(one, cur[:-1] + '2')
    assert len(same) == len(one), 'same-length retarget changed size'
    manifest['cases'].append({'key': f'{h}_base', 'path': write(f'{h}_base', one),
        'desc': f'{h} one_lfo unmodified (control)', 'expect_load': True, 'expect_page': 'LFO'})
    manifest['cases'].append({'key': f'{h}_retarget_same', 'path': write(f'{h}_retarget_same', same),
        'desc': f'{h} route {cur}->{cur[:-1]}2 (same length; zero size/meta/f4 change)',
        'expect_load': None, 'expect_page': 'LFO'})
    # length-changing retarget: shifts the object stream after the string, but still
    # NO meta/f4 change (route is in the object stream). Short target.
    lenc = retarget(one, 'CUTOFF')
    assert len(lenc) != len(one), 'expected size change'
    manifest['cases'].append({'key': f'{h}_retarget_len', 'path': write(f'{h}_retarget_len', lenc),
        'desc': f'{h} route {cur}->CUTOFF (length change, stream shift, no meta/f4 change)',
        'expect_load': None, 'expect_page': 'LFO'})

print(json.dumps(manifest, indent=2))
