#!/usr/bin/env python3
"""Build E11f test presets: same-donor / same-TYPE repeated ADD.

The handoff framed E11f as "does adding two modulators from the SAME donor collide
their 0x2ab8 Chain GUID?". Measurement first corrected that premise: a single
modulator object embeds NO 0x2ab8 (it is device/chain-level, count fixed at 2). The
only per-object embedded ids are:
  - 0x1a1b instanceId  — must be unique (proven, E10f)
  - 0x18c6 device_guid — the TYPE identity, IDENTICAL across instances of one type,
                         and the exact source of meta referenced_modulator_ids.

So the real question: adding a second modulator of a type already present makes a
DUPLICATE 0x18c6 in the object stream AND a DUPLICATE entry in
referenced_modulator_ids. Does Bitwig accept that? If yes, addModulator needs no
"freshen" step for same-type adds. If no, the library must do something (and no
freshening of 0x18c6 is even possible — it's the type GUID; a random one would no
longer name a real modulator type).

Cases (unique 0x1a1b throughout — we are NOT re-testing the id gate):
  F0  mp_one_lfo unmodified                                  -> [LFO]
  F1  one_lfo + Random(slot1)          (control == E10f-B1)  -> [LFO, Random]
  F2  one_lfo + Random(slot1) + Random(slot2)  SAME donor    -> [LFO, Random, Random]
        referenced_modulator_ids = [LFO-guid, rand-guid, rand-guid]  (DUP entry)
  F3  one_lfo + LFO(slot1)   duplicate of the EXISTING type  -> [LFO, LFO]
        referenced_modulator_ids = [LFO-guid, LFO-guid]              (DUP entry)

Run:
  python3 tools/bwformat/build_e11f_cases.py > /tmp/e11f_manifest.json
  GN_MANIFEST=/tmp/e11f_manifest.json npx tsx src/probes/e11f-dupdonor.ts
"""
import json, os, struct, tempfile, difflib

LIB = os.path.expanduser('~/Documents/Bitwig Studio/Library/Presets/Polysynth')
OUT = tempfile.mkdtemp(prefix='gn-e11f-')

def load(name): return open(f'{LIB}/{name}.bwpreset', 'rb').read()
def stream_start(b): return int(b[16:24], 16) - 1
def set_f4(b, new_start): return b[:16] + f'{new_start+1:08x}'.encode('ascii') + b[24:]

def mod_object_via_bare_diff(variant_name):
    """Exact bytes of a single-modulator object (diff vs mp_bare); stream-relative."""
    bare = load('mp_bare'); sb = bare[stream_start(bare):]
    var = load(variant_name); sv = var[stream_start(var):]
    sm = difflib.SequenceMatcher(a=sb, b=sv, autojunk=False)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == 'insert' and (j2 - j1) > 200:
            obj = sv[j1:j2]
            assert struct.unpack_from('>I', obj, 0)[0] == 0x06c9
            assert obj[-4:] == b'\x00\x00\x00\x00'
            return obj, j1, j2
    raise RuntimeError('no object found')

def rename_slot(obj, idx_char):
    """Set both position fields (0x02b9 name string + 0x1a1b u8) to idx_char."""
    obj = bytearray(obj)
    m = obj.find(b'\x00\x00\x02\xb9\x08\x00\x00\x00\x01')
    obj[m + 9] = ord(idx_char)
    n = obj.find(b'\x00\x00\x1a\x1b\x01')
    assert n >= 0
    obj[n + 5] = int(idx_char)
    return bytes(obj)

def append_mod_ref(b, guid_hex):
    """Append a GUID to meta referenced_modulator_ids; bump count; patch f4 (+40B)."""
    def fmt(h): return f'{h[:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:]}'
    name = b'referenced_modulator_ids'
    i = b.find(name); p = i + len(name)
    assert b[p] == 0x19, 'not a str[]'
    cnt = struct.unpack_from('>I', b, p + 1)[0]
    q = p + 5
    for _ in range(cnt):
        L = struct.unpack_from('>I', b, q)[0]; q += 4 + L
    guid = fmt(guid_hex).encode()
    elem = struct.pack('>I', len(guid)) + guid
    nb = b[:p + 1] + struct.pack('>I', cnt + 1) + b[p + 5:q] + elem + b[q:]
    added = len(nb) - len(b)
    nb = set_f4(nb, stream_start(nb) + added)
    return nb, added

def write(name, data):
    path = os.path.join(OUT, name + '.bwpreset')
    open(path, 'wb').write(data)
    return path

LFO_GUID = 'ad947004f1d340a1bd153ec721ee7c65'
RAND_GUID = 'bf29a7b091dc48518a94c63f358f3cda'

one_lfo = load('mp_one_lfo')
ss = stream_start(one_lfo)
_, lstart, lend = mod_object_via_bare_diff('mp_one_lfo')
insert_at = ss + lend                       # absolute offset of the list terminator
rand_obj, _, _ = mod_object_via_bare_diff('mp_one_random')
lfo_obj, _, _ = mod_object_via_bare_diff('mp_one_lfo')

manifest = {'dir': OUT, 'cases': []}

# F0 baseline
manifest['cases'].append({'key': 'F0_baseline', 'path': write('F0_baseline', one_lfo),
    'desc': 'mp_one_lfo unmodified', 'expect_load': True, 'expect_page': 'LFO'})

# F1 control: add Random once (== E10f-B1)
r1 = rename_slot(rand_obj, '1')
f1s = one_lfo[:insert_at] + r1 + one_lfo[insert_at:]
f1, _ = append_mod_ref(f1s, RAND_GUID)
manifest['cases'].append({'key': 'F1_add_random_once', 'path': write('F1_add_random_once', f1),
    'desc': 'ADD Random once (control, == E10f-B1)', 'expect_load': None, 'expect_page': 'Random'})

# F2 the test: add the SAME Random donor twice -> duplicate 0x18c6 + duplicate meta ref
r1 = rename_slot(rand_obj, '1'); r2 = rename_slot(rand_obj, '2')
f2s = one_lfo[:insert_at] + r1 + r2 + one_lfo[insert_at:]
f2, _ = append_mod_ref(f2s, RAND_GUID)
f2, _ = append_mod_ref(f2, RAND_GUID)
manifest['cases'].append({'key': 'F2_add_random_twice', 'path': write('F2_add_random_twice', f2),
    'desc': 'ADD Random TWICE (same donor): dup 0x18c6 + dup referenced_modulator_ids; ids [0,1,2]',
    'expect_load': None, 'expect_page': 'Random'})

# F3 the test: add a second LFO (duplicate of the type ALREADY present)
l1 = rename_slot(lfo_obj, '1')
f3s = one_lfo[:insert_at] + l1 + one_lfo[insert_at:]
f3, _ = append_mod_ref(f3s, LFO_GUID)
manifest['cases'].append({'key': 'F3_add_lfo_dup', 'path': write('F3_add_lfo_dup', f3),
    'desc': 'ADD a 2nd LFO (dup of existing type): dup 0x18c6 + dup referenced_modulator_ids; ids [0,1]',
    'expect_load': None, 'expect_page': 'LFO'})

print(json.dumps(manifest, indent=2))
