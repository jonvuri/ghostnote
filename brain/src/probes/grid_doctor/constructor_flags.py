"""Trace a final integer field to a constructor argument or literal."""
from grid_symbols.scan import Refusal, instructions
from .admission import Work
from .migrate import member
from .ownership import constant
from .fixed_descriptors import integer
from .read_dataflow import signature
from .receiver_trace import Declarations, ReceiverLimits


def flag_origin(jar, code, owner, desc, field):
    field = tuple(field)
    declarations = Declarations(jar, Work(ReceiverLimits()))
    declared = declarations.find('field', *field)
    if declared['status'] != 'declaration' or field[2] != 'I':
        raise Refusal('constructor-flag-field')
    field = declared['owner'], *field[1:]
    if declared['flags'] & 8 or not declared['flags'] & 16:
        raise Refusal('constructor-flag-not-final-instance')
    parameters, result = signature(desc)
    if result != 'V':
        raise Refusal('constructor-flag-result')
    values = [('argument', i) for i in range(len(parameters))]
    current, seen, rows, stores = (owner, desc), set(), [], []
    while current[0] in jar.classes:
        if current in seen or len(seen) >= 128:
            raise Refusal('constructor-flag-cycle-or-depth')
        seen.add(current)
        cls = code.get(jar, current[0]); method = member(cls, '<init>', current[1])
        params, returned = signature(method.desc)
        raw = instructions(method.code)
        if (method.flags & (8 | 32 | 256 | 1024) or method.handlers or returned != 'V'
                or not raw or len(raw) > 4096 or len(params) != len(values)):
            raise Refusal('constructor-flag-body')
        local = {0: ('self', owner)}; kinds = {0: 'L'}; slot = 1
        for kind, value in zip(params, values):
            local[slot], kinds[slot] = value, kind
            slot += 2 if kind in ('J', 'D') else 1
        if slot > 64:
            raise Refusal('constructor-flag-local-limit')

        def operand(row):
            _, op, args = row
            if 21 <= op <= 45:
                index = args[0] if op <= 25 else (op - 26) % 4
                category = op - 21 if op <= 25 else (op - 26) // 4
                if index not in local:
                    raise Refusal('constructor-flag-local')
                expected = ('I', 'J', 'F', 'D', 'L')[category]
                actual = 'L' if kinds[index].startswith(('L', '[')) else 'I' if kinds[index] in 'ZBCSI' else kinds[index]
                if expected != actual:
                    raise Refusal('constructor-flag-load-kind')
                return local[index]
            if op == 1:
                return ('null',)
            if 2 <= op <= 8:
                return ('integer', op - 3)
            if op in (16, 17):
                return ('integer', int.from_bytes(bytes(args), 'big', signed=True))
            if op in (18, 19, 20):
                value = constant(cls, args[0] if op == 18 else int.from_bytes(bytes(args), 'big'))
                if value['tag'] == 3:
                    return ('integer', int.from_bytes(bytes.fromhex(value['value']), 'big', signed=True))
                if value['tag'] in (4, 5, 6, 7, 8):
                    return ('constant', value['tag'], str(value['value']))
            if op == 178:
                value = constant(cls, int.from_bytes(bytes(args), 'big'))
                if value['tag'] == 9:
                    return ('static', value['owner'], value['name'], value['descriptor'])
            raise Refusal('constructor-flag-prefix')

        stack = []; parent = None
        for offset, op, args in raw:
            if op == 183:
                parent = constant(cls, int.from_bytes(bytes(args), 'big'))
                count = len(signature(parent['descriptor'])[0])
                if (parent.get('tag') != 10 or parent['name'] != '<init>'
                        or parent['owner'] not in (cls.name, cls.parent)
                        or len(stack) != count + 1 or stack[0] != ('self', owner)):
                    raise Refusal('constructor-flag-parent')
                break
            stack.append(operand((offset, op, args)))
            if len(stack) > 64:
                raise Refusal('constructor-flag-stack-limit')
        if parent is None:
            raise Refusal('constructor-flag-missing-parent')
        parent_offset = offset
        for i, (offset, op, args) in enumerate(raw):
            if op != 181:
                continue
            ref = constant(cls, int.from_bytes(bytes(args), 'big'))
            if ref.get('tag') != 9:
                raise Refusal('constructor-flag-store-reference')
            resolved = declarations.find('field', ref['owner'], ref['name'], ref['descriptor'])
            if resolved['status'] != 'declaration':
                raise Refusal('constructor-flag-unresolved-store')
            if (resolved['owner'], ref['name'], ref['descriptor']) != field:
                continue
            if (cls.name != field[0] or i < 2 or raw[i - 2][1] != 42 or offset <= parent_offset
                    or raw[i - 1][1] not in (21, 26, 27, 28, 29, 2, 3, 4, 5, 6, 7, 8, 16, 17, 18, 19)):
                raise Refusal('constructor-flag-store-shape')
            tail = [r for r in raw if r[0] > parent_offset]
            if len(tail) != 4 or tail[:3] != raw[i - 2:i + 1] or tail[3][1] != 177:
                raise Refusal('constructor-flag-store-not-unconditional')
            # A prior local write could change the argument's provenance.
            if any(54 <= r[1] <= 78 or r[1] in (132, 196) for r in raw[:i]):
                raise Refusal('constructor-flag-local-write')
            value = operand(raw[i - 1])
            if value[0] not in ('argument', 'integer'):
                raise Refusal('constructor-flag-value')
            stores.append({'method': [cls.name, method.name, method.desc],
                           'offset': offset, 'origin': list(value)})
        rows.append({'method': [cls.name, method.name, method.desc], 'parentOffset': parent_offset,
                     'parent': [parent['owner'], parent['name'], parent['descriptor']],
                     'arguments': [list(x) for x in stack[1:]]})
        values, current = stack[1:], (parent['owner'], parent['descriptor'])
    if current != ('java/lang/Object', '()V') or len(stores) != 1:
        raise Refusal('constructor-flag-terminal-or-store-count')
    origin = stores[0]['origin']
    if origin[0] == 'argument' and parameters[origin[1]] not in ('Z', 'B', 'C', 'S', 'I'):
        raise Refusal('constructor-flag-input-kind')
    return {'field': list(field), 'origin': stores[0]['origin'], 'store': stores[0],
            'constructors': rows, 'runtimeObserved': False, 'boundedAdmission': False}


