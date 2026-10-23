"""Trace read arguments and receivers on inert bytecode under explicit guards."""
from collections import deque
import re
from grid_symbols.scan import Refusal, ancestors, instructions
from .admission import Work, lineage
from .migrate import member
from .ownership import constant
from .receiver_trace import Declarations, ReceiverLimits


def signature(desc):
    match = re.fullmatch(r'\(((?:\[*[ZBCSIJFD]|\[*L[^;]+;)*)\)(V|\[*[ZBCSIJFD]|\[*L[^;]+;)', desc)
    if not match:
        raise Refusal('read-flow-signature')
    return re.findall(r'\[*[ZBCSIJFD]|\[*L[^;]+;', match[1]), match[2]


def integer(value=None):
    return ('int', 'I', value)


def unknown(desc):
    return ('unknown', desc, None)


NULL = ('null', 'Ljava/lang/Object;', None)


def path_bound(edges):
    """Bound each cost component on an acyclic state graph."""
    pending = {state: len(rows) for state, rows in edges.items()}
    parents = {state: [] for state in edges}
    for state, rows in edges.items():
        for target, weight in rows:
            if target not in parents:
                raise Refusal('read-flow-cost-target')
            parents[target].append((state, weight))
    ready = deque(state for state, degree in pending.items() if degree == 0)
    costs = {state: (1, 0, 0) for state in ready}
    while ready:
        target = ready.popleft()
        for state, weight in parents[target]:
            candidate = tuple(a + b for a, b in zip(weight, costs[target]))
            costs[state] = tuple(max(a, b) for a, b in zip(costs.get(state, (0, 0, 0)), candidate))
            pending[state] -= 1
            if pending[state] == 0:
                ready.append(state)
    if any(pending.values()):
        raise Refusal('read-flow-cost-cycle')
    if any(c[0] > 2000000 or max(c[1:]) > 16000 for c in costs.values()):
        raise Refusal('read-flow-cost-limit')
    return costs


