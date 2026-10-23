"""Trace fixed read dispatch with an explicit property ID and exact receiver types."""
from collections import deque
import re
from grid_symbols.scan import Refusal, ancestors, instructions
from .admission import Work
from .descriptor_resolution import Code
from .fixed_descriptors import integer
from .migrate import member
from .ownership import bootstraps, constant, method_trace
from .receiver_trace import Declarations, ReceiverLimits


def reachable(cls, method, property_id, guarded_flags=()):
    """Select only switches with a direct, unchanged ID argument load."""
    raw = instructions(method.code)
    by_offset = {r[0]: i for i, r in enumerate(raw)}
    if not raw:
        return set()
    # Generated descriptor dispatch puts the ID in local 2.
    can_select = property_id is not None and re.match(r'^\(L[^;]+;I', method.desc) is not None and not method.flags & 8
    targets = {h[2] for h in method.handlers}
    for offset, op, args in raw:
        if op in (*range(153, 169), 198, 199, 200, 201):
            targets.add(offset + int.from_bytes(bytes(args), 'big', signed=True))
        elif op in (170, 171):
            targets.update(offset + value for value in ([args[0], *args[3:]] if op == 170 else [args[0], *args[2::2]]))
        if op == 196:
            can_select = False
        elif op == 132 and args[0] == 2:
            can_select = False
        elif 54 <= op <= 58:
            width = 2 if op in (55, 57) else 1
            if args[0] <= 2 < args[0] + width:
                can_select = False
        elif 59 <= op <= 78:
            group, index = divmod(op - 59, 4)
            width = 2 if group in (1, 3) else 1
            if index <= 2 < index + width:
                can_select = False
    todo, seen = [raw[0][0]], set()
    while todo:
        offset = todo.pop()
        if offset in seen:
            continue
        if offset not in by_offset:
            raise Refusal('dispatch-invalid-branch')
        seen.add(offset)
        i = by_offset[offset]
        _, op, args = raw[i]
        following = [raw[i + 1][0]] if i + 1 < len(raw) else []
        if op in (170, 171):
            words = args
            default = offset + words[0]
            if op == 171:
                choices = {words[n]: offset + words[n + 1] for n in range(1, len(words), 2)}
            else:
                choices = {words[1] + n: offset + value for n, value in enumerate(words[3:])}
            load = raw[i - 1][1:] if i else None
            direct = load == (28, ()) or load == (21, (2,))
            following = [choices.get(property_id, default)] if can_select and direct and offset not in targets else [default, *choices.values()]
        elif op in (167, 200):
            following = [offset + int.from_bytes(bytes(args), 'big', signed=True)]
        elif op in (*range(153, 167), 198, 199):
            target = offset + int.from_bytes(bytes(args), 'big', signed=True)
            known = None
            if op in (153, 154) and i and raw[i - 1][1] == 178 and offset not in targets:
                operands = raw[i - 1][2]
                ref = constant(cls, operands[0] * 256 + operands[1])
                if (ref['owner'], ref['name'], ref['descriptor']) in guarded_flags:
                    known = op == 154
            if can_select and op in (159, 160) and i >= 2 and offset not in targets:
                load = raw[i - 2][1:]
                value = integer(cls, raw[i - 1][1], raw[i - 1][2])
                if load in ((28, ()), (21, (2,))) and value is not None:
                    known = (property_id == value) if op == 159 else (property_id != value)
            following = [target] if known is True else following if known is False else following + [target]
        elif op in (*range(172, 178), 191):
            following = []
        elif op in (168, 169, 201):
            raise Refusal('dispatch-subroutine')
        todo.extend(following)
        for start, end, handler, _ in method.handlers:
            if start <= offset < end:
                todo.append(handler)
    return seen