def allocation_flags(jar, code, cls, method, allocation_offset, field):
    """Keep the literal argument and its constructor-field relation together."""
    raw = instructions(method.code)
    if len(raw) > 4096:
        raise Refusal('allocation-flag-body-limit')
    found = [i for i, r in enumerate(raw) if r[0] == allocation_offset]
    if len(found) != 1 or raw[found[0]][1] != 187:
        raise Refusal('allocation-flag-witness')
    start = found[0]
    allocated = constant(cls, int.from_bytes(bytes(raw[start][2]), 'big'))
    if allocated.get('tag') != 7 or allocated['value'] not in jar.classes:
        raise Refusal('allocation-flag-type')
    call = None
    for i in range(start + 1, min(start + 129, len(raw))):
        offset, op, args = raw[i]
        if op == 183:
            call = constant(cls, int.from_bytes(bytes(args), 'big'))
            if call.get('tag') != 10 or call['owner'] != allocated['value'] or call['name'] != '<init>':
                raise Refusal('allocation-flag-constructor')
            break
        if op in (*range(153, 178), 191, *range(198, 202)):
            raise Refusal('allocation-flag-prefix-branch')
        if i == start + 1 and op == 89:
            continue
        if op == 184:
            ref = constant(cls, int.from_bytes(bytes(args), 'big'))
            if (ref.get('tag'), ref.get('owner'), ref.get('name'), ref.get('descriptor')) == (
                    10, 'java/lang/Integer', 'valueOf', '(I)Ljava/lang/Integer;'):
                continue
        if not 1 <= op <= 45 and op != 178:
            raise Refusal('allocation-flag-prefix-operation')
    if call is None:
        raise Refusal('allocation-flag-call-limit')
    end = raw[i][0]
    if raw[start + 1][1] != 89:
        raise Refusal('allocation-flag-duplicate')
    # A jump can otherwise bypass the literal immediately before the call.
    for off, op, args in raw:
        targets = []
        if op in (*range(153, 169), 198, 199, 200, 201):
            targets = [off + int.from_bytes(bytes(args), 'big', signed=True)]
        elif op in (170, 171):
            targets = [off + x for x in ([args[0], *args[3:]] if op == 170 else [args[0], *args[2::2]])]
        if any(allocation_offset < target <= end for target in targets):
            raise Refusal('allocation-flag-entered-prefix')
    if any(start <= end and stop > allocation_offset for start, stop, _, _ in method.handlers):
        raise Refusal('allocation-flag-handler')
    params, result = signature(call['descriptor'])
    value = integer(cls, raw[i - 1][1], raw[i - 1][2])
    if not params or params[-1] != 'I' or result != 'V' or value is None:
        raise Refusal('allocation-flag-final-literal')
    origin = flag_origin(jar, code, call['owner'], call['descriptor'], field)
    if origin['origin'] != ['argument', len(params) - 1]:
        raise Refusal('allocation-flag-argument-position')
    return {'allocation': [cls.name, method.name, method.desc, allocation_offset],
            'constructor': [call['owner'], '<init>', call['descriptor']],
            'callOffset': end, 'flags': value, 'fieldProvenance': origin,
            'runtimeObserved': False, 'boundedAdmission': False}
