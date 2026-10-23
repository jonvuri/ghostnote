"""Find the exact-dispatch core of fixed command paths. Keep other edges open.

The index reads class bytes as data. It does not load or initialize a class.
A call edge enters the core only when its receiver is exact or when the
class hierarchy gives one target. Other virtual, interface, dynamic, and
external edges go to an explicit frontier. A frontier edge is not an
exclusion and not a proof of reachability.
"""
from array import array
from collections import OrderedDict, deque
from dataclasses import dataclass
import re

from grid_symbols.scan import Refusal, instructions, parse
from .ownership import bootstraps, constant

ARGUMENT = re.compile(r'\[*[ZBCSIJFD]|\[*L[^;]+;')
MUTATORS = {'add', 'addAll', 'remove', 'removeAll', 'retainAll', 'clear', 'removeIf', 'put', 'putAll', 'set'}


@dataclass
class ClosureLimits:
    sites: int = 1000000
    edges: int = 16384
    nodes: int = 4096
    code_classes: int = 256
    chain: int = 128
    producer_hops: int = 8
    fanout: int = 1


def arguments(desc):
    """Return the argument count and whether the method returns a value."""
    if not desc.startswith('(') or ')' not in desc:
        raise Refusal('closure-signature')
    inner, result = desc[1:].split(')', 1)
    found = ARGUMENT.findall(inner)
    if ''.join(found) != inner:
        raise Refusal('closure-signature')
    return len(found), result != 'V', sum(2 if x in ('J', 'D') else 1 for x in found)


