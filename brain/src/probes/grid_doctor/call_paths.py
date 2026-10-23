"""Find possible direct command paths. Do not infer runtime reachability."""
from array import array
from collections import defaultdict, deque
from grid_symbols.scan import Refusal, instructions, parse
from .admission import Work, lineage
from .ownership import constant, bootstraps, method_trace
from .receiver_trace import Declarations, ReceiverLimits


def paths(jar, roots, sinks, code, receiver_hypotheses=None, witness_limit=1):
    receiver_hypotheses = receiver_hypotheses or {}
    methods, method_ids = [], {}
    owners = sorted(jar.classes)
    owner_ids = {name: i for i, name in enumerate(owners)}
    incoming, external_count, dynamic_count, instructions_count, sites = {}, 0, 0, 0, 0
    for name in owners:
        jar.check()
        cls = parse(jar.zip.read(name + '.class'), True)
        for method in cls.methods:
            key = cls.name, method.name, method.desc
            if key in method_ids:
                raise Refusal('paths-duplicate-method')
            mid = len(methods)
            method_ids[key] = mid
            methods.append(key)
            if len(methods) > 1000000:
                raise Refusal('paths-method-limit')
            raw = instructions(method.code)
            instructions_count += len(raw)
            if instructions_count > 16000000:
                raise Refusal('paths-instruction-limit')
            for offset, op, args in raw:
                if op == 186:
                    dynamic_count += 1
                elif 182 <= op <= 185:
                    ref = constant(cls, args[0] * 256 + args[1])
                    if ref['owner'] not in owner_ids:
                        external_count += 1
                        continue
                    sites += 1
                    if sites > 1000000 or sites * 16 > 128 * 1024**2:
                        raise Refusal('paths-index-limit')
                    slot = ref['name'], ref['descriptor']
                    if slot not in incoming:
                        incoming[slot] = array('I')
                    incoming[slot].extend((mid, owner_ids[ref['owner']], offset, op))
    work = Work(ReceiverLimits())
    declarations = Declarations(jar, work)
    ancestry = {}

    def parents(owner):
        if owner not in ancestry:
            ancestry[owner] = set(lineage(jar, owner, work)[0])
        return ancestry[owner]

    root_keys = {tuple(r) for r in roots}
    results, traces, visited_edges = [], {}, 0
    for sink in sinks:
        sink = tuple(sink)
        if sink not in method_ids:
            raise Refusal('paths-missing-sink')
        todo, seen, parent = deque([sink]), {sink}, {}
        matched, cutoff = [], None
        while todo:
            target = todo.popleft()
            refs = incoming.get(target[1:], ())
            for i in range(0, len(refs), 4):
                caller_id, owner_id, offset, op = refs[i:i + 4]
                owner = owners[owner_id]
                if target[0] not in parents(owner) and owner not in parents(target[0]):
                    continue
                possible = False
                resolution = declarations.find('method', owner, *target[1:])
                if resolution['status'] == 'declaration' and resolution['owner'] == target[0]:
                    possible = True
                elif op in (182, 185) and owner in parents(target[0]):
                    possible = True
                if not possible:
                    continue
                caller = methods[caller_id]
                hypotheses = receiver_hypotheses.get(caller, ())
                relevant = [r for r in hypotheses if owner in parents(r)]
                if op in (182, 185) and relevant:
                    selected = [declarations.find('method', r, *target[1:]) for r in relevant]
                    if not any(r['status'] == 'declaration' and r['owner'] == target[0] for r in selected):
                        continue
                if visited_edges >= 16384:
                    cutoff = 'search-edge-limit'
                    todo.clear()
                    break
                visited_edges += 1
                caller = methods[caller_id]
                if caller not in seen:
                    seen.add(caller)
                    edge = {'caller': list(caller), 'offset': offset, 'opcode': op,
                            'symbolicOwner': owner, 'target': list(target),
                            'kind': 'possible-virtual' if op in (182, 185) else 'symbolic-direct'}
                    parent[caller] = edge
                    todo.append(caller)
                if caller in root_keys and caller not in matched:
                    matched.append(caller)
                    if len(matched) >= witness_limit:
                        cutoff = 'first-root-witness' if witness_limit == 1 else 'root-witness-limit'
                        todo.clear()
                        break
        chains = []
        for root in sorted(matched):
            current, chain = root, []
            while current != sink:
                edge = parent[current]
                chain.append(edge)
                current = tuple(edge['target'])
                if len(chain) > 128:
                    raise Refusal('paths-chain-depth')
            chains.append({'root': list(root), 'edges': chain, 'runtimeReachability': 'unproved'})
            for key in [root, *(tuple(e['target']) for e in chain)]:
                if key not in traces:
                    if len(traces) >= 512:
                        raise Refusal('paths-trace-limit')
                    cls = code.get(jar, key[0])
                    from .migrate import member
                    traces[key] = method_trace(jar, cls, member(cls, *key[1:]), bootstraps(jar.zip.read(key[0] + '.class'), cls))
        results.append({'sink': list(sink), 'predecessorCount': len(seen), 'searchComplete': cutoff is None, 'cutoff': cutoff, 'rootPaths': chains})
    return {'sha256': jar.sha256, 'receiverHypotheses': [{'method': list(k), 'receivers': v} for k, v in receiver_hypotheses.items()], 'results': results, 'methods': list(traces.values()),
            'work': {**work.counts, 'classes': len(owners), 'traces': len(traces), 'methods': len(methods), 'instructions': instructions_count, 'indexedSites': sites,
                     'packedBytes': sites * 16, 'searchEdges': visited_edges},
            'unresolvedIndexEdges': {'external': external_count, 'dynamic': dynamic_count},
            'limits': ['Possible virtual paths need receiver and branch checks.',
                       'No path is not an exclusion of dynamic, reflection, native, or external calls.'],
            'completeTable': False, 'boundedAdmission': False, 'writeAuthority': False}