def read_paths(jar, catalog, symbols, properties, code, guarded_flags=()):
    declarations = Declarations(jar, Work(ReceiverLimits()))
    roles = {r['role']: r['reference'] for r in symbols['members']}
    anchors = {(r['name'], r['id']): r['matches'][0] for r in catalog['rows'] if r['count'] == 1}
    paths, traces, all_edges, instruction_work = [], {}, 0, 0
    for row in properties['properties']:
        anchor = anchors[row['name'], row['id']]
        for prop in row['properties']:
            if prop['matchCount'] != 1:
                raise Refusal('dispatch-property-unbound')
            receivers = [prop['targetClass'], anchor['descriptor'], anchor['runtimeClass']]
            lineage = {n: set(ancestors(jar.classes, n, jar.limits.depth)) for n in receivers}
            start_roles = ['scalar-read']
            if symbols['types']['relationship'] in lineage[receivers[0]]:
                start_roles += ['child-count', 'child-read']
            queue = deque((receivers[0], *roles[r][2:], False) for r in start_roles)
            visited, edges, frontier = set(), [], []
            while queue:
                receiver, name, desc, special = queue.popleft()
                key = receiver, name, desc, special
                if key in visited:
                    continue
                if len(visited) >= 128:
                    raise Refusal('dispatch-path-method-limit')
                visited.add(key)
                found = declarations.find('method', receiver, name, desc)
                if found['status'] != 'declaration' or found['flags'] & (256 | 1024):
                    frontier.append({'call': list(key), 'resolution': found})
                    continue
                owner = found['owner']
                cls = code.get(jar, owner)
                method = member(cls, name, desc)
                trace_key = owner, name, desc
                if trace_key not in traces:
                    if len(traces) >= 512:
                        raise Refusal('dispatch-trace-limit')
                    traces[trace_key] = method_trace(jar, cls, method, bootstraps(jar.zip.read(owner + '.class'), cls))
                descriptor_receiver = symbols['types']['descriptor-base'] in set(ancestors(jar.classes, receiver, jar.limits.depth))
                selected = reachable(cls, method, prop['id'] if descriptor_receiver else None, guarded_flags)
                raw = instructions(method.code)
                instruction_work += len(raw)
                if instruction_work > 2000000:
                    raise Refusal('dispatch-instruction-limit')
                for offset, op, args in raw:
                    if offset not in selected or not 182 <= op <= 186:
                        continue
                    ref = constant(cls, args[0] * 256 + args[1])
                    all_edges += 1
                    if all_edges > 16000:
                        raise Refusal('dispatch-edge-limit')
                    edge = {'caller': [owner, name, desc], 'offset': offset, 'opcode': op, 'target': ref}
                    if op == 186:
                        edge['status'] = 'dynamic-unresolved'
                        frontier.append(edge)
                    elif ref['owner'] not in jar.classes:
                        edge['status'] = 'external-unresolved'
                        frontier.append(edge)
                    elif op in (183, 184):
                        edge['status'] = 'symbolic-direct'
                        queue.append((ref['owner'], ref['name'], ref['descriptor'], True))
                    else:
                        candidates = [r for r in receivers if ref['owner'] in lineage[r]]
                        if len(candidates) == 1:
                            edge.update(status='fixed-receiver-hypothesis', receiver=candidates[0])
                            queue.append((candidates[0], ref['name'], ref['descriptor'], False))
                        else:
                            edge.update(status='receiver-unresolved', candidates=candidates)
                            frontier.append(edge)
                    edges.append(edge)
            paths.append({'className': row['name'], 'classId': row['id'], 'propertyName': prop['name'],
                          'propertyId': prop['id'], 'receivers': receivers,
                          'edges': edges, 'frontier': frontier, 'methodsVisited': len(visited),
                          'limits': ['Receiver hypotheses require data-flow and live identity checks.',
                                     'A selected switch does not prove that all caller arguments carry this ID.']})
    return {'sha256': jar.sha256, 'requiredTrueFlags': sorted(guarded_flags), 'paths': paths, 'methods': list(traces.values()),
            'work': {'instructions': instruction_work, 'edges': all_edges, 'traces': len(traces)},
            'completeTable': False, 'boundedAdmission': False, 'writeAuthority': False}
