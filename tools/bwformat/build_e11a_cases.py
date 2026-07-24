#!/usr/bin/env python3
"""Build E11a test presets: is 0x1a1b UNIQUENESS enough, or must ids be CONTIGUOUS?

modtest loads with modulator instance ids [0,1,2] (name string == id in every
passing case so far). This edits the three modulators' 0x1a1b u8 AND their 0x02b9
name digit TOGETHER (kept equal, so we are NOT also testing the E11b name/id
question) to non-contiguous unique sets, and loads each:

  C0  [0,1,2]  unmodified                       -> control, must load
  A_sparse [0,1,5]  unique, a gap at 2..4
  A_high   [9,4,7]  unique, none zero, sparse
  A_perm   [2,0,1]  the set {0,1,2} but permuted across physical slots

If A_sparse / A_high LOAD  -> uniqueness alone suffices; ids may be sparse, so
  bwmod may reuse a freed id and delete need not renumber.
If they REJECT but A_perm loads -> the id SET must be contiguous {0..n-1}.

Run:
  python3 tools/bwformat/build_e11a_cases.py > /tmp/e11a_manifest.json
  GN_MANIFEST=/tmp/e11a_manifest.json npx tsx src/probes/e11-load.ts
"""
import json, os, struct, tempfile

LIB = os.path.expanduser('~/Documents/Bitwig Studio/Library/Presets/Polysynth')
OUT = tempfile.mkdtemp(prefix='gn-e11a-')
modtest = open(f'{LIB}/modtest.bwpreset', 'rb').read()

NAME_MARKER = b'\x00\x00\x02\xb9\x08\x00\x00\x00\x01'   # field 0x02b9, str, len 1
ID_MARKER = b'\x00\x00\x1a\x1b\x01'                     # field 0x1a1b, u8

def modulator_markers(b):
    """Return, per modulator (in physical order), (name_byte_off, id_byte_off)."""
    out = []
    i = b.find(NAME_MARKER)
    while i != -1:
        name_off = i + len(NAME_MARKER)          # the single ASCII digit
        if 0x30 <= b[name_off] <= 0x39:
            n = b.find(ID_MARKER, i)              # nearest 0x1a1b after this name
            assert n != -1, 'no 0x1a1b after name'
            out.append((name_off, n + 5))
        i = b.find(NAME_MARKER, i + 1)
    return out

markers = modulator_markers(modtest)
assert len(markers) == 3, f'expected 3 modulators, got {len(markers)}'
# sanity: current ids/names are [0,1,2]
for slot, (noff, ioff) in enumerate(markers):
    assert modtest[noff] == ord(str(slot)) and modtest[ioff] == slot, \
        f'slot {slot}: name={chr(modtest[noff])} id={modtest[ioff]}'

def make(ids):
    b = bytearray(modtest)
    for slot, (noff, ioff) in enumerate(markers):
        b[noff] = ord(str(ids[slot]))            # 0x02b9 name digit
        b[ioff] = ids[slot]                      # 0x1a1b u8
    return bytes(b)

def write(name, data):
    p = os.path.join(OUT, name + '.bwpreset'); open(p, 'wb').write(data); return p

manifest = {'dir': OUT, 'cases': []}
manifest['cases'].append({'key': 'C0_contiguous', 'path': write('C0_contiguous', modtest),
    'desc': 'modtest unmodified, ids [0,1,2]', 'expect_load': True, 'expect_page': None})
for key, ids, desc in [
    ('A_sparse', [0, 1, 5], 'unique but sparse: ids [0,1,5]'),
    ('A_high', [9, 4, 7], 'unique, none zero, sparse: ids [9,4,7]'),
    ('A_perm', [2, 0, 1], 'set {0,1,2} permuted across slots: ids [2,0,1]'),
]:
    manifest['cases'].append({'key': key, 'path': write(key, make(ids)),
        'desc': desc, 'expect_load': None, 'expect_page': None})

print(json.dumps(manifest, indent=2))
