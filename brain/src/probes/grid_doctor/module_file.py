"""Inspect a fixed module file as data. Do not run its constructors."""
from collections import Counter
import math
import struct

from grid_symbols.scan import Refusal, instructions
from .fixed_descriptors import integer
from .ownership import constant

MAX_FILE = 1024 * 1024
MAX_ITEMS = 4096
MAX_STRING = 64 * 1024


def key_bytes(cls, method):
    """Read the traced byte-array initializer. Refuse other method shapes."""
    raw = instructions(method.code)
    if method.flags != 4 or method.handlers or len(raw) != 521:
        raise Refusal('module-key-method-shape')
    if integer(cls, *raw[0][1:]) != 128 or raw[1][1:] != (188, (8,)):
        raise Refusal('module-key-array')
    result = bytearray()
    for i in range(128):
        block = raw[2 + i * 4:6 + i * 4]
        if block[0][1] != 89 or block[3][1] != 84 or integer(cls, *block[1][1:]) != i:
            raise Refusal('module-key-store')
        value = integer(cls, *block[2][1:])
        if value is None or not -128 <= value <= 127:
            raise Refusal('module-key-byte')
        result.append(value & 255)
    tail = raw[514:]
    if [r[1] for r in tail] != [76, 187, 89, 43, 16, 183, 176] or tail[4][2] != (16,):
        raise Refusal('module-key-tail')
    allocated = constant(cls, int.from_bytes(bytes(tail[1][2]), 'big'))
    call = constant(cls, int.from_bytes(bytes(tail[5][2]), 'big'))
    if call != {'tag': 10, 'owner': allocated.get('value'), 'name': '<init>', 'descriptor': '([BI)V'}:
        raise Refusal('module-key-constructor')
    return bytes(result)


