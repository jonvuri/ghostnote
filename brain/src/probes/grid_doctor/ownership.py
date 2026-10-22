"""Trace ownership and disposal references as data. Never admit a live table."""
import argparse
from dataclasses import asdict, dataclass
import hashlib
import json
from pathlib import Path
import time

from grid_symbols.scan import CP_OPS, Jar, Reader, Refusal, instructions, parse, rss_bytes
from grid_symbols.resolve import unique
from .migrate import member, snapshot


@dataclass
class TraceLimits:
    methods: int = 1000000
    instructions: int = 16000000
    sites: int = 16000
    traces: int = 512
    report_bytes: int = 8 * 1024**2


def constant(cls, index, depth=0):
    """Decode evidence, including dynamic indices. Do not execute a bootstrap."""
    if depth > 16:
        raise Refusal('ownership-constant-depth')
    tag, value = cls.cp[index]
    if tag in (1, 3, 4, 5, 6):
        return {'tag': tag, 'value': value}
    if tag in (7, 8, 16, 19, 20):
        return {'tag': tag, 'value': cls.cp[value][1]}
    if tag in (9, 10, 11):
        owner, nt = value
        ni, di = cls.cp[nt][1]
        return {'tag': tag, 'owner': cls.cp[cls.cp[owner][1]][1],
                'name': cls.cp[ni][1], 'descriptor': cls.cp[di][1]}
    if tag == 12:
        return {'tag': tag, 'name': cls.cp[value[0]][1], 'descriptor': cls.cp[value[1]][1]}
    if tag == 15:
        return {'tag': tag, 'kind': value[0], 'target': constant(cls, value[1], depth + 1)}
    if tag in (17, 18):
        return {**constant(cls, value[1], depth + 1), 'tag': tag, 'bootstrapIndex': value[0]}
    raise Refusal('ownership-constant-tag:' + str(tag))


def bootstraps(data, cls):
    """Read the class attribute that the shared metadata parser discards."""
    r = Reader(data)
    r.take(8)
    count = r.u2()
    index = 1
    widths = {3: 4, 4: 4, 5: 8, 6: 8, 7: 2, 8: 2, 9: 4, 10: 4,
              11: 4, 12: 4, 15: 3, 16: 2, 17: 4, 18: 4, 19: 2, 20: 2}
    while index < count:
        tag = r.u1()
        r.take(r.u2() if tag == 1 else widths[tag])
        index += 2 if tag in (5, 6) else 1
    r.take(6)
    r.take(2 * r.u2())

    def attrs():
        return [(r.u2(), r.take(r.u4())) for _ in range(r.u2())]

    for _ in range(2):
        for _ in range(r.u2()):
            r.take(6)
            attrs()
    result = []
    seen = False
    for name, value in attrs():
        if cls.cp[name][1] != 'BootstrapMethods':
            continue
        if seen:
            raise Refusal('ownership-duplicate-bootstrap-attribute')
        seen = True
        b = Reader(value)
        for _ in range(b.u2()):
            result.append({'handle': constant(cls, b.u2()),
                           'arguments': [constant(cls, b.u2()) for _ in range(b.u2())]})
        if b.pos != len(value):
            raise Refusal('ownership-bootstrap-trailing-data')
    if r.pos != len(data):
        raise Refusal('ownership-class-trailing-data')
    return result


def method_trace(jar, cls, method, bootstrap):
    result = snapshot(jar, cls, method)
    result['instructions'] = []
    for offset, opcode, args in instructions(method.code):
        row = {'offset': offset, 'opcode': opcode, 'args': list(args)}
        if opcode in CP_OPS:
            index = args[0] if opcode == 18 else args[0] * 256 + args[1]
            row['constant'] = constant(cls, index)
            if 'bootstrapIndex' in row['constant']:
                bi = row['constant']['bootstrapIndex']
                if bi >= len(bootstrap):
                    raise Refusal('ownership-missing-bootstrap')
                row['bootstrap'] = bootstrap[bi]
        result['instructions'].append(row)
    return result


def seed_rows(seed):
    rows = [seed['disposal']['new'], seed['recordingEdit']['new']]
    rows += [r['new'] for r in seed['relationshipHooks']]
    rows += seed['newCallees']
    rows += [r['new'] for r in seed['matchedCallerMethods']]
    return rows


def validate_seed(jar, seed):
    target = seed['inputs'][1]
    if jar.sha256 != target['sha256']:
        raise Refusal('ownership-seed-jar-hash')
    for row in seed_rows(seed):
        cls = jar.code(row['owner'])
        actual = snapshot(jar, cls, member(cls, row['name'], row['descriptor']))
        if actual != row:
            raise Refusal('ownership-seed-trace-disagreement')


