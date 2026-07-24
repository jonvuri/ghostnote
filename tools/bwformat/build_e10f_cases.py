#!/usr/bin/env python3
"""Build E10f test presets: (A) category-vs-position confound, (B) the ADD test.
Writes files to a temp dir and prints a JSON manifest for the TS probe.

SUPERSEDED for production use by `brain/src/bwmod/` (E13, DECISIONS D3): the
surgery primitives below were the PORT SOURCE for that library, which now does
add/replace/delete/retarget with the sentinel, f4, f6 and Tier-2 stub rules
enforced and tested. This script is kept VERBATIM on purpose — it is the record
FINDINGS E10f cites, and `brain/src/bwmod/oracle.test.ts` re-runs these same
primitives as a byte-for-byte oracle against the TS port. Do not "modernise" it;
write new surgery against bwmod instead.
"""
import json, os, re, struct, sys, tempfile

LIB = os.path.expanduser('~/Documents/Bitwig Studio/Library/Presets/Polysynth')
OUT = tempfile.mkdtemp(prefix='gn-e10f-')

def load(name): return open(f'{LIB}/{name}.bwpreset', 'rb').read()

def stream_start(b): return int(b[16:24], 16) - 1

def set_f4(b, new_start):
    """f4 stores (stream_start + 1) as 8-hex-digit ASCII at bytes [16:24]."""
    return b[:16] + f'{new_start+1:08x}'.encode('ascii') + b[24:]

def find_mods(b):
    marker = b'\x00\x00\x02\xb9\x08\x00\x00\x00\x01'
    starts = []
    i = b.find(marker)
    while i != -1:
        ch = b[i + len(marker)]
        if 0x30 <= ch <= 0x39:
            starts.append((i - 4, chr(ch)))
        i = b.find(marker, i + 1)
    return starts

def mod_object_via_bare_diff(variant_name):
    """Extract a single-modulator object's exact bytes using a diff vs mp_bare
    (the inserted span IS the object — verified to start 0x06c9, end 00000000)."""
    import difflib
    bare = load('mp_bare'); sb = bare[stream_start(bare):]
    var = load(variant_name); sv = var[stream_start(var):]
    sm = difflib.SequenceMatcher(a=sb, b=sv, autojunk=False)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == 'insert' and (j2 - j1) > 200:
            obj = sv[j1:j2]
            assert struct.unpack_from('>I', obj, 0)[0] == 0x06c9, 'not a modulator object'
            assert obj[-4:] == b'\x00\x00\x00\x00', 'object does not end on a terminator'
            return obj, j1, j2   # obj bytes, stream-relative start, end
    raise RuntimeError('no object found')

def rename_slot(obj, idx_char, fix_index=True):
    """Relocate a modulator object to slot `idx_char`. A modulator encodes its
    position TWICE: the 0x02b9 name STRING ("0"/"1"/…) and the 0x1a1b u8 numeric
    index. Both must agree or Bitwig rejects the whole preset (the bug behind
    E10c/E10e-R3/E10f-B1). fix_index=False updates only the name, to demonstrate
    that the 0x1a1b field is the load-bearing one."""
    obj = bytearray(obj)
    m = obj.find(b'\x00\x00\x02\xb9\x08\x00\x00\x00\x01')
    obj[m + 9] = ord(idx_char)
    if fix_index:
        n = obj.find(b'\x00\x00\x1a\x1b\x01')       # field 0x1a1b, u8
        assert n >= 0, 'no 0x1a1b slot-index field'
        obj[n + 5] = int(idx_char)
    return bytes(obj)

def ascii_guid_replace(b, old_hex, new_hex):
    def fmt(h): return f'{h[:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:]}'
    o, n = fmt(old_hex).encode(), fmt(new_hex).encode()
    assert b.count(o) == 1, f'{o} occurs {b.count(o)} times'
    return b.replace(o, n)