class Index:
    """Stream one jar once. Keep declarations, packed incoming sites, and writes."""

    def __init__(self, jar, limits=None):
        self.jar, self.limits = jar, limits or ClosureLimits()
        self.names = sorted(jar.classes)
        self.ids = {n: i for i, n in enumerate(self.names)}
        self.methods, self.method_ids, self.incoming, self.writes = [], {}, {}, {}
        self.lambdas, self.handles, self.external, self.dynamic = {}, {}, 0, 0
        self.children, self.cache, self.bootstrap_cache = {}, OrderedDict(), {}
        sites = 0
        for name in self.names:
            jar.check()
            raw = jar.zip.read(name + '.class')
            cls = parse(raw, True)
            if cls.name != name:
                raise Refusal('closure-class-identity')
            for parent in (cls.parent, *cls.interfaces):
                if parent:
                    self.children.setdefault(parent, []).append(name)
            for i, entry in enumerate(cls.cp):
                if entry and entry[0] == 15:
                    target = constant(cls, i)['target']
                    self.handles.setdefault((target['owner'], target['name'], target['descriptor']), []).append(name)
            boot = None
            for method in cls.methods:
                key = name, method.name, method.desc
                if key in self.method_ids:
                    raise Refusal('closure-duplicate-method')
                mid = len(self.methods)
                self.method_ids[key] = mid
                self.methods.append(key)
                for offset, op, args in instructions(method.code):
                    if op == 186:
                        self.dynamic += 1
                        ref = constant(cls, args[0] * 256 + args[1])
                        if boot is None:
                            boot = bootstraps(raw, cls)
                        row = boot[ref['bootstrapIndex']]
                        if row['handle']['target']['name'] in ('metafactory', 'altMetafactory'):
                            interface = ref['descriptor'].split(')')[1][1:-1]
                            target = row['arguments'][1]['target']
                            self.lambdas.setdefault((ref['name'], row['arguments'][0]['value']), set()).add(
                                (interface, target['owner'], target['name'], target['descriptor']))
                    elif op in (179, 181):
                        ref = constant(cls, args[0] * 256 + args[1])
                        self.writes.setdefault((ref['owner'], ref['name']), array('I')).extend((mid, offset))
                    elif 182 <= op <= 185:
                        ref = constant(cls, args[0] * 256 + args[1])
                        owner = self.ids.get(ref['owner'])
                        if owner is None:
                            self.external += 1
                            continue
                        sites += 1
                        if sites > self.limits.sites:
                            raise Refusal('closure-site-limit')
                        self.incoming.setdefault((ref['name'], ref['descriptor']), array('I')).extend((mid, owner, offset, op))
        self.sites = sites
        self.subtype_cache = {}

    def code(self, name):
        if name in self.cache:
            self.cache.move_to_end(name)
            return self.cache[name]
        self.jar.check()
        cls = parse(self.jar.zip.read(name + '.class'), True)
        self.cache[name] = cls
        if len(self.cache) > self.limits.code_classes:
            self.cache.popitem(last=False)
        return cls

    def method(self, owner, name, desc):
        found = [m for m in self.code(owner).methods if m.name == name and m.desc == desc]
        if len(found) != 1:
            raise Refusal('closure-method-identity')
        return found[0]

    def declared(self, owner, name, desc):
        cls = self.jar.classes.get(owner)
        if cls is None:
            return None
        found = [m for m in cls.methods if m.name == name and m.desc == desc]
        if len(found) > 1:
            raise Refusal('closure-duplicate-declaration')
        return found[0] if found else None

    def resolve(self, owner, name, desc):
        """Resolve a symbolic reference in the class chain, then in interfaces."""
        current, depth = owner, 0
        while current in self.jar.classes:
            if self.declared(current, name, desc):
                return current
            current, depth = self.jar.classes[current].parent, depth + 1
            if depth > self.jar.limits.depth:
                raise Refusal('closure-hierarchy-depth')
        todo, seen, hits = [owner], set(), set()
        while todo:
            current = todo.pop()
            if current in seen or current not in self.jar.classes:
                continue
            seen.add(current)
            m = self.declared(current, name, desc)
            if m and not m.flags & 1024 and self.jar.classes[current].flags & 0x200:
                hits.add(current)
            c = self.jar.classes[current]
            todo.extend(x for x in (c.parent, *c.interfaces) if x)
        # Keep only the most specific default methods, as the JVM does.
        hits = {h for h in hits if not any(o != h and o in self.subtypes(h) for o in hits)}
        if len(hits) > 1:
            raise Refusal('closure-default-method-ambiguous')
        return next(iter(hits), None)

    def dispatch(self, runtime, name, desc):
        """Return the body for an exact runtime class, or None."""
        cls = self.jar.classes.get(runtime)
        if cls is None or cls.flags & (0x200 | 0x400):
            return None
        owner = self.resolve(runtime, name, desc)
        if owner is None:
            return None
        m = self.declared(owner, name, desc)
        return None if m.flags & 1024 else owner

    def subtypes(self, owner):
        if owner not in self.subtype_cache:
            found, todo = set(), [owner]
            while todo:
                current = todo.pop()
                if current in found:
                    continue
                found.add(current)
                todo.extend(self.children.get(current, ()))
            self.subtype_cache[owner] = found
        return self.subtype_cache[owner]

    def hierarchy_targets(self, owner, name, desc):
        """All in-jar bodies and lambda bodies for one virtual or interface slot."""
        bodies = {(t, name, desc) for t in (self.dispatch(c, name, desc) for c in self.subtypes(owner)) if t}
        types = self.subtypes(owner)
        for interface, impl_owner, impl_name, impl_desc in self.lambdas.get((name, desc), ()):
            if interface in types and impl_owner in self.jar.classes:
                bodies.add((impl_owner, impl_name, impl_desc))
        return sorted(bodies)

    def callers(self, owner, name, desc, related=True):
        rows, packed = [], self.incoming.get((name, desc), ())
        for i in range(0, len(packed), 4):
            mid, symbolic, offset, op = packed[i:i + 4]
            symbolic = self.names[symbolic]
            if related and owner not in self.subtypes(symbolic) and symbolic not in self.subtypes(owner):
                continue
            rows.append({'caller': list(self.methods[mid]), 'symbolicOwner': symbolic, 'offset': offset, 'opcode': op})
        return rows

    def field_writes(self, owner, name):
        packed = self.writes.get((owner, name), ())
        return [(self.methods[packed[i]], packed[i + 1]) for i in range(0, len(packed), 2)]

    def lambda_target(self, cls, index):
        if cls.name not in self.bootstrap_cache:
            self.bootstrap_cache[cls.name] = bootstraps(self.jar.zip.read(cls.name + '.class'), cls)
        ref = constant(cls, index)
        row = self.bootstrap_cache[cls.name][ref['bootstrapIndex']]
        if row['handle']['target']['name'] not in ('metafactory', 'altMetafactory'):
            return None
        t = row['arguments'][1]['target']
        return 'lambda', t['owner'], t['name'], t['descriptor']


