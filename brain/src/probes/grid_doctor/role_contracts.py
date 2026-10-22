"""Census exact local contracts for every source role. Never select a table."""
import argparse
from collections import Counter, defaultdict
from dataclasses import asdict
import hashlib
import json
from pathlib import Path
import time

from grid_symbols.scan import Jar, Limits, Refusal, instructions, parse, rss_bytes
from grid_symbols.resolve import resolve, validate
from .contracts import contract, signature_key
from .migrate import bindings, member
from .admission import Work, lineage
from .ownership import bootstraps, method_trace
from .receiver_trace import Declarations, ReceiverLimits

MAX_NAMES = 128
MAX_REPORT = 4 * 1024**2


def member_edge(source, target, candidate, scanned, caller_role, member_role):
    """Trace one bound call and simple superclass delegates. Keep refusal."""
    caller = next(r for r in candidate['members'] if r['role'] == caller_role)
    required = next(r for r in candidate['members'] if r['role'] == member_role)
    result = next(r for r in scanned['members'] if r['role'] == caller_role)
    if result['status'] != 'unique-local-contract' or result['matchCount'] != 1:
        raise Refusal('role-edge-anchor-not-unique')
    hit = result['matches'][0]
    oc, nc = source.code(caller['declaring']), target.code(hit['owner'])
    om, nm = member(oc, caller['name'], caller['descriptor']), member(nc, hit['name'], hit['descriptor'])
    before, after = contract(oc, om, source.classes), contract(nc, nm, target.classes)
    _, mapped = bindings(before, after)
    work = Work(ReceiverLimits())
    old_decl, new_decl = Declarations(source, work), Declarations(target, work)
    edges = []
    for key, value in mapped.items():
        tag, owner, name, desc = key
        if tag != 10 or (name, desc) != (required['name'], required['descriptor']):
            continue
        found = old_decl.find('method', owner, name, desc)
        chain, _ = lineage(source, owner, work)
        if found['status'] == 'declaration' and required['declaring'] in chain:
            edges.append((key, value))
    if len(edges) != 1:
        raise Refusal('role-edge-missing-or-duplicate')
    _, owner, name, desc = edges[0][1]
    route, seen = [], set()
    for _ in range(8):
        target.check()
        found = new_decl.find('method', owner, name, desc)
        if found['status'] != 'declaration':
            raise Refusal('role-edge-unresolved')
        identity = found['owner'], name, desc
        if identity in seen:
            raise Refusal('role-edge-cycle')
        seen.add(identity)
        cls = target.code(found['owner'])
        method = member(cls, name, desc)
        trace = method_trace(target, cls, method, bootstraps(target.zip.read(cls.name + '.class'), cls))
        route.append({'symbolicOwner': owner, 'trace': trace})
        ops = trace['instructions']
        if [i['opcode'] for i in ops] != [42, 183, 176] or method.handlers:
            break
        call = ops[1]['constant']
        if call['descriptor'] != desc or not desc.startswith('()L'):
            raise Refusal('role-edge-nongetter-delegate')
        chain, _ = lineage(target, cls.name, work)
        if call['owner'] not in chain[1:]:
            raise Refusal('role-edge-nonsuper-delegate')
        owner, name, desc = call['owner'], call['name'], call['descriptor']
    else:
        raise Refusal('role-edge-depth-limit')
    old_cls = source.code(required['declaring'])
    old_method = member(old_cls, required['name'], required['descriptor'])
    return {'callerRole': caller_role, 'memberRole': member_role,
            'sourceCaller': caller, 'targetCaller': hit, 'callerDigest': before['digest'],
            'sourceReference': list(edges[0][0]), 'targetReference': list(edges[0][1]),
            'sourceSymbolicDeclaration': old_decl.find('method', *edges[0][0][1:]),
            'source': method_trace(source, old_cls, old_method,
                                   bootstraps(source.zip.read(old_cls.name + '.class'), old_cls)),
            'targetRoute': route,
            'terminalContractEqual': contract(old_cls, old_method, source.classes)['digest'] ==
                                     contract(cls, method, target.classes)['digest'],
            'runtimeReceiverProved': False, 'writeAuthority': False}


def sources(jar, candidate):
    rows, index = [], defaultdict(list)
    for source in candidate['members']:
        row = {'role': source['role'], 'source': source, 'matchCount': 0, 'matches': []}
        rows.append(row)
        if source['kind'] == 'field':
            row['status'] = 'requires-operation-binding'
            continue
        cls = jar.code(source['declaring'])
        methods = [m for m in cls.methods
                   if (m.name, m.desc, m.flags) ==
                   (source['name'], source['descriptor'], source['flags'])]
        if len(methods) != 1:
            raise Refusal('role-source-missing-or-duplicate')
        method = methods[0]
        if method.flags & (0x100 | 0x400):
            row['status'] = 'requires-dispatch-binding'
            continue
        try:
            value = contract(cls, method, jar.classes)
        except Refusal as error:
            if not str(error).startswith('contract-unsupported-constant:'):
                raise
            row.update(status='unsupported-source-contract', reason=str(error))
            continue
        row.update(status='pending', digest=value['digest'])
        index[(signature_key(method, jar.classes), len(method.code), value['digest'])].append(row)
    return rows, index