class ReadFlow:
    """Keep each branch state. Refuse loops and unknown vendor receivers."""
    def __init__(self, jar, code, flags, property_field, property_id, descriptor_class, work=None,
                 *, property_descriptor=None, static_values=None, instance_values=None, class_tests=False):
        self.jar, self.code = jar, code
        self.flags, self.property_field = set(map(tuple, flags)), tuple(property_field)
        self.property_id, self.descriptor_class = property_id, descriptor_class
        self.property_descriptor = property_descriptor
        self.static_values = dict(static_values or {})
        self.instance_values = dict(instance_values or {})
        self.instance_fields = set()
        self.type_tests = set()
        self.class_tests = class_tests
        self.resolved_class_tests = set()
        if len(self.instance_values) > 128:
            raise Refusal('read-flow-instance-guard-limit')
        for key, value in self.instance_values.items():
            if not isinstance(key, tuple) or len(key) != 2:
                raise Refusal('read-flow-instance-guard-key')
            if not isinstance(value, tuple) or len(value) != 3:
                raise Refusal('read-flow-instance-guard-value')
            receiver, field = key
            if (not isinstance(receiver, tuple) or len(receiver) != 3
                    or receiver[0] != 'ref' or receiver[1] not in jar.classes
                    or not isinstance(field, tuple) or len(field) != 3
                    or not all(isinstance(part, str) for part in field) or field[0] not in jar.classes
                    or field[0] not in set(ancestors(jar.classes, receiver[1], jar.limits.depth))):
                raise Refusal('read-flow-instance-guard-receiver')
            fields = [f for f in jar.classes[field[0]].fields if (f.name, f.desc) == field[1:]]
            if len(fields) != 1 or fields[0].flags & 8:
                raise Refusal('read-flow-instance-guard-field')
            protected = [self.property_field]
            if property_descriptor is not None:
                protected.append(tuple(property_descriptor[0]))
            if any(field[1:] == item[1:] and (field[0] == item[0] or
                   item[0] in jar.classes and field[0] in
                   set(ancestors(jar.classes, item[0], jar.limits.depth))) for item in protected):
                raise Refusal('read-flow-instance-guard-property-input')
            reference = field[2].startswith(('L', '['))
            valid = reference and value == NULL
            if len(value) == 3 and value[0] == 'ref' and value[1] in jar.classes:
                valid = field[2].startswith('L') and (field[2] == 'Ljava/lang/Object;' or
                    field[2][1:-1] in set(ancestors(jar.classes, value[1], jar.limits.depth)))
            if len(value) == 3 and value[0:2] == ('int', 'I') and type(value[2]) is int:
                valid = (field[2] == 'I' and -2**31 <= value[2] < 2**31 or
                         field[2] == 'Z' and value[2] in (0, 1))
            if not valid:
                raise Refusal('read-flow-instance-guard-value')
        if len(self.static_values) > 128:
            raise Refusal('read-flow-static-guard-limit')
        for field, value in self.static_values.items():
            if len(field) != 3 or field[0] not in jar.classes:
                raise Refusal('read-flow-static-guard-field')
            fields = [f for f in jar.classes[field[0]].fields if (f.name, f.desc) == field[1:]]
            if len(fields) != 1 or not fields[0].flags & 8:
                raise Refusal('read-flow-static-guard-field')
            if (len(value) != 3 or value[0] != 'ref' or value[1] not in jar.classes
                    or not field[2].startswith('L') or field[2][1:-1] not in
                    set(ancestors(jar.classes, value[1], jar.limits.depth))):
                raise Refusal('read-flow-static-guard-type')
        self.declarations = Declarations(jar, Work(ReceiverLimits()))
        self.memo, self.active, self.methods, self.external, self.static_fields = {}, set(), set(), set(), set()
        self.bounds = {}
        self.work = work if work is not None else {'instructions': 0, 'states': 0, 'calls': 0}

    def evaluate(self, owner, name, desc, receiver, args=(), direct=False):
        key = owner, name, desc, receiver, tuple(args), direct
        if key in self.active:
            raise Refusal('read-flow-recursion')
        if key in self.memo:
            return self.memo[key]
        if len(self.active) >= 64 or len(self.memo) >= 1024:
            raise Refusal('read-flow-context-limit')
        if owner not in self.jar.classes:
            self.external.add((owner, name, desc, receiver))
            if len(self.external) > 512:
                raise Refusal('read-flow-external-limit')
            self.bounds[key] = (0, 0, 1)
            return {unknown(signature(desc)[1])}
        runtime = owner if direct else receiver[1] if receiver and receiver[0] == 'ref' else None
        if runtime is None:
            raise Refusal(f'read-flow-unknown-receiver:{owner}.{name}{desc}:{receiver}')
        if receiver is not None:
            if receiver[0] != 'ref':
                raise Refusal('read-flow-unknown-receiver')
            if owner not in set(ancestors(self.jar.classes, receiver[1], self.jar.limits.depth)):
                raise Refusal('read-flow-receiver-type')
        found = self.declarations.find('method', runtime, name, desc)
        if found['status'] != 'declaration' or found['flags'] & (256 | 1024 | 32):
            raise Refusal('read-flow-declaration')
        cls = self.code.get(self.jar, found['owner'])
        method = member(cls, name, desc)
        if method.handlers:
            raise Refusal('read-flow-handler')
        if bool(method.flags & 8) != (receiver is None):
            raise Refusal('read-flow-static-kind')
        parameters, result = signature(desc)
        if len(parameters) != len(args):
            raise Refusal('read-flow-argument-count')
        if receiver and receiver[0] == 'ref' and receiver[2] == 'descriptor' and len(parameters) >= 2 and parameters[0].startswith('L') and parameters[1] == 'I':
            if args[1] != integer(self.property_id):
                raise Refusal('read-flow-dispatch-id')
        locals_ = [] if receiver is None else [receiver]
        for kind, value in zip(parameters, args):
            locals_.append(value)
            if kind in ('J', 'D'):
                locals_.append(None)
        if len(locals_) > 64:
            raise Refusal('read-flow-local-limit')
        raw = instructions(method.code)
        if not raw:
            raise Refusal('read-flow-empty-body')
        indexed = {row[0]: i for i, row in enumerate(raw)}
        initial = (0, (), tuple(locals_))
        todo, seen, returned, edges = deque([initial]), set(), set(), {}
        self.active.add(key)
        self.methods.add((cls.name, name, desc))
        while todo:
            self.jar.check()
            state = todo.popleft()
            if state in seen:
                continue
            seen.add(state)
            edges[state] = []
            self.work['states'] += 1
            if len(seen) > 4096 or self.work['states'] > 100000:
                raise Refusal('read-flow-state-limit')
            offset, stack_, locals_ = state
            if offset not in indexed:
                raise Refusal('read-flow-branch-target')
            index = indexed[offset]
            _, op, operands = raw[index]
            stack, local = list(stack_), list(locals_)
            if len(stack) > 64 or len(local) > 64:
                raise Refusal('read-flow-frame-limit')
            following = [raw[index + 1][0]] if index + 1 < len(raw) else []
            self.work['instructions'] += 1
            if self.work['instructions'] > 2000000:
                raise Refusal('read-flow-instruction-limit')

            def pop():
                if not stack:
                    raise Refusal('read-flow-stack-underflow')
                return stack.pop()

            def cp():
                return constant(cls, operands[0] if op == 18 else operands[0] * 256 + operands[1])

            if op == 0:
                pass
            elif op == 1:
                stack.append(NULL)
            elif 2 <= op <= 8:
                stack.append(integer(op - 3))
            elif op in (16, 17):
                stack.append(integer(int.from_bytes(bytes(operands), 'big', signed=True)))
            elif op in (18, 19, 20):
                value = cp()
                if value['tag'] == 3:
                    stack.append(integer(int.from_bytes(bytes.fromhex(value['value']), 'big', signed=True)))
                elif value['tag'] in (4, 5, 6):
                    stack.append(unknown({4: 'F', 5: 'J', 6: 'D'}[value['tag']]))
                else:
                    raise Refusal('read-flow-literal')
            elif 9 <= op <= 15:
                stack.append(unknown('J' if op <= 10 else 'F' if op <= 13 else 'D'))
            elif 21 <= op <= 45:
                slot = operands[0] if op <= 25 else (op - 26) % 4
                if slot >= len(local) or local[slot] is None:
                    raise Refusal('read-flow-local-load')
                stack.append(local[slot])
            elif 54 <= op <= 78:
                slot = operands[0] if op <= 58 else (op - 59) % 4
                if slot >= 63:
                    raise Refusal('read-flow-local-limit')
                value = pop()
                while len(local) <= slot + 1:
                    local.append(None)
                local[slot] = value
                if value[1] in ('J', 'D'):
                    local[slot + 1] = None
            elif op == 87:
                pop()
            elif op == 89:
                value = pop(); stack.extend([value, value])
            elif op in (178, 180):
                ref = cp(); field = ref['owner'], ref['name'], ref['descriptor']
                value = unknown(ref['descriptor'])
                if op == 180:
                    source = pop()
                    if source[0] != 'ref' or ref['owner'] not in set(ancestors(self.jar.classes, source[1], self.jar.limits.depth)):
                        raise Refusal('read-flow-field-receiver')
                    guarded_field = field
                    if self.instance_values:
                        declaration = self.declarations.find('field', *field)
                        if declaration['status'] != 'declaration' or declaration['flags'] & 8:
                            raise Refusal('read-flow-instance-field-declaration')
                        guarded_field = (declaration['owner'], *field[1:])
                    if (source, guarded_field) in self.instance_values:
                        self.instance_fields.add((source, guarded_field))
                        value = self.instance_values[source, guarded_field]
                    elif field == self.property_field and source[2] == 'property':
                        value = integer(self.property_id)
                    elif self.property_descriptor is not None and source[2] == 'property':
                        expected, descriptor_class = self.property_descriptor
                        if field == tuple(expected):
                            value = ('ref', descriptor_class, 'descriptor')
                elif field in self.static_values:
                    self.static_fields.add(field)
                    value = self.static_values[field]
                elif field in self.flags:
                    value = integer(1)
                elif ref['descriptor'] == 'L' + self.descriptor_class + ';':
                    self.static_fields.add(field)
                    value = ('ref', self.descriptor_class, 'descriptor')
                stack.append(value)
            elif op in (182, 183, 184, 185):
                ref = cp(); types, return_type = signature(ref['descriptor'])
                values = tuple(reversed([pop() for _ in types]))
                source = None if op == 184 else pop()
                self.work['calls'] += 1
                if self.work['calls'] > 16000:
                    raise Refusal('read-flow-call-limit')
                if op in (182, 185) and ref['owner'] in self.jar.classes:
                    symbolic = self.declarations.find('method', ref['owner'], ref['name'], ref['descriptor'])
                    if symbolic['status'] != 'declaration' or symbolic['flags'] & 2:
                        raise Refusal('read-flow-private-or-unresolved-virtual')
                outcomes = self.evaluate(ref['owner'], ref['name'], ref['descriptor'], source, values, op in (183, 184))
                child_key = (ref['owner'], ref['name'], ref['descriptor'], source, values, op in (183, 184))
                child_cost = self.bounds[child_key]
                weight = (1 + child_cost[0], int(ref['owner'] in self.jar.classes) + child_cost[1], child_cost[2])
                for outcome in outcomes:
                    next_stack = tuple(stack + ([outcome] if return_type != 'V' else []))
                    for target in following:
                        following_state = (target, next_stack, tuple(local))
                        edges[state].append((following_state, weight))
                        todo.append(following_state)
                if len(todo) > 4096:
                    raise Refusal('read-flow-queue-limit')
                continue
            elif op == 192:
                value = pop(); target = cp()['value']
                if value[0] == 'ref' and target not in set(ancestors(self.jar.classes, value[1], self.jar.limits.depth)):
                    raise Refusal('read-flow-cast-type')
                stack.append(value)
            elif op == 193:
                target = cp()
                if target.get('tag') != 7:
                    raise Refusal('read-flow-instanceof-type')
                self.type_tests.add(target['value'])
                value = pop()
                result = 0 if value == NULL else None
                tested = target['value']
                if (self.class_tests and value[0] == 'ref' and value[1] in self.jar.classes
                        and not self.jar.classes[value[1]].flags & (512 | 1024)
                        and tested in self.jar.classes and not self.jar.classes[tested].flags & 512):
                    chain, external = lineage(self.jar, value[1], self.declarations.work)
                    if tested in chain:
                        result = 1
                    elif external == 'java/lang/Object':
                        result = 0
                    if result is not None:
                        self.resolved_class_tests.add((value[1], tested, result))
                        if len(self.resolved_class_tests) > 128:
                            raise Refusal('read-flow-class-test-limit')
                stack.append(integer(result))
            elif op in (96, 100, 126):
                right, left = pop(), pop()
                value = None
                if left[0] == right[0] == 'int' and left[2] is not None and right[2] is not None:
                    value = left[2] + right[2] if op == 96 else left[2] - right[2] if op == 100 else left[2] & right[2]
                    value = (value + 2**31) % 2**32 - 2**31
                stack.append(integer(value))
            elif 153 <= op <= 166 or op in (198, 199):
                right = pop()
                left = pop() if 159 <= op <= 166 else integer(0)
                known = None
                if op in (198, 199) and right[0] in ('null', 'ref'):
                    known = (right[0] == 'null') == (op == 198)
                elif op <= 164 and left[0] == right[0] == 'int' and left[2] is not None and right[2] is not None:
                    a, b = (right[2], 0) if op < 159 else (left[2], right[2])
                    known = (a == b, a != b, a < b, a >= b, a > b, a <= b)[(op - 153) % 6]
                target = offset + int.from_bytes(bytes(operands), 'big', signed=True)
                following = [target] if known is True else following if known is False else [*following, target]
            elif op in (167, 200):
                following = [offset + int.from_bytes(bytes(operands), 'big', signed=True)]
            elif op in (170, 171):
                value = pop()
                choices = ({operands[n]: offset + operands[n + 1] for n in range(1, len(operands), 2)}
                           if op == 171 else {operands[1] + n: offset + x for n, x in enumerate(operands[3:])})
                default = offset + operands[0]
                following = [choices.get(value[2], default)] if value[0] == 'int' and value[2] is not None else [default, *choices.values()]
            elif 172 <= op <= 177:
                value = unknown('V') if op == 177 else pop()
                if stack:
                    raise Refusal('read-flow-return-stack')
                returned.add(value)
                continue
            else:
                raise Refusal(f'read-flow-opcode:{cls.name}.{name}{desc}:{offset}:{op}')
            if len(following) + len(todo) > 4096:
                raise Refusal('read-flow-queue-limit')
            for target in following:
                if target <= offset:
                    raise Refusal('read-flow-back-edge')
                following_state = (target, tuple(stack), tuple(local))
                edges[state].append((following_state, (1, 0, 0)))
                todo.append(following_state)
        self.active.remove(key)
        if not returned:
            raise Refusal('read-flow-no-return')
        self.bounds[key] = path_bound(edges)[initial]
        self.memo[key] = returned
        return returned