def stack_effect(cls, op, args):
    """Return (values popped, values pushed). Return None for unsupported forms."""
    if op in (0, 132, 167):
        return 0, 0
    if 1 <= op <= 45:
        return 0, 1
    if 46 <= op <= 53:
        return 2, 1
    if 54 <= op <= 78:
        return 1, 0
    if 79 <= op <= 86:
        return 3, 0
    if op == 87:
        return 1, 0
    if op == 89:
        return 1, 2
    if 96 <= op <= 115 or 120 <= op <= 131 or 148 <= op <= 152:
        return 2, 1
    if 116 <= op <= 119 or 133 <= op <= 147 or op in (188, 189, 190, 192, 193):
        return 1, 1
    if 153 <= op <= 158 or op in (198, 199):
        return 1, 0
    if 159 <= op <= 166:
        return 2, 0
    if op in (178, 179, 180, 181):
        return {178: (0, 1), 179: (1, 0), 180: (1, 1), 181: (2, 0)}[op]
    if op == 187:
        return 0, 1
    if 182 <= op <= 186:
        count, value, _ = arguments(constant(cls, args[0] * 256 + args[1])['descriptor'])
        return count + (0 if op in (184, 186) else 1), int(value)
    return None


def branch_targets(method):
    rows = instructions(method.code)
    targets = {h[2] for h in method.handlers} | {h[0] for h in method.handlers}
    for offset, op, args in rows:
        if 153 <= op <= 168 or op in (198, 199):
            targets.add(offset + int.from_bytes(bytes(args), 'big', signed=True))
        elif op in (170, 171, 200, 201, 168, 169):
            return rows, None
    return rows, targets


def producer(cls, method, offset, depth):
    """Find the instruction that pushed one stack value in one linear block."""
    rows, targets = branch_targets(method)
    if targets is None:
        return None
    index = {o: i for i, (o, _, _) in enumerate(rows)}
    if offset not in index:
        raise Refusal('closure-producer-offset')
    i, need = index[offset] - 1, depth
    while i >= 0:
        if rows[i + 1][0] in targets:
            return None
        o, op, args = rows[i]
        effect = stack_effect(cls, op, args)
        if effect is None or op == 167:
            return None
        if op == 89 and need <= 1:
            need, i = 0, i - 1
            continue
        pop, push = effect
        if need < push:
            return rows[i]
        need, i = need - push + pop, i - 1
    return None


def local_stores(method, slot):
    found = []
    for offset, op, args in instructions(method.code):
        if op == 196:
            return None
        if (op == 58 and args[0] == slot) or (75 <= op <= 78 and op - 75 == slot):
            found.append(offset)
    return found


def value_source(cls, method, offset, depth, hops=0, limit=8):
    """Follow single-assignment local variables to a value producer."""
    found = producer(cls, method, offset, depth)
    if found is None:
        return 'nonlinear', None
    _, op, args = found
    slot = op - 42 if 42 <= op <= 45 else args[0] if op == 25 else None
    if slot is None:
        return 'op', found
    params = (0 if method.flags & 8 else 1) + arguments(method.desc)[2]
    if slot == 0 and not method.flags & 8:
        return 'this', None
    stores = local_stores(method, slot)
    if stores is None:
        return 'wide', None
    if not stores:
        return ('parameter', slot) if slot < params else ('unassigned', slot)
    if len(stores) != 1 or slot < params or hops >= limit:
        return 'multiple-stores', slot
    return value_source(cls, method, stores[0], 0, hops + 1, limit)


def field_declaration(index, owner, name):
    current = owner
    while current in index.jar.classes:
        cls = index.jar.classes[current]
        if any(f.name == name for f in cls.fields):
            return current
        for interface in cls.interfaces:
            if interface in index.jar.classes and any(f.name == name for f in index.jar.classes[interface].fields):
                return interface
        current = cls.parent
    return None


