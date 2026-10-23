"""Recognize disabled-assertion fields. Require a true live value before use."""
from grid_symbols.scan import Refusal, instructions
from .ownership import constant, method_trace, bootstraps


def disabled_field(cls):
    methods = [m for m in cls.methods if m.name == '<clinit>' and m.desc == '()V']
    if not methods:
        return None
    if len(methods) != 1:
        raise Refusal('assertion-initializer-count')
    method = methods[0]
    raw = instructions(method.code)
    if len(raw) < 7:
        return None
    head = raw[:7]
    if head[0][1] not in (18, 19) or [r[1] for r in head[1:]] != [182, 154, 4, 167, 3, 179]:
        return None

    def cp(row):
        _, op, args = row
        return constant(cls, args[0] if op == 18 else args[0] * 256 + args[1])

    if cp(head[0]) != {'tag': 7, 'value': cls.name} or cp(head[1]) != {
            'tag': 10, 'owner': 'java/lang/Class', 'name': 'desiredAssertionStatus', 'descriptor': '()Z'}:
        return None
    if head[2][0] + int.from_bytes(bytes(head[2][2]), 'big', signed=True) != head[5][0]:
        return None
    if head[4][0] + int.from_bytes(bytes(head[4][2]), 'big', signed=True) != head[6][0]:
        return None
    ref = cp(head[6])
    if ref['tag'] != 9 or ref['owner'] != cls.name or ref['descriptor'] != 'Z':
        return None
    fields = [f for f in cls.fields if (f.name, f.desc) == (ref['name'], 'Z')]
    if len(fields) != 1 or fields[0].flags != 4120:
        return None
    if any(op == 179 and constant(cls, args[0] * 256 + args[1]) == ref for _, op, args in raw[7:]):
        raise Refusal('assertion-reassigned-in-initializer')
    if any(start < head[6][0] + 3 for start, _, _, _ in method.handlers):
        raise Refusal('assertion-initializer-handler')
    return (cls.name, ref['name'], 'Z')


def requirements(jar, owners, code):
    fields, traces = [], []
    if len(owners) > 256:
        raise Refusal('assertion-owner-limit')
    for owner in sorted(owners):
        cls = code.get(jar, owner)
        field = disabled_field(cls)
        if field is not None:
            fields.append(field)
            method = next(m for m in cls.methods if m.name == '<clinit>')
            traces.append(method_trace(jar, cls, method, bootstraps(jar.zip.read(owner + '.class'), cls)))
    return {'fields': fields, 'initializers': traces, 'runtimeValuesObserved': False,
            'condition': 'Each field must already be initialized and true. Do not change assertion mode.',
            'boundedAdmission': False}
