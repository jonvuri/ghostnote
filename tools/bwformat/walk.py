#!/usr/bin/env python3
"""E11h scratch: a linear, offset-annotated field walker to resolve the unmapped
stream types (0x02/0x06/0x1a) and the list/field framing. Unlike bwparse.py's
recursive dumper, this walks fields linearly from a given offset, prints every
byte decision with its absolute offset, and STOPS with full context at the first
unknown type — so we can infer widths by hand instead of guessing.

Usage: python3 walk.py <file> <hexoffset> [maxfields]
"""
import os, sys, struct

KNOWN_W = {0x01:1, 0x05:1, 0x03:4, 0x07:8, 0x15:16}  # fixed-width scalar types

def main():
    b=open(os.path.expanduser(sys.argv[1]),'rb').read()
    p=int(sys.argv[2],16)
    maxf=int(sys.argv[3]) if len(sys.argv)>3 else 60
    depth=0
    def u32(o): return struct.unpack_from('>I',b,o)[0]
    # walk fields at current depth; recurse into obj/list
    def walk(p, depth, n):
        pad='  '*depth
        for _ in range(n[0]):
            n[0]-=1
            fid=u32(p)
            if fid==0:
                print(f"{pad}{p:#06x}: 00000000  <END obj/list>")
                return p+4
            t=b[p+4]
            head=f"{pad}{p:#06x}: fid={fid:#06x} type={t:#04x}"
            if t in KNOWN_W:
                w=KNOWN_W[t]; val=b[p+5:p+5+w]
                print(f"{head}  ({w}B) {val.hex(' ')}")
                p+=5+w
            elif t==0x08:  # str
                L=u32(p+5); s=b[p+9:p+9+L]
                print(f"{head}  str[{L}] {s[:32]!r}")
                p+=9+L
            elif t==0x19:  # str[]
                cnt=u32(p+5); q=p+9
                for _ in range(cnt):
                    L=u32(q); q+=4+L
                print(f"{head}  str[]x{cnt}")
                p=q
            elif t==0x09:  # nested object: classId then fields
                cls=u32(p+5)
                print(f"{head}  OBJ cls={cls:#06x} {{")
                p=walk(p+9, depth+1, n)
                print(f"{pad}}}")
            elif t==0x12:  # list: items (classId + fields) until classId 0
                print(f"{head}  LIST [")
                p+=5
                idx=0
                while True:
                    cls=u32(p)
                    if cls==0:
                        print(f"{pad}  {p:#06x}: 00000000  <END list>")
                        p+=4; break
                    print(f"{pad}  item[{idx}] {p:#06x}: cls={cls:#06x} {{")
                    p=walk(p+4, depth+1, n)
                    print(f"{pad}  }}")
                    idx+=1
                    if n[0]<=0: break
                print(f"{pad}]")
            else:
                print(f"{head}  *** UNKNOWN TYPE {t:#04x} ***")
                print(f"{pad}   next 24B: {b[p+5:p+5+24].hex(' ')}")
                return None
            if p is None: return None
        return p
    print(f"# {sys.argv[1].split('/')[-1]}  walking from {p:#x}")
    walk(p, depth, [maxf])

if __name__=='__main__':
    main()
