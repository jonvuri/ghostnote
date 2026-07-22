#!/usr/bin/env python3
"""
Structural diff for two BtWg kind=0002 presets (ghostnote spike, E10 series).

Splits each file into header / meta / object-stream, then:
  - META  : parsed as flat key/value TLV and diffed by key (so volatile fields
            like revision_id/comment are visible and can be judged, not just noise)
  - STREAM: byte-aligned with difflib; each differing block is annotated with the
            length-prefixed strings inside it, so a diff reads as "these named
            things changed" instead of a hex smear.

USAGE  python3 bwdiff.py A.bwpreset B.bwpreset [--full]
"""
import struct
import sys
import difflib

VOLATILE = {'revision_id', 'revision_no', 'comment'}  # expected to differ, not signal


def split(b):
    hdr = b[:42]
    stream_start = int(b[16:24], 16) - 1
    # meta ends where the object stream begins (f4 pointer)
    return hdr, b[42:stream_start], b[stream_start:], stream_start


def parse_meta(mbytes, base=42):
    """meta = (u32 tag, name, u8 type, value)*, space-padded. Best-effort."""
    out = {}
    p = 0
    b = mbytes
    n = len(b)
    while p < n - 8:
        try:
            tag = struct.unpack_from('>I', b, p)[0]; p += 4
            if tag == 4:      # section marker: (u32=4) len name
                ln = struct.unpack_from('>I', b, p)[0]; p += 4
                p += ln
                continue
            if tag != 1:
                break
            ln = struct.unpack_from('>I', b, p)[0]; p += 4
            name = b[p:p + ln].decode('utf-8', 'replace'); p += ln
            t = b[p]; p += 1
            if t == 0x08:
                vl = struct.unpack_from('>I', b, p)[0]; p += 4
                val = b[p:p + vl].decode('utf-8', 'replace'); p += vl
            elif t == 0x03:
                val = struct.unpack_from('>I', b, p)[0]; p += 4
            elif t == 0x02:
                val = b[p]; p += 1
            elif t == 0x19:   # str[]
                cnt = struct.unpack_from('>I', b, p)[0]; p += 4
                items = []
                for _ in range(cnt):
                    il = struct.unpack_from('>I', b, p)[0]; p += 4
                    items.append(b[p:p + il].decode('utf-8', 'replace')); p += il
                val = items
            else:
                out[name] = f'<type {t:#04x}>'
                break
            out[name] = val
        except Exception:
            break
    return out


def strings_in(seg, start_off):
    res = []
    for i in range(len(seg) - 4):
        if i > 0 and seg[i - 1] != 0x08:
            continue
        ln = struct.unpack_from('>I', seg, i)[0]
        if 1 <= ln <= 64 and i + 4 + ln <= len(seg):
            s = seg[i + 4:i + 4 + ln]
            if all(32 <= c < 127 for c in s):
                res.append(s.decode('ascii'))
    return res


def main():
    pa, pb = sys.argv[1], sys.argv[2]
    full = '--full' in sys.argv[3:]
    a = open(pa, 'rb').read()
    b = open(pb, 'rb').read()
    ha, ma, sa, soa = split(a)
    hb, mb, sb, sob = split(b)
    print(f'A {pa.split("/")[-1]}  {len(a)}B  stream@{soa:#x}')
    print(f'B {pb.split("/")[-1]}  {len(b)}B  stream@{sob:#x}')
    print(f'header same: {ha == hb}   meta len {len(ma)} vs {len(mb)}   stream len {len(sa)} vs {len(sb)}')

    print('\n== META diff (key: A | B) ==')
    ka, kb = parse_meta(ma), parse_meta(mb)
    keys = sorted(set(ka) | set(kb))
    any_meta = False
    for k in keys:
        va, vb = ka.get(k, '<absent>'), kb.get(k, '<absent>')
        if va != vb:
            tag = ' [volatile]' if k in VOLATILE else ''
            print(f'  {k}{tag}:\n      A= {va!r}\n      B= {vb!r}')
            any_meta = True
    if not any_meta:
        print('  (meta identical)')

    print('\n== STREAM diff (annotated) ==')
    sm = difflib.SequenceMatcher(a=sa, b=sb, autojunk=False)
    blocks = [op for op in sm.get_opcodes() if op[0] != 'equal']
    if not blocks:
        print('  (object streams byte-identical)')
    for tagn, i1, i2, j1, j2 in blocks:
        segA, segB = sa[i1:i2], sb[j1:j2]
        strA = strings_in(sa[max(0, i1 - 8):i2 + 8], 0)
        strB = strings_in(sb[max(0, j1 - 8):j2 + 8], 0)
        print(f'  {tagn.upper():7} A[{i1:#06x}:{i2:#06x}] ({i2-i1}B)  B[{j1:#06x}:{j2:#06x}] ({j2-j1}B)')
        if strA or strB:
            print(f'          strings A: {strA}')
            print(f'          strings B: {strB}')
        if full:
            print(f'          A: {segA[:48].hex(" ")}')
            print(f'          B: {segB[:48].hex(" ")}')


if __name__ == '__main__':
    main()
