"""Resolve source operation anchors. Keep runtime admission separate."""
import argparse
import copy
from collections import Counter, OrderedDict
import hashlib
import json
from pathlib import Path
import time

from grid_symbols.scan import Jar, Refusal, descriptor, instructions, parse, rss_bytes
from grid_symbols.resolve import resolve, validate
from .admission import Work
from .contracts import contract, references, signature_key
from .migrate import bindings, member, merge, snapshot
from .receiver_trace import Declarations, ReceiverLimits
from .role_bindings import bind_roles, canonical_edges
from .role_contracts import census as role_census
from .bootstrap_contracts import managed_pair

MAX_METHODS = 1000000
MAX_SCAN_INSTRUCTIONS = 16000000
MAX_COMPARISONS = 100000
MAX_BIND_INSTRUCTIONS = 2000000
MAX_TRACES = 512
MAX_REPORT = 8 * 1024**2


class Code:
    """Keep at most 128 code classes across both inputs."""
    def __init__(self):
        self.cache = OrderedDict()

    def get(self, jar, name):
        jar.check()
        key = id(jar), name
        if key in self.cache:
            self.cache.move_to_end(key)
            return self.cache[key]
        value = parse(jar.zip.read(name + '.class'), True)
        self.cache[key] = value
        if len(self.cache) > 128:
            self.cache.popitem(last=False)
        return value


def checked_contract(cls, method, classes):
    try:
        return contract(cls, method, classes)
    except Refusal as error:
        if str(error).startswith('contract-unsupported-constant:'):
            return None
        raise


def source_contracts(old, plan, code):
    result = {}
    for row in plan['anchors'] + plan['roleWitnesses']:
        owner, name, desc = row['source']
        cls = code.get(old, owner)
        value = contract(cls, member(cls, name, desc), old.classes)
        if value['digest'] != row['digest']:
            raise Refusal('descriptor-source-contract')
        result[tuple(row['source'])] = value
    if len(result) > MAX_TRACES:
        raise Refusal('descriptor-source-limit')
    return result


def anchor_census(old, target, plan, expected, code):
    """Count all matches. Keep a target only while its complete count is one."""
    keys = {row['digest'] for row in plan['anchors']}
    shapes = {signature_key(member(code.get(old, r['source'][0]), *r['source'][1:]), old.classes)
              for r in plan['anchors']}
    counts, unique, work = Counter(), {}, Counter()
    for name in sorted(target.classes):
        target.check()
        metadata = target.classes[name]
        if not any(signature_key(m, target.classes) in shapes for m in metadata.methods):
            work['methods'] += len(metadata.methods)
            if work['methods'] > MAX_METHODS:
                raise Refusal('descriptor-scan-method-limit')
            continue
        cls = code.get(target, name)
        for method in cls.methods:
            work['methods'] += 1
            if work['methods'] > MAX_METHODS:
                raise Refusal('descriptor-scan-method-limit')
            if signature_key(method, target.classes) not in shapes:
                continue
            work['instructions'] += len(instructions(method.code))
            if work['instructions'] > MAX_SCAN_INSTRUCTIONS:
                raise Refusal('descriptor-scan-instruction-limit')
            value = checked_contract(cls, method, target.classes)
            if value is None or value['digest'] not in keys:
                continue
            key = value['digest']
            counts[key] += 1
            if counts[key] == 1:
                unique[key] = [name, method.name, method.desc]
            else:
                unique.pop(key, None)
    return {'sha256': target.sha256,
            'pools': [{'digest': k, 'count': counts[k], 'unique': unique.get(k)} for k in sorted(keys)],
            'work': dict(work)}