def exact_field(index, owner, name, memo=None):
    """Return the exact classes stored in one field, or None with a reason.

    Every in-jar writer must store a fresh allocation, a lambda, or null.
    Reflection, Unsafe, serialization, and native writes stay conditions.
    """
    memo = {} if memo is None else memo
    declaration = field_declaration(index, owner, name)
    if declaration is None:
        return None, 'field-unresolved'
    key = declaration, name
    if key in memo:
        return memo[key]
    writes = index.field_writes(*key)
    if not writes:
        memo[key] = None, 'no-in-jar-writer'
        return memo[key]
    found = set()
    for (wowner, wname, wdesc), offset in writes:
        cls = index.code(wowner)
        kind, row = value_source(cls, index.method(wowner, wname, wdesc), offset, 0, limit=index.limits.producer_hops)
        if kind != 'op':
            memo[key] = None, f'writer-{kind}:{wowner}.{wname}{wdesc}@{offset}'
            return memo[key]
        _, op, args = row
        if op == 187:
            found.add(constant(cls, args[0] * 256 + args[1])['value'])
        elif op == 186 and index.lambda_target(cls, args[0] * 256 + args[1]):
            found.add(index.lambda_target(cls, args[0] * 256 + args[1]))
        elif op != 1:
            memo[key] = None, f'writer-op{op}:{wowner}.{wname}{wdesc}@{offset}'
            return memo[key]
    memo[key] = frozenset(found), f'{len(writes)}-writers'
    return memo[key]


def receiver(index, node, offset, desc, memo, pins=None):
    owner, name, mdesc, this = node
    cls = index.code(owner)
    method = index.method(owner, name, mdesc)
    kind, row = value_source(cls, method, offset, arguments(desc)[0], limit=index.limits.producer_hops)
    if kind == 'this':
        return ({this}, 'this') if this else (None, 'this-unknown')
    if kind != 'op':
        return None, kind
    _, op, args = row
    if op == 187:
        return {constant(cls, args[0] * 256 + args[1])['value']}, 'allocation'
    if op == 186:
        target = index.lambda_target(cls, args[0] * 256 + args[1])
        return ({target}, 'lambda') if target else (None, 'dynamic-other')
    if op in (178, 180):
        ref = constant(cls, args[0] * 256 + args[1])
        pinned = (pins or {}).get((field_declaration(index, ref['owner'], ref['name']), ref['name']))
        if pinned is not None:
            return set(pinned), 'pinned-field:' + ref['owner'] + '.' + ref['name']
        found, why = exact_field(index, ref['owner'], ref['name'], memo)
        label = 'field:' + ref['owner'] + '.' + ref['name'] + ':' + why
        return (set(found), label) if found is not None else (None, label)
    return None, 'producer-op' + str(op)


