"""Compare one null-guarded fresh listener map with its old constructor form."""
from grid_symbols.scan import Refusal, descriptor, digest, instructions
from .contracts import contract
from .ownership import constant
from .read_dataflow import signature


def lazy_capacity_one(cls, method, classes):
    args, result = signature(method.desc)
    raw = instructions(method.code)
    if (method.flags != 1 or method.handlers or len(args) != 1
            or not args[0].startswith('L') or result != 'V' or len(raw) > 4096):
        raise Refusal('listener-map-method')
    value = contract(cls, method, classes)
    tokens = value['tokens']
    pattern = [[187, ['type', 'java/util/HashMap'], []], [89, []], [4, []],
               [183, [10, 'java/util/HashMap', '<init>', '(I)V'], []]]
    sites = [i for i in range(len(tokens) - 3) if tokens[i:i + 4] == pattern]
    if len(sites) != 1:
        raise Refusal('listener-map-site-count')
    start = sites[0]
    if (start < 2 or start + 5 >= len(tokens)
            or tokens[start - 2][0] != 178 or tokens[start - 1][0] != 199
            or tokens[start + 4][0] != 179
            or tokens[start + 5] != tokens[start - 2]
            or tokens[start + 4][1:] != tokens[start - 2][1:]
            or tokens[start - 1][1] != 6):
        raise Refusal('listener-map-null-guard')
    field = constant(cls, int.from_bytes(bytes(raw[start + 4][2]), 'big'))
    fields = [f for f in cls.fields if (f.name, f.desc) == (field['name'], field['descriptor'])]
    if (field['owner'] != cls.name or field['descriptor'] != 'Ljava/util/HashMap;'
            or len(fields) != 1 or fields[0].flags != 10):
        raise Refusal('listener-map-private-static-field')
    branch_ops = (*range(153, 168), 198, 199, 200)
    for i, token in enumerate(tokens):
        if token[0] in (168, 169, 170, 171, 201):
            raise Refusal('listener-map-control-form')
        if token[0] in branch_ops:
            target = i + token[1]
            if target <= i or not 0 <= target < len(tokens):
                raise Refusal('listener-map-back-edge')
            if start <= target <= start + 4:
                raise Refusal('listener-map-entered-allocation')
    removed = start + 2
    projected = []
    for i, token in enumerate(tokens):
        if i == removed:
            continue
        if i == start + 3:
            token = [183, [10, 'java/util/HashMap', '<init>', '()V'], []]
        elif token[0] in branch_ops:
            target = i + token[1]
            token = [token[0], target - (target > removed) - i + (i > removed)]
        projected.append(token)
    original = value['digest']
    value['tokens'] = projected
    desc = descriptor(method.desc, lambda n: value['types'].get(n, n))
    value['digest'] = digest([method.flags, desc, projected, value['handlers']])
    value['bodyDigest'] = digest([desc, projected, value['handlers']])
    value['listenerMapVariant'] = {
        'kind': 'null-guarded-fresh-hash-map-capacity-one', 'originalDigest': original,
        'field': [cls.name, field['name'], field['descriptor']],
        'allocationOffset': raw[start][0], 'addedInstructions': 1,
        'sourceConstructor': '()V', 'targetConstructor': '(I)V', 'targetCapacity': 1,
        'limits': ['Map growth, external constructor work, and concurrency remain separate.',
                   'This projection does not admit listener registration or callbacks.'],
    }
    return value
