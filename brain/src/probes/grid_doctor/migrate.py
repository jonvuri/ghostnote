"""Trace cross-build command contracts. Never emit a live candidate table."""
import argparse
from dataclasses import asdict
import hashlib
import json
from pathlib import Path
import re
import time

from grid_symbols.scan import Jar, Limits, Refusal, instructions, parse, rss_bytes
from grid_symbols.resolve import resolve, unique, validate
from .contracts import contract, references, signature_key
from .diagnose import class_pair

MAX_MATCHES = 128
MAX_REPORT = 2 * 1024**2


def member(cls, name, desc):
    return unique([m for m in cls.methods if (m.name, m.desc) == (name, desc)], 'trace-member')


def snapshot(jar, cls, method):
    branches = []
    for offset, op, args in instructions(method.code):
        if op in (*range(153, 169), 198, 199, 200, 201):
            branches.append({'offset': offset, 'opcode': op,
                             'target': offset + int.from_bytes(bytes(args), 'big', signed=True)})
        elif op in (170, 171):
            targets = args[3:] if op == 170 else args[2::2]
            branches.append({'offset': offset, 'opcode': op, 'default': offset + args[0],
                             'targets': [offset + t for t in targets]})
    return {'owner': cls.name, 'name': method.name, 'descriptor': method.desc,
            'flags': method.flags, 'codeBytes': len(method.code),
            'classSha256': hashlib.sha256(jar.zip.read(cls.name + '.class')).hexdigest(),
            'exceptionHandlers': [list(h) for h in method.handlers],
            'branches': branches, 'references': references(cls, method)}


def bindings(a, b):
    """Map identities only after an exact local contract match."""
    if a['digest'] != b['digest']:
        raise Refusal('contract-difference')
    result = []
    for category in ('types', 'members'):
        reverse = {label: identity for identity, label in b[category].items()}
        result.append({identity: reverse[label] for identity, label in a[category].items()})
    return result


def merge(current, additions):
    result = [dict(x) for x in current]
    for target, addition in zip(result, additions):
        for old, new in addition.items():
            if old in target and target[old] != new:
                raise Refusal('operation-edge-conflict')
            if new in target.values() and target.get(old) != new:
                raise Refusal('reference-alias-conflict')
            target[old] = new
    return result


class Comparison:
    def __init__(self, old, new):
        self.old, self.new = old, new
        self.work = {'methods': 0, 'instructions': 0, 'streamedCodeClasses': 0}

    def shape(self, jar, cls, method):
        self.work['methods'] += 1
        if self.work['methods'] > 1000000:
            raise Refusal('migration-method-limit')
        jar.check()
        result = contract(cls, method, jar.classes)
        self.work['instructions'] += result['instructions']
        if self.work['instructions'] > 16000000:
            raise Refusal('migration-instruction-limit')
        return result

    def matches(self, source_cls, source_method, known=None, owner=None):
        expected = self.shape(self.old, source_cls, source_method)
        signature = signature_key(source_method, self.old.classes)
        matches = []
        classes = [self.new.classes[owner]] if owner else self.new.classes.values()
        for metadata in classes:
            self.new.check()
            if not any(signature_key(m, self.new.classes) == signature for m in metadata.methods):
                continue
            # Stream code instead of retaining the whole jar's method bodies.
            cls = parse(self.new.zip.read(metadata.name + '.class'), True)
            self.work['streamedCodeClasses'] += 1
            for method in cls.methods:
                if signature_key(method, self.new.classes) != signature:
                    continue
                # Equal normalized opcodes imply equal encoded length here.
                if len(method.code) != len(source_method.code):
                    continue
                try:
                    actual = self.shape(self.new, cls, method)
                except Refusal as error:
                    if str(error).startswith('contract-unsupported-constant:'):
                        continue
                    raise
                if actual['digest'] != expected['digest']:
                    continue
                try:
                    mapped = merge(known or [{}, {}], bindings(expected, actual))
                    mapped = merge(mapped, [{}, {
                        (10, source_cls.name, source_method.name, source_method.desc):
                        (10, cls.name, method.name, method.desc)}])
                except Refusal:
                    continue
                retained = self.new.code(cls.name)
                self.new.check()
                matches.append((retained, member(retained, method.name, method.desc), mapped))
                if len(matches) > MAX_MATCHES:
                    raise Refusal('migration-match-limit')
        return matches


