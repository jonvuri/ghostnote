"""Count direct constructor work. Keep external and dynamic work open."""
from collections import Counter

from grid_symbols.scan import Refusal, instructions
from .descriptor_builders import lookup
from .dispatch_paths import reachable
from .ownership import constant


def direct_bounds(jar, code, roots, flags=()):
    """Count each repeated call. Branch sums are conservative upper bounds."""
    roots = list(dict.fromkeys(map(tuple, roots)))
    if len(roots) > 128:
        raise Refusal('constructor-bound-root-limit')
    guards = set(map(tuple, flags))
    rows, active, costs = {}, set(), {}
    work = Counter()

    def visit(key):
        if key in active:
            raise Refusal('constructor-bound-recursion')
        if key in costs:
            return costs[key]
        if len(active) >= 64 or len(rows) >= 512:
            raise Refusal('constructor-bound-method-limit')
        cls, method = lookup(jar, code, *key)
        if (cls.name, method.name, method.desc) != key:
            raise Refusal('constructor-bound-declaration')
        if method.flags & (32 | 256 | 1024) or method.handlers:
            raise Refusal('constructor-bound-method-shape')
        raw = instructions(method.code)
        if not raw or len(raw) > 4096:
            raise Refusal('constructor-bound-body-limit')
        selected = reachable(cls, method, None, guards)
        active.add(key)
        row = {'method': list(key), 'selectedInstructions': len(selected),
               'calls': [], 'allocations': [], 'staticFields': []}
        rows[key] = row
        total = Counter(instructions=len(selected))
        objects, external, dynamic = Counter(), Counter(), Counter()
        for offset, op, args in raw:
            if offset not in selected:
                continue
            work['instructions'] += 1
            if work['instructions'] > 2000000:
                raise Refusal('constructor-bound-work-limit')
            if op in (168, 169, 188, 189, 194, 195, 197, 201):
                raise Refusal('constructor-bound-unsupported-operation')
            targets = []
            if op in (*range(153, 168), 198, 199, 200):
                targets = [offset + int.from_bytes(bytes(args), 'big', signed=True)]
            elif op in (170, 171):
                targets = [offset + x for x in ([args[0], *args[3:]] if op == 170
                                               else [args[0], *args[2::2]])]
            if any(target <= offset for target in targets):
                raise Refusal('constructor-bound-back-edge')
            if op in (178, 179):
                ref = constant(cls, int.from_bytes(bytes(args[:2]), 'big'))
                row['staticFields'].append({'offset': offset, 'opcode': op, 'reference': ref})
            if op == 187:
                ref = constant(cls, int.from_bytes(bytes(args[:2]), 'big'))
                objects[ref['value']] += 1
                row['allocations'].append({'offset': offset, 'type': ref['value']})
            if not 182 <= op <= 186:
                continue
            work['callSites'] += 1
            if work['callSites'] > 16000:
                raise Refusal('constructor-bound-call-limit')
            ref = constant(cls, int.from_bytes(bytes(args[:2]), 'big'))
            call = {'offset': offset, 'opcode': op, 'reference': ref}
            row['calls'].append(call)
            if op in (182, 185):
                raise Refusal(f'constructor-bound-virtual-call:{key}:{offset}:{ref}')
            if op == 186:
                dynamic[(key, offset)] += 1
                continue
            target = (ref['owner'], ref['name'], ref['descriptor'])
            if target[0] not in jar.classes:
                external[target] += 1
                continue
            child_cls, child_method = lookup(jar, code, *target)
            target = child_cls.name, child_method.name, child_method.desc
            if bool(child_method.flags & 8) != (op == 184):
                raise Refusal('constructor-bound-call-kind')
            call['directTarget'] = list(target)
            child_total, child_objects, child_external, child_dynamic = visit(target)
            total.update(child_total)
            total['vendorCalls'] += 1
            objects.update(child_objects)
            external.update(child_external)
            dynamic.update(child_dynamic)
        if (total['instructions'] > 2000000 or total['vendorCalls'] > 16000
                or sum(external.values()) + sum(dynamic.values()) > 16000):
            raise Refusal('constructor-bound-path-limit')
        active.remove(key)
        costs[key] = total, objects, external, dynamic
        return costs[key]

    results = []
    for root in roots:
        total, objects, external, dynamic = visit(root)
        results.append({'root': list(root), 'vendorInstructions': total['instructions'],
                        'vendorCalls': total['vendorCalls'],
                        'explicitObjects': dict(sorted(objects.items())),
                        'externalCalls': [{'method': list(k), 'count': n}
                                          for k, n in sorted(external.items())],
                        'dynamicSites': [{'method': list(k[0]), 'offset': k[1], 'count': n}
                                         for k, n in sorted(dynamic.items())]})
    return {'roots': results, 'methods': list(rows.values()), 'work': dict(work),
            'assertionGuards': [list(k) for k in sorted(guards)],
            'boundedAdmission': False, 'runtimeObserved': False,
            'exclusions': ['Class initialization and bootstrap work.',
                           'External method bodies and exception paths.',
                           'Root allocations and later factory initialization.']}
