"""Recognize generated disposal wrappers. Do not admit a recursive disposal."""
from grid_symbols.scan import Refusal, instructions
from .assertion_guards import requirements
from .dispatch_paths import reachable
from .ownership import constant, method_trace, bootstraps


def map_wrapper(jar, code, cls, method):
    if method.desc != '()V' or method.flags != 1 or method.handlers:
        raise Refusal('disposal-wrapper-signature-or-handler')
    guards = requirements(jar, {cls.name}, code)
    flags = set(guards['fields'])
    selected = reachable(cls, method, None, flags)
    raw = [row for row in instructions(method.code) if row[0] in selected]

    def reference(row):
        args = row[2]
        return constant(cls, args[0] * 256 + args[1])

    rows, i = [], 0
    while i < len(raw):
        row = raw[i]
        if row[1] == 178:
            field = reference(row)
            key = field['owner'], field['name'], field['descriptor']
            if key in flags and i + 1 < len(raw) and raw[i + 1][1] == 154:
                jump = raw[i + 1]
                target = jump[0] + int.from_bytes(bytes(jump[2]), 'big', signed=True)
                if i + 2 >= len(raw) or target != raw[i + 2][0]:
                    raise Refusal('disposal-wrapper-guard-target')
                i += 2
                continue
        rows.append(row)
        i += 1
    fields, i = [], 0
    while i + 6 < len(rows) and rows[i][1] == 178:
        block = rows[i:i + 6]
        if [r[1] for r in block] != [178, 198, 178, 42, 182, 87]:
            raise Refusal('disposal-wrapper-map-shape')
        field, repeated, call = reference(block[0]), reference(block[2]), reference(block[4])
        if field != repeated or field['owner'] != cls.name or field['descriptor'] != 'Ljava/util/HashMap;':
            raise Refusal('disposal-wrapper-map-identity')
        declarations = [f for f in cls.fields if (f.name, f.desc) == (field['name'], field['descriptor'])]
        if len(declarations) != 1 or not declarations[0].flags & 8:
            raise Refusal('disposal-wrapper-map-declaration')
        if (call['owner'], call['name'], call['descriptor']) != (
                'java/util/HashMap', 'remove', '(Ljava/lang/Object;)Ljava/lang/Object;'):
            raise Refusal('disposal-wrapper-map-call')
        target = block[1][0] + int.from_bytes(bytes(block[1][2]), 'big', signed=True)
        if target != rows[i + 6][0]:
            raise Refusal('disposal-wrapper-map-branch')
        fields.append([field['owner'], field['name'], field['descriptor']])
        if len(fields) > 128:
            raise Refusal('disposal-wrapper-map-limit')
        i += 6
    if [row[1] for row in rows[i:]] != [42, 183, 177]:
        raise Refusal('disposal-wrapper-delegate-shape')
    call = reference(rows[i + 1])
    if (call['owner'], call['name'], call['descriptor']) != (cls.parent, method.name, '()V'):
        raise Refusal('disposal-wrapper-delegate-identity')
    return {'owner': cls.name, 'name': method.name, 'descriptor': method.desc,
            'mapFields': fields, 'mapRemoveCallBound': len(fields),
            'instructionBound': len(raw), 'delegate': [call['owner'], call['name'], call['descriptor']],
            'assertionGuards': guards,
            'trace': method_trace(jar, cls, method, bootstraps(jar.zip.read(cls.name + '.class'), cls)),
            'limits': ['The superclass body and all child disposal methods need separate checks.',
                       'Each map must be null or an exact HashMap with an enforced size bound.',
                       'Key hashing, equality, and tree behavior remain separate dependencies.',
                       'Assertion fields must be initialized and true.'],
            'boundedAdmission': False, 'writeAuthority': False}


