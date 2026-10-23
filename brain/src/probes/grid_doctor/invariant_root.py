"""Check the two descriptor invariant loops under an empty-list condition."""
from grid_symbols.scan import Refusal, instructions
from .ownership import constant
from .read_dataflow import signature


def invariant_root(cls, method, empty_field):
    raw = instructions(method.code)
    args, result = signature(method.desc)
    if (method.flags != 1 or len(args) != 1 or not args[0].startswith('L')
            or result != 'V' or len(raw) < 54 or len(raw) > 4096):
        raise Refusal('invariant-root-method')
    expected = [42, 180, 198, 42, 180, 77, 44, 190, 62, 3, 54,
                21, 29, 162, 44, 21, 50, 58, 25, 43, 182, 132, 167,
                42, 180, 198, 42, 180, 77, 44, 190, 62, 3, 54,
                21, 29, 162, 44, 21, 50, 58, 25, 43, 182, 58, 25,
                182, 132, 167, 42, 180, 185, 154]
    if [x[1] for x in raw[:53]] != expected:
        raise Refusal('invariant-root-prefix')
    local_operands = {10: (4,), 11: (4,), 15: (4,), 17: (5,), 18: (5,),
                      21: (4, 1), 33: (4,), 34: (4,), 38: (4,), 40: (5,),
                      41: (5,), 44: (6,), 45: (6,), 47: (4, 1)}
    if any(tuple(raw[i][2]) != value for i, value in local_operands.items()):
        raise Refusal('invariant-root-local')
    indexed = {x[0]: i for i, x in enumerate(raw)}
    targets = {}
    for i in (2, 13, 22, 25, 36, 48, 52):
        target = raw[i][0] + int.from_bytes(bytes(raw[i][2]), 'big', signed=True)
        if target not in indexed:
            raise Refusal('invariant-root-branch-target')
        targets[i] = indexed[target]
    if ({k: v for k, v in targets.items() if k != 52}
            != {2: 23, 13: 23, 22: 11, 25: 49, 36: 49, 48: 34}
            or targets[52] < 53 or raw[targets[52]][1] != 177):
        raise Refusal('invariant-root-branches')
    selected = {x[0] for x in raw[:53]} | {raw[targets[52]][0]}
    if any(any(start <= off < end for off in selected)
           for start, end, _, _ in method.handlers):
        raise Refusal('invariant-root-handler')

    def ref(i, tag):
        value = constant(cls, int.from_bytes(bytes(raw[i][2][:2]), 'big'))
        if value.get('tag') != tag:
            raise Refusal('invariant-root-reference-kind')
        return value['owner'], value['name'], value['descriptor']

    value_field, lock_field, expression_field = ref(1, 9), ref(24, 9), ref(50, 9)
    value_call, lock_call, lock_check = ref(20, 10), ref(43, 10), ref(46, 10)
    lock_args, lock_result = signature(lock_call[2])
    if (value_field != ref(4, 9) or lock_field != ref(27, 9)
            or len({value_field, lock_field, expression_field}) != 3
            or expression_field != tuple(empty_field)
            or value_field[2] != '[L' + value_call[0] + ';'
            or lock_field[2] != '[L' + lock_call[0] + ';'
            or value_call[2] != method.desc or lock_args != args
            or lock_result != 'L' + lock_check[0] + ';' or lock_check[2] != '()V'
            or ref(51, 11) != ('java/util/List', 'isEmpty', '()Z')
            or tuple(raw[51][2][2:]) != (1, 0)):
        raise Refusal('invariant-root-reference-shape')
    for field in (value_field, lock_field, expression_field):
        fields = [f for f in cls.fields if (f.name, f.desc) == field[1:]]
        if field[0] != cls.name or len(fields) != 1 or fields[0].flags != (
                18 if field == expression_field else 2):
            raise Refusal('invariant-root-field')
    if expression_field[2] != 'Ljava/util/List;':
        raise Refusal('invariant-root-empty-field')
    return {
        'method': [cls.name, method.name, method.desc],
        'valueArray': list(value_field), 'lockArray': list(lock_field),
        'emptyListCondition': list(expression_field),
        'valueCall': list(value_call), 'lockRead': list(lock_call), 'lockCheck': list(lock_check),
        'ownInstructions': {'constant': 33, 'perValue': 12, 'perLock': 15},
        'vendorCalls': {'constant': 0, 'perValue': 1, 'perLock': 2},
        'externalCalls': [{'method': ['java/util/List', 'isEmpty', '()Z'], 'count': 1}],
        'selectedOffsets': sorted(selected), 'runtimeObserved': False, 'boundedAdmission': False,
        'conditions': ['The expression list is empty and remains empty.',
                       'Array lengths, contents, and identities require stable runtime guards.',
                       'Callee bodies, external bodies, and failure paths are separate.'],
    }
