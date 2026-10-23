"""Describe narrow constructor changes without changing strict contracts."""
import copy

from grid_symbols.scan import Refusal, descriptor, digest, instructions
from .contracts import contract
from .migrate import member
from .ownership import constant


def map_capacity_one(cls, method, classes):
    """Project one fresh LinkedHashMap capacity-one call to its old form."""
    raw = instructions(method.code)
    if (method.name != '<init>' or method.desc != '()V' or method.handlers
            or method.flags & (8 | 256 | 1024) or len(raw) > 4096
            or any(op in (*range(153, 172), 198, 199, 200, 201) for _, op, _ in raw)):
        raise Refusal('map-capacity-constructor-shape')
    value = contract(cls, method, classes)
    tokens = value['tokens']
    pattern = [[187, ['type', 'java/util/LinkedHashMap'], []], [89, []], [4, []],
               [183, [10, 'java/util/LinkedHashMap', '<init>', '(I)V'], []]]
    sites = [i for i in range(len(tokens) - 3) if tokens[i:i + 4] == pattern]
    if len(sites) != 1:
        raise Refusal('map-capacity-site-count')
    index = sites[0]
    if (index == 0 or tokens[index - 1] != [42, []] or index + 4 >= len(tokens)
            or tokens[index + 4][0] != 181 or tokens[index + 4][1][1] != 'self'
            or tokens[index + 4][1][3] != 'Ljava/util/Map;'):
        raise Refusal('map-capacity-fresh-field')
    ref = constant(cls, int.from_bytes(bytes(raw[index + 4][2]), 'big'))
    fields = [f for f in cls.fields if (f.name, f.desc) == (ref['name'], ref['descriptor'])]
    if len(fields) != 1 or fields[0].flags & 8:
        raise Refusal('map-capacity-field-declaration')
    tokens[index:index + 4] = pattern[:2] + [
        [183, [10, 'java/util/LinkedHashMap', '<init>', '()V'], []]]
    signature = descriptor(method.desc, lambda n: value['types'].get(n, n))
    original = value['digest']
    value['digest'] = digest([method.flags, signature, tokens, value['handlers']])
    value['bodyDigest'] = digest([signature, tokens, value['handlers']])
    value['constructorVariant'] = {'kind': 'fresh-linked-map-capacity-one',
        'originalDigest': original, 'offset': raw[index][0], 'targetCapacity': 1,
        'sourceConstructor': '()V', 'targetConstructor': '(I)V',
        'limits': ['Only the fresh constructor form is projected.',
                   'JDK initialization, capacity growth, and later map operations need separate bounds.']}
    return value


def empty_holder(jar, code, cls, method):
    """Project one fresh empty holder after an unchanged parent call."""
    raw = instructions(method.code)
    if (method.name != '<init>' or method.desc != '()V' or method.handlers
            or method.flags & (8 | 256 | 1024)
            or [op for _, op, _ in raw] != [42, 183, 42, 187, 89, 183, 181, 177]):
        raise Refusal('empty-holder-constructor-shape')
    def ref(i):
        return constant(cls, int.from_bytes(bytes(raw[i][2]), 'big'))
    parent, allocated, call, field = ref(1), ref(3), ref(5), ref(6)
    typ = allocated['value']
    if (parent != {'tag': 10, 'owner': cls.parent, 'name': '<init>', 'descriptor': '()V'}
            or call != {'tag': 10, 'owner': typ, 'name': '<init>', 'descriptor': '()V'}
            or field.get('owner') != cls.name or field.get('descriptor') != 'L' + typ + ';'):
        raise Refusal('empty-holder-reference')
    fields = [f for f in cls.fields if (f.name, f.desc) == (field['name'], field['descriptor'])]
    if len(fields) != 1 or fields[0].flags != 18:
        raise Refusal('empty-holder-final-field')
    holder = code.get(jar, typ)
    ctor = member(holder, '<init>', '()V')
    body = instructions(ctor.code)
    if (holder.parent != 'java/lang/Object' or holder.flags & (512 | 1024)
            or holder.interfaces or len(holder.fields) != 1
            or holder.fields[0].desc != 'Ljava/lang/Object;' or holder.fields[0].flags != 2
            or any(m.name in ('<clinit>', 'finalize') for m in holder.methods)
            or ctor.flags != 1 or ctor.handlers or [op for _, op, _ in body] != [42, 183, 177]):
        raise Refusal('empty-holder-class')
    call = constant(holder, int.from_bytes(bytes(body[1][2]), 'big'))
    if call != {'tag': 10, 'owner': 'java/lang/Object', 'name': '<init>', 'descriptor': '()V'}:
        raise Refusal('empty-holder-super-call')
    projected = copy.copy(method)
    projected.code = method.code[:raw[2][0]] + method.code[raw[7][0]:]
    value = contract(cls, projected, jar.classes)
    value['constructorVariant'] = {'kind': 'fresh-empty-holder',
        'originalDigest': contract(cls, method, jar.classes)['digest'],
        'field': [cls.name, field['name'], field['descriptor']], 'holder': typ,
        'valueField': [typ, holder.fields[0].name, holder.fields[0].desc],
        'addedObjectAllocations': 1, 'holderConstructorInstructions': 3,
        'externalCalls': [['java/lang/Object', '<init>', '()V']],
        'limits': ['The holder value is null after construction.',
                   'Later holder reads and writes need separate contracts.',
                   'The projection does not claim equal storage or allocation.']}
    return value