def fixed_read_flow(jar, code, symbols, catalog, properties, flags):
    roles = {row['role']: row['reference'] for row in symbols['members']}
    ref = roles['property-id']
    cls = code.get(jar, ref[1])
    getter = member(cls, *ref[2:])
    raw = instructions(getter.code)
    if getter.flags != 1 or getter.handlers or [x[1] for x in raw] != [42, 180, 172]:
        raise Refusal('read-flow-property-id-getter')
    args = raw[1][2]; field = constant(cls, args[0] * 256 + args[1])
    if field['descriptor'] != 'I':
        raise Refusal('read-flow-property-id-field')
    property_field = field['owner'], field['name'], field['descriptor']
    anchors = {(r['name'], r['id']): r['matches'][0] for r in catalog['rows'] if r['count'] == 1}
    work = {'instructions': 0, 'states': 0, 'calls': 0}
    results, methods = [], set()
    for row in properties['properties']:
        anchor = anchors[row['name'], row['id']]
        for prop in row['properties']:
            if prop['matchCount'] != 1:
                raise Refusal('read-flow-property-count')
            flow = ReadFlow(jar, code, flags, property_field, prop['id'], anchor['descriptor'], work)
            receiver = ('ref', prop['targetClass'], 'property')
            obj = ('ref', anchor['runtimeClass'], 'object')
            selected = ['scalar-read']
            if symbols['types']['relationship'] in set(ancestors(jar.classes, receiver[1], jar.limits.depth)):
                selected += ['child-count', 'child-read']
            error, bounds = None, []
            try:
                for role in selected:
                    root = roles[role]
                    args = (obj, integer()) if role == 'child-read' else (obj,)
                    flow.evaluate(root[1], root[2], root[3], receiver, args)
                    cost = flow.bounds[(root[1], root[2], root[3], receiver, tuple(args), False)]
                    bounds.append(dict(role=role, **dict(zip(
                        ('vendorInstructions', 'vendorCalls', 'externalCalls'), cost))))
            except Refusal as failure:
                error = str(failure)
                if 'limit' in error:
                    raise
            methods.update(flow.methods)
            if len(methods) > 512:
                raise Refusal('read-flow-trace-limit')
            results.append({'classId': row['id'], 'className': row['name'],
                            'propertyId': prop['id'], 'propertyName': prop['name'],
                            'error': error, 'methods': sorted(flow.methods),
                            'normalReadBounds': bounds,
                            'external': sorted(flow.external, key=repr),
                            'requiredStaticDescriptorFields': sorted(flow.static_fields)})
    return {'sha256': jar.sha256, 'paths': results, 'methods': sorted(methods),
            'propertyIdField': property_field, 'work': work,
            'limits': ['Property and object receivers require exact runtime-class guards.',
                       'Property IDs and static descriptor identities require live checks.',
                       'External list and boxing dependencies remain separate conditions.',
                       'Normal read bounds exclude class initialization, external method bodies, and exception paths.',
                       'No vendor class is initialized and no runtime value is observed.'],
            'completeTable': False, 'boundedAdmission': False, 'writeAuthority': False}