def decode_stream(raw, key):
    if len(raw) > MAX_FILE or len(raw) < 17 or raw[0] != 0 or len(key) != 128:
        raise Refusal('module-codec-input')
    salt = raw[1:17] + key[:16]
    result = bytearray()
    for index, value in enumerate(raw[17:]):
        shift = (index // 112) & 7
        byte = salt[index % 32]
        rotated = ((byte >> shift) | (byte << (8 - shift))) & 255
        result.append(value ^ key[16 + index % 112] ^ rotated)
    return bytes(result)


def decode_file(raw, key):
    if len(raw) > MAX_FILE or len(raw) < 76 or raw[:4] != b'BtWg':
        raise Refusal('module-file-size-or-magic')
    try:
        version, codec, document = (int(raw[a:b], 16) for a, b in ((4, 8), (8, 12), (12, 16)))
        offset, resources, flags = (int(raw[a:b], 16) for a, b in ((16, 24), (24, 40), (40, 42)))
    except ValueError as error:
        raise Refusal('module-header-number') from error
    if version != 3 or codec != 4 or resources != 0 or flags != 0 or not 59 <= offset <= len(raw) - 17:
        raise Refusal('module-header-form')
    metadata = decode_stream(raw[42:offset], key)
    reader = Reader(metadata)
    reader.object()
    padding = raw[59 + reader.pos:offset]
    if not padding or padding[-1:] != b'\n' or padding[:-1].strip(b' '):
        raise Refusal('module-metadata-padding')
    return {'version': version, 'codec': codec, 'documentVersion': document, 'objectOffset': offset,
            'metadataPaddingBytes': len(padding)}, metadata[:reader.pos], decode_stream(raw[offset:], key)


class Reader:
    """Read the traced binary forms. Keep property order and duplicate IDs."""
    def __init__(self, raw):
        if len(raw) > MAX_FILE:
            raise Refusal('module-payload-size')
        self.raw, self.pos, self.nodes, self.depth, self.work = raw, 0, [], 0, 0

    def take(self, count):
        if count < 0 or self.pos + count > len(self.raw):
            raise Refusal('module-payload-truncated')
        result = self.raw[self.pos:self.pos + count]
        self.pos += count
        return result

    def integer(self):
        return int.from_bytes(self.take(4), 'big', signed=True)

    def count(self, maximum=MAX_ITEMS):
        value = self.integer()
        if not 0 <= value <= maximum:
            raise Refusal('module-count-limit')
        return value

    def tick(self):
        self.work += 1
        if self.work > 100000:
            raise Refusal('module-value-limit')

    def string(self):
        try:
            return self.take(self.count(MAX_STRING)).decode('utf8')
        except UnicodeError as error:
            raise Refusal('module-string-encoding') from error

    def object(self, class_id=None):
        self.tick()
        if self.depth >= 64 or len(self.nodes) >= MAX_ITEMS:
            raise Refusal('module-tree-limit')
        self.depth += 1
        offset = self.pos
        class_id = self.integer() if class_id is None else class_id
        if class_id == 4:
            class_id = self.string()
        elif class_id <= 5:
            raise Refusal('module-object-class')
        node = {'classId': class_id, 'offset': offset, 'properties': []}
        self.nodes.append(node)
        while True:
            prop = self.integer()
            if prop == 0:
                break
            self.tick()
            if prop == 1:
                prop = self.string()
            elif prop < 0:
                raise Refusal('module-property-id')
            if len(node['properties']) >= MAX_ITEMS:
                raise Refusal('module-property-limit')
            tag = self.take(1)[0]
            value = self.value(tag)
            node['properties'].append({'id': prop, 'type': tag, 'value': value})
        self.depth -= 1
        return node

    def value(self, tag):
        self.tick()
        if tag in (1, 2, 3, 4):
            return int.from_bytes(self.take({1: 1, 2: 2, 3: 4, 4: 8}[tag]), 'big', signed=True)
        if tag == 5:
            value = self.take(1)[0]
            if value not in (0, 1):
                raise Refusal('module-boolean')
            return bool(value)
        if tag in (6, 7):
            value = struct.unpack('>f' if tag == 6 else '>d', self.take(4 if tag == 6 else 8))[0]
            if not math.isfinite(value):
                raise Refusal('module-nonfinite')
            return value
        if tag == 8:
            return self.string()
        if tag == 9:
            return self.object()
        if tag == 10:
            return None
        if tag == 11:
            return {'reference': self.integer()}
        if tag in (13, 14, 15, 16, 17, 23, 24):
            width = {13: 1, 14: 2, 15: 4, 16: 8, 17: 1, 23: 4, 24: 8}[tag]
            count = self.count()
            return {'count': count, 'bytes': self.take(count * width).hex()}
        if tag == 25:
            return [self.string() for _ in range(self.count())]
        if tag == 21:
            return {'uuid': self.take(16).hex()}
        if tag == 22:
            return {'colorBytes': self.take(16).hex()}
        if tag == 18:
            result = []
            while True:
                class_id = self.integer()
                if class_id == 3:
                    return result
                self.tick()
                if len(result) >= MAX_ITEMS:
                    raise Refusal('module-list-limit')
                if class_id == 0:
                    result.append(None)
                elif class_id == 1:
                    result.append({'reference': self.integer()})
                elif class_id in (2, 5):
                    raise Refusal('module-list-reference-form')
                else:
                    result.append(self.object(class_id))
        # External references and maps require separate format traces.
        raise Refusal('module-unsupported-type-' + str(tag))

    def read(self):
        root = self.object()
        if self.pos != len(self.raw):
            raise Refusal('module-trailing-data')
        counts = Counter(str(node['classId']) for node in self.nodes)
        return {'root': root, 'classCounts': dict(sorted(counts.items())),
                'objectCount': len(self.nodes), 'bytes': self.pos, 'work': self.work,
                'runtimeObserved': False, 'boundedAdmission': False, 'writeAuthority': False}


def object_references(root):
    """Resolve prior object IDs. This does not prove owned relationships."""
    nodes, references = [], []
    work = 0

    def visit(obj, depth):
        nonlocal work
        if depth >= 64 or len(nodes) >= MAX_ITEMS:
            raise Refusal('module-reference-tree-limit')
        source = len(nodes) + 1
        nodes.append({'objectId': source, 'classId': obj['classId']})
        for prop in obj['properties']:
            values = prop['value'] if isinstance(prop['value'], list) else [prop['value']]
            for value in values:
                work += 1
                if work > 100000:
                    raise Refusal('module-reference-work-limit')
                if not isinstance(value, dict):
                    continue
                if 'classId' in value:
                    visit(value, depth + 1)
                elif 'reference' in value:
                    target = value['reference']
                    if type(target) is not int or not 1 <= target <= len(nodes):
                        raise Refusal('module-reference-not-registered')
                    references.append({'source': source, 'propertyId': prop['id'],
                                       'target': target, 'targetClassId': nodes[target - 1]['classId']})
    visit(root, 0)
    return {'nodes': nodes, 'references': references, 'work': work,
            'rule': 'Register each object before its properties. IDs start at one.',
            'ownershipProved': False, 'boundedAdmission': False}


def main():
    import argparse
    import hashlib
    import json
    from pathlib import Path
    import time
    from grid_symbols.scan import Jar, rss_bytes
    from .contracts import contract
    from .descriptor_resolution import Code
    from .migrate import member
    from .ownership import method_trace, bootstraps

    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('jar', 'module', 'plan', 'report'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    if args.report.exists():
        raise Refusal('module-report-exists')
    if args.module.stat().st_size > MAX_FILE or args.plan.stat().st_size > 65536:
        raise Refusal('module-input-size')
    raw, plan_raw = args.module.read_bytes(), args.plan.read_bytes()
    plan = json.loads(plan_raw)
    module_hash = hashlib.sha256(raw).hexdigest()
    if module_hash != plan['moduleSha256']:
        raise Refusal('module-source-hash')
    start = time.perf_counter()
    jar = Jar(args.jar)
    try:
        if jar.sha256 != plan['jarSha256']:
            raise Refusal('module-jar-hash')
        code, traces = Code(), []
        if not 1 <= len(plan['methods']) <= 128:
            raise Refusal('module-method-plan-limit')
        key = None
        for index, spec in enumerate(plan['methods']):
            cls = code.get(jar, spec['owner'])
            method = member(cls, spec['name'], spec['descriptor'])
            if contract(cls, method, {})['digest'] != spec['digest']:
                raise Refusal('module-method-contract')
            if index == 0:
                key = key_bytes(cls, method)
            traces.append(method_trace(jar, cls, method, bootstraps(jar.zip.read(cls.name + '.class'), cls)))
        header, metadata, objects = decode_file(raw, key)
        report = {'jarSha256': jar.sha256, 'moduleSha256': module_hash,
                  'planSha256': hashlib.sha256(plan_raw).hexdigest(), 'header': header,
                  'metadata': Reader(metadata).read(), 'objects': Reader(objects).read(),
                  'methodTraces': traces, 'decodedHashes': {
                      'metadata': hashlib.sha256(metadata).hexdigest(),
                      'objects': hashlib.sha256(objects).hexdigest()},
                  'elapsedMs': round((time.perf_counter() - start) * 1000, 3),
                  'peakRssBytes': rss_bytes(), 'boundedAdmission': False, 'writeAuthority': False,
                  'limits': ['The plan pins diagnostic codec traces. It does not prove runtime identity.',
                             'Serialized nodes do not include all constructor defaults or migrations.',
                             'Opaque byte arrays are retained as data. Their consumers need separate checks.']}
        jar.check()
        if report['elapsedMs'] > 120000:
            raise Refusal('module-deadline')
        encoded = json.dumps(report, indent=2).encode() + b'\n'
        if len(encoded) > 8 * 1024**2:
            raise Refusal('module-report-limit')
        with args.report.open('xb') as output:
            output.write(encoded)
        print(json.dumps({'objects': report['objects']['objectCount'],
                          'classes': len(report['objects']['classCounts']),
                          'elapsedMs': report['elapsedMs'], 'peakRssBytes': report['peakRssBytes'],
                          'reportBytes': len(encoded)}))
    finally:
        jar.close()


if __name__ == '__main__':
    main()
