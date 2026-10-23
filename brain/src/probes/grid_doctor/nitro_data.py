"""Read a fixed Nitro program as data. Do not initialize vendor classes."""
import math
import struct

from grid_symbols.scan import Refusal, instructions
from .fixed_descriptors import integer
from .ownership import constant

MAX_BYTES = 1024 * 1024
MAX_NODES = 512
MAX_VALUES = 4096
MAX_DEPTH = 64


def byte_array_initializers(cls, method):
    """Extract literal byte-array stores. Require a separate route contract."""
    if method.name != '<clinit>' or method.desc != '()V' or method.flags != 8:
        raise Refusal('nitro-key-initializer')
    raw = instructions(method.code)
    if len(raw) > 16384 or method.handlers:
        raise Refusal('nitro-key-work')
    arrays = {}
    for index, (_, op, args) in enumerate(raw):
        if op != 188 or args != (8,):
            continue
        count = integer(cls, *raw[index - 1][1:]) if index else None
        if not isinstance(count, int) or not 16 < count <= 256:
            raise Refusal('nitro-key-size')
        result = bytearray()
        for item in range(count):
            block = raw[index + 1 + item * 4:index + 5 + item * 4]
            if (len(block) != 4 or block[0][1] != 89 or block[3][1] != 84
                    or integer(cls, *block[1][1:]) != item):
                raise Refusal('nitro-key-store')
            value = integer(cls, *block[2][1:])
            if not isinstance(value, int) or not -128 <= value <= 127:
                raise Refusal('nitro-key-byte')
            result.append(value & 255)
        end_index = index + 1 + count * 4
        if end_index >= len(raw) or raw[end_index][1] != 179:
            raise Refusal('nitro-key-field-store')
        ref = constant(cls, int.from_bytes(bytes(raw[end_index][2]), 'big'))
        if ref.get('tag') != 9 or ref.get('owner') != cls.name or ref.get('descriptor') != '[B':
            raise Refusal('nitro-key-field')
        fields = [f for f in cls.fields if (f.name, f.desc) == (ref['name'], ref['descriptor'])]
        if len(fields) != 1 or fields[0].flags != 26 or ref['name'] in arrays:
            raise Refusal('nitro-key-field')
        writes = [constant(cls, int.from_bytes(bytes(args), 'big'))
                  for _, op, args in raw if op == 179]
        if writes.count(ref) != 1:
            raise Refusal('nitro-key-reassigned')
        arrays[ref['name']] = bytes(result)
        if len(arrays) > 8:
            raise Refusal('nitro-key-array-limit')
    return arrays


def decode_program(raw, key):
    """Decode the traced codec-2 form. The route and key need source proof."""
    salt_size = len(key) * 2
    if (not 16 < len(key) <= 256 or len(raw) > MAX_BYTES
            or len(raw) <= 1 + salt_size or raw[0] != 2):
        raise Refusal('nitro-codec-input')
    salt, body = raw[1:1 + salt_size] + key[:16], raw[1 + salt_size:]
    result = bytearray()
    width = len(key) - 16
    for index, value in enumerate(body):
        shift = (index // width) & 7
        byte = salt[index % len(salt)]
        rotated = ((byte >> shift) | (byte << (8 - shift))) & 255
        result.append(value ^ key[16 + index % width] ^ rotated)
    return bytes(result)


class AstReader:
    """Read tokens with a source-bound type registry. Refuse other forms."""
    def __init__(self, raw, registry, declaration_types):
        if len(raw) > MAX_BYTES or len(registry) > 512:
            raise Refusal('nitro-ast-input-limit')
        if any(type(k) is not int or not 0 <= k <= 32767 or not isinstance(v, str)
               for k, v in registry.items()):
            raise Refusal('nitro-ast-registry')
        if not set(declaration_types) <= set(registry.values()):
            raise Refusal('nitro-ast-declaration-types')
        self.raw, self.registry = raw, dict(registry)
        self.declaration_types = set(declaration_types)
        self.pos, self.depth, self.work = 0, 0, 0
        self.strings, self.nodes = [], []

    def take(self, count):
        if count < 0 or self.pos + count > len(self.raw):
            raise Refusal('nitro-ast-truncated')
        value = self.raw[self.pos:self.pos + count]
        self.pos += count
        return value

    def number(self, width):
        return int.from_bytes(self.take(width), 'big', signed=True)

    def peek(self):
        if self.pos == len(self.raw):
            raise Refusal('nitro-ast-truncated')
        return self.raw[self.pos]

    def value(self):
        self.depth += 1
        self.work += 1
        if self.depth > MAX_DEPTH or self.work > MAX_VALUES:
            raise Refusal('nitro-ast-work-limit')
        try:
            return self._value()
        finally:
            self.depth -= 1

    def _value(self):
        offset, tag = self.pos, self.number(1)
        if tag == 1:
            ident = self.number(2)
            if ident not in self.registry or len(self.nodes) >= MAX_NODES:
                raise Refusal('nitro-ast-node')
            node = {'offset': offset, 'id': ident, 'class': self.registry[ident], 'data': []}
            self.nodes.append(node)
            while self.peek() != 2:
                node['data'].append(self.value())
            self.take(1)
            if node['class'] in self.declaration_types:
                annotations = self.value()
                if not isinstance(annotations, list):
                    raise Refusal('nitro-ast-annotations')
                node['annotations'] = annotations
            return node
        if tag == 3:
            return None
        if tag == 4:
            count = self.number(4)
            if not 0 <= count <= MAX_VALUES:
                raise Refusal('nitro-ast-list-limit')
            values = [self.value() for _ in range(count)]
            if self.take(1) != b'\x05':
                raise Refusal('nitro-ast-list-end')
            return values
        if tag == 6:
            count = self.number(4)
            if not 0 <= count <= 65536:
                raise Refusal('nitro-ast-string-limit')
            try:
                value = self.take(count).decode('utf8')
            except UnicodeDecodeError as error:
                raise Refusal('nitro-ast-string-encoding') from error
            self.strings.append(value)
            return value
        if tag == 7:
            index = self.number(4)
            if not 0 <= index < len(self.strings):
                raise Refusal('nitro-ast-string-reference')
            return self.strings[index]
        if tag in (9, 10):
            return tag == 9
        if tag == 11:
            return self.number(8)
        if tag == 12:
            value = struct.unpack('>d', self.take(8))[0]
            if not math.isfinite(value):
                raise Refusal('nitro-ast-nonfinite')
            return value
        raise Refusal('nitro-ast-tag')

    def read(self):
        if self.pos or self.value() is not False:
            raise Refusal('nitro-ast-debug-header')
        root = self.value()
        if not isinstance(root, dict) or self.pos != len(self.raw):
            raise Refusal('nitro-ast-root-or-trailing')
        return {'root': root, 'nodeOccurrences': len(self.nodes), 'work': self.work,
                'strings': self.strings, 'boundedAdmission': False}
