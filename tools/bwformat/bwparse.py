#!/usr/bin/env python3
"""
Reader for Bitwig's `BtWg` container — enough of it to inspect and safely edit
preset topology (E10, ghostnote spike).

USAGE
    python3 bwparse.py <file.bwpreset>            # dump the object tree
    python3 bwparse.py <file.bwpreset> --header   # header fields only
    python3 bwparse.py <file.bwpreset> --strings  # length-prefixed strings + offsets

CONTAINER
    [0:4]   'BtWg'
    [4:8]   container version   ASCII hex   ('0003' on Bitwig 6.x)
    [8:12]  ENCODING            ASCII hex   '0002' = plain | '0004' = opaque
    [12:16] writer version
    [16:24] f4 -> ABSOLUTE OFFSET of the object-stream root marker, +1
    [24:32] f5
    [32:40] f6
    [40:42] '00'

    Verified across all 361 BtWg files shipped with / written by Bitwig 6.0.6:
    the encoding field alone predicts readability, and it is per file TYPE:

      .bwpreset / .bwclip / .bwproject   '0002'  plain, parseable (167 files)
      .bwdevice / .bwmodulator           '0004'  opaque           (194 files)

    '0004' is NOT any standard compression: a brute-force zlib/raw-deflate/gzip
    scan at every offset yields nothing, and there is no lzma/xz/zstd/lz4 magic
    anywhere in the payload. Do not spend time on it — those files hold Bitwig's
    proprietary DSP device implementations. zezic/bitwig-device-hacks could patch
    them only because Bitwig 1.x wrote '0001'/plain; that era is over.

    The interesting content — modulator INSTANCES and their ROUTING — lives in
    `.bwpreset`, which is plain.

GRAMMAR (object stream)
    stream := u8(0x0a) u32 rootClassId field* u32(0)
    object := u32 classId field* u32(0)
    field  := u32 fieldId u8 type value
    types  := 0x01 u8 | 0x03 u32 | 0x05 bool | 0x07 f64 | 0x08 str
              0x09 object | 0x12 list | 0x15 guid16 | 0x19 str[]
    str    := u32 byteLen bytes          # length-prefixed, NOT nul-terminated

    Field ids are numeric keys into an internal schema. That schema is not
    recoverable by inspection (bitwig.jar is obfuscated across ~17k classes and
    carries no plaintext field names; the native engine has none either), so ids
    are reported raw. The ones that matter are named in FIELDS below.

    IMPORTANT — the u32 after a 0x09/0x12 type byte is a classId, NOT a byte
    length. E10b proved this behaviourally: inserting and removing bytes inside
    an object shifts everything after it and Bitwig still loads the file with the
    edit honoured. So a length-changing edit needs NO enclosing fixups — only the
    edited string's own u32 prefix. Nothing in the container encodes an absolute
    offset or a span that a later edit could invalidate, and the meta
    `revision_id` hash is not validated.

KNOWN LIMITATION
    Dumping stops partway through most files. After an object's terminator the
    next u32 is ambiguous — it is either the next list item's classId or the
    parent's next field id, and both are non-zero. The real decoder resolves this
    from the schema (it knows a given field holds a list of class X); without the
    schema a reader cannot. A backtracking parser would likely get past it.

    This does NOT limit targeted editing, which is what the spike needs: locating
    a length-prefixed string and rewriting it (see --strings) never requires a
    complete parse.
"""
import struct
import sys

# Field ids observed to be stable and meaningful. Everything else is raw.
FIELDS = {
    0x009a: 'device_name',
    0x009b: 'device_creator',
    0x009c: 'device_category',
    0x009e: 'creator',
    0x02b9: 'name',
    0x0124: 'range_lo',
    0x0125: 'range_hi',
    0x0136: 'value',
    0x0e32: 'amount',
    0x0e3d: 'ROUTING_TARGET',   # e.g. 'CONTENTS/F1FREQ' — editable (E10/E10b)
    0x12de: 'preset_name',
    0x18c6: 'device_guid',      # 16-byte identity; substitutable (E4g)
    0x1a46: 'modulator_list',
}


class Reader:
    def __init__(self, b, p=0):
        self.b, self.p = b, p

    def u8(self):
        v = self.b[self.p]; self.p += 1; return v

    def u32(self):
        v = struct.unpack_from('>I', self.b, self.p)[0]; self.p += 4; return v

    def peek32(self):
        return struct.unpack_from('>I', self.b, self.p)[0]

    def f64(self):
        v = struct.unpack_from('>d', self.b, self.p)[0]; self.p += 8; return v

    def raw(self, n):
        v = self.b[self.p:self.p + n]; self.p += n; return v

    def string(self):
        return self.raw(self.u32()).decode('utf-8', 'replace')


def parse_header(b):
    if b[:4] != b'BtWg':
        raise ValueError('not a BtWg file')
    h = b[:42].decode('ascii')
    return {
        'container': h[4:8],
        'encoding': h[8:12],
        'encoding_meaning': {'0002': 'plain', '0004': 'opaque'}.get(h[8:12], '?'),
        'writer': h[12:16],
        'f4_stream_ptr': int(h[16:24], 16),
        'f5': h[24:32],
        'f6': h[32:40],
    }


