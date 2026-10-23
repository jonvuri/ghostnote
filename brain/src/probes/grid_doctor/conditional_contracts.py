"""Project disabled assertion blocks without executing vendor code."""
from grid_symbols.scan import Refusal, instructions
from .assertion_guards import disabled_field
from .ownership import constant


def assertion_ranges(cls, method):
    """Return ranges excluded only when the initialized flag is true."""
    field = disabled_field(cls)
    if field is None:
        return {'field': None, 'ranges': []}
    raw = instructions(method.code)
    if len(raw) > 4096:
        raise Refusal('conditional-instruction-limit')
    offsets = {row[0] for row in raw}
    edges, candidates = [], []
    for i, (offset, op, args) in enumerate(raw):
        if op in (168, 169, 201):
            raise Refusal('conditional-subroutine')
        if op in (*range(153, 168), 198, 199, 200):
            edges.append((offset, offset + int.from_bytes(bytes(args), 'big', signed=True)))
        elif op == 170:
            edges.extend((offset, offset + delta) for delta in [args[0], *args[3:]])
        elif op == 171:
            edges.extend((offset, offset + delta) for delta in [args[0], *args[2::2]])
        if op != 178 or i + 1 >= len(raw) or raw[i + 1][1] != 154:
            continue
        ref = constant(cls, int.from_bytes(bytes(args), 'big'))
        if (ref.get('owner'), ref.get('name'), ref.get('descriptor')) != field:
            continue
        condition, _, operands = raw[i + 1]
        end = condition + int.from_bytes(bytes(operands), 'big', signed=True)
        if end not in offsets or end <= condition:
            raise Refusal('conditional-guard-target')
        candidates.append((offset, condition, end))
    ranges = []
    for start, condition, end in candidates:
        if ranges and start < ranges[-1][1]:
            if end > ranges[-1][1]:
                raise Refusal('conditional-overlapping-guards')
            continue
        if any(not start <= origin < end and condition <= dest < end for origin, dest in edges):
            raise Refusal('conditional-entered-block')
        ranges.append((start, end))
    if ranges and method.handlers:
        raise Refusal('conditional-handler')
    if len(ranges) > 128:
        raise Refusal('conditional-guard-limit')
    return {'field': field if ranges else None, 'ranges': ranges}


def project_assertions(cls, method):
    """Build a comparison copy under the initialized true assertion guard.

    Callers must opt in for a named local contract. This function does not
    change the strict comparator or admit the resulting method.
    """
    import copy
    result = assertion_ranges(cls, method)
    if result['field'] is None or method.handlers:
        raise Refusal('conditional-projection-guard-or-handler')
    raw = instructions(method.code)
    ranges = result['ranges']
    kept = [row for row in raw if not any(a <= row[0] < b for a, b in ranges)]
    if not kept:
        raise Refusal('conditional-projection-empty')
    sizes = {r[0]: (raw[i + 1][0] if i + 1 < len(raw) else len(method.code)) - r[0]
             for i, r in enumerate(raw)}
    positions, total = {}, 0
    for offset, op, _ in kept:
        if op in (168, 169, 170, 171, 201):
            raise Refusal('conditional-projection-control')
        positions[offset] = total
        total += sizes[offset]
    binary = bytearray()
    for offset, op, args in kept:
        if op in (*range(153, 168), 198, 199, 200):
            target = offset + int.from_bytes(bytes(args), 'big', signed=True)
            for start, end in ranges:
                if target == start:
                    target = end
            if target not in positions:
                raise Refusal('conditional-projection-target')
            delta = positions[target] - positions[offset]
            width = 4 if op == 200 else 2
            if not -(1 << (width * 8 - 1)) <= delta < (1 << (width * 8 - 1)):
                raise Refusal('conditional-projection-branch-width')
            binary.extend(bytes([op]) + delta.to_bytes(width, 'big', signed=True))
        else:
            binary.extend(method.code[offset:offset + sizes[offset]])
    projected = copy.deepcopy(method)
    projected.code = bytes(binary)
    return projected, {'requiredTrueField': result['field'], 'excludedRanges': ranges,
                       'sourceInstructions': len(raw), 'projectedInstructions': len(kept),
                       'boundedAdmission': False, 'runtimeObserved': False}
