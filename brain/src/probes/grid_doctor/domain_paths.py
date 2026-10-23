"""Bound primitive domain reads under explicit assertion-field guards."""
from grid_symbols.scan import Refusal, ancestors, instructions
from .admission import Work
from .assertion_guards import requirements
from .dispatch_paths import reachable
from .migrate import member
from .ownership import constant, method_trace, bootstraps
from .receiver_trace import Declarations, ReceiverLimits


def domain_reads(jar, catalog, symbols, code):
    reference = next(r['reference'] for r in symbols['members'] if r['role'] == 'domain-extent')
    receivers = [r['matches'][0]['runtimeClass'] for r in catalog['rows'] if r['count'] == 1]
    if len(receivers) != len(catalog['rows']) or len(receivers) > 128:
        raise Refusal('domain-read-receiver-count')
    owners = {a for receiver in receivers for a in ancestors(jar.classes, receiver, jar.limits.depth) if a in jar.classes}
    guards = requirements(jar, owners, code)
    flags = set(map(tuple, guards['fields']))
    declarations = Declarations(jar, Work(ReceiverLimits()))
    traces, list_fields, work = {}, set(), {'instructions': 0, 'calls': 0}
    results = []
    for receiver in receivers:
        memo, chain = {}, set()
        receiver_parents = set(ancestors(jar.classes, receiver, jar.limits.depth))

        def visit(name, desc, depth=0):
            if depth > 32:
                raise Refusal('domain-read-depth')
            key = name, desc
            if key in chain:
                raise Refusal('domain-read-recursion')
            if key in memo:
                return memo[key]
            if desc not in ('()Z', '()I', '()J', '()F', '()D'):
                raise Refusal('domain-read-signature')
            found = declarations.find('method', receiver, name, desc)
            if found['status'] != 'declaration' or found['flags'] & (2 | 8 | 32 | 256 | 1024):
                raise Refusal('domain-read-declaration')
            cls = code.get(jar, found['owner'])
            method = member(cls, name, desc)
            if method.handlers:
                raise Refusal('domain-read-handler')
            trace_key = cls.name, name, desc
            if trace_key not in traces:
                if len(traces) >= 512:
                    raise Refusal('domain-read-trace-limit')
                traces[trace_key] = method_trace(jar, cls, method, bootstraps(jar.zip.read(cls.name + '.class'), cls))
            selected = reachable(cls, method, None, flags)
            raw = instructions(method.code)
            count, nested, chain_length = len(selected), 0, 1
            chain.add(key)
            for i, (offset, op, args) in enumerate(raw):
                if offset not in selected:
                    continue
                work['instructions'] += 1
                if work['instructions'] > 2000000:
                    raise Refusal('domain-read-work-limit')
                if op in (18, 19, 20):
                    value = constant(cls, args[0] if op == 18 else args[0] * 256 + args[1])
                    if value['tag'] not in (3, 4, 5, 6):
                        raise Refusal('domain-read-nonnumeric-literal')
                elif op == 178:
                    ref = constant(cls, args[0] * 256 + args[1])
                    if (ref['owner'], ref['name'], ref['descriptor']) not in flags:
                        raise Refusal('domain-read-static-field')
                elif op == 180:
                    ref = constant(cls, args[0] * 256 + args[1])
                    primitive = ref['descriptor'] in ('Z', 'B', 'C', 'S', 'I', 'J', 'F', 'D')
                    list_read = ref['descriptor'] == 'Ljava/util/List;' and i + 1 < len(raw) and raw[i + 1][1] in (185, 198, 199)
                    if i == 0 or raw[i - 1][1] != 42 or ref['owner'] not in receiver_parents or not (primitive or list_read):
                        raise Refusal(f'domain-read-field-receiver-or-type:{receiver}:{cls.name}.{name}{desc}:{offset}:{ref}')
                    if list_read:
                        list_fields.add((receiver, ref['owner'], ref['name'], ref['descriptor']))
                elif op == 182:
                    ref = constant(cls, args[0] * 256 + args[1])
                    if i == 0 or raw[i - 1][1] != 42 or ref['owner'] not in receiver_parents:
                        raise Refusal('domain-read-call-receiver')
                    child = visit(ref['name'], ref['descriptor'], depth + 1)
                    count += child['instructionBound']
                    nested += 1 + child['callBound']
                    chain_length = max(chain_length, 1 + child['depthBound'])
                    work['calls'] += 1
                elif op == 185:
                    ref = constant(cls, args[0] * 256 + args[1])
                    if (ref['owner'], ref['name'], ref['descriptor']) != ('java/util/List', 'size', '()I') or i < 2 or raw[i - 1][1] != 180 or raw[i - 2][1] != 42:
                        raise Refusal('domain-read-external-call')
                    field = constant(cls, raw[i - 1][2][0] * 256 + raw[i - 1][2][1])
                    if (receiver, field['owner'], field['name'], field['descriptor']) not in list_fields:
                        raise Refusal('domain-read-list-receiver')
                    nested += 1
                    work['calls'] += 1
                elif 153 <= op <= 167 or op in (198, 199):
                    if offset + int.from_bytes(bytes(args), 'big', signed=True) <= offset:
                        raise Refusal('domain-read-back-edge')
                elif op in (54, 55, 56, 57) and args[0] == 0 or op in (59, 63, 67, 71):
                    raise Refusal('domain-read-receiver-store')
                elif op not in {0, *range(2, 18), *range(21, 25), *range(26, 43), *range(54, 58), *range(59, 75), *range(87, 153), *range(172, 176)}:
                    raise Refusal('domain-read-unsupported-opcode:' + str(op))
            chain.remove(key)
            memo[key] = {'instructionBound': count, 'callBound': nested, 'depthBound': chain_length, 'heapAllocations': 0}
            return memo[key]

        results.append({'receiver': receiver, **visit(*reference[2:]), 'runtimeObserved': False})
    return {'sha256': jar.sha256, 'receivers': results, 'assertionGuards': guards,
            'requiredListFields': [list(x) for x in sorted(list_fields)],
            'limits': ['List fields must be null or exact ArrayList instances.',
                       'Instruction bounds exclude the external List.size body.',
                       'Runtime field values and JDK dependencies remain unverified.'],
            'methods': list(traces.values()), 'work': work,
            'completeTable': False, 'boundedAdmission': False, 'writeAuthority': False}
