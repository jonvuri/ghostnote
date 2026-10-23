"""Check the local history ancestor loop without assuming a runtime chain."""
from grid_symbols.scan import Refusal, instructions
from .ownership import constant
from .read_dataflow import signature


def history_ancestor(cls, method):
    raw = instructions(method.code)
    args, result = signature(method.desc)
    if (method.flags != 9 or method.handlers or len(args) != 1
            or not args[0].startswith('L') or result != 'Z'):
        raise Refusal('history-ancestor-method')
    expected = [42, 182, 76, 43, 198, 43, 182, 182, 153,
                4, 172, 43, 182, 182, 76, 167, 3, 172]
    if [r[1] for r in raw] != expected:
        raise Refusal('history-ancestor-body')
    for index, target in ((4, 16), (8, 11), (15, 3)):
        offset, _, operand = raw[index]
        if offset + int.from_bytes(bytes(operand), 'big', signed=True) != raw[target][0]:
            raise Refusal('history-ancestor-branch')

    def ref(index):
        value = constant(cls, int.from_bytes(bytes(raw[index][2]), 'big'))
        if value.get('tag') != 10:
            raise Refusal('history-ancestor-reference')
        return value['owner'], value['name'], value['descriptor']

    wrapper, prop, predicate, parent = (ref(i) for i in (1, 6, 7, 12))
    wrapper_args, wrapper_type = signature(wrapper[2])
    if (wrapper_args or not wrapper_type.startswith('L') or wrapper != ref(13)
            or args != ['L' + wrapper[0] + ';']
            or prop[0] != wrapper_type[1:-1] or parent[0] != prop[0]
            or prop[2] != '()L' + predicate[0] + ';'
            or predicate[2] != '()Z' or parent[2] != '()' + args[0]):
        raise Refusal('history-ancestor-call-shape')
    return {
        'method': [cls.name, method.name, method.desc],
        'wrapperGetter': list(wrapper), 'propertyGetter': list(prop),
        'predicate': list(predicate), 'parentGetter': list(parent),
        'ownInstructions': {'constant': 7, 'perAncestor': 11},
        'vendorCalls': {'constant': 1, 'perAncestor': 4},
        'trueExit': {'ownInstructionsPerVisitedAncestor': 11,
                     'vendorCallsPerVisitedAncestor': 4, 'vendorCallConstant': -1},
        'runtimeObserved': False, 'boundedAdmission': False,
        'conditions': ['The wrapper chain is stable, finite, and has no cycle.',
                       'Each getter and predicate needs an exact receiver and a separate bound.',
                       'The depth limit and failure paths remain separate.'],
    }