def false_fields_delegate(jar, code, cls, method):
    """Keep a superclass delegate when each leading instance flag is false."""
    if method.desc != '()V' or method.flags != 1 or method.handlers:
        raise Refusal('disposal-flags-signature-or-handler')
    raw = instructions(method.code)
    positions = {r[0]: i for i, r in enumerate(raw)}
    fields, i, count = [], 0, 0

    def reference(row):
        return constant(cls, row[2][0] * 256 + row[2][1])

    while i + 2 < len(raw) and [r[1] for r in raw[i:i + 3]] == [42, 180, 153]:
        field = reference(raw[i + 1])
        if field['owner'] != cls.name or field['descriptor'] != 'Z':
            raise Refusal('disposal-flags-field-identity')
        matches = [f for f in cls.fields if (f.name, f.desc) == (field['name'], 'Z')]
        if len(matches) != 1 or matches[0].flags & 8:
            raise Refusal('disposal-flags-field-declaration')
        branch = raw[i + 2]
        target = branch[0] + int.from_bytes(bytes(branch[2]), 'big', signed=True)
        if target not in positions or positions[target] <= i + 2:
            raise Refusal('disposal-flags-branch')
        fields.append([field['owner'], field['name'], 'Z'])
        if len(fields) > 128:
            raise Refusal('disposal-flags-limit')
        count += 3
        i = positions[target]
    if not fields or [r[1] for r in raw[i:]] != [42, 183, 177]:
        raise Refusal('disposal-flags-delegate-shape')
    call = reference(raw[i + 1])
    if (call['owner'], call['name'], call['descriptor']) != (cls.parent, method.name, '()V'):
        raise Refusal('disposal-flags-delegate-identity')
    return {'owner': cls.name, 'name': method.name, 'descriptor': method.desc,
            'requiredFalseFields': fields, 'instructionBound': count + 3,
            'delegate': [call['owner'], call['name'], call['descriptor']],
            'trace': method_trace(jar, cls, method, bootstraps(jar.zip.read(cls.name + '.class'), cls)),
            'limits': ['Each instance flag must remain false from entry through its branch.',
                       'The superclass body needs a separate check.',
                       'The skipped branches are not admitted.'],
            'boundedAdmission': False, 'writeAuthority': False}


def listener_flags_delegate(cls, method):
    """Retain enabled listener-removal blocks and their superclass delegate."""
    if method.desc != '()V' or method.flags != 1 or method.handlers:
        raise Refusal('disposal-listener-method')
    raw = instructions(method.code)
    if len(raw) > 4096:
        raise Refusal('disposal-listener-body-limit')

    def ref(index, tag):
        value = constant(cls, int.from_bytes(bytes(raw[index][2]), 'big'))
        if value.get('tag') != tag:
            raise Refusal('disposal-listener-reference')
        return value['owner'], value['name'], value['descriptor']

    rows, i, flags, listeners = [], 0, set(), set()
    while i < len(raw) and raw[i:i + 3] and [r[1] for r in raw[i:i + 3]] == [42, 180, 153]:
        if len(rows) >= 128 or i + 11 >= len(raw):
            raise Refusal('disposal-listener-block-limit')
        if [r[1] for r in raw[i:i + 11]] != [42, 180, 153, 42, 182, 42, 180, 182, 42, 3, 181]:
            raise Refusal('disposal-listener-block')
        branch = raw[i + 2]
        if branch[0] + int.from_bytes(bytes(branch[2]), 'big', signed=True) != raw[i + 11][0]:
            raise Refusal('disposal-listener-branch')
        flag, getter, listener, remove, stored = (
            ref(i + index, tag) for index, tag in ((1, 9), (4, 10), (6, 9), (7, 10), (10, 9)))
        if (flag != stored or flag[0] != cls.name or flag[2] != 'Z'
                or listener[0] != cls.name or not listener[2].startswith('L')
                or getter[0] != cls.name or getter[2] != '()L' + remove[0] + ';'
                or remove[2] != '(' + listener[2] + ')V'):
            raise Refusal('disposal-listener-reference-shape')
        for field, access in ((flag, 2), (listener, 18)):
            found = [f for f in cls.fields if (f.name, f.desc) == field[1:]]
            if len(found) != 1 or found[0].flags != access:
                raise Refusal('disposal-listener-field')
        if flag in flags or listener in listeners:
            raise Refusal('disposal-listener-duplicate')
        flags.add(flag); listeners.add(listener)
        rows.append({'flag': list(flag), 'getter': list(getter), 'listener': list(listener),
                     'remove': list(remove), 'flagAfterSuccess': False})
        i += 11
    if not rows or [r[1] for r in raw[i:]] != [42, 183, 177]:
        raise Refusal('disposal-listener-delegate')
    delegate = ref(i + 1, 10)
    if delegate != (cls.parent, method.name, '()V'):
        raise Refusal('disposal-listener-delegate-target')
    return {'method': [cls.name, method.name, method.desc], 'blocks': rows,
            'delegate': list(delegate), 'ownInstructionBound': 3 + 11 * len(rows),
            'ownVendorCallBound': 1 + 2 * len(rows),
            'allFlagsFalseInstructions': 3 + 3 * len(rows),
            'boundedAdmission': False, 'runtimeObserved': False,
            'conditions': ['Exact getter and removal callees need separate checks.',
                           'Listener identity, storage, and tracking mode need stable guards.',
                           'A failure can leave an earlier flag cleared. Do not retry disposal.',
                           'Superclass disposal and failure paths remain separate.']}


