"""Compare rejected build selectors as data. Never emit a live candidate table."""
import argparse
from collections import Counter, defaultdict
from dataclasses import asdict
import hashlib
import json
from pathlib import Path
import re
import time

from grid_symbols.scan import Jar, Limits, Refusal, class_shape, class_trace, digest, rss_bytes
from grid_symbols.resolve import resolve, validate

MAX_NAMES = 128
MAX_REPORT_BYTES = 1024 * 1024


def rounds(jar):
    def external(name):
        return 'vendor' if name in jar.classes else name
    base = {}
    for name, cls in jar.classes.items():
        jar.check()
        base[name] = digest(class_shape(cls, external))
    result = [base]
    for _ in range(2):
        previous = result[-1]
        current = {}
        for name, cls in jar.classes.items():
            jar.check()
            current[name] = digest(class_shape(cls, lambda n: previous.get(n, n)))
        result.append(current)
    if result[-1] != jar.keys:
        raise Refusal('diagnostic-refinement-disagreement')
    return result


def indexes(keys):
    result = defaultdict(list)
    for name, key in keys.items():
        result[key].append(name)
    return result


def sample(names):
    return {'count': len(names), 'names': sorted(names)[:MAX_NAMES],
            'truncated': len(names) > MAX_NAMES}


def type_census(old, new, rules, old_types):
    old_rounds, new_rounds = rounds(old), rounds(new)
    new_indexes = [indexes(keys) for keys in new_rounds]
    rows = []
    for role, rule in rules['types'].items():
        new.check()
        name = old_types[role]
        pools = [index.get(keys[name], []) for keys, index in zip(old_rounds, new_indexes)]
        strict = pools[-1]
        if 'codeTrace' in rule:
            strict = [n for n in strict if class_trace(new.code(n), new.keys) == rule['codeTrace']]
        rows.append({'role': role, 'oldType': name,
                     'rounds': [sample(p) for p in pools], 'strict': sample(strict)})
    return rows, old_rounds, new_rounds


def member_census(rules, types):
    available = {r['role'] for r in types if r['strict']['count'] == 1}
    result = []
    for rule in rules['members']:
        required = {rule['lookupType'], rule['declaringType']}
        required.update(re.findall(r'@([^;]+);', rule['signature']))
        if 'dispatchType' in rule:
            required.add(rule['dispatchType'])
        missing = sorted(required - available)
        result.append({'role': rule['role'], 'unresolvedTypes': missing,
                       'memberValidation': 'not-run', 'writeAuthority': False})
    return result


def shallow_shape(jar, cls):
    return class_shape(cls, lambda n: 'vendor' if n in jar.classes else n)


def shape_delta(before, after):
    a, b = Counter(map(tuple, before)), Counter(map(tuple, after))
    return {'removed': sorted((a - b).elements()), 'added': sorted((b - a).elements())}


def class_pair(old, new, a, b):
    ac, bc = old.classes[a], new.classes[b]
    ash, bsh = shallow_shape(old, ac), shallow_shape(new, bc)
    return {'old': a, 'newHypothesis': b, 'oldParent': ac.parent, 'newParent': bc.parent,
            'oldClassSha256': hashlib.sha256(old.zip.read(a + '.class')).hexdigest(),
            'newClassSha256': hashlib.sha256(new.zip.read(b + '.class')).hexdigest(),
            'equalShallowShape': ash == bsh,
            'oldCounts': {'fields': len(ac.fields), 'methods': len(ac.methods)},
            'newCounts': {'fields': len(bc.fields), 'methods': len(bc.methods)},
            'fields': shape_delta(ash[-2], bsh[-2]), 'methods': shape_delta(ash[-1], bsh[-1])}


