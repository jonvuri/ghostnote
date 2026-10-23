"""Check fixed receiver slots. Keep symbolic dispatch separate from live identity."""
from grid_symbols.scan import Refusal
from .admission import Work
from .contracts import contract, references
from .descriptor_resolution import checked_contract
from .migrate import bindings, member, merge
from .ownership import bootstraps, method_trace
from .receiver_trace import Declarations, ReceiverLimits


def fixed_slots(old, target, source_catalog, target_catalog, source_symbols, target_symbols, properties, code, domain_catalogs=None):
    known = [dict(properties['typeBindings']),
             {tuple(r['source']): tuple(r['target']) for r in target_symbols['memberBindings']}]
    declarations = {id(j): Declarations(j, Work(ReceiverLimits())) for j in (old, target)}
    rows, traces, pending = [], {}, []
    source_roles = {r['role']: r['reference'] for r in source_symbols['members']}
    target_roles = {r['role']: r['reference'] for r in target_symbols['members']}
    targets = {(r['name'], r['id']): r for r in target_catalog['rows']}
    for row in source_catalog['rows']:
        other = targets[row['name'], row['id']]
        if row['count'] != 1 or other['count'] != 1:
            raise Refusal('fixed-dispatch-anchor-count')
        a, b = row['matches'][0], other['matches'][0]
        for role in ('descriptor', 'owner', 'context'):
            pending.append((role, a['runtimeClass'], b['runtimeClass'], source_roles[role][2:], target_roles[role][2:]))
    for item in properties['propertyDispatch']:
        for slot in item['slots']:
            if slot.get('applicable'):
                role = slot['role']
                pending.append((role, item['source'], item['target'], source_roles[role][2:], target_roles[role][2:]))
    if domain_catalogs is None:
        pending.append(('domain-extent', source_symbols['types']['domain'], target_symbols['types']['domain'],
                        source_roles['domain-extent'][2:], target_roles['domain-extent'][2:]))
    else:
        domain_targets = {(r['name'], r['id']): r for r in domain_catalogs[1]['rows']}
        for row in domain_catalogs[0]['rows']:
            other = domain_targets[row['name'], row['id']]
            if row['count'] != 1 or other['count'] != 1:
                raise Refusal('fixed-domain-anchor-count')
            a, b = row['matches'][0], other['matches'][0]
            known = merge(known, [{a['runtimeClass']: b['runtimeClass'], a['descriptor']: b['descriptor']}, {}])
            pending.append(('domain-extent', a['runtimeClass'], b['runtimeClass'],
                            source_roles['domain-extent'][2:], target_roles['domain-extent'][2:]))
    for role, source, dest, source_slot, target_slot in pending:
        found = [declarations[id(jar)].find('method', receiver, *slot)
                 for jar, receiver, slot in [(old, source, source_slot), (target, dest, target_slot)]]
        row = {'role': role, 'sourceReceiver': source, 'targetReceiver': dest,
               'sourceSlot': source_slot, 'targetSlot': target_slot,
               'declarations': found, 'runtimeObserved': False, 'status': 'unresolved'}
        if all(d['status'] == 'declaration' and not d['flags'] & (256 | 1024) for d in found):
            ac, bc = code.get(old, found[0]['owner']), code.get(target, found[1]['owner'])
            am, bm = member(ac, *source_slot), member(bc, *target_slot)
            av, bv = checked_contract(ac, am, old.classes), checked_contract(bc, bm, target.classes)
            if av is not None and bv is not None and av['digest'] == bv['digest']:
                known = merge(known, bindings(av, bv))
                known = merge(known, [{ac.name: bc.name},
                              {(10, ac.name, am.name, am.desc): (10, bc.name, bm.name, bm.desc)}])
                row['status'] = 'exact-concrete-local-contract'
                row['digest'] = av['digest']
            else:
                row['status'] = 'concrete-body-difference'
            for jar, cls, method in [(old, ac, am), (target, bc, bm)]:
                key = jar.sha256, cls.name, method.name, method.desc
                if key not in traces:
                    if len(traces) >= 512:
                        raise Refusal('fixed-dispatch-trace-limit')
                    traces[key] = {'jarSha256': jar.sha256, 'trace': method_trace(jar, cls, method,
                        bootstraps(jar.zip.read(cls.name + '.class'), cls))}
        rows.append(row)
    return {'sha256': target.sha256, 'slots': rows, 'traces': list(traces.values()),
            'typeBindings': known[0], 'memberBindings': [{'source': list(k), 'target': list(v)} for k, v in known[1].items()],
            'completeTable': False, 'boundedAdmission': False, 'writeAuthority': False}
