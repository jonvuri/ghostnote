"""Bounded, read-only 6.1.4 research reader; not a portable prefs codec.

Only location configuration is exported. Unknown wire types fail closed.
Pass the active prefs file explicitly; do not select the newest installed version.
"""
import hashlib
import json
import struct
import sys
from pathlib import Path

PIN = '5c2b1895bbb9e7d08d9216de421985bb1f24b2ee62762c9451b4fe847df2469f'
LIMIT = 32 * 1024 * 1024


class Reader:
    def __init__(self, data):
        if len(data) > LIMIT or data[:16] != b'BtWg000100020006':
            raise ValueError('unsupported prefs header or size')
        self.data = data
        self.p = int(data[16:24], 16) - 1
        self.objects = 0
        if self.p < 40 or self.take(1) != b'\x0a':
            raise ValueError('invalid object-stream offset')

    def take(self, n):
        if n < 0 or self.p + n > len(self.data):
            raise ValueError('truncated input')
        value = self.data[self.p:self.p+n]
        self.p += n
        return value

    def u32(self):
        return struct.unpack('>I', self.take(4))[0]

    def string(self):
        n = self.u32()
        wide = bool(n & 0x80000000)
        return self.take((n & 0x7fffffff) * (2 if wide else 1)).decode(
            'utf-16-be' if wide else 'ascii')

    def obj(self, depth=0):
        self.objects += 1
        if depth > 64 or self.objects > 100000:
            raise ValueError('object/depth limit')
        kind = self.u32()
        if kind == 3:  # Bare four-byte terminator in this prefs stream.
            return (kind, {})
        if kind == 1:
            return (kind, {'reference': self.u32()})
        fields = {}
        while True:
            fid = self.u32()
            if fid == 0:
                return (kind, fields)
            if fid in fields or len(fields) >= 10000:
                raise ValueError('duplicate field or field limit')
            wire = self.take(1)[0]
            fields[fid] = (wire, self.value(wire, depth + 1))

    def value(self, wire, depth):
        if wire == 10:
            return None
        if wire in (1, 5):
            return self.take(1)[0]
        if wire == 2:
            return self.take(2)
        if wire in (3, 6, 11):
            return self.u32()
        if wire in (4, 7):
            return self.take(8)
        if wire == 8:
            return self.string()
        if wire == 9:
            return self.obj(depth)
        if wire == 18:
            values = []
            while True:
                value = self.obj(depth)
                if value[0] == 3:
                    return values
                values.append(value)
        if wire in (21, 22):
            return self.take(16)  # Opaque; not interpreted as location fields.
        if wire == 25:
            count = self.u32()
            if count > 100000:
                raise ValueError('string-array limit')
            return [self.string() for _ in range(count)]
        raise ValueError(f'unsupported wire type {wire}')


def field(fields, key, wire):
    actual, value = fields[key]
    if actual != wire:
        raise ValueError(f'unexpected type for field {key}')
    return value


def decode(data):
    reader = Reader(data)
    kind, fields = reader.obj()
    if kind != 722 or reader.p != len(data):
        raise ValueError('unexpected root or trailing bytes')
    kind, library = field(fields, 3457, 9)
    if kind != 718:
        raise ValueError('unexpected library class')
    result = {'myLibrary': field(library, 5134, 8),
              'packageInstallationDirectory': field(fields, 4917, 8)}
    for name, key in [('soundContent', 5066), ('music', 5067), ('plugins', 5068)]:
        rows = []
        for kind, config in field(library, key, 18):
            if kind != 720:
                raise ValueError('unexpected location class/reference')
            automatic = field(config, 3444, 5)
            if automatic not in (0, 1):
                raise ValueError('invalid automatic-update flag')
            rows.append({'path': field(config, 3443, 8),
                         'automaticUpdate': bool(automatic)})
        result[name] = rows
    return result


def package_root(configured, settings_root):
    default = str(Path(settings_root) / 'installed-packages')
    if not configured or configured == default:
        return default
    path = Path(configured)
    return str(path if path.name == 'Installed Bitwig Packs' else path / 'Installed Bitwig Packs')


def snapshot(path):
    def sig():
        s = path.stat()
        return [s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns, s.st_ctime_ns]
    before = sig()
    if before[2] > LIMIT:
        raise ValueError('input size limit')
    with path.open('rb') as source:
        data = source.read(LIMIT + 1)
    if before != sig() or len(data) != before[2]:
        raise ValueError('prefs changed during read')
    return {'source': str(path), 'stat': before,
            'sha256': hashlib.sha256(data).hexdigest(), 'locations': decode(data)}


if __name__ == '__main__':
    # Build-specific field IDs: refuse other installed jars.
    jar = Path('/Applications/Bitwig Studio.app/Contents/Java/bitwig.jar')
    if hashlib.sha256(jar.read_bytes()).hexdigest() != PIN:
        raise SystemExit('unsupported jar')
    print(json.dumps(snapshot(Path(sys.argv[1])), indent=2))
