"""Propagate exact operation identities. Refuse incomplete role contracts."""
import argparse
from collections import Counter
from dataclasses import asdict
import hashlib
import json
from pathlib import Path
import time

from grid_symbols.scan import Jar, Limits, Refusal, parse, rss_bytes
from grid_symbols.resolve import resolve, validate
from .admission import Work
from .contracts import contract, references, signature_key
from .migrate import bindings, member, merge, snapshot
from .receiver_trace import Declarations, ReceiverLimits
from .role_contracts import census, member_edge
from .role_variants import trace_variants

MAX_COMPARISONS = 100000
MAX_INSTRUCTIONS = 2000000
MAX_ROUNDS = 128
MAX_REPORT = 8 * 1024**2


def code(jar, name):
    """Read one class without retaining it in the jar cache."""
    jar.check()
    return parse(jar.zip.read(name + '.class'), True)


def canonical_edges(mapped, old_decl, new_decl):
    """Keep symbolic identities and add their class declarations."""
    result = merge([{}, {}], mapped)
    unresolved = []
    for source, target in mapped[1].items():
        tag, owner, name, desc = source
        kind = 'field' if tag == 9 else 'method'
        a = old_decl.find(kind, owner, name, desc)
        b = new_decl.find(kind, *target[1:])
        if a['status'] != 'declaration' or b['status'] != 'declaration':
            unresolved.append({'source': list(source), 'target': list(target),
                               'sourceLookup': a, 'targetLookup': b})
            continue
        ka = tag, a['owner'], name, desc
        kb = target[0], b['owner'], target[2], target[3]
        result = merge(result, [{a['owner']: b['owner']}, {ka: kb}])
    return result, unresolved


