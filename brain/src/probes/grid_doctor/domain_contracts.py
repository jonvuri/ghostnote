"""Find domain descriptor anchors from concrete extent receivers."""
from grid_symbols.scan import Refusal, ancestors, instructions
from .admission import Work
from .fixed_descriptors import constructor_pair
from .migrate import member
from .ownership import constant
from .receiver_trace import Declarations, ReceiverLimits


def descriptor_class(jar, receiver, name, desc, code, declarations):
    seen = set()
    for _ in range(16):
        found = declarations.find('method', receiver, name, desc)
        if found['status'] != 'declaration' or found['flags'] & (256 | 1024):
            raise Refusal('domain-descriptor-slot')
        key = found['owner'], name, desc
        if key in seen:
            raise Refusal('domain-descriptor-cycle')
        seen.add(key)
        cls = code.get(jar, found['owner'])
        method = member(cls, name, desc)
        raw = instructions(method.code)
        if method.handlers:
            raise Refusal('domain-descriptor-handlers')
        if len(raw) == 3 and [r[1] for r in raw] == [42, 182, 176]:
            args = raw[1][2]
            ref = constant(cls, args[0] * 256 + args[1])
            if ref['owner'] not in set(ancestors(jar.classes, receiver, jar.limits.depth)) or not ref['descriptor'].startswith('()L'):
                raise Refusal('domain-descriptor-receiver')
            name, desc = ref['name'], ref['descriptor']
            continue
        if len(raw) == 2 and [r[1] for r in raw] == [178, 176]:
            args = raw[0][2]
            ref = constant(cls, args[0] * 256 + args[1])
            if ref['descriptor'] != 'L' + ref['owner'] + ';':
                raise Refusal('domain-descriptor-field-type')
            return ref['owner'], sorted(seen)
        raise Refusal('domain-descriptor-body')
    raise Refusal('domain-descriptor-depth')


def source_domains(jar, symbols, code):
    base = symbols['types']['domain']
    roles = {r['role']: r['reference'] for r in symbols['members']}
    declarations = Declarations(jar, Work(ReceiverLimits()))
    rows, pairs = [], {}
    for cls in jar.classes.values():
        jar.check()
        if cls.flags & (512 | 1024) or base not in set(ancestors(jar.classes, cls.name, jar.limits.depth)):
            continue
        desc, chain = descriptor_class(jar, cls.name, *roles['descriptor'][2:], code, declarations)
        dc = code.get(jar, desc)
        pair = constructor_pair(dc, member(dc, '<init>', '()V'))
        if pair is None:
            raise Refusal('domain-descriptor-constructor')
        getters = [m for m in dc.methods if m.desc == '()Ljava/lang/Class;' and m.flags == 1]
        if len(getters) != 1:
            raise Refusal('domain-runtime-getter-count')
        raw = instructions(getters[0].code)
        if len(raw) != 2 or raw[0][1] not in (18, 19) or raw[1][1] != 176:
            raise Refusal('domain-runtime-getter-body')
        op, args = raw[0][1:]
        value = constant(dc, args[0] if op == 18 else args[0] * 256 + args[1])
        if value['tag'] != 7:
            raise Refusal('domain-runtime-getter-type')
        runtime = value['value']
        if pair in pairs and pairs[pair] != runtime:
            raise Refusal('domain-pair-runtime-conflict')
        pairs[pair] = runtime
        rows.append({'receiver': cls.name, 'descriptor': desc, 'name': pair[0], 'id': pair[1],
                     'canonicalRuntime': runtime, 'exactCanonicalRuntime': cls.name == runtime,
                     'extentDeclaration': declarations.find('method', cls.name, *roles['domain-extent'][2:]),
                     'getterChain': chain, 'runtimeObserved': False})
        if len(rows) > 128:
            raise Refusal('domain-receiver-limit')
    return pairs, rows