def fmt_guid(g):
    h = g.hex()
    return f'{h[0:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}'


def label(fid):
    n = FIELDS.get(fid)
    return f'{fid:#06x}' + (f' {n}' if n else '')


class Dumper:
    def __init__(self, b, start):
        self.r = Reader(b, start)
        self.out = []

    def emit(self, s):
        self.out.append(s)

    def object(self, depth, tag=''):
        cls = self.r.u32()
        self.emit('  ' * depth + f'<cls {cls:#06x}>{tag} {{')
        self.fields(depth + 1)
        self.emit('  ' * depth + '}')

    def fields(self, depth):
        pad = '  ' * depth
        while True:
            fid = self.r.u32()
            if fid == 0:
                return
            t = self.r.u8()
            if t == 0x01:
                self.emit(f'{pad}{label(fid)} u8   = {self.r.u8()}')
            elif t == 0x03:
                self.emit(f'{pad}{label(fid)} u32  = {self.r.u32()}')
            elif t == 0x05:
                self.emit(f'{pad}{label(fid)} bool = {bool(self.r.u8())}')
            elif t == 0x07:
                self.emit(f'{pad}{label(fid)} f64  = {self.r.f64():g}')
            elif t == 0x08:
                self.emit(f'{pad}{label(fid)} str  = {self.r.string()!r}')
            elif t == 0x15:
                self.emit(f'{pad}{label(fid)} guid = {fmt_guid(self.r.raw(16))}')
            elif t == 0x19:
                n = self.r.u32()
                self.emit(f'{pad}{label(fid)} str[]= {[self.r.string() for _ in range(n)]}')
            elif t == 0x09:
                self.emit(f'{pad}{label(fid)} obj')
                self.object(depth, '')
            elif t == 0x12:
                self.emit(f'{pad}{label(fid)} list [')
                i = 0
                while self.r.peek32() != 0:
                    self.object(depth + 1, f' [{i}]')
                    i += 1
                self.r.u32()
                self.emit(f'{pad}] ({i} items)')
            else:
                raise ValueError(f'unknown type {t:#04x} at {self.r.p - 1:#x}')


def iter_strings(b, start):
    """Yield (offset_of_u32_prefix, text) for every length-prefixed string.

    This is the workhorse for targeted edits: it does not need a complete parse,
    so it keeps working past the point where the tree dump gives up.
    """
    for i in range(start, len(b) - 4):
        if b[i - 1] != 0x08:          # must be introduced by a str type byte
            continue
        n = struct.unpack_from('>I', b, i)[0]
        if not (1 <= n <= 256) or i + 4 + n > len(b):
            continue
        s = b[i + 4:i + 4 + n]
        if all(32 <= c < 127 for c in s):
            yield i, s.decode('ascii')


def patch_string(b, old, new):
    """Replace a length-prefixed string, rewriting its u32 prefix.

    Lengths may differ (E10b). `old` must occur exactly once; refusing otherwise
    is deliberate, since a length-preserving overwrite of the wrong occurrence is
    a silent wrong-result, the E4f gate-3 trap.
    """
    hits = []
    at = b.find(old.encode('latin1'))
    while at != -1:
        hits.append(at)
        at = b.find(old.encode('latin1'), at + 1)
    if len(hits) != 1:
        raise ValueError(f'{old!r} occurs {len(hits)} times, need exactly 1')
    at = hits[0]
    if struct.unpack_from('>I', b, at - 4)[0] != len(old):
        raise ValueError(f'no u32 length prefix {len(old)} before offset {at}')
    return (b[:at - 4] + struct.pack('>I', len(new))
            + new.encode('latin1') + b[at + len(old):])


def main():
    path = sys.argv[1]
    mode = sys.argv[2] if len(sys.argv) > 2 else '--tree'
    b = open(path, 'rb').read()
    hdr = parse_header(b)
    print(f'# {path.split("/")[-1]}  {len(b)} bytes')
    for k, v in hdr.items():
        print(f'#   {k:18s} {v}')
    if mode == '--header':
        return
    if hdr['encoding'] != '0002':
        print('# encoding is not 0002 (plain) — nothing further to read')
        return
    start = hdr['f4_stream_ptr'] - 1
    if mode == '--strings':
        for off, s in iter_strings(b, start):
            print(f'{off:#08x}  len={len(s):<3} {s!r}')
        return
    d = Dumper(b, start)
    try:
        marker = d.r.u8()
        assert marker == 0x0a, f'expected root marker 0x0a, got {marker:#04x}'
        d.object(0, ' ROOT')
    except Exception as e:
        d.emit(f'<<STOP {type(e).__name__}: {e} @ {d.r.p:#x} — see KNOWN LIMITATION>>')
    print('\n'.join(d.out))
    print(f'# consumed {d.r.p:#x} / {len(b):#x}')


if __name__ == '__main__':
    main()
