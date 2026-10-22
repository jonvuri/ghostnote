"""Retain variant evidence. No variant here admits a method or a live path."""
from grid_symbols.scan import Refusal
from .contracts import signature_key
from .migrate import member, snapshot
from .ownership import bootstraps, method_trace
from .receiver_trace import Declarations, ReceiverLimits
from .admission import Work


def trace_variants(old, target, candidate, bound, migration, membership):
    from .role_bindings import code

    if bound['sha256'] != target.sha256:
        raise Refusal('variant-binding-jar')
    is_source = target.sha256 == old.sha256
    if not is_source and target.sha256 != migration['inputs'][1]['sha256']:
        raise Refusal('variant-seed-jar')
    rows = {r['role']: r for r in candidate['members']}
    traces, selected = {}, {}

    def retain(jar, owner, name, desc):
        jar.check()
        key = jar.sha256, owner, name, desc
        if key not in traces:
            if len(traces) >= 128:
                raise Refusal('variant-trace-limit')
            cls = code(jar, owner)
            value = method_trace(jar, cls, member(cls, name, desc),
                                 bootstraps(jar.zip.read(owner + '.class'), cls))
            traces[key] = value
        return traces[key]

    for role, section in [('disposal', 'disposal'), ('journal-recording-edit', 'recordingEdit')]:
        row = rows[role]
        before = retain(old, row['declaring'], row['name'], row['descriptor'])
        seed = migration[section]['old' if is_source else 'new']
        cls = code(target, seed['owner'])
        m = member(cls, seed['name'], seed['descriptor'])
        if snapshot(target, cls, m) != seed:
            raise Refusal('variant-seed-trace')
        after = retain(target, seed['owner'], seed['name'], seed['descriptor'])
        selected[role] = {'source': before, 'target': after, 'admitted': False}

    required = rows['managed-id']
    before = retain(old, required['declaring'], required['name'], required['descriptor'])
    owner = bound['typeBindings'].get(required['declaring'])
    if not owner:
        raise Refusal('variant-unbound-object')
    oc = code(old, required['declaring'])
    om = member(oc, required['name'], required['descriptor'])
    nc = code(target, owner)
    candidates = [m for m in nc.methods if signature_key(m, target.classes) == signature_key(om, old.classes)]
    # Retain the complete signature pool. This is an investigation input.
    # Even a single result does not satisfy the unsupported contract.
    after = [retain(target, owner, m.name, m.desc) for m in candidates]
    selected['managed-id'] = {'source': before, 'targetSignaturePool': after,
                              'admitted': False, 'basis': 'bound object and complete signature pool'}
    dependencies, unresolved = [], []
    for jar, roots in [(old, [before]), (target, after)]:
        declarations = Declarations(jar, Work(ReceiverLimits()))
        todo = []
        for root in roots:
            for op in root['instructions']:
                bs = op.get('bootstrap')
                if bs:
                    for arg in bs['arguments']:
                        if arg.get('tag') == 15:
                            todo.append((arg['target'], 0, 'bootstrap-target'))
            for ref in root['references']:
                if ref['opcode'] == 184:
                    todo.append((ref, 0, 'assertion-helper'))
        seen = set()
        while todo:
            ref, depth, reason = todo.pop(0)
            key = ref['owner'], ref['name'], ref['descriptor']
            if key in seen:
                continue
            seen.add(key)
            found = declarations.find('method', *key)
            if found['status'] != 'declaration':
                unresolved.append({'jarSha256': jar.sha256, 'reference': ref, 'lookup': found})
                continue
            value = retain(jar, found['owner'], ref['name'], ref['descriptor'])
            dependencies.append({'jarSha256': jar.sha256, 'reason': reason, 'depth': depth, 'trace': value})
            if depth == 0:
                cls = code(jar, found['owner'])
                if any(m.name == '<clinit>' and m.desc == '()V' for m in cls.methods):
                    init = retain(jar, cls.name, '<clinit>', '()V')
                    dependencies.append({'jarSha256': jar.sha256, 'reason': 'initialization',
                                         'depth': depth, 'trace': init})
                for child in value['references']:
                    if child['opcode'] in (182, 183, 184, 185):
                        todo.append((child, depth + 1, 'direct-dependency'))
    frontier, dynamic = [], []
    for key, value in traces.items():
        for ref in value['references']:
            if ref['opcode'] not in (182, 183, 184, 185):
                continue
            direct = (key[0], ref['owner'], ref['name'], ref['descriptor'])
            # A retained declaration does not close virtual dispatch.
            if direct not in traces or ref['opcode'] in (182, 185):
                frontier.append({'jarSha256': key[0], 'caller': list(key[1:]), 'reference': ref,
                                 'reason': 'virtual-dispatch-or-untraced-body'})
        for op in value['instructions']:
            if 'bootstrap' in op:
                dynamic.append({'jarSha256': key[0], 'caller': list(key[1:]), 'offset': op['offset'],
                                'constant': op['constant'], 'bootstrap': op['bootstrap']})
    return {'result': 'refused', 'reason': 'variants-not-admitted', 'variants': selected,
            'membership': membership, 'managedDependencies': dependencies,
            'unresolvedDependencies': unresolved, 'unclosedCalls': frontier, 'dynamicSites': dynamic, 'retainedUniqueMethods': len(traces),
            'limits': {'methods': 128, 'managedDependencyDepth': 1},
            'completeTable': False, 'boundedAdmission': False, 'writeAuthority': False,
            'limitsOfEvidence': [
                'A target signature pool does not bind the managed-ID contract.',
                'Bootstrap handles are evidence. They are not checked by the strict comparator.',
                'Direct callees do not close virtual dispatch, initialization, or external work.',
                'No runtime descriptor, receiver, assertion mode, history, or tracking mode is measured.',
                'Membership field access and external call remain distinct contracts.']}
