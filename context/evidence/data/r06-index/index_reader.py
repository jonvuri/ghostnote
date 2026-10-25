"""Read-only, bounded research decoder for Bitwig 6.1.4 plug-in indexes.

Schema traced through WZM, pAe, voN, NX, Ph, PF, QT/NQ and MVg.
No host imports, native calls, source writes, or arbitrary string scanning.
"""
import struct
from pathlib import PurePosixPath


class FormatError(ValueError):
    pass


class Reader:
    def __init__(self, data):
        if len(data) > 32 * 1024 * 1024:
            raise FormatError('input exceeds research bound')
        self.data, self.pos = data, 0

    def take(self, n):
        if n < 0 or n > len(self.data) - self.pos:
            raise FormatError(f'truncated input at {self.pos}, requested {n}')
        start = self.pos
        self.pos += n
        return self.data[start:self.pos]

    def num(self, fmt):
        return struct.unpack(fmt, self.take(struct.calcsize(fmt)))[0]

    def u32(self):
        return self.num('<I')

    def byte(self):
        return self.num('B')

    def boolean(self):
        n = self.byte()
        if n not in (0, 1):
            raise FormatError('invalid boolean')
        return bool(n)

    def array(self):
        n = self.u32()
        if n > 1024:
            raise FormatError('oversized ID array')
        return [self.u32() for _ in range(n)]

    def name(self):
        self.u32()  # search hash, not identity
        n = self.num('<H')
        if n > 1024:
            raise FormatError('oversized tree name')
        return self.take(n).decode('utf-8', errors='strict')

    def done(self):
        if self.pos != len(self.data):
            raise FormatError(f'unconsumed bytes: {len(self.data) - self.pos}')


def ids(data):
    """MVg.iCS string stream; table position is the stored ID."""
    r, out = Reader(data), []
    while r.pos < len(data):
        n = r.num('>I')
        wide, n = bool(n & 0x80000000), n & 0x7fffffff
        if n > 1024 * 1024:
            raise FormatError('oversized dictionary string')
        value = r.take(n * (2 if wide else 1)).decode('utf-16-be' if wide else 'ascii')
        if '\0' in value:
            raise FormatError('null in dictionary string')
        out.append(value)
    return out


def lookup(tables, table, index):
    values = tables[table]
    if index >= len(values):
        raise FormatError(f'{table} reference outside dictionary: {index}')
    return values[index]


def component(name):
    if not name or name in ('.', '..') or '/' in name or '\0' in name:
        raise FormatError('unsafe path component')
    return name


def plugins(data, kind, arch, tables):
    if kind not in ('vst3', 'clap') or arch not in ('arm64', 'x64'):
        raise FormatError('unsupported scope')
    r = Reader(data)
    magic = {'vst3': b'3tsv', 'clap': b'palc'}[kind]
    if r.take(4) != magic or r.u32() != 27 or r.byte() != 1:
        raise FormatError('unsupported index header')
    stack, out = [], []
    while r.pos < len(data):
        offset = r.pos
        h = r.u32()
        tag, size = h >> 24, h & 0xffffff
        b = Reader(r.take(size))
        if tag in (1, 5):
            name = component(b.name())
            b.array()
            if tag == 5:
                if b.byte() != 0:
                    raise FormatError('unknown bundle file type')
                bundle_flag = b.boolean()
            else:
                bundle_flag = None
            b.done()
            stack.append((name, tag, bundle_flag))
            if len(stack) > 64:
                raise FormatError('tree depth exceeds bound')
        elif tag in (4, 6):
            b.done()
            if not stack or stack[-1][1] != {4: 1, 6: 5}[tag]:
                raise FormatError('unbalanced directory/container')
            stack.pop()
        elif tag == 3:
            pass  # explicitly deleted/padding record, as pAe.cfM(long)
        elif tag == 2:
            if not stack or stack[-1][1] != 5:
                raise FormatError('plug-in outside bundle')
            raw_name = b.name()
            b.array()
            if b.byte() != 0:
                raise FormatError('unknown plug-in file type')
            stamp = b.num('<Q')
            category = lookup(tables, 'categories', b.u32())
            name = raw_name
            identity = lookup(tables, kind + '-device-ids', b.u32())
            version = b.name()
            vst_flag = b.boolean() if kind == 'vst3' else None
            foreign_flag = b.boolean() if arch != 'arm64' else None
            device_type, type_mask = b.byte(), b.u32()
            vendor = lookup(tables, 'device-creators', b.u32())
            b.done()
            if kind == 'vst3' and (len(identity) != 32 or any(c not in '0123456789ABCDEFabcdef' for c in identity)):
                raise FormatError('invalid VST3 ID')
            if not identity or not name:
                raise FormatError('empty identity/name')
            out.append(dict(name=name, rawName=raw_name, kind=kind, architecture=arch,
                identity=identity, relativeBundle=str(PurePosixPath(*(x[0] for x in stack))),
                vendor=vendor, category=category, version=version, deviceType=device_type, typeMask=type_mask,
                timestamp=stamp, offset=offset, bundleFlag=stack[-1][2], vstFlag=vst_flag,
                foreignFlag=foreign_flag))
        else:
            raise FormatError(f'unsupported record type {tag} at {offset}')
    if stack:
        raise FormatError('unclosed directory/container')
    return out


def cache_envelopes(data, version):
    """OKo/vna cache framing. Payloads remain opaque; failures are not devices."""
    r = Reader(data)
    if r.num('>I') != version:
        raise FormatError('unsupported cache version')
    records = []
    while r.pos < len(data):
        offset = r.pos
        def string():
            n = r.num('>I')
            wide, n = bool(n & 0x80000000), n & 0x7fffffff
            if n > 1024 * 1024:
                raise FormatError('oversized cache string')
            return r.take(n * (2 if wide else 1)).decode('utf-16-be' if wide else 'ascii')
        path = string()
        if not path.startswith('/') or '\0' in path:
            raise FormatError('invalid cache path')
        stamp, secondary = r.num('>Q'), r.num('>Q')
        failed = r.boolean()
        if failed:
            error, payload = string(), None
        else:
            payload = r.take(r.num('>I'))
            error = None
        records.append(dict(path=path, timestamp=stamp, secondary=secondary,
                            failed=failed, error=error, payload=payload, offset=offset))
    return records
