"""Bind captured descriptor IDs to generated classes without initialization."""
import argparse
from collections import defaultdict
import hashlib
import json
from pathlib import Path
import time
import zipfile

from grid_symbols.scan import Jar, Refusal, instructions, parse, rss_bytes
from .ownership import constant, method_trace, bootstraps


def captured_pairs(path):
    pairs, descriptors = {}, set()
    with zipfile.ZipFile(path) as archive:
        if len(archive.infolist()) > 128 or sum(x.file_size for x in archive.infolist()) > 32 * 1024**2:
            raise Refusal('fixed-capture-size')
        def visit(value):
            if isinstance(value, dict):
                if {'runtimeClass', 'classId', 'className'} <= value.keys():
                    key = value['className'], value['classId']
                    runtime = value['runtimeClass'].replace('.', '/')
                    if key in pairs and pairs[key] != runtime:
                        raise Refusal('fixed-source-runtime-conflict')
                    pairs[key] = runtime
                if 'descriptorClass' in value:
                    descriptors.add(value['descriptorClass'].replace('.', '/'))
                for item in value.values():
                    visit(item)
            elif isinstance(value, list):
                for item in value:
                    visit(item)
        for name in archive.namelist():
            visit(json.loads(archive.read(name)))
    return pairs, sorted(descriptors)


def integer(cls, opcode, args):
    if 2 <= opcode <= 8:
        return opcode - 3
    if opcode in (16, 17):
        return int.from_bytes(bytes(args), 'big', signed=True)
    if opcode in (18, 19):
        value = constant(cls, args[0] if opcode == 18 else args[0] * 256 + args[1])
        if value['tag'] == 3:
            return int.from_bytes(bytes.fromhex(value['value']), 'big', signed=True)
    return None


def constructor_pair(cls, method):
    raw = instructions(method.code)
    if method.name != '<init>' or method.desc != '()V' or method.handlers or len(raw) != 5:
        return None
    if [r[1] for r in raw[:2]] not in ([42, 18], [42, 19]) or [r[1] for r in raw[-2:]] != [183, 177]:
        return None
    _, op, args = raw[1]
    label = constant(cls, args[0] if op == 18 else args[0] * 256 + args[1])
    number = integer(cls, raw[2][1], raw[2][2])
    args = raw[3][2]
    call = constant(cls, args[0] * 256 + args[1])
    if label['tag'] != 8 or number is None or call != {'tag': 10, 'owner': cls.parent,
            'name': '<init>', 'descriptor': '(Ljava/lang/String;I)V'}:
        return None
    return label['value'], number


def catalog(jar, pairs):
    matches = defaultdict(list)
    methods, decoded = 0, 0
    for name in sorted(jar.classes):
        jar.check()
        metadata = jar.classes[name]
        methods += len(metadata.methods)
        if methods > 1000000:
            raise Refusal('fixed-method-limit')
        if not any(m.name == '<init>' and m.desc == '()V' for m in metadata.methods):
            continue
        data = jar.zip.read(name + '.class')
        cls = parse(data, True)
        for method in cls.methods:
            if method.name != '<init>' or method.desc != '()V':
                continue
            decoded += len(instructions(method.code))
            if decoded > 16000000:
                raise Refusal('fixed-instruction-limit')
            pair = constructor_pair(cls, method)
            if pair not in pairs:
                continue
            getters = []
            for getter in cls.methods:
                if getter.desc != '()Ljava/lang/Class;' or getter.flags != 1 or getter.handlers:
                    continue
                raw = instructions(getter.code)
                if len(raw) != 2 or raw[0][1] not in (18, 19) or raw[1][1] != 176:
                    continue
                _, op, args = raw[0]
                value = constant(cls, args[0] if op == 18 else args[0] * 256 + args[1])
                if value['tag'] == 7:
                    getters.append((getter, value['value']))
            if len(getters) != 1:
                raise Refusal('fixed-runtime-class-getter')
            getter, runtime = getters[0]
            if runtime not in jar.classes:
                raise Refusal('fixed-external-runtime-class')
            bs = bootstraps(data, cls)
            matches[pair].append({'descriptor': name, 'runtimeClass': runtime,
                                  'constructor': method_trace(jar, cls, method, bs),
                                  'classGetter': method_trace(jar, cls, getter, bs)})
            if len(matches[pair]) > 128:
                raise Refusal('fixed-candidate-limit')
    rows = []
    for pair, source in sorted(pairs.items()):
        hits = matches[pair]
        rows.append({'name': pair[0], 'id': pair[1], 'sourceRuntime': source, 'count': len(hits),
                     'status': 'unique-constructor-and-class-getter' if len(hits) == 1 else 'refused',
                     'matches': hits, 'runtimeObserved': False})
    return {'sha256': jar.sha256, 'rows': rows, 'methodsScanned': methods, 'instructionsDecoded': decoded,
            'boundedAdmission': False, 'writeAuthority': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('old-jar', 'new-jar', 'captures', 'report'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    if args.report.exists():
        raise Refusal('fixed-report-exists')
    pairs, properties = captured_pairs(args.captures)
    start, builds = time.perf_counter(), []
    class BoundedJar(Jar):
        def check(self):
            super().check()
            if time.perf_counter() - start > 120:
                raise Refusal('fixed-deadline')

    for path in (args.old_jar, args.new_jar):
        jar = BoundedJar(path)
        try:
            builds.append(catalog(jar, pairs))
        finally:
            jar.close()
    for row in builds[0]['rows']:
        if row['count'] != 1 or row['matches'][0]['runtimeClass'] != row['sourceRuntime']:
            raise Refusal('fixed-source-capture-disagreement')
    report = {'builds': builds, 'sourcePropertyClasses': properties,
              'captureSha256': hashlib.sha256(args.captures.read_bytes()).hexdigest(),
              'elapsedMs': round((time.perf_counter() - start) * 1000, 3), 'peakRssBytes': rss_bytes(),
              'completeTable': False, 'boundedAdmission': False, 'writeAuthority': False,
              'limits': ['Constructor and class getters describe generated code, not current live receivers.',
                         'The exact runtime class and descriptor identity still need independent checks.']}
    raw = json.dumps(report, indent=2).encode() + b'\n'
    if len(raw) > 8 * 1024**2:
        raise Refusal('fixed-report-limit')
    with args.report.open('xb') as output:
        output.write(raw)
    print(json.dumps({'counts': [[r['count'] for r in b['rows']] for b in builds],
                      'elapsedMs': report['elapsedMs'], 'peakRssBytes': report['peakRssBytes']}))


if __name__ == '__main__':
    main()
