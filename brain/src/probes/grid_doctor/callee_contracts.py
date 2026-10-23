"""Compare traced callees through exact local contracts and explicit variants."""
import copy
from collections import Counter
from grid_symbols.scan import Refusal, descriptor, digest, instructions
from .admission import Work
from .bootstrap_contracts import bootstrap_contract
from .contracts import contract, signature_key
from .descriptor_resolution import checked_contract
from .migrate import bindings, member, merge
from .ownership import bootstraps
from .receiver_trace import Declarations, ReceiverLimits
from .role_bindings import canonical_edges


def compare_callees(old, target, traces, seed, code, membership_targets=(), local_contract=None):
    known = [dict(seed['typeBindings']), {tuple(r['source']): tuple(r['target']) for r in seed['memberBindings']}]
    declarations = [Declarations(j, Work(ReceiverLimits())) for j in (old, target)]
    selected, counts, unsupported, work = {}, {}, {}, Counter()
    pending = {(m['owner'], m['name'], m['descriptor']) for m in traces}
    if len(pending) > 512:
        raise Refusal('callee-trace-limit')

    def local(jar, cls, method):
        if local_contract is not None:
            return local_contract(jar, cls, method)
        value = checked_contract(cls, method, jar.classes)
        if value is None:
            try:
                return bootstrap_contract(cls, method, jar.classes, bootstraps(jar.zip.read(cls.name + '.class'), cls))
            except Refusal as error:
                if str(error).startswith(('bootstrap-', 'contract-unsupported-constant:')):
                    return None
                raise
        return value

    for round_number in range(128):
        inverse_types = {v: k for k, v in known[0].items()}
        inverse_members = {v: k for k, v in known[1].items()}
        additions = []
        for key in sorted(pending - selected.keys()):
            if key[0] not in inverse_types:
                continue
            tc, sc = code.get(target, key[0]), code.get(old, inverse_types[key[0]])
            tm = member(tc, *key[1:])
            tv = local(target, tc, tm)
            if tv is None:
                unsupported[key] = 'unsupported-local-contract'
                continue
            kind = 'explicit-local-contract' if local_contract is not None else 'exact-local-contract'
            variants = [(tv, kind)]
            if key in membership_targets:
                token = [184, [10, 'java/util/Collections', 'emptyList', '()Ljava/util/List;'], []]
                positions = [i for i, value in enumerate(tv['tokens']) if value == token]
                if len(positions) != 1:
                    raise Refusal('callee-membership-site-count')
                altered = copy.deepcopy(tv)
                altered['tokens'][positions[0]] = [178, [9, 'java/util/Collections', 'EMPTY_LIST', 'Ljava/util/List;'], []]
                signature = descriptor(tm.desc, lambda n: altered['types'].get(n, n))
                altered['digest'] = digest([tm.flags, signature, altered['tokens'], altered['handlers']])
                variants.append((altered, 'jdk-empty-list-access'))
            reference = inverse_members.get((10, *key))
            source_methods = [member(code.get(old, reference[1]), *reference[2:])] if reference else sc.methods
            if reference:
                sc = code.get(old, reference[1])
            hits = []
            for sm in source_methods:
                if signature_key(sm, old.classes) != signature_key(tm, target.classes):
                    continue
                work['comparisons'] += 1
                work['instructions'] += len(instructions(sm.code))
                if work['comparisons'] > 100000 or work['instructions'] > 2000000:
                    raise Refusal('callee-work-limit')
                sv = local(old, sc, sm)
                if sv is None:
                    continue
                for value, kind in variants:
                    if sv['digest'] != value['digest']:
                        continue
                    mapped = merge(bindings(sv, value), [{sc.name: tc.name},
                                   {(10, sc.name, sm.name, sm.desc): (10, *key)}])
                    try:
                        mapped, unresolved = canonical_edges(mapped, *declarations)
                        merge(known, mapped)
                    except Refusal as error:
                        if str(error) in ('operation-edge-conflict', 'reference-alias-conflict'):
                            continue
                        raise
                    hits.append((sm, mapped, kind, unresolved, sv['digest']))
            counts[key] = len(hits)
            if len(hits) == 1:
                sm, mapped, kind, unresolved, fingerprint = hits[0]
                additions.append((key, mapped, {'source': [sc.name, sm.name, sm.desc], 'target': list(key),
                    'contract': kind, 'digest': fingerprint, 'unresolvedDeclarations': unresolved, 'round': round_number}))
        if not additions:
            break
        for key, mapped, row in additions:
            known = merge(known, mapped)
            selected[key] = row
    else:
        raise Refusal('callee-round-limit')
    return {'sha256': target.sha256, 'matched': list(selected.values()),
            'unmatched': [{'target': list(k), 'count': counts.get(k), 'reason': unsupported.get(k)}
                          for k in sorted(pending - selected.keys())],
            'typeBindings': known[0], 'memberBindings': [{'source': list(k), 'target': list(v)} for k, v in known[1].items()],
            'work': dict(work), 'completeTable': False, 'boundedAdmission': False, 'writeAuthority': False}
