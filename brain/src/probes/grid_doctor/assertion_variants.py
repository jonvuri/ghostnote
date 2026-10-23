"""Check one field-to-getter change behind a disabled assertion guard."""
import copy

from grid_symbols.scan import Refusal, descriptor, digest, instructions
from .assertion_guards import disabled_field
from .contracts import contract
from .ownership import constant


def field_to_getter(source_cls, source_method, source_classes,
                    target_cls, target_method, target_classes):
    """Require equal control flow and one excluded reference change."""
    classes = (source_cls, target_cls)
    methods = (source_method, target_method)
    if source_method.flags != target_method.flags or any(m.handlers for m in methods):
        raise Refusal('assertion-variant-flags-or-handlers')
    values = [contract(c, m, model) for c, m, model in
              zip(classes, methods, (source_classes, target_classes))]
    a, b = values
    signatures = [descriptor(m.desc, lambda n: v['types'].get(n, n))
                  for m, v in zip(methods, values)]
    if signatures[0] != signatures[1]:
        raise Refusal('assertion-variant-signature')
    if len(a['tokens']) != len(b['tokens']):
        raise Refusal('assertion-variant-size')
    changed = [i for i, pair in enumerate(zip(a['tokens'], b['tokens'])) if pair[0] != pair[1]]
    if len(changed) != 1:
        raise Refusal('assertion-variant-difference-count')
    index = changed[0]
    left, right = a['tokens'][index], b['tokens'][index]
    if (left[0] != 180 or right[0] != 182 or left[1][0] != 9 or right[1][0] != 10
            or left[1][1:3] != right[1][1:3] or left[1][1] != 'self'
            or right[1][3] != '()' + left[1][3] or left[2] or right[2]):
        raise Refusal('assertion-variant-reference-shape')
    guards, excluded = [], []
    for cls, method in zip(classes, methods):
        field = disabled_field(cls)
        if field is None:
            raise Refusal('assertion-variant-field')
        raw = instructions(method.code)
        if len(raw) > 4096:
            raise Refusal('assertion-variant-instruction-limit')
        offsets = {row[0]: i for i, row in enumerate(raw)}
        branches = []
        for i, (offset, op, args) in enumerate(raw):
            if op in (168, 169, 201):
                raise Refusal('assertion-variant-subroutine')
            if op in (*range(153, 168), 198, 199, 200):
                branches.append((i, offsets[offset + int.from_bytes(bytes(args), 'big', signed=True)]))
            elif op in (170, 171):
                raise Refusal('assertion-variant-switch')
        candidates = []
        for i, (offset, op, args) in enumerate(raw[:-1]):
            if op != 178 or raw[i + 1][1] != 154:
                continue
            ref = constant(cls, int.from_bytes(bytes(args), 'big'))
            if (ref.get('owner'), ref.get('name'), ref.get('descriptor')) != field:
                continue
            end = next(t for start, t in branches if start == i + 1)
            if not i + 2 <= index < end:
                continue
            if any(not i + 2 <= start < end and i + 1 <= dest < end for start, dest in branches):
                raise Refusal('assertion-variant-entered-block')
            candidates.append((i, end))
        if len(candidates) != 1:
            raise Refusal('assertion-variant-guard-count')
        guards.append(field)
        excluded.append(candidates[0])
    if excluded[0] != excluded[1]:
        raise Refusal('assertion-variant-guard-change')
    # The getter is not called when the required assertion field is true.
    raw = instructions(target_method.code)
    ref = constant(target_cls, int.from_bytes(bytes(raw[index][2]), 'big'))
    getters = [m for m in target_cls.methods if (m.name, m.desc) == (ref['name'], ref['descriptor'])]
    if len(getters) != 1 or getters[0].flags != 2:
        raise Refusal('assertion-variant-getter-declaration')
    projected = copy.deepcopy(a['tokens'])
    projected[index] = ['excluded-assertion-read']
    return {'sourceGuard': guards[0], 'targetGuard': guards[1], 'guardRange': excluded[0],
            'changedInstruction': index, 'conditionalTokenDigest': digest(projected),
            'condition': 'Both guard fields must already be initialized and true.',
            'runtimeValuesObserved': False, 'boundedAdmission': False,
            'limits': ['This check does not compare the getter body or admit an enabled assertion.',
                       'Other calls, initialization, and mutation bounds remain separate.']}