def hierarchy_edges(old, target, known):
    """Bind direct superclass edges. These are static relationships only."""
    additions, evidence = [{}, {}], []
    for source, dest in sorted(known[0].items()):
        if source not in old.classes or dest not in target.classes:
            continue
        a, b = old.classes[source].parent, target.classes[dest].parent
        if a not in old.classes:
            if b != a:
                raise Refusal('descriptor-external-parent-change')
            continue
        if b not in target.classes:
            raise Refusal('descriptor-missing-parent')
        additions = merge(additions, [{a: b}, {}])
        evidence.append({'source': [source, a], 'target': [dest, b]})
    merge(known, additions)
    return additions, evidence


def override_edges(old, target, key, hit, code):
    """Link a concrete override to matching ancestor declarations."""
    owner, name, desc = key
    dest, renamed, signature = hit
    source_method = member(code.get(old, owner), name, desc)
    target_method = member(code.get(target, dest), renamed, signature)
    if source_method.flags & (2 | 8) or target_method.flags & (2 | 8) or name.startswith('<'):
        return [{}, {}]
    result = [{}, {}]
    a, b = old.classes[owner].parent, target.classes[dest].parent
    for _ in range(128):
        if a not in old.classes or b not in target.classes:
            break
        am = [m for m in old.classes[a].methods if (m.name, m.desc) == (name, desc)]
        bm = [m for m in target.classes[b].methods if (m.name, m.desc) == (renamed, signature)]
        if len(am) > 1 or len(bm) > 1:
            raise Refusal('descriptor-duplicate-override')
        if am and bm and not (am[0].flags & (2 | 8) or bm[0].flags & (2 | 8)):
            if am[0].flags != bm[0].flags:
                raise Refusal('descriptor-override-access')
            result = merge(result, [{a: b}, {(10, a, name, desc): (10, b, renamed, signature)}])
        elif bool(am) != bool(bm):
            raise Refusal('descriptor-override-relationship')
        a, b = old.classes[a].parent, target.classes[b].parent
    else:
        raise Refusal('descriptor-override-depth')
    return result



def abstract_interface_slot(jar, lookup, owner, name, desc, work):
    """Resolve one abstract interface slot. Do not select an implementation."""
    pending, seen, matches = [lookup], set(), []
    while pending:
        current = pending.pop()
        if current in seen:
            continue
        seen.add(current)
        work.tick('hierarchy_edges')
        cls = jar.classes.get(current)
        if cls is None:
            continue
        declarations = [m for m in cls.methods if (m.name, m.desc) == (name, desc)]
        if len(declarations) > 1:
            raise Refusal('descriptor-duplicate-interface-slot')
        if declarations:
            method = declarations[0]
            if not cls.flags & 512 or not method.flags & 1024 or method.flags & (2 | 8):
                raise Refusal('descriptor-interface-implementation-required')
            matches.append({'status': 'declaration', 'owner': current, 'flags': method.flags})
        pending.extend(cls.interfaces)
        pending.append(cls.parent)
    if len(matches) != 1 or matches[0]['owner'] != owner:
        raise Refusal('descriptor-interface-slot-ambiguous')
    return matches[0]


