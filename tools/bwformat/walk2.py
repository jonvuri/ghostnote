#!/usr/bin/env python3
"""E12b — crack the full object grammar to COUNT objects reliably (the count-stub
delta on a sampled Sampler = the object footprint of the inserted/removed
modulator subtree; E12a showed the correct add-Random delta was +0x0b, the
donor's own object count, not a per-type constant).

Corrected grammar hypothesis (vs E11h):
  list (type 0x12) := object*  00 00 00 00      # terminates on a BARE classId 0
  the empty class-3 object `00 00 00 03 00 00 00 00` is a NORMAL list ITEM
  (a null/default entry), NOT the terminator. Reading it as the terminator is
  what desynced the old walker (the phantom "type 0x00 / unmapped 0x02/0x06/0x1a").
  object := u32 classId  field*  00 00 00 00    # fid 0 ends fields
  classId 1 is a STUB: u32 classId(=1) then a u32 payload (an object reference).

Usage: python3 tools/bwformat/walk2.py <file.bwpreset> [--count-mod]
"""
import sys, struct

def ss(b): return int(b[16:24], 16) - 1

class Walker:
    def __init__(self, b):
        self.b = b; self.nobj = 0; self.classes = {}

    def u32(self, p): return struct.unpack_from('>I', self.b, p)[0]

    def obj(self, p, depth):
        b = self.b
        cls = self.u32(p); p += 4
        self.nobj += 1
        self.classes[cls] = self.classes.get(cls, 0) + 1
        if cls == 1:                      # stub: classId 1 + u32 ref payload
            ref = self.u32(p); p += 4
            return p
        while True:
            fid = self.u32(p); p += 4
            if fid == 0:                  # end of fields
                return p
            t = b[p]; p += 1
            if t == 0x01 or t == 0x05: p += 1
            elif t == 0x03: p += 4
            elif t == 0x07: p += 8
            elif t == 0x08:
                L = self.u32(p); p += 4 + L
            elif t == 0x09:
                p = self.obj(p, depth+1)
            elif t == 0x12:               # list: objects until bare classId 0
                while self.u32(p) != 0:
                    p = self.obj(p, depth+1)
                p += 4                    # consume the classId-0 terminator
            elif t == 0x15: p += 16
            elif t == 0x19:
                n = self.u32(p); p += 4
                for _ in range(n):
                    L = self.u32(p); p += 4 + L
            else:
                raise ValueError(f'unknown type 0x{t:02x} at {p-1} (fid 0x{fid:x}, depth {depth})')

    def walk(self):
        p = ss(self.b) + 1               # skip the 0x0a marker
        end = self.obj(p, 0)
        return end

if __name__ == '__main__':
    path = sys.argv[1]
    b = open(path, 'rb').read()
    w = Walker(b)
    try:
        end = w.walk()
        leftover = len(b) - end
        print(f'{path.split("/")[-1]}: OK  objects={w.nobj}  walked_to={end}  leftover={leftover}')
        print(f'  class histogram: {dict(sorted(w.classes.items()))}')
    except Exception as e:
        print(f'{path.split("/")[-1]}: FAIL {e}  (objects so far={w.nobj})')