def boolean_trace(old, new, census, old_rounds, new_rounds):
    row = next(r for r in census if r['role'] == 'boolean-atom')
    if row['rounds'][0]['count'] != 1:
        return {'result': 'no-unique-shallow-hypothesis', 'writeAuthority': False}
    a, b = row['oldType'], row['rounds'][0]['names'][0]
    root_a, root_b = a, b
    chain, seen = [], set()
    while a in old.classes and b in new.classes:
        new.check()
        if (a, b) in seen or len(chain) >= old.limits.depth:
            raise Refusal('diagnostic-inheritance-limit')
        seen.add((a, b))
        chain.append(class_pair(old, new, a, b))
        a, b = old.classes[a].parent, new.classes[b].parent
    def references(cls):
        return {cls.parent, *cls.interfaces,
                *(n for m in cls.fields + cls.methods for n in re.findall(r'L([^;]+);', m.desc))}
    new_refs = references(new.classes[root_b])
    dependencies = []
    for name in sorted(references(old.classes[root_a])):
        if name not in old.classes:
            continue
        matches = [n for n in new_refs if n in new.classes and old_rounds[0][name] == new_rounds[0][n]]
        dependencies.append({'oldType': name, 'shallowMatchesAmongNewReferences': sample(matches)})
    return {'result': 'diagnostic-hypothesis-only', 'writeAuthority': False,
            'basis': 'Unique shallow atom shape, then declared superclass edges. No runtime identity proof.',
            'chain': chain, 'directDependencies': dependencies}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--old-jar', type=Path, required=True)
    parser.add_argument('--new-jar', type=Path, required=True)
    parser.add_argument('--selectors', type=Path, required=True)
    parser.add_argument('--old-candidate', type=Path, required=True)
    parser.add_argument('--report', type=Path, required=True)
    args = parser.parse_args()
    started = time.perf_counter()
    limits = Limits()
    jars = []
    def check():
        if time.perf_counter() - started > limits.seconds:
            raise Refusal('diagnostic-deadline')
        if rss_bytes() > limits.rss:
            raise Refusal('diagnostic-rss-limit')
        if sum(len(getattr(j, 'code_cache', {})) for j in jars) > limits.code_classes:
            raise Refusal('diagnostic-code-class-limit')
    class DiagnosticJar(Jar):
        def check(self):
            super().check()
            check()
    def load(path):
        if path.stat().st_size > 128 * 1024:
            raise Refusal('diagnostic-input-limit')
        return json.loads(path.read_text())
    report = {'format': 1, 'result': 'diagnostic', 'writeAuthority': False,
              'bridgeCalls': 0, 'nativeCommands': 0, 'vendorClassesInitialized': 0}
    try:
        rules, candidate = load(args.selectors), load(args.old_candidate)
        if len(rules['types']) != 55 or len(rules['members']) != 76:
            raise Refusal('diagnostic-role-limit')
        if hashlib.sha256(args.selectors.read_bytes()).hexdigest() != candidate['selectorSha256']:
            raise Refusal('diagnostic-selector-hash')
        old = DiagnosticJar(args.old_jar)
        jars.append(old)
        check()
        if old.sha256 != candidate['jarSha256']:
            raise Refusal('diagnostic-old-jar-hash')
        types, members = resolve(old, rules)
        validate(old, rules, types, members)
        if types != candidate['types'] or members != candidate['members']:
            raise Refusal('diagnostic-old-oracle-disagreement')
        new = DiagnosticJar(args.new_jar)
        jars.append(new)
        check()
        try:
            resolve(new, rules)
            report['strictResolution'] = {'result': 'matched'}
        except Refusal as error:
            report['strictResolution'] = {'result': 'refused', 'reason': str(error)}
        census, old_rounds, new_rounds = type_census(old, new, rules, types)
        report['typeCensus'] = census
        report['memberCensus'] = member_census(rules, census)
        report['booleanTrace'] = boolean_trace(old, new, census, old_rounds, new_rounds)
        report['summary'] = {
            'strictUniqueTypes': sum(r['strict']['count'] == 1 for r in census),
            'strictMissingTypes': sum(r['strict']['count'] == 0 for r in census),
            'shallowUniqueTypes': sum(r['rounds'][0]['count'] == 1 for r in census),
            'shallowMissingTypes': sum(r['rounds'][0]['count'] == 0 for r in census),
            'shallowAmbiguousTypes': sum(r['rounds'][0]['count'] > 1 for r in census),
            'membersWithUnresolvedTypes': sum(bool(r['unresolvedTypes']) for r in report['memberCensus'])}
        check()
    except (Refusal, ValueError, KeyError, OSError) as error:
        report.update(result='refused', reason=str(error))
    finally:
        report['inputs'] = [{'path': str(j.path.resolve()), 'sha256': j.sha256,
                             'mtimeNs': str(j.path.stat().st_mtime_ns), 'counts': j.stats,
                             'timingsMs': j.timings, 'retainedCodeClasses': len(j.code_cache)} for j in jars]
        for jar in jars:
            jar.close()
    report['elapsedMs'] = round((time.perf_counter() - started) * 1000, 3)
    report['peakRssBytes'] = rss_bytes()
    report['limitsPerJar'] = asdict(limits)
    report['diagnosticLimits'] = {'jars': 2, 'seconds': limits.seconds, 'rssBytes': limits.rss,
                                  'retainedCodeClasses': limits.code_classes,
                                  'candidateNamesPerRow': MAX_NAMES, 'reportBytes': MAX_REPORT_BYTES}
    encoded = (json.dumps(report, indent=2) + '\n').encode()
    if len(encoded) > MAX_REPORT_BYTES:
        raise Refusal('diagnostic-report-limit')
    with args.report.open('xb') as output:
        output.write(encoded)
    print(json.dumps({k: report[k] for k in ('result', 'summary', 'elapsedMs', 'peakRssBytes') if k in report}))
    return 0 if report['result'] == 'diagnostic' else 1


if __name__ == '__main__':
    raise SystemExit(main())