def extend(old, target, candidate, seed, plan, census, code):
    """Require exact witnesses and consistent rounds. Do not emit a live table."""
    if seed['sha256'] != target.sha256 or census['sha256'] != target.sha256:
        raise Refusal('descriptor-input-jar')
    expected = source_contracts(old, plan, code)
    known = [dict(seed['typeBindings']),
             {tuple(r['source']): tuple(r['target']) for r in seed['memberBindings']}]
    work = Work(ReceiverLimits())
    od, nd = Declarations(old, work), Declarations(target, work)
    pools = {r['digest']: r for r in census['pools']}
    anchors, additions = [], [{}, {}]
    for row in plan['anchors']:
        pool = pools[row['digest']]
        if pool['count'] != 1 or pool['unique'] is None:
            raise Refusal('descriptor-anchor-count:' + str(pool['count']))
        key, hit = tuple(row['source']), tuple(pool['unique'])
        cls = code.get(target, hit[0])
        actual = contract(cls, member(cls, *hit[1:]), target.classes)
        mapped = merge(bindings(expected[key], actual),
                       [{key[0]: hit[0]}, {(10, *key): (10, *hit)}])
        mapped, unresolved = canonical_edges(mapped, od, nd)
        additions = merge(additions, mapped)
        anchors.append({'source': list(key), 'target': list(hit), 'digest': row['digest'],
                        'unresolvedDeclarations': unresolved})
    known = merge(known, additions)
    witnesses = {tuple(r['source']) for r in plan['roleWitnesses']}
    field_keys = {(r['declaring'], r['name'], r['descriptor'])
                  for r in candidate['members'] if r['kind'] == 'field'}
    for owner in sorted({x[0] for x in field_keys}):
        cls = code.get(old, owner)
        for method in cls.methods:
            if any((r['owner'], r['name'], r['descriptor']) in field_keys for r in references(cls, method)):
                witnesses.add((owner, method.name, method.desc))
    role_keys = {(r['declaring'], r['name'], r['descriptor'])
                 for r in candidate['members'] if r['kind'] == 'method'}
    selected, unsupported, rounds, parents = {}, {}, [], []
    counters = Counter()
    for round_number in range(128):
        parent_adds, parent_rows = hierarchy_edges(old, target, known)
        next_known = merge(known, parent_adds)
        parents.extend(r for r in parent_rows if r not in parents)
        states, pending = {}, []
        for key in sorted(witnesses | role_keys):
            target.check()
            if key in selected or key[0] not in next_known[0]:
                continue
            source_cls = code.get(old, key[0])
            source_method = member(source_cls, *key[1:])
            value = checked_contract(source_cls, source_method, old.classes)
            if value is None:
                unsupported[key] = 'unsupported-source-contract'
                continue
            dest = next_known[0][key[0]]
            cls = code.get(target, dest)
            matches = []
            for method in cls.methods:
                if signature_key(method, target.classes) != signature_key(source_method, old.classes):
                    continue
                counters['comparisons'] += 1
                counters['instructions'] += len(instructions(method.code))
                if counters['comparisons'] > MAX_COMPARISONS or counters['instructions'] > MAX_BIND_INSTRUCTIONS:
                    raise Refusal('descriptor-binding-work-limit')
                actual = checked_contract(cls, method, target.classes)
                if actual is None or actual['digest'] != value['digest']:
                    continue
                hit = (dest, method.name, method.desc)
                mapped = merge(bindings(value, actual), [{key[0]: dest}, {(10, *key): (10, *hit)}])
                try:
                    mapped, unresolved = canonical_edges(mapped, od, nd)
                    mapped = merge(mapped, override_edges(old, target, key, hit, code))
                    merge(next_known, mapped)
                except Refusal as error:
                    if str(error) in ('operation-edge-conflict', 'reference-alias-conflict',
                                     'descriptor-override-relationship', 'descriptor-override-access'):
                        continue
                    raise
                matches.append((hit, mapped, unresolved))
            states[key] = len(matches)
            if len(matches) == 1:
                pending.append((key, value, *matches[0]))
        for key, value, hit, mapped, unresolved in pending:
            next_known = merge(next_known, mapped)
        if next_known == known and not pending:
            break
        known = next_known
        for key, value, hit, mapped, unresolved in pending:
            selected[key] = {'source': list(key), 'target': list(hit), 'digest': value['digest'],
                             'round': round_number, 'unresolvedDeclarations': unresolved}
        if len(selected) + len(anchors) > MAX_TRACES:
            raise Refusal('descriptor-trace-limit')
        rounds.append(len(pending))
    else:
        raise Refusal('descriptor-round-limit')
    rows = []
    for row in candidate['members']:
        key = row['declaring'], row['name'], row['descriptor']
        tag = 9 if row['kind'] == 'field' else 10
        ref = known[1].get((tag, *key))
        lookup = known[0].get(row['lookup'])
        result = {'role': row['role'], 'source': row, 'reference': list(ref) if ref else None,
                  'lookup': lookup, 'runtimeReceiverProved': False}
        if ref and lookup:
            declaration = nd.find(row['kind'], *ref[1:])
            found = nd.find(row['kind'], lookup, ref[2], ref[3])
            if row['flags'] & 1024 and target.classes[ref[1]].flags & 512:
                declaration = abstract_interface_slot(target, ref[1], ref[1], ref[2], ref[3], work)
                found = abstract_interface_slot(target, lookup, ref[1], ref[2], ref[3], work)
            result.update(declaration=declaration, lookupDeclaration=found)
            if declaration != found or declaration.get('flags') != row['flags']:
                result['status'] = 'lookup-or-access-difference'
            elif row['kind'] == 'field':
                result['status'] = 'field-operation-bound'
            elif key in selected:
                result['status'] = 'abstract-slot-bound' if row['flags'] & 1024 else 'exact-operation-contract'
            else:
                result['status'] = unsupported.get(key, 'required-body-difference')
        else:
            result['status'] = 'unbound-or-ambiguous'
        result['remainingCount'] = states.get(key)
        rows.append(result)
    managed_row = next((r for r in rows if r['role'] == 'managed-id'), None)
    bootstrap = None
    if managed_row is not None and managed_row['reference'] is not None:
        bootstrap = managed_pair(old, target, managed_row['source'], managed_row['reference'], known, code)
        managed_row['status'] = 'bootstrap-local-contract'
    return {'bootstrap': bootstrap, 'sha256': target.sha256, 'types': {role: known[0].get(name) for role, name in candidate['types'].items()},
            'typeBindings': known[0], 'memberBindings': [{'source': list(k), 'target': list(v)}
                                                       for k, v in sorted(known[1].items())],
            'members': rows, 'summary': dict(Counter(r['status'] for r in rows)),
            'anchors': anchors, 'witnesses': list(selected.values()), 'parentEdges': parents,
            'rounds': rounds, 'work': work.counts | dict(counters),
            'completeTable': False, 'boundedAdmission': False, 'writeAuthority': False}