def census(source, target, candidate, budget=None):
    rows, index = sources(source, candidate)
    shapes = {(shape, size) for shape, size, _ in index}
    work = budget if budget is not None else {'methods': 0, 'instructions': 0}
    start_counts = dict(work)
    unsupported, compared, classes = 0, 0, 0
    for metadata in target.classes.values():
        target.check()
        cls = parse(target.zip.read(metadata.name + '.class'), True)
        classes += 1
        for method in cls.methods:
            target.check()
            work['methods'] += 1
            work['instructions'] += len(instructions(method.code))
            if work['methods'] > 1000000 or work['instructions'] > 16000000:
                raise Refusal('role-census-work-limit')
            shape = signature_key(method, target.classes)
            if (shape, len(method.code)) not in shapes:
                continue
            try:
                value = contract(cls, method, target.classes)
            except Refusal as error:
                if not str(error).startswith('contract-unsupported-constant:'):
                    raise
                unsupported += 1
                continue
            compared += 1
            for row in index.get((shape, len(method.code), value['digest']), ()):
                row['matchCount'] += 1
                hit = {'owner': cls.name, 'name': method.name, 'descriptor': method.desc,
                       'flags': method.flags}
                # Keep a deterministic bounded sample. A truncated pool never selects a role.
                row['matches'].append(hit)
                row['matches'].sort(key=lambda r: (r['owner'], r['name'], r['descriptor']))
                del row['matches'][MAX_NAMES:]
    for row in rows:
        if row['status'] == 'pending':
            n = row['matchCount']
            row['status'] = 'missing' if n == 0 else 'unique-local-contract' if n == 1 else 'ambiguous'
        row['matchesTruncated'] = row['matchCount'] > MAX_NAMES
    return {'sha256': target.sha256, 'members': rows,
            'summary': dict(Counter(r['status'] for r in rows)),
            'work': {k: work[k] - start_counts[k] for k in work} |
                    {'classes': classes, 'compared': compared, 'unsupportedTargets': unsupported},
            'completeTable': False, 'writeAuthority': False,
            'types': [{'role': role, 'source': name, 'status': 'receiver-binding-unproved'}
                      for role, name in sorted(candidate['types'].items())]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('old-jar', 'new-jar', 'report'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    if args.report.exists():
        raise Refusal('role-report-exists')
    root = Path(__file__).resolve().parents[4]
    evidence = root / 'context/evidence/data/phase9b-doctor/v20-preparation'
    candidate_bytes = (evidence / 'candidate.json').read_bytes()
    candidate = json.loads(candidate_bytes)
    rules_bytes = (evidence / 'selectors.json').read_bytes()
    if hashlib.sha256(rules_bytes).hexdigest() != candidate['selectorSha256']:
        raise Refusal('role-source-selector-hash')
    if len(candidate['types']) != 55 or len(candidate['members']) != 76:
        raise Refusal('role-source-coverage')
    if len({r['role'] for r in candidate['members']}) != 76:
        raise Refusal('role-source-duplicate')
    started, jars, limits = time.perf_counter(), [], Limits()

    class BoundedJar(Jar):
        def check(self):
            super().check()
            if time.perf_counter() - started > limits.seconds:
                raise Refusal('role-census-deadline')
            if sum(len(j.code_cache) for j in jars) > limits.code_classes:
                raise Refusal('role-census-code-limit')

    report = {'result': 'refused', 'reason': 'receiver-bindings-and-command-closure-unproved',
              'completeTable': False, 'boundedAdmission': False, 'writeAuthority': False,
              'bridgeCalls': 0, 'nativeCommands': 0, 'vendorClassesInitialized': 0,
              'sourceCandidateSha256': hashlib.sha256(candidate_bytes).hexdigest(),
              'selectorSha256': hashlib.sha256(rules_bytes).hexdigest()}
    try:
        old = BoundedJar(args.old_jar)
        jars.append(old)
        if old.sha256 != candidate['jarSha256']:
            raise Refusal('role-source-jar-hash')
        rules = json.loads(rules_bytes)
        types, members = resolve(old, rules)
        validate(old, rules, types, members)
        if types != candidate['types'] or members != candidate['members']:
            raise Refusal('role-source-table-disagreement')
        new = BoundedJar(args.new_jar)
        jars.append(new)
        budget = {'methods': 0, 'instructions': 0}
        report['censuses'] = [census(old, target, candidate, budget) for target in (old, new)]
        report['membershipEdges'] = [member_edge(old, target, candidate, scanned, 'insert-body', 'members')
                                     for target, scanned in zip((old, new), report['censuses'])]
        report['work'] = budget
        new.check()
    except (Refusal, ValueError, KeyError, IndexError, OSError) as error:
        report['reason'] = str(error)
    finally:
        report['inputs'] = [{'path': str(j.path), 'sha256': j.sha256,
                             'retainedCodeClasses': len(j.code_cache), 'counts': j.stats} for j in jars]
        for jar in jars:
            jar.close()
    report.update(elapsedMs=round((time.perf_counter() - started) * 1000, 3),
                  peakRssBytes=rss_bytes(), limits=asdict(limits),
                  censusLimits={'methods': 1000000, 'instructions': 16000000,
                                'matchesPerRole': MAX_NAMES, 'reportBytes': MAX_REPORT})
    encoded = (json.dumps(report, indent=2) + '\n').encode()
    if len(encoded) > MAX_REPORT:
        raise Refusal('role-report-byte-limit')
    with args.report.open('xb') as output:
        output.write(encoded)
    print(json.dumps({k: report[k] for k in ('result', 'reason', 'elapsedMs', 'peakRssBytes')} |
                     {'reportBytes': len(encoded)}))
    return 0 if 'membershipEdges' in report else 2


if __name__ == '__main__':
    raise SystemExit(main())