def append_mod_ref(b, guid_hex):
    """Append a GUID to meta referenced_modulator_ids (str[]); bump count; +40 bytes."""
    def fmt(h): return f'{h[:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:]}'
    name = b'referenced_modulator_ids'
    i = b.find(name); p = i + len(name)
    assert b[p] == 0x19, 'not a str[]'
    cnt = struct.unpack_from('>I', b, p + 1)[0]
    q = p + 5
    for _ in range(cnt):
        L = struct.unpack_from('>I', b, q)[0]; q += 4 + L
    guid = fmt(guid_hex).encode()
    elem = struct.pack('>I', len(guid)) + guid           # +4 +36 = 40 bytes
    nb = b[:p + 1] + struct.pack('>I', cnt + 1) + b[p + 5:q] + elem + b[q:]
    added = len(nb) - len(b)
    nb = set_f4(nb, stream_start(nb) + added)             # meta grew -> shift stream ptr
    return nb, added

def write(name, data):
    path = os.path.join(OUT, name + '.bwpreset')
    open(path, 'wb').write(data)
    return path

GUIDS = {'classic_lfo': '39f4b13629464ac5b34ce5fde1e58fd8',
         'random': 'bf29a7b091dc48518a94c63f358f3cda',
         'expressions': 'dcacb71b0f1a44938916bd460eee71d5'}

manifest = {'dir': OUT, 'cases': []}

# ---- Classic LFO donor object (modzoo slot 0, exact bounds [6013,6592)) ----
mz = load('mp_bare')  # placeholder to keep style; real donor from modzoo below
modzoo = open(os.path.expanduser('~/Documents/Bitwig Studio/Library/Presets/Polysynth/modzoo.bwpreset'), 'rb').read()
clfo_obj = modzoo[6013:6592]
assert struct.unpack_from('>I', clfo_obj, 0)[0] == 0x06c9

# =====================================================================
# PHASE A — category vs position. note_first: Expressions(Note,slot0) + LFO(LFO,slot1)
# =====================================================================
nf = load('mp_note_first')
mods = find_mods(nf)
expr = [(s, ix) for s, ix in mods if ix == '0'][0]
# bounds of slot-0 Expressions: [start, next-start)
expr_start = mods[0][0]; expr_end = mods[1][0]
assert nf[expr_start:expr_end].__len__() == 459

# A0 baseline
manifest['cases'].append({'key': 'A0_baseline', 'path': write('A0_baseline', nf),
    'desc': 'note_first unmodified', 'expect_load': True, 'expect_page': None})

# A1 cross-category at SLOT 0: replace Expressions(Note) with Classic LFO(LFO)
donor = rename_slot(clfo_obj, '0')                        # keep slot 0
spliced = nf[:expr_start] + donor + nf[expr_end:]
spliced = ascii_guid_replace(spliced, GUIDS['expressions'], GUIDS['classic_lfo'])
manifest['cases'].append({'key': 'A1_crosscat_slot0', 'path': write('A1_crosscat_slot0', spliced),
    'desc': 'replace Expressions(Note-driven, SLOT 0) with Classic LFO(LFO)',
    'expect_load': None, 'expect_page': 'Classic LFO'})

# =====================================================================
# PHASE B — the ADD test. one_lfo (LFO at slot 0) -> add Random at slot 1
# =====================================================================
one_lfo = load('mp_one_lfo')
ss = stream_start(one_lfo)
lfo_obj, lstart, lend = mod_object_via_bare_diff('mp_one_lfo')   # stream-relative
# list terminator sits right after the LFO object -> insert new object there
insert_at = ss + lend
rand_obj, _, _ = mod_object_via_bare_diff('mp_one_random')
# NB: do NOT pre-rename rand_obj here — B1 and B1n each apply their own
# rename so B1n is a genuine no-fix control (a stale pre-rename here silently
# gave B1n a unique 0x1a1b and broke the control).

# B0 baseline
manifest['cases'].append({'key': 'B0_baseline', 'path': write('B0_baseline', one_lfo),
    'desc': 'one_lfo unmodified (LFO only)', 'expect_load': True, 'expect_page': 'LFO'})

# B1 ADD (with the 0x1a1b fix): insert Random as slot 1 + append meta ref + patch f4
rand_slot1 = rename_slot(rand_obj, '1')                          # name + 0x1a1b -> 1
added_stream = one_lfo[:insert_at] + rand_slot1 + one_lfo[insert_at:]
added_full, delta = append_mod_ref(added_stream, GUIDS['random'])
manifest['cases'].append({'key': 'B1_add_random', 'path': write('B1_add_random', added_full),
    'desc': f'ADD Random(LFO) as 2nd modulator, BOTH position fields fixed (+{len(rand_obj)}B obj, +{delta}B meta)',
    'expect_load': None, 'expect_page': 'Random'})