def validate_symbols(jar, rules, report):
    """Check the complete symbolic table. Do not admit command behavior."""
    adjusted = copy.deepcopy(rules)
    rows = []
    for item in report['members']:
        ref, found = item['reference'], item.get('declaration', {})
        if ref is None or found.get('status') != 'declaration':
            raise Refusal('descriptor-incomplete-symbol-table')
        source = item['source']
        row = {'role': item['role'], 'lookup': item['lookup'], 'declaring': ref[1],
               'kind': source['kind'], 'name': ref[2], 'descriptor': ref[3],
               'flags': found['flags']}
        rows.append(row)
        rule = next(r for r in adjusted['members'] if r['role'] == item['role'])
        if row['flags'] != rule['flags']:
            if item['role'] != 'journal-recording-edit' or rule['flags'] != 2 or row['flags'] != 0:
                raise Refusal('descriptor-untraced-access-change')
            rule['flags'] = 0
    result = validate(jar, adjusted, report['types'], rows)
    return {'types': report['types'], 'members': rows, 'validation': result,
            'symbolicCoverageComplete': True, 'completeTable': False,
            'boundedAdmission': False, 'writeAuthority': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('old-jar', 'new-jar', 'plan', 'report'):
        parser.add_argument('--' + name, type=Path, required=True)
    parser.add_argument('--jdk-root', type=Path)
    args = parser.parse_args()
    if args.report.exists():
        raise Refusal('descriptor-report-exists')
    root = Path(__file__).resolve().parents[4]
    data = root / 'context/evidence/data/phase9b-doctor'
    paths = {'candidate': data / 'v20-preparation/candidate.json',
             'selectors': data / 'v20-preparation/selectors.json',
             'census': data / '614-fixtures/role-contracts.json',
             'bindings': data / '614-bindings/bindings.json', 'plan': args.plan}
    raw = {key: path.read_bytes() for key, path in paths.items()}
    inputs = {key: json.loads(value) for key, value in raw.items()}
    if inputs['plan']['format'] != 'grid-doctor-source-anchors-v1':
        raise Refusal('descriptor-plan-format')
    if hashlib.sha256(raw['selectors']).hexdigest() != inputs['candidate']['selectorSha256']:
        raise Refusal('descriptor-source-selectors')
    for key in ('candidate', 'selectors', 'census'):
        if hashlib.sha256(raw[key]).hexdigest() != inputs['bindings']['inputHashes'][key]:
            raise Refusal('descriptor-preserved-input')
    start, jars = time.perf_counter(), []

    class BoundedJar(Jar):
        def check(self):
            super().check()
            if time.perf_counter() - start > 120:
                raise Refusal('descriptor-deadline')

    try:
        old = BoundedJar(args.old_jar); jars.append(old)
        target = BoundedJar(args.new_jar); jars.append(target)
        candidate = inputs['candidate']
        source_types, source_members = resolve(old, inputs['selectors'])
        validate(old, inputs['selectors'], source_types, source_members)
        if old.sha256 != candidate['jarSha256'] or source_types != candidate['types'] or source_members != candidate['members']:
            raise Refusal('descriptor-source-table')
        old.code_cache.clear()
        code = Code()
        expected = source_contracts(old, inputs['plan'], code)
        builds, censuses = [], []
        fresh_work = {'methods': 0, 'instructions': 0}
        for i, jar in enumerate(jars):
            saved = next((r for r in inputs['census']['censuses'] if r['sha256'] == jar.sha256), None)
            scanned = saved if saved is not None else role_census(old, jar, candidate, fresh_work)
            seed = bind_roles(old, jar, candidate, scanned)
            prior = next((r for r in inputs['bindings']['builds'] if r['sha256'] == jar.sha256), None)
            if prior is not None and seed != prior:
                raise Refusal('descriptor-seed-reproduction')
            census = anchor_census(old, jar, inputs['plan'], expected, code)
            censuses.append(census)
            build = extend(old, jar, candidate, seed, inputs['plan'], census, code)
            build['symbolTable'] = validate_symbols(jar, inputs['selectors'], build)
            if args.jdk_root is not None:
                from .explicit_variants import jdk_membership, variants
                dependency = jdk_membership(args.jdk_root)
                build['localVariants'] = variants(old, jar, candidate, build, code, dependency)
                allowed = {'abstract-slot-bound', 'exact-operation-contract', 'field-operation-bound',
                           'bootstrap-local-contract'}
                covered = {r['role'] for r in build['localVariants'] if r['localContractChecked']}
                if any(r['status'] not in allowed and r['role'] not in covered for r in build['members']):
                    raise Refusal('descriptor-local-role-contract-incomplete')
                build['localRoleContractsComplete'] = True
                build['membershipDependency'] = dependency
            builds.append(build)
        report = {'result': 'refused', 'reason': 'runtime-contracts-and-admission-required',
                  'completeTable': False, 'boundedAdmission': False, 'writeAuthority': False,
                  'bridgeCalls': 0, 'nativeCommands': 0, 'vendorClassesInitialized': 0,
                  'inputHashes': {key: hashlib.sha256(value).hexdigest() for key, value in raw.items()},
                  'censuses': censuses, 'builds': builds, 'freshRoleCensusWork': fresh_work,
                  'elapsedMs': round((time.perf_counter() - start) * 1000, 3), 'peakRssBytes': rss_bytes()}
        encoded = json.dumps(report, indent=2).encode() + b'\n'
        if len(encoded) > MAX_REPORT:
            raise Refusal('descriptor-report-limit')
        with args.report.open('xb') as stream:
            stream.write(encoded)
        print(json.dumps({'bytes': len(encoded), 'elapsedMs': report['elapsedMs'],
                          'peakRssBytes': report['peakRssBytes'], 'summaries': [b['summary'] for b in builds]}))
    finally:
        for jar in jars:
            jar.close()


if __name__ == '__main__':
    main()