def captured_wrappers(old, target, catalog, symbols, seed, code):
    from .admission import Work
    from .callee_contracts import compare_callees
    from .migrate import member, merge, bindings
    from .contracts import contract
    from .explicit_variants import disposal_prefix
    from .receiver_trace import Declarations, ReceiverLimits
    if any(r['count'] != 1 for r in catalog['rows']) or len(catalog['rows']) > 128:
        raise Refusal('disposal-catalog-count')
    ref = next(r['reference'] for r in symbols['members'] if r['role'] == 'disposal')
    base, name, desc = ref[1:]
    if desc != '()V':
        raise Refusal('disposal-base-signature')
    declarations = Declarations(target, Work(ReceiverLimits()))
    methods, receivers, traces = {}, [], {}
    classes = sorted({r['matches'][0]['runtimeClass'] for r in catalog['rows']})
    known = [dict(seed['typeBindings']), {tuple(r['source']): tuple(r['target']) for r in seed['memberBindings']}]
    role = next(r for r in symbols['members'] if r['role'] == 'disposal')
    source = role['source']
    ac, bc = code.get(old, source['declaring']), code.get(target, base)
    am, bm = member(ac, source['name'], source['descriptor']), member(bc, name, desc)
    av, bv = contract(ac, am, old.classes), contract(bc, bm, target.classes)
    if av['digest'] != bv['digest']:
        bv = contract(bc, disposal_prefix(am, bc, bm), target.classes)
    known = merge(known, bindings(av, bv))
    inverse = {v: k for k, v in known[0].items()}
    for runtime in classes:
        if runtime not in inverse:
            raise Refusal('disposal-unbound-catalog-class')
        source, dest, seen = inverse[runtime], runtime, set()
        while source in old.classes and dest in target.classes:
            if (source, dest) in seen or len(seen) >= 128:
                raise Refusal('disposal-parent-cycle-or-depth')
            seen.add((source, dest))
            known = merge(known, [{source: dest}, {}])
            source, dest = old.classes[source].parent, target.classes[dest].parent
        if source != dest:
            raise Refusal('disposal-external-parent-difference')
    for runtime in classes:
        found = declarations.find('method', runtime, name, desc)
        chain = []
        while found['status'] == 'declaration' and found['owner'] != base:
            owner = found['owner']
            if owner in chain or len(chain) >= 128:
                raise Refusal('disposal-wrapper-chain')
            chain.append(owner)
            if owner not in methods:
                cls = code.get(target, owner)
                method = member(cls, name, desc)
                try:
                    result = map_wrapper(target, code, cls, method)
                    result['kind'] = 'map-removal-delegate'
                except Refusal as first:
                    try:
                        result = false_fields_delegate(target, code, cls, method)
                        result['kind'] = 'false-field-delegate'
                    except Refusal as second:
                        result = {'owner': owner, 'refusal': [str(first), str(second)]}
                methods[owner] = result
                if 'refusal' not in result:
                    for trace in [result['trace'], *result.get('assertionGuards', {}).get('initializers', [])]:
                        traces[tuple(trace[k] for k in ('owner', 'name', 'descriptor'))] = trace
                        if len(traces) > 512:
                            raise Refusal('disposal-wrapper-trace-limit')
            if 'refusal' in methods[owner]:
                break
            found = declarations.find('method', *methods[owner]['delegate'])
        receivers.append({'runtimeClass': runtime, 'chain': chain,
                          'baseReached': found['status'] == 'declaration' and found['owner'] == base})
    bound_seed = {'typeBindings': known[0],
                  'memberBindings': [{'source': list(k), 'target': list(v)} for k, v in known[1].items()]}
    contracts = compare_callees(old, target, list(traces.values()), bound_seed, code)
    return {'sha256': target.sha256, 'receivers': receivers, 'methods': list(methods.values()),
            'contracts': contracts, 'boundedAdmission': False, 'writeAuthority': False,
            'limits': ['The base disposal body and its child traversal remain separate requirements.',
                       'The captured catalog does not enumerate the complete detached ownership tree.',
                       'Local wrapper bounds require all recorded runtime conditions.']}