# B1n NO-FIX control: same add, but only the name string set to "1" (0x1a1b left 0)
rand_slot1_nofix = rename_slot(rand_obj, '1', fix_index=False)
added_nofix = one_lfo[:insert_at] + rand_slot1_nofix + one_lfo[insert_at:]
added_nofix, _ = append_mod_ref(added_nofix, GUIDS['random'])
manifest['cases'].append({'key': 'B1n_add_nofix', 'path': write('B1n_add_nofix', added_nofix),
    'desc': 'SAME add but ONLY the name string fixed (0x1a1b left at 0) — the control',
    'expect_load': None, 'expect_page': 'Random'})

# =====================================================================
# PHASE C — direct re-test of E10e-R3 (replace modtest SLOT 1) WITH the fix
# =====================================================================
modtest = open(os.path.expanduser('~/Documents/Bitwig Studio/Library/Presets/Polysynth/modtest.bwpreset'), 'rb').read()
mt_mods = find_mods(modtest)
# slot 1 is Expressions: [start,next-start)
mt_expr_start = mt_mods[1][0]; mt_expr_end = mt_mods[2][0]
GUIDS['mt_expr'] = 'dcacb71b0f1a44938916bd460eee71d5'
# C1: replace slot 1 with Classic LFO, position fields -> 1 (the R3 case, now fixed)
donor_c1 = rename_slot(clfo_obj, '1')
c1 = modtest[:mt_expr_start] + donor_c1 + modtest[mt_expr_end:]
c1 = ascii_guid_replace(c1, GUIDS['mt_expr'], GUIDS['classic_lfo'])
manifest['cases'].append({'key': 'C1_replace_slot1_fixed', 'path': write('C1_replace_slot1_fixed', c1),
    'desc': 'E10e-R3 re-test: replace modtest SLOT 1 with Classic LFO, 0x1a1b fixed',
    'expect_load': None, 'expect_page': 'Classic LFO'})
# C1n: E10e-R3 EXACT repro — replace slot 1, name only, 0x1a1b left at 0
donor_c1n = rename_slot(clfo_obj, '1', fix_index=False)
c1n = modtest[:mt_expr_start] + donor_c1n + modtest[mt_expr_end:]
c1n = ascii_guid_replace(c1n, GUIDS['mt_expr'], GUIDS['classic_lfo'])
manifest['cases'].append({'key': 'C1n_replace_slot1_nofix', 'path': write('C1n_replace_slot1_nofix', c1n),
    'desc': 'E10e-R3 EXACT repro: replace modtest SLOT 1, 0x1a1b left at 0',
    'expect_load': None, 'expect_page': 'Classic LFO'})

# M1: modtest UNCHANGED except slot-1's 0x1a1b flipped 1 -> 0 (a single byte).
# Isolates whether Bitwig VALIDATES the 0x1a1b slot index on load. modtest's
# indices become [0,0,2] (duplicate 0, gap at 1). Nothing else differs.
mt_slot1_start = mt_mods[1][0]; mt_slot1_end = mt_mods[2][0]
m1 = bytearray(modtest)
n = m1.find(b'\x00\x00\x1a\x1b\x01', mt_slot1_start, mt_slot1_end)
assert n >= 0 and m1[n + 5] == 1, f'slot1 0x1a1b not 1 (got {m1[n+5] if n>=0 else "absent"})'
m1[n + 5] = 0
manifest['cases'].append({'key': 'M1_index_dup', 'path': write('M1_index_dup', bytes(m1)),
    'desc': 'modtest with ONLY slot1 0x1a1b 1->0 (indices become [0,0,2]); one byte',
    'expect_load': None, 'expect_page': None})

# C0 baseline
manifest['cases'].append({'key': 'C0_baseline', 'path': write('C0_baseline', modtest),
    'desc': 'modtest unmodified', 'expect_load': True, 'expect_page': None})

print(json.dumps(manifest, indent=2))