def closure(index, roots, sinks=(), skip=(), pins=None):
    """Return the exact-dispatch core, the sinks in it, and the open frontier.

    A pin states the exact runtime classes of one field. It is a condition
    that a runtime guard must check; it is not a trace result.
    """
    limits, memo = index.limits, {}
    sinks, skip = set(map(tuple, sinks)), set(map(tuple, skip))
    parent, todo, edges = {}, deque(), 0
    for root in roots:
        root = tuple(root)
        parent[root] = None
        todo.append(root)
    frontier, external, hits, unresolved = {}, {}, [], 0
    while todo:
        node = todo.popleft()
        owner, name, desc, this = node
        if (owner, name, desc) in sinks:
            hits.append(node)
        method = index.method(owner, name, desc)
        if method.flags & (256 | 1024):
            frontier.setdefault(('native-or-abstract', owner, name, desc), set()).add((owner, name, desc, -1))
            continue
        cls = index.code(owner)
        for offset, op, args in instructions(method.code):
            if not 182 <= op <= 186:
                continue
            ref = constant(cls, args[0] * 256 + args[1])
            site = owner, name, desc, offset
            if site in skip:
                frontier.setdefault(('skipped', ref.get('owner'), ref['name'], ref['descriptor']), set()).add(site)
                continue
            if op == 186:
                if not index.lambda_target(cls, args[0] * 256 + args[1]):
                    frontier.setdefault(('dynamic', None, ref['name'], ref['descriptor']), set()).add(site)
                continue
            target = ref['owner'], ref['name'], ref['descriptor']
            if ref['owner'] not in index.jar.classes:
                external.setdefault(target, set()).add(site)
                if op in (183, 184) or not index.children.get(ref['owner']):
                    continue
            nodes, why = [], None
            if op in (183, 184):
                body = index.resolve(*target)
                if body is None:
                    frontier.setdefault(('unresolved', *target), set()).add(site)
                    continue
                exact = None
                if op == 183:
                    found, why = receiver(index, node, offset, ref['descriptor'], memo, pins)
                    if found and len(found) == 1 and isinstance(next(iter(found)), str):
                        exact = next(iter(found))
                nodes = [(body, ref['name'], ref['descriptor'], exact)]
            else:
                found, why = receiver(index, node, offset, ref['descriptor'], memo, pins)
                if found is not None:
                    for item in sorted(found, key=str):
                        if isinstance(item, tuple):
                            body = index.resolve(*item[1:])
                            if body:
                                nodes.append((body, item[2], item[3], None))
                        elif item in index.jar.classes:
                            body = index.dispatch(item, ref['name'], ref['descriptor'])
                            if body:
                                nodes.append((body, ref['name'], ref['descriptor'], item))
                        else:
                            external.setdefault((item, ref['name'], ref['descriptor']), set()).add(site)
                else:
                    bodies = index.hierarchy_targets(*target)
                    if not bodies:
                        external.setdefault(target, set()).add(site)
                        continue
                    if len(bodies) > limits.fanout:
                        frontier.setdefault(('receiver-open', *target, why, len(bodies)), set()).add(site)
                        unresolved += 1
                        continue
                    nodes = [(*body, None) for body in bodies]
            for child in nodes:
                edges += 1
                if edges > limits.edges:
                    raise Refusal('closure-edge-limit')
                if child not in parent:
                    if len(parent) >= limits.nodes:
                        raise Refusal('closure-node-limit')
                    parent[child] = node, offset, op, why
                    todo.append(child)

    def chain(node):
        rows = []
        while parent.get(node):
            caller, offset, op, why = parent[node]
            rows.append({'caller': list(caller[:3]), 'callerThis': caller[3], 'offset': offset, 'opcode': op,
                         'target': list(node[:3]), 'targetThis': node[3], 'receiver': why})
            node = caller
            if len(rows) > limits.chain:
                raise Refusal('closure-chain-limit')
        return rows[::-1]

    return {'roots': [list(r) for r in roots], 'pins': sorted([list(k), sorted(v)] for k, v in (pins or {}).items()),
            'coreMethods': len(parent), 'edges': edges,
            'sinkHits': [{'sink': list(h[:3]), 'this': h[3], 'chain': chain(h)} for h in hits],
            'externalCalls': sorted(([list(k), len(v), sorted(map(list, v))[:8]] for k, v in external.items()), key=str),
            'frontier': sorted(([list(k), len(v), sorted(map(list, v))[:8]] for k, v in frontier.items()), key=str),
            'frontierSites': sum(len(v) for v in frontier.values()), 'openReceiverSites': unresolved,
            'core': sorted((list(k) for k in parent), key=str),
            'limits': ['The core uses exact receivers or one hierarchy target.',
                       'A frontier site can reach any of its targets at run time.',
                       'Reflection, native, external callback, and generated-class edges are conditions.']}


def list_mutations(index, owner, field):
    """Report the method calls on each read of one list or set field."""
    rows = []
    for name in (owner,):
        cls = index.code(name)
        for method in cls.methods:
            raw = instructions(method.code)
            for i, (offset, op, args) in enumerate(raw):
                if op != 180:
                    continue
                ref = constant(cls, args[0] * 256 + args[1])
                if (ref['owner'], ref['name']) != (owner, field):
                    continue
                call = None
                for o2, op2, a2 in raw[i + 1:i + 6]:
                    if op2 in (182, 185):
                        r2 = constant(cls, a2[0] * 256 + a2[1])
                        call = r2['name']
                        break
                rows.append({'method': [name, method.name, method.desc], 'offset': offset, 'nextCall': call,
                             'mutation': call in MUTATORS})
    return rows


def fingerprint(method):
    """Opcode sequence and handler offsets. Operands and names are not used."""
    return len(method.code), tuple(op for _, op, _ in instructions(method.code)), tuple(h[:3] for h in method.handlers)