def bind_roles(old, new, candidate, scanned):
    """Use complete pools and exact edges. Never infer a runtime receiver."""
    if scanned['sha256'] != new.sha256:
        raise Refusal('binding-census-jar')
    rows = {r['role']: r for r in scanned['members']}
    if len(rows) != len(candidate['members']) or set(rows) != {r['role'] for r in candidate['members']}:
        raise Refusal('binding-census-coverage')
    for row in candidate['members']:
        if rows[row['role']]['source'] != row:
            raise Refusal('binding-census-source')
    work = Work(ReceiverLimits())
    old_decl, new_decl = Declarations(old, work), Declarations(new, work)
    known, selected, rounds, unresolved = [{}, {}], {}, [], []
    counts = {'comparisons': 0, 'instructions': 0}
    source_contracts = {}
    for row in candidate['members']:
        if rows[row['role']]['status'] in ('unique-local-contract', 'ambiguous', 'missing'):
            cls = code(old, row['declaring'])
            m = member(cls, row['name'], row['descriptor'])
            source_contracts[row['role']] = (m, contract(cls, m, old.classes))

    support, unsupported = [], []
    field_owners = {r['declaring'] for r in candidate['members'] if r['kind'] == 'field'}
    for owner in sorted(field_owners):
        cls = code(old, owner)
        fields = {(r['name'], r['descriptor']) for r in candidate['members']
                  if r['kind'] == 'field' and r['declaring'] == owner}
        for m in cls.methods:
            if not any(r['owner'] == owner and (r['name'], r['descriptor']) in fields
                       for r in references(cls, m)):
                continue
            role = '$field-use:' + owner + '.' + m.name + m.desc
            try:
                value = contract(cls, m, old.classes)
            except Refusal as error:
                if not str(error).startswith('contract-unsupported-constant:'):
                    raise
                unsupported.append({'owner': owner, 'name': m.name, 'descriptor': m.desc,
                                    'reason': str(error)})
                continue
            row = {'role': role, 'kind': 'method', 'declaring': owner, 'lookup': owner,
                   'name': m.name, 'descriptor': m.desc, 'flags': m.flags}
            support.append(row)
            source_contracts[role] = (m, value)
    if len(support) + len(unsupported) > 128:
        raise Refusal('binding-field-witness-limit')
    operation_rows = candidate['members'] + support
    for round_number in range(MAX_ROUNDS):
        additions = []
        states = {}
        for row in operation_rows:
            role = row['role']
            if role in selected or role not in source_contracts:
                continue
            source_method, expected = source_contracts[role]
            owner = known[0].get(row['declaring'])
            pool = rows.get(role)
            if not owner and pool is None:
                continue
            if owner:
                cls = code(new, owner)
                hits = [(cls, m) for m in cls.methods
                        if signature_key(m, new.classes) == signature_key(source_method, old.classes)]
                scope = 'bound-declaration'
            elif pool['matchesTruncated']:
                states[role] = {'status': 'unbound-truncated-pool', 'count': pool['matchCount']}
                continue
            else:
                def pool_hits():
                    for hit in pool['matches']:
                        cls = code(new, hit['owner'])
                        yield cls, member(cls, hit['name'], hit['descriptor'])
                hits = pool_hits()
                scope = 'complete-global-pool'
            matches = []
            for cls, method in hits:
                counts['comparisons'] += 1
                if counts['comparisons'] > MAX_COMPARISONS:
                    raise Refusal('binding-comparison-limit')
                try:
                    actual = contract(cls, method, new.classes)
                except Refusal as error:
                    if str(error).startswith('contract-unsupported-constant:'):
                        continue
                    raise
                counts['instructions'] += actual['instructions']
                if counts['instructions'] > MAX_INSTRUCTIONS:
                    raise Refusal('binding-instruction-limit')
                if actual['digest'] != expected['digest']:
                    continue
                mapped = bindings(expected, actual)
                mapped = merge(mapped, [{}, {
                    (10, row['declaring'], row['name'], row['descriptor']):
                    (10, cls.name, method.name, method.desc)}])
                try:
                    mapped, missing = canonical_edges(mapped, old_decl, new_decl)
                    merge(known, mapped)
                except Refusal as error:
                    if str(error) not in ('operation-edge-conflict', 'reference-alias-conflict'):
                        raise
                    continue
                hit = {'owner': cls.name, 'name': method.name, 'descriptor': method.desc,
                       'flags': method.flags}
                matches.append((hit, mapped, missing))
            states[role] = {'status': 'missing-or-conflicting' if not matches else 'ambiguous',
                            'count': len(matches), 'scope': scope}
            if len(matches) == 1:
                additions.append((row, *matches[0], scope))
        if not additions:
            break
        next_known = known
        # Merge the whole round before publishing any result. Order cannot
        # choose between conflicting unique anchors.
        for _, _, mapped, _, _ in additions:
            next_known = merge(next_known, mapped)
        known = next_known
        round_rows = []
        for row, target, _, missing, scope in additions:
            hit = {**target, 'digest': source_contracts[row['role']][1]['digest'],
                   'scope': scope, 'round': round_number}
            selected[row['role']] = hit
            unresolved.extend(missing)
            round_rows.append(row['role'])
        rounds.append(sorted(round_rows))
    else:
        raise Refusal('binding-round-limit')

    roles = []
    for row in candidate['members']:
        role = row['role']
        tag = 9 if row['kind'] == 'field' else 10
        key = tag, row['declaring'], row['name'], row['descriptor']
        edge = known[1].get(key)
        lookup = known[0].get(row['lookup'])
        result = {'role': role, 'source': row, 'lookup': lookup,
                  'operationReference': list(edge) if edge else None,
                  'status': states.get(role, {}).get('status', rows[role]['status']),
                  'runtimeReceiverProved': False}
        if role in selected:
            result.update(status='exact-operation-contract', target=selected[role])
        elif edge:
            declaration = new_decl.find(row['kind'], *edge[1:])
            result['declaration'] = declaration
            result['status'] = 'operation-edge-only'
            if row['kind'] == 'field' and declaration['status'] == 'declaration':
                if declaration['flags'] != row['flags']:
                    result['status'] = 'field-access-changed'
                elif lookup:
                    found = new_decl.find('field', lookup, edge[2], edge[3])
                    result['lookupDeclaration'] = found
                    if found == declaration:
                        result['status'] = 'field-operation-bound'
        if role in states:
            result['remainingPool'] = states[role]
        roles.append(result)
    field_witnesses = []
    for row in support:
        hit = selected.get(row['role'])
        if not hit:
            continue
        oc, nc = code(old, row['declaring']), code(new, hit['owner'])
        field_witnesses.append({'source': snapshot(old, oc, member(oc, row['name'], row['descriptor'])),
                               'target': snapshot(new, nc, member(nc, hit['name'], hit['descriptor'])),
                               'digest': hit['digest']})
    return {'sha256': new.sha256, 'members': roles, 'fieldWitnesses': field_witnesses,
            'types': [{'role': role, 'source': name, 'target': known[0].get(name),
                       'status': 'operation-type-input' if name in known[0] else 'unbound'}
                      for role, name in sorted(candidate['types'].items())],
            'supportMethods': [{'source': r, 'target': selected.get(r['role']),
                                'remainingPool': states.get(r['role'])} for r in support],
            'unsupportedSupportMethods': unsupported,
            'rounds': rounds, 'summary': dict(Counter(r['status'] for r in roles)),
            'typeBindings': dict(sorted(known[0].items())),
            'memberBindings': [{'source': list(k), 'target': list(v)} for k, v in sorted(known[1].items())],
            'unresolvedDeclarations': unresolved, 'work': work.counts | counts,
            'completeTable': False, 'boundedAdmission': False, 'writeAuthority': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('old-jar', 'new-jar', 'report'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    if args.report.exists():
        raise Refusal('binding-report-exists')
    root = Path(__file__).resolve().parents[4]
    data = root / 'context/evidence/data/phase9b-doctor'
    inputs = {name: (data / path).read_bytes() for name, path in {
        'candidate': 'v20-preparation/candidate.json', 'selectors': 'v20-preparation/selectors.json',
        'census': '614-fixtures/role-contracts.json',
        'migration': '614-structural/migration.json'}.items()}
    candidate = json.loads(inputs['candidate'])
    expected = json.loads(inputs['census'])
    if hashlib.sha256(inputs['selectors']).hexdigest() != candidate['selectorSha256']:
        raise Refusal('binding-source-selectors')
    started, jars, limits = time.perf_counter(), [], Limits()

    class BoundedJar(Jar):
        def check(self):
            super().check()
            if time.perf_counter() - started > limits.seconds:
                raise Refusal('binding-deadline')
            if sum(len(j.code_cache) for j in jars) > limits.code_classes:
                raise Refusal('binding-code-limit')

    report = {'result': 'refused', 'reason': 'incomplete-operation-bindings',
              'completeTable': False, 'boundedAdmission': False, 'writeAuthority': False,
              'bridgeCalls': 0, 'nativeCommands': 0, 'vendorClassesInitialized': 0,
              'inputHashes': {k: hashlib.sha256(v).hexdigest() for k, v in inputs.items()}}
    try:
        old = BoundedJar(args.old_jar)
        jars.append(old)
        if old.sha256 != candidate['jarSha256']:
            raise Refusal('binding-source-jar')
        rules = json.loads(inputs['selectors'])
        types, members = resolve(old, rules)
        validate(old, rules, types, members)
        if types != candidate['types'] or members != candidate['members']:
            raise Refusal('binding-source-table')
        new = BoundedJar(args.new_jar)
        jars.append(new)
        budget = {'methods': 0, 'instructions': 0}
        reports = []
        for jar, saved, membership in zip(jars, expected['censuses'], expected['membershipEdges']):
            actual = census(old, jar, candidate, budget)
            if actual != saved:
                raise Refusal('binding-census-disagreement')
            if member_edge(old, jar, candidate, actual, 'insert-body', 'members') != membership:
                raise Refusal('binding-membership-disagreement')
            reports.append(bind_roles(old, jar, candidate, actual))
        report.update(builds=reports, censusWork=budget)
        report['variantTraces'] = [trace_variants(old, jar, candidate, bound,
            json.loads(inputs['migration']), membership) for jar, bound, membership in
            zip(jars, reports, expected['membershipEdges'])]
        new.check()
    except (Refusal, ValueError, KeyError, IndexError, OSError) as error:
        report['reason'] = str(error)
    finally:
        report['inputs'] = [{'path': str(j.path), 'sha256': j.sha256,
                             'retainedCodeClasses': len(j.code_cache)} for j in jars]
        for jar in jars:
            jar.close()
    report.update(elapsedMs=round((time.perf_counter() - started) * 1000, 3),
                  peakRssBytes=rss_bytes(), limits=asdict(limits),
                  bindingLimits={'comparisons': MAX_COMPARISONS, 'instructions': MAX_INSTRUCTIONS,
                                 'rounds': MAX_ROUNDS, 'reportBytes': MAX_REPORT})
    encoded = (json.dumps(report, indent=2) + '\n').encode()
    if len(encoded) > MAX_REPORT:
        raise Refusal('binding-report-byte-limit')
    with args.report.open('xb') as output:
        output.write(encoded)
    print(json.dumps({k: report[k] for k in ('result', 'reason', 'elapsedMs', 'peakRssBytes')} |
                     {'reportBytes': len(encoded)}))
    return 0 if 'variantTraces' in report else 2


if __name__ == '__main__':
    raise SystemExit(main())