def scan(jar, seed, expand=(), limits=None):
    limits = limits or TraceLimits()
    validate_seed(jar, seed)
    types = seed['typeTraceInputs']
    document, edit, journal = (types[k] for k in ('edit-document', 'edit', 'journal'))
    hook = unique(sorted({r['new']['owner'] for r in seed['relationshipHooks']}), 'ownership-hook')
    disposal = seed['disposal']['new']
    tail = unique([r for r in disposal['references'] if r['opcode'] == 184
                   and r['offset'] >= seed['disposal']['old']['codeBytes'] - 1], 'ownership-tail')
    tracker = tail['owner']
    tracker_cls = jar.code(tracker)
    reference = unique([r['owner'] for m in tracker_cls.methods for r in snapshot(jar, tracker_cls, m)['references']
                        if r['name'] == '<init>' and r['descriptor'] == '(Ljava/lang/Object;)V'
                        and r['owner'] in jar.classes], 'ownership-reference')
    owners = {document, edit, journal, hook, tracker, reference}
    # Extra owners are explicit investigation inputs, never resolution rules.
    expansion = []
    for name in expand:
        incoming = []
        for owner in sorted(owners):
            cls = jar.code(owner)
            for method in cls.methods:
                jar.check()
                for ref in snapshot(jar, cls, method)['references']:
                    if ref['owner'] == name:
                        incoming.append({'owner': owner, 'method': method.name,
                                         'descriptor': method.desc, 'reference': ref})
        if not incoming or name not in jar.classes:
            raise Refusal('ownership-unlinked-expansion:' + name)
        expansion.append({'owner': name, 'incoming': incoming})
        owners.add(name)
    work = {'classes': 0, 'methods': 0, 'instructions': 0, 'sites': 0, 'traces': 0}
    sites, handles, traces, class_rows = [], [], [], {}

    def tick(key, count=1):
        work[key] += count
        if hasattr(limits, key) and work[key] > getattr(limits, key):
            raise Refusal('ownership-' + key + '-limit')

    for metadata in jar.classes.values():
        jar.check()
        data = jar.zip.read(metadata.name + '.class')
        cls = parse(data, True)
        tick('classes')
        bootstrap = None
        for index, cp in enumerate(cls.cp):
            if cp and cp[0] == 15:
                value = constant(cls, index)
                if value['target'].get('owner') in owners:
                    tick('sites')
                    handles.append({'owner': cls.name, 'constantIndex': index, **value})
        for method in cls.methods:
            jar.check()
            tick('methods')
            raw = instructions(method.code)
            tick('instructions', len(raw))
            tracker_caller = False
            for offset, opcode, args in raw:
                if opcode not in range(178, 186):
                    continue
                ref = constant(cls, args[0] * 256 + args[1])
                if ref['owner'] in owners:
                    tick('sites')
                    sites.append({'caller': cls.name, 'method': method.name, 'descriptor': method.desc,
                                  'offset': offset, 'opcode': opcode, 'target': ref})
                    tracker_caller |= ref['owner'] == tracker
            if cls.name in owners or tracker_caller:
                tick('traces')
                if bootstrap is None:
                    bootstrap = bootstraps(data, cls)
                traces.append(method_trace(jar, cls, method, bootstrap))
                class_rows[cls.name] = {'sha256': hashlib.sha256(data).hexdigest(),
                                        'parent': cls.parent, 'flags': cls.flags,
                                        'fields': [{'name': f.name, 'descriptor': f.desc, 'flags': f.flags}
                                                   for f in cls.fields]}
    return {'result': 'refused', 'reason': 'ownership-and-tracking-admission-not-established',
            'completeTable': False, 'writeAuthority': False,
            'roles': {'document': document, 'edit': edit, 'journal': journal, 'hook': hook,
                      'tracker': tracker, 'reference': reference},
            'expansion': expansion, 'classes': class_rows, 'methods': traces,
            'directSites': sites, 'methodHandles': handles, 'work': work,
            'coverage': {'requiredTypes': 55, 'requiredMembers': 76, 'validatedNewTableMembers': 0},
            'limitsOfEvidence': [
                'Direct bytecode references and constant-pool handles in this jar only.',
                'Bootstrap entries are evidence, not validated resolver contracts.',
                'No complete virtual dispatch, reflection, native code, or external-jar caller census.',
                'No runtime mode, queue size, ownership state, or live behavior is measured.']}


def write_report(path, report, limits):
    data = (json.dumps(report, indent=2) + '\n').encode()
    if len(data) > limits.report_bytes:
        raise Refusal('ownership-report-limit')
    with path.open('xb') as output:
        output.write(data)
    return len(data)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--jar', type=Path, required=True)
    parser.add_argument('--seed', type=Path, required=True)
    parser.add_argument('--expand-owner', action='append', default=[])
    parser.add_argument('--report', type=Path, required=True)
    args = parser.parse_args()
    if args.report.exists():
        raise Refusal('ownership-report-exists')
    if args.seed.stat().st_size > 2 * 1024**2:
        raise Refusal('ownership-seed-byte-limit')
    seed_bytes = args.seed.read_bytes()
    seed = json.loads(seed_bytes)
    started, jar, limits = time.perf_counter(), None, TraceLimits()
    report = {'result': 'refused', 'reason': 'incomplete-trace', 'completeTable': False,
              'writeAuthority': False}
    try:
        jar = Jar(args.jar)
        report.update(scan(jar, seed, args.expand_owner, limits))
        jar.check()
    except (Refusal, ValueError, KeyError, IndexError, OSError) as error:
        report['reason'] = str(error)
    finally:
        if jar:
            report['input'] = {'path': str(jar.path), 'sha256': jar.sha256, 'counts': jar.stats,
                               'retainedCodeClasses': len(jar.code_cache), 'limits': asdict(jar.limits)}
            jar.close()
    report.update(seedSha256=hashlib.sha256(seed_bytes).hexdigest(),
                  elapsedMs=round((time.perf_counter() - started) * 1000, 3),
                  peakRssBytes=rss_bytes(), traceLimits=asdict(limits),
                  bridgeCalls=0, nativeCommands=0, vendorClassesInitialized=0)
    size = write_report(args.report, report, limits)
    print(json.dumps({k: report[k] for k in ('result', 'reason', 'elapsedMs', 'peakRssBytes')}
                     | {'reportBytes': size}))
    return 0 if 'work' in report else 1


if __name__ == '__main__':
    raise SystemExit(main())