def trace(old, new, candidate, caller):
    compare = Comparison(old, new)
    source = []
    for row in caller['members']:
        cls = old.code(row['owner'])
        method = member(cls, row['method'], row['descriptor'])
        snap = snapshot(old, cls, method)
        if (snap['classSha256'] != row['classSha256'] or
                snap['references'] != row['references'] or method.flags != row['flags'] or
                len(method.code) != row['codeBytes'] or
                snap['exceptionHandlers'] != row['exceptionHandlers']):
            raise Refusal('source-caller-trace-disagreement')
        source.append((cls, method))
    journal_source = unique([(c, m) for c, m in source
                             if c.name == candidate['types']['journal'] and m.desc == '()V'],
                            'journal-source')
    anchor = unique(compare.matches(*journal_source), 'journal-command-anchor')
    known = anchor[2]
    report = {'journalAnchor': {'old': snapshot(old, *journal_source),
                               'new': snapshot(new, *anchor[:2])}, 'matchedCallerMethods': []}
    pending = list(source)
    while pending:
        progress = False
        for cls, method in list(pending):
            owner = known[0].get(cls.name)
            if owner is None:
                continue
            matches = compare.matches(cls, method, known, owner)
            if len(matches) != 1:
                continue
            nc, nm, known = matches[0]
            report['matchedCallerMethods'].append({'old': snapshot(old, cls, method),
                                                    'new': snapshot(new, nc, nm)})
            pending.remove((cls, method))
            progress = True
        if not progress:
            break

    # Project identity requires the getter and the document Undo call edge.
    project = [(c, m) for c, m in source if c.name == candidate['types']['project-root']]
    getter = unique([(c, m) for c, m in project if m.desc != '()V'], 'project-getter-source')
    undo = unique([r for r in candidate['members'] if r['role'] == 'undo-command'], 'document-undo-source')
    project_undo = unique([(c, m) for c, m in project
                          if any(r['owner'] == undo['declaring'] and r['name'] == undo['name']
                                 and r['descriptor'] == undo['descriptor'] for r in references(c, m))],
                         'project-undo-source')
    project_matches = []
    for nc, nm, mapped in compare.matches(*getter, known):
        pairs = [(getter, (nc, nm))]
        for c, m in [project_undo]:
            matches = compare.matches(c, m, mapped, nc.name)
            if len(matches) != 1:
                break
            pc, pm, mapped = matches[0]
            pairs.append(((c, m), (pc, pm)))
        else:
            project_matches.append((mapped, pairs))
    mapped, pairs = unique(project_matches, 'project-caller-chain')
    known = mapped
    report['projectCaller'] = [{'old': snapshot(old, *a), 'new': snapshot(new, *b)} for a, b in pairs]
    refresh = unique([(c, m) for c, m in project if (c, m) not in (getter, project_undo)], 'refresh-source')
    c, m = refresh
    identity = known[1][(10, c.name, m.name, m.desc)]
    nc = new.code(identity[1])
    nm = member(nc, identity[2], identity[3])
    report['projectRefresh'] = {'old': snapshot(old, c, m), 'new': snapshot(new, nc, nm),
                                'equalContract': compare.shape(old, c, m)['digest'] == compare.shape(new, nc, nm)['digest']}

    # Find hook receivers from the bound document and both signatures. This
    # establishes a trace hypothesis only. Both bodies must still match.
    hooks = [(c, m) for c, m in source if m.name in ('aboutToInsertItem', 'aboutToRemoveItem')]
    unique(list({c.name for c, _ in hooks}), 'hook-source-owner')
    document = known[0][candidate['types']['edit-document']]
    signatures = {signature_key(m, old.classes) for _, m in hooks}
    owners = [c.name for c in new.classes.values()
              if any(f.desc == 'L' + document + ';' for f in c.fields) and
              signatures <= {signature_key(m, new.classes) for m in c.methods}]
    hc = new.code(unique(owners, 'document-hook-receiver'))
    report['relationshipHooks'] = []
    for oc, om in hooks:
        nm = unique([m for m in hc.methods if signature_key(m, new.classes) == signature_key(om, old.classes)],
                    'hook-signature')
        before, after = compare.shape(old, oc, om), compare.shape(new, hc, nm)
        report['relationshipHooks'].append({'old': snapshot(old, oc, om), 'new': snapshot(new, hc, nm),
                                             'equalContract': before['digest'] == after['digest']})
    # The repeated object argument supplies an object hypothesis only.
    om, nm = hooks[0][1], member(hc, report['relationshipHooks'][0]['new']['name'],
                                report['relationshipHooks'][0]['new']['descriptor'])
    old_args, new_args = re.findall(r'L([^;]+);', om.desc), re.findall(r'L([^;]+);', nm.desc)
    object_name = candidate['types']['object']
    object_pairs = {n for o, n in zip(old_args, new_args) if o == object_name}
    new_object = unique(list(object_pairs), 'hook-object-argument')
    known = merge(known, [{object_name: new_object}, {}])
    report['typeTraceInputs'] = {role: known[0][name] for role, name in candidate['types'].items() if name in known[0]}
    report['typeChanges'] = {role: class_pair(old, new, candidate['types'][role], name)
                             for role, name in report['typeTraceInputs'].items()}

    record = unique([r for r in candidate['members'] if r['role'] == 'journal-recording-edit'], 'recording-source')
    oc = old.code(record['declaring'])
    om = member(oc, record['name'], record['descriptor'])
    nc = new.code(known[0][oc.name])
    body = compare.shape(old, oc, om)['bodyDigest']
    same_body = [m for m in nc.methods if signature_key(m, new.classes)[1] == signature_key(om, old.classes)[1]
                 and compare.shape(new, nc, m)['bodyDigest'] == body]
    nm = unique(same_body, 'recording-body-hypothesis')
    report['recordingEdit'] = {'old': snapshot(old, oc, om), 'new': snapshot(new, nc, nm),
                             'equalBody': True, 'equalAccess': om.flags == nm.flags}
    diagnostic = {(c.name, m.name, m.desc) for c, m in hooks + project}
    diagnostic.add((record['declaring'], record['name'], record['descriptor']))
    report['unmatchedCallerMethods'] = [snapshot(old, c, m) for c, m in pending
                                        if (c.name, m.name, m.desc) not in diagnostic]

    disposal = unique([r for r in candidate['members'] if r['role'] == 'disposal'], 'disposal-source')
    oc, nc = old.code(object_name), new.code(new_object)
    om = member(oc, disposal['name'], disposal['descriptor'])
    before = compare.shape(old, oc, om)
    disposal_matches = []
    for m in nc.methods:
        if signature_key(m, new.classes) != signature_key(om, old.classes):
            continue
        after = compare.shape(new, nc, m)
        if after['tokens'][:len(before['tokens']) - 1] == before['tokens'][:-1]:
            disposal_matches.append((m, after))
    nm, after = unique(disposal_matches, 'disposal-prefix-hypothesis')
    report['disposal'] = {'old': snapshot(old, oc, om), 'new': snapshot(new, nc, nm),
                          'equalContract': before['digest'] == after['digest'],
                          'basis': 'Exact old body prefix, excluding its final return. Diagnostic only.'}

    # Keep one-hop document, journal, and hook callees for the changed hooks.
    # The disposal tail gets two edges to expose its queue-drain loop.
    extra = {}
    todo = [(hc, member(hc, r['new']['name'], r['new']['descriptor']), 1)
            for r in report['relationshipHooks']]
    todo.append((nc, nm, 2))
    while todo:
        cls, method, depth = todo.pop()
        if depth == 0:
            continue
        for ref in references(cls, method):
            if ref['opcode'] not in (182, 183, 184, 185) or ref['owner'] not in new.classes:
                continue
            # Disposal helper expansion is limited to the added tail call.
            if cls == nc and method == nm and ref['offset'] < len(om.code) - 1:
                continue
            identity = (ref['owner'], ref['name'], ref['descriptor'])
            if identity in extra:
                continue
            target = new.code(ref['owner'])
            methods = [m for m in target.methods if (m.name, m.desc) == identity[1:]]
            if not methods:
                continue
            callee = unique(methods, 'callee')
            extra[identity] = snapshot(new, target, callee)
            todo.append((target, callee, depth - 1))
    report['newCallees'] = list(extra.values())
    report['calleeFields'] = {name: [{'name': f.name, 'descriptor': f.desc, 'flags': f.flags}
                                    for f in new.classes[name].fields]
                              for name in sorted({r['owner'] for r in extra.values()})}
    report['coverage'] = {'requiredTypes': 55, 'requiredMembers': 76,
                          'typeTraceInputs': len(report['typeTraceInputs']),
                          'validatedNewTableMembers': 0,
                          'untracedTypeRoles': sorted(set(candidate['types']) - set(report['typeTraceInputs']))}
    report['work'] = compare.work
    report['result'] = 'refused' if (not all(r['equalContract'] for r in report['relationshipHooks']) or
                                    not report['disposal']['equalContract'] or
                                    not report['recordingEdit']['equalAccess'] or
                                    not report['projectRefresh']['equalContract'] or
                                    report['unmatchedCallerMethods']) else 'traced-subset'
    report['reason'] = 'changed-required-contracts' if report['result'] == 'refused' else 'complete-resolver-not-implemented'
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--old-jar', type=Path, required=True)
    parser.add_argument('--new-jar', type=Path, required=True)
    parser.add_argument('--report', type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[4]
    evidence = root / 'context/evidence/data/phase9b-doctor/v20-preparation'
    candidate = json.loads((evidence / 'candidate.json').read_text())
    caller = json.loads((evidence / 'undo-caller-trace.json').read_text())
    rules_bytes = (evidence / 'selectors.json').read_bytes()
    if hashlib.sha256(rules_bytes).hexdigest() != candidate['selectorSha256']:
        raise Refusal('source-selector-hash')
    started, jars, limits = time.perf_counter(), [], Limits()

    class BoundedJar(Jar):
        def check(self):
            super().check()
            if time.perf_counter() - started > limits.seconds:
                raise Refusal('migration-deadline')
            if sum(len(j.code_cache) for j in jars) > limits.code_classes:
                raise Refusal('migration-code-class-limit')

    report = {'writeAuthority': False, 'completeTable': False, 'bridgeCalls': 0,
              'nativeCommands': 0, 'vendorClassesInitialized': 0}
    try:
        old = BoundedJar(args.old_jar)
        jars.append(old)
        if old.sha256 != candidate['jarSha256'] or old.sha256 != caller['jarSha256']:
            raise Refusal('source-jar-hash')
        types, rows = resolve(old, json.loads(rules_bytes))
        validate(old, json.loads(rules_bytes), types, rows)
        if types != candidate['types'] or rows != candidate['members']:
            raise Refusal('source-table-disagreement')
        new = BoundedJar(args.new_jar)
        jars.append(new)
        report.update(trace(old, new, candidate, caller))
        new.check()
    except (Refusal, ValueError, KeyError, IndexError, OSError) as error:
        report.update(result='refused', reason=str(error))
    finally:
        report['inputs'] = [{'path': str(j.path), 'sha256': j.sha256, 'counts': j.stats,
                             'retainedCodeClasses': len(j.code_cache)} for j in jars]
        for j in jars:
            j.close()
    report.update(elapsedMs=round((time.perf_counter() - started) * 1000, 3),
                  peakRssBytes=rss_bytes(), limits=asdict(limits))
    encoded = (json.dumps(report, indent=2) + '\n').encode()
    if len(encoded) > MAX_REPORT:
        raise Refusal('migration-report-limit')
    with args.report.open('xb') as output:
        output.write(encoded)
    print(json.dumps({k: report[k] for k in ('result', 'reason', 'elapsedMs', 'peakRssBytes')}))
    return 0 if 'journalAnchor' in report else 1


if __name__ == '__main__':
    raise SystemExit(main())
