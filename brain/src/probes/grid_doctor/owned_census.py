"""Derive the exact-class set of the fresh Amplify owned tree from bytecode.

The runtime ownership walk visits the strong relationship children of each
document object. Those objects come from two sources: the serialized module
file and the initialization hooks of each class and its ancestors. The
9b.6h guard set used the serialized tree plus constructor defaults. It missed
the objects that static factories create inside ancestor init methods
(`rce.bl_()` creates `wKx` on 6.1.4).

This module reads the jar as data. It resolves every serialized node by the
declared target of the relationship that references it, follows the
initialization entries of each class through its ancestor chain, and records
each document-object creation that is stored through a this-call. It then
traces the disposal body chain of each class. No vendor class is loaded or
initialized, no host request is sent, and the report grants no write
authority.
"""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import time

from grid_symbols.scan import Jar, Refusal, ancestors, instructions, parse, rss_bytes
from .contracts import contract
from .fixed_descriptors import constructor_pair, integer
from .ownership import constant

FORMAT = 'grid-doctor-owned-census-v1'
SERIAL_PACKAGE = 'com/bitwig/ramona/serial/'
MAX_SECONDS = 180
MAX_RSS = 768 * 1024**2
MAX_STATIC_DEPTH = 6
MAX_HELPER_DEPTH = 2
COLLECTION_TYPES = ('java/util/List', 'java/util/Collection', 'java/util/Set', 'java/util/ArrayList')
MAX_CLASSES = 64
MAX_REACHABLE = 4096
MAX_REPORT = 2 * 1024**2
CACHE_RELEASE = 100
CONDITIONS = [
    'Classes are read as data. No vendor class is loaded or initialized.',
    'A serialized node is resolved by the declared target descriptor of the relationship '
    'that references it; the root is the module-contents class of the module file.',
    'Initialization entries are the constructor, the base methods that static factories call '
    'on a fresh object, the base serialization hooks, and the instance methods that the '
    'module factory closure calls on the module class.',
    'Reachability follows this-calls inside the class chain, super calls from the named class, '
    'and calls on helper objects that are not document objects, at most two hops away. Calls on '
    'other document objects are not followed; those objects have their own closure.',
    'A creation counts when the created class is a concrete document object and the creating '
    'body, or the init body that receives it from a helper, passes it to a call on this or on a '
    'document object whose parameter type is one of its ancestors, or adds it to a collection.',
    'A document object created on an init path without such a store is a helper object. It is '
    'not in the set, but its own init closure is followed for children stored into the tree.',
    'The set is an over-approximation of the runtime tree for the fixed Amplify module: a '
    'conditional creation on an init path is included even when the data does not take it.',
    'The disposal chain compares body contracts modulo renaming. It does not run any body.',
]


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def params(desc):
    return re.findall(r'L([^;]+);', desc[:desc.index(')')])


def return_type(desc):
    rest = desc[desc.index(')') + 1:]
    return rest[1:-1] if rest.startswith('L') else None


class Census:
    """One build. Every lookup is a read of class-file data."""

    def __init__(self, jar, roles, forms, strong):
        self.jar = jar
        self.base = roles['object']
        self.descriptor = roles['descriptor']
        self.module = roles['module']
        self.factory = roles['module-factory']
        self.forms = forms
        self.strong = strong
        self.anc = {}
        self.start = time.perf_counter()
        self.work = 0

    # --- bounded helpers -------------------------------------------------
    def check(self):
        self.jar.check()
        if time.perf_counter() - self.start > MAX_SECONDS:
            raise Refusal('census-deadline')
        if rss_bytes() > MAX_RSS:
            raise Refusal('census-rss-limit')

    def chain(self, name):
        if name not in self.anc:
            self.anc[name] = list(ancestors(self.jar.classes, name)) if name in self.jar.classes else []
        return self.anc[name]

    def is_doc(self, name):
        return name != self.base and self.base in self.chain(name)

    def code(self, name):
        if len(self.jar.code_cache) >= CACHE_RELEASE:
            self.jar.code_cache.clear()
        self.check()
        return self.jar.code(name)

    def ref(self, cls, args):
        owner, nt = cls.cp[args[0] * 256 + args[1]][1]
        owner = cls.cp[cls.cp[owner][1]][1]
        ni, di = cls.cp[nt][1]
        return owner, cls.cp[ni][1], cls.cp[di][1]

    def class_ref(self, cls, args):
        return cls.cp[cls.cp[args[0] * 256 + args[1]][1]][1]

    def method(self, cls, name, desc):
        found = [m for m in cls.methods if (m.name, m.desc) == (name, desc)]
        return found[0] if len(found) == 1 else None

    # --- descriptor catalog ---------------------------------------------
    def catalog(self):
        """Map (name, id) and runtime class to the document descriptor class."""
        by_runtime, by_id = {}, {}
        for entry in self.jar.zip.namelist():
            if not entry.endswith('.class'):
                continue
            name = entry[:-6]
            if self.descriptor not in self.chain(name):
                continue
            meta = self.jar.classes[name]
            if not any(m.name == '<init>' and m.desc == '()V' for m in meta.methods):
                continue
            self.check()
            cls = parse(self.jar.zip.read(entry), True)
            init = self.method(cls, '<init>', '()V')
            pair = constructor_pair(cls, init) if init and init.code else None
            if pair is None:
                continue
            getters = []
            for getter in cls.methods:
                if getter.desc != '()Ljava/lang/Class;' or getter.flags != 1 or not getter.code:
                    continue
                raw = instructions(getter.code)
                if len(raw) == 2 and raw[0][1] in (18, 19) and raw[1][1] == 176:
                    _, op, args = raw[0]
                    value = constant(cls, args[0] if op == 18 else args[0] * 256 + args[1])
                    if value['tag'] == 7:
                        getters.append(value['value'])
            if len(getters) != 1 or not self.is_doc(getters[0]):
                continue
            runtime = getters[0]
            if runtime in by_runtime:
                raise Refusal('census-runtime-descriptor-conflict:' + runtime)
            row = {'descriptor': name, 'runtime': runtime, 'className': pair[0], 'classId': pair[1]}
            by_runtime[runtime] = row
            by_id.setdefault(pair[1], []).append(row)
        self.by_runtime, self.by_id = by_runtime, by_id
        return by_runtime

    def relationships(self, descriptor):
        """Read the relationship definitions of one descriptor class and its ancestors.

        Each definition is `new R(name, id, owner, target, kind, ...)` where R is
        a relationship class, owner and target are descriptor singletons, and
        kind is the relationship-kind enum constant. A descriptor inherits the
        definitions of its ancestor descriptors.
        """
        result, seen = [], set()
        for owner in self.chain(descriptor):
            if owner == self.descriptor or self.descriptor not in self.chain(owner):
                continue
            for row in self.declared_relationships(owner):
                if row['id'] in seen:
                    continue
                seen.add(row['id'])
                result.append({**row, 'declaring': owner})
        return result

    def declared_relationships(self, descriptor):
        cls = self.code(descriptor)
        result = []
        for m in cls.methods:
            if not m.code:
                continue
            raw = instructions(m.code)
            pending = None
            for index, (offset, op, args) in enumerate(raw):
                if op == 187:
                    created = self.class_ref(cls, args)
                    if created in self.forms:
                        pending = {'form': self.forms[created], 'class': created, 'name': None, 'id': None,
                                   'descriptors': [], 'kind': None, 'start': index}
                    continue
                if pending is None:
                    continue
                if op in (18, 19):
                    value = constant(cls, args[0] if op == 18 else args[0] * 256 + args[1])
                    if value['tag'] == 8 and pending['name'] is None:
                        pending['name'] = value['value']
                    elif value['tag'] == 3 and pending['id'] is None:
                        pending['id'] = integer(cls, op, args)
                elif 2 <= op <= 8 or op in (16, 17):
                    if pending['id'] is None:
                        pending['id'] = integer(cls, op, args)
                elif op == 178:
                    owner, name, desc = self.ref(cls, args)
                    if owner == self.strong['kindEnum']:
                        pending['kind'] = self.strong['enumNames'].get(name, 'unknown:' + name)
                    elif self.descriptor in self.chain(owner):
                        pending['descriptors'].append(owner)
                elif op == 183:
                    owner, name, desc = self.ref(cls, args)
                    if owner == pending['class'] and name == '<init>':
                        target = [d for d in pending['descriptors'] if d != descriptor]
                        if pending['kind'] is None:
                            # A map relationship sets its kind inside its own constructor.
                            pending['kind'] = self.constructor_kind(owner, desc)
                        if pending['name'] is None or pending['id'] is None or pending['kind'] is None:
                            raise Refusal(f'census-relationship-shape:{descriptor}:{m.name}{m.desc}:{offset}')
                        result.append({'name': pending['name'], 'id': pending['id'], 'form': pending['form'],
                                       'kind': pending['kind'], 'target': target[0] if len(target) == 1 else None,
                                       'targets': target})
                        pending = None
        return result

    def constructor_kind(self, relationship, desc):
        """The kind enum constant that a relationship constructor passes to its parent."""
        cls = self.code(relationship)
        m = self.method(cls, '<init>', desc)
        if m is None or not m.code:
            return None
        found = []
        for offset, op, args in instructions(m.code):
            if op == 178:
                owner, name, field_desc = self.ref(cls, args)
                if owner == self.strong['kindEnum']:
                    found.append(self.strong['enumNames'].get(name, 'unknown:' + name))
        return found[0] if len(found) == 1 else None

    # --- serialized tree --------------------------------------------------
    def resolve_serialized(self, root):
        """Resolve each serialized node to a runtime class through relationship targets."""
        refs = serialized_edges(root)
        nodes = {n['objectId']: dict(n) for n in refs['nodes']}
        root_id = refs['nodes'][0]['objectId']
        hits = self.by_id.get(nodes[root_id]['classId'], [])
        if len(hits) != 1:
            raise Refusal('census-root-ambiguous')
        nodes[root_id]['runtime'] = hits[0]['runtime']
        nodes[root_id]['via'] = 'root'
        relationship_cache = {}
        for edge in refs['references']:
            source, target = nodes[edge['source']], nodes[edge['target']]
            if 'runtime' not in source:
                raise Refusal('census-edge-order')
            descriptor = self.by_runtime[source['runtime']]['descriptor']
            if descriptor not in relationship_cache:
                relationship_cache[descriptor] = {r['id']: r for r in self.relationships(descriptor)}
            relationship = relationship_cache[descriptor].get(edge['propertyId'])
            if relationship is None or relationship['target'] is None:
                raise Refusal(f'census-edge-relationship:{source["runtime"]}:{edge["propertyId"]}')
            target_descriptor = relationship['target']
            candidates = [r for r in self.by_id.get(target['classId'], [])
                          if target_descriptor in self.chain(r['descriptor'])]
            if len(candidates) != 1:
                raise Refusal(f'census-edge-target:{source["runtime"]}:{edge["propertyId"]}:{target["classId"]}')
            runtime = candidates[0]['runtime']
            if 'runtime' in target and target['runtime'] != runtime:
                raise Refusal('census-edge-conflict')
            if edge['kind'] == 'inline':
                target['runtime'] = runtime
                target['via'] = [source['runtime'], edge['propertyId'], relationship['kind']]
            else:
                target.setdefault('referencedBy', []).append([source['runtime'], edge['propertyId'], relationship['kind']])
        if any('runtime' not in n for n in nodes.values()):
            raise Refusal('census-unresolved-node')
        counts = Counter(n['runtime'] for n in nodes.values())
        strong_edges = sum(1 for n in nodes.values() if n['via'] != 'root' and n['via'][2] == 'STRONG')
        weak_inline = [[n['via'][0], n['via'][1], n['runtime']] for n in nodes.values()
                       if n['via'] != 'root' and n['via'][2] != 'STRONG']
        references = sum(len(n.get('referencedBy', [])) for n in nodes.values())
        return {'objects': len(nodes), 'strongEdges': strong_edges, 'nonStrongInlineEdges': weak_inline,
                'referenceEdges': references, 'classes': dict(sorted(counts.items())),
                'relationships': relationship_cache}

    # --- initialization entries -------------------------------------------
    def entries(self, seeds):
        """Base methods that static factories call on a fresh object, and the serialization hooks."""
        base_methods = {(m.name, m.desc) for m in self.jar.classes[self.base].methods}
        result = {('<init>', '()V'): 'constructor'}
        for seed in seeds:
            for owner in self.chain(seed):
                if owner not in self.jar.classes or owner == self.base or owner in self.chain(self.base):
                    continue
                cls = self.code(owner)
                for m in cls.methods:
                    if not m.code or not m.flags & 8:
                        continue
                    created = None
                    for offset, op, args in instructions(m.code):
                        if op == 187:
                            name = self.class_ref(cls, args)
                            if self.is_doc(name):
                                created = name
                        elif op in (182, 183) and created:
                            target, name, desc = self.ref(cls, args)
                            if (name, desc) in base_methods and name != '<init>' \
                                    and (target == created or target in self.chain(created)):
                                result.setdefault((name, desc), f'factory:{owner}.{m.name}{m.desc}')
        for m in self.jar.classes[self.base].methods:
            if not m.flags & 8 and any(p.startswith(SERIAL_PACKAGE) for p in params(m.desc)):
                result.setdefault((m.name, m.desc), 'serialization-hook')
        return result

    def module_entries(self):
        """Instance methods that the module factory's static closure calls on the module class."""
        extra, seen = {}, set()
        todo = [(self.factory[0], self.factory[1], self.factory[2], 0)]
        while todo:
            owner, name, desc, depth = todo.pop()
            if (owner, name, desc) in seen or depth > MAX_STATIC_DEPTH or owner not in self.jar.classes:
                continue
            seen.add((owner, name, desc))
            cls = self.code(owner)
            m = self.method(cls, name, desc)
            if m is None or not m.code:
                continue
            for offset, op, args in instructions(m.code):
                if op not in (182, 183, 184):
                    continue
                target, n2, d2 = self.ref(cls, args)
                if op == 184 and target in self.jar.classes:
                    todo.append((target, n2, d2, depth + 1))
                elif op != 184 and n2 != '<init>' and (target == self.module or target in self.chain(self.module)):
                    extra.setdefault((n2, d2), f'module-factory:{owner}.{name}{desc}')
        return extra

    # --- reachability and creations --------------------------------------
    def resolve(self, receiver, name, desc):
        for owner in self.chain(receiver):
            if owner not in self.jar.classes:
                continue
            for m in self.jar.classes[owner].methods:
                if (m.name, m.desc) == (name, desc) and not m.flags & 0x400:
                    return owner
        return None

    def callee_creations(self, start, name, desc, depth, seen, static):
        """Concrete document classes created inside a callee and its own call chain.

        A static callee resolves on its named class. An instance callee
        resolves from the start class. Both follow further static calls and
        this-calls whose return type is a document object.
        """
        owner = start if static else self.resolve(start, name, desc)
        if depth > MAX_STATIC_DEPTH or owner is None or (owner, name, desc) in seen \
                or owner not in self.jar.classes or owner == self.base or owner in self.chain(self.base):
            return []
        seen.add((owner, name, desc))
        cls = self.code(owner)
        m = self.method(cls, name, desc)
        if m is None or not m.code:
            return []
        out = []
        for offset, op, args in instructions(m.code):
            if op == 187:
                created = self.class_ref(cls, args)
                if self.is_doc(created):
                    out.append(created)
            elif op in (182, 183, 184, 185):
                target, n2, d2 = self.ref(cls, args)
                returned = return_type(d2)
                if not (returned and self.is_doc(returned)):
                    continue
                if op == 184:
                    out.extend(self.callee_creations(target, n2, d2, depth + 1, seen, True))
                elif op == 183:
                    out.extend(self.callee_creations(target, n2, d2, depth + 1, seen, True))
                elif target == owner or target in self.chain(start):
                    out.extend(self.callee_creations(start, n2, d2, depth + 1, seen, False))
        return out

    def store_evidence(self, cls, m, created):
        """A call whose parameter type is an ancestor of the created class.

        The receiver is this, an ancestor, or another document object. A
        helper that creates a child stores it through the owning object.
        """
        collection = None
        for offset, op, args in instructions(m.code):
            if op in (182, 183, 185):
                owner, name, desc = self.ref(cls, args)
                if owner == cls.name or owner in self.chain(cls.name) or self.is_doc(owner):
                    for p in params(desc):
                        if p != 'java/lang/Object' and p in self.chain(created):
                            return [owner, name, desc, p]
                elif owner in COLLECTION_TYPES and name == 'add' and collection is None:
                    collection = [owner, name, desc, 'collection-add']
        return collection

    def reachable(self, receiver, entries):
        """Init-reachable methods of one class and the stored creations in them.

        A virtual call on this resolves from the receiver. A special call
        resolves from the named class, so a super chain is followed. A call on
        a helper object that is not a document object resolves from its static
        type, at most MAX_HELPER_DEPTH hops away from the receiver.
        """
        todo = [(receiver, name, desc, 0) for name, desc in sorted(entries)]
        visited, methods, creations = set(), [], []
        while todo:
            start, name, desc, depth = todo.pop()
            owner = self.resolve(start, name, desc)
            if owner is None or owner == self.base or owner in self.chain(self.base) or owner.startswith('java/'):
                continue
            if (owner, name, desc) in visited:
                continue
            visited.add((owner, name, desc))
            if len(visited) > MAX_REACHABLE:
                raise Refusal('census-reachable-limit:' + receiver)
            cls = self.code(owner)
            m = self.method(cls, name, desc)
            if m is None or not m.code:
                continue
            methods.append([owner, name, desc, depth])
            own_chain = self.chain(receiver) if depth == 0 else self.chain(start)
            for offset, op, args in instructions(m.code):
                self.work += 1
                if op == 183:
                    target, n2, d2 = self.ref(cls, args)
                    if target in self.jar.classes:
                        todo.append((target, n2, d2, depth))
                        self.attribute(creations, receiver, owner, m, cls, target, n2, d2, True)
                elif op in (182, 185):
                    target, n2, d2 = self.ref(cls, args)
                    if target == owner or target in own_chain:
                        todo.append((start if depth else receiver, n2, d2, depth))
                        self.attribute(creations, receiver, owner, m, cls, start if depth else receiver, n2, d2, False)
                    elif target in self.jar.classes and not self.is_doc(target) and depth < MAX_HELPER_DEPTH \
                            and self.descriptor not in self.chain(target):
                        todo.append((target, n2, d2, depth + 1))
                elif op == 187:
                    created = self.class_ref(cls, args)
                    if self.is_doc(created):
                        self.creation(creations, receiver, owner, m, cls, created, None)
                elif op == 184:
                    target, n2, d2 = self.ref(cls, args)
                    self.attribute(creations, receiver, owner, m, cls, target, n2, d2, True)
        return methods, creations

    def attribute(self, creations, receiver, owner, m, cls, start, name, desc, static):
        """Creations inside a callee that returns a document object count for the calling body."""
        returned = return_type(desc)
        if not (returned and self.is_doc(returned)):
            return
        for created in self.callee_creations(start, name, desc, 0, set(), static):
            self.creation(creations, receiver, owner, m, cls, created, [start, name, desc])

    def creation(self, creations, receiver, owner, m, cls, created, via):
        if created not in self.jar.classes or self.jar.classes[created].flags & 0x400:
            return
        store = self.store_evidence(cls, m, created)
        row = {'class': created, 'for': receiver, 'in': [owner, m.name, m.desc], 'via': via, 'store': store}
        if row not in creations:
            creations.append(row)

    # --- disposal chain ---------------------------------------------------
    def disposal_chain(self, receiver, disposal):
        """Every declaration of the disposal role along the ancestor chain, root first."""
        name, desc = disposal[1], disposal[2]
        rows = []
        for owner in self.chain(receiver):
            if owner not in self.jar.classes:
                continue
            if not any((m.name, m.desc) == (name, desc) for m in self.jar.classes[owner].methods):
                continue
            cls = self.code(owner)
            m = self.method(cls, name, desc)
            if m is None or not m.code:
                continue
            body = contract(cls, m, self.jar.classes)
            calls = sorted({f'{o}.{n}{d}' for o, n, d in (self.ref(cls, a) for _, op, a in instructions(m.code)
                                                           if op in (182, 183, 184, 185))})
            rows.append({'declaring': owner, 'instructions': body['instructions'],
                         'bodyDigest': body['bodyDigest'], 'flags': m.flags, 'calls': calls})
        return rows

    # --- the census -------------------------------------------------------
    def run(self, root, disposal):
        self.catalog()
        serialized = self.resolve_serialized(root)
        tree = {}
        for runtime, count in serialized['classes'].items():
            tree[runtime] = {'serialized': count, 'creations': []}
        tree.setdefault(self.module, {'serialized': 0, 'creations': []})
        seeds = list(tree)
        entries = self.entries(seeds)
        module_extra = self.module_entries()
        entry_rows = {f'{n}{d}': why for (n, d), why in entries.items()}
        entry_rows.update({f'{n}{d}': why for (n, d), why in module_extra.items()})
        work, done, reach, helpers = list(tree), set(), {}, {}
        while work:
            receiver = work.pop()
            if receiver in done:
                continue
            done.add(receiver)
            keys = set(entries) | (set(module_extra) if receiver == self.module else set())
            methods, creations = self.reachable(receiver, keys)
            reach[receiver] = methods
            for row in creations:
                created = row['class']
                site = {k: v for k, v in row.items() if k != 'class'}
                if row['store'] is None:
                    # Created on an init path but not stored through a call: a helper document object.
                    # Its own init closure can store children into tree objects.
                    helpers.setdefault(created, []).append(site)
                else:
                    tree.setdefault(created, {'serialized': 0, 'creations': []})
                    tree[created]['creations'].append(site)
                if created not in done:
                    work.append(created)
            if len(tree) + len(helpers) > MAX_CLASSES * 2:
                raise Refusal('census-class-limit')
        for name in list(helpers):
            if name in tree:
                del helpers[name]
        classes = []
        for runtime in sorted(tree, key=lambda r: (self.by_runtime.get(r, {}).get('className', ''), r)):
            row = self.by_runtime.get(runtime)
            if row is None:
                raise Refusal('census-class-without-descriptor:' + runtime)
            strong = [r for r in self.relationships(row['descriptor']) if r['kind'] == 'STRONG']
            classes.append({'name': runtime, 'className': row['className'], 'classId': row['classId'],
                            'descriptor': row['descriptor'], 'serialized': tree[runtime]['serialized'],
                            'creations': sorted(tree[runtime]['creations'], key=lambda row: json.dumps(row, sort_keys=True)),
                            'strong': [{'name': r['name'], 'id': r['id'], 'form': r['form'],
                                        'target': r['target']} for r in strong],
                            'reachableMethods': len(reach[runtime]),
                            'disposalChain': self.disposal_chain(runtime, disposal)})
        return {'serialized': {k: v for k, v in serialized.items() if k != 'relationships'},
                'entries': dict(sorted(entry_rows.items())), 'classes': classes,
                'helperObjects': {name: {'className': self.by_runtime.get(name, {}).get('className'),
                                         'classId': self.by_runtime.get(name, {}).get('classId'),
                                         'creations': sites} for name, sites in sorted(helpers.items())},
                'reachable': {k: sorted(v) for k, v in sorted(reach.items()) if k in tree}, 'work': self.work}


def serialized_edges(root):
    """Register each serialized object and every edge to it: inline children and references.

    The registration order is the module-file order (each object before its
    properties, IDs from one), the same as `module_file.object_references`.
    """
    nodes, edges = [], []
    work = 0

    def visit(obj, depth, source, property_id):
        nonlocal work
        if depth >= 64 or len(nodes) >= 4096:
            raise Refusal('census-serialized-tree-limit')
        node_id = len(nodes) + 1
        nodes.append({'objectId': node_id, 'classId': obj['classId']})
        if source is not None:
            edges.append({'source': source, 'propertyId': property_id, 'target': node_id, 'kind': 'inline'})
        for prop in obj['properties']:
            values = prop['value'] if isinstance(prop['value'], list) else [prop['value']]
            for value in values:
                work += 1
                if work > 100000:
                    raise Refusal('census-serialized-work-limit')
                if not isinstance(value, dict):
                    continue
                if 'classId' in value:
                    visit(value, depth + 1, node_id, prop['id'])
                elif 'reference' in value:
                    target = value['reference']
                    if type(target) is not int or not 1 <= target <= len(nodes):
                        raise Refusal('census-serialized-reference')
                    edges.append({'source': node_id, 'propertyId': prop['id'], 'target': target, 'kind': 'reference'})
    visit(root, 0, None, None)
    return {'nodes': nodes, 'references': edges}


def build_for(symbols, sha):
    found = [b for b in symbols['builds'] if b['sha256'] == sha]
    if len(found) != 1:
        raise Refusal('census-symbol-build')
    table = found[0]['symbolTable']
    roles = dict(table['types'])
    members = {m['role']: [m['declaring'], m['name'], m['descriptor']] for m in table['members']}
    roles['module-factory'] = members['module-factory']
    return roles, members


def collector_for(report, sha):
    found = [b for b in report['builds'] if b['sha256'] == sha]
    if len(found) != 1:
        raise Refusal('census-collector-build')
    build = found[0]
    forms = {name: value['form'] for name, value in build['relationshipForms'].items()}
    return forms, build['strongFilter'], build['receivers']


def detached_classes(read):
    """The runtime classes of the detached capture nodes in one doctor read."""
    nodes = read['snapshot']['detached']
    return sorted({n['runtimeClass'].replace('.', '/') for n in nodes}), read['snapshot']['ownedObjects']


def run_census(jar, roles, disposal, forms, strong, root, receivers=None, read=None,
               refused_class=None, managed_class_id=1904):
    """Derive the class set of one build. Pinned receivers and a live read are optional checks.

    A missing optional input gives a ``None`` check, not a pass. The live
    exact-class guard still refuses any class outside the derived set.
    """
    worker = Census(jar, roles, forms, strong)
    result = worker.run(root, disposal)
    names = {c['name'] for c in result['classes']}
    pinned = {r['runtime'] for r in receivers} if receivers is not None else None
    observed, owned = detached_classes(read) if read is not None else (None, None)
    checks = {
        'pinnedReceiversCovered': sorted(pinned - names) == [] if pinned is not None else None,
        'pinnedMissing': sorted(pinned - names) if pinned is not None else [],
        'added': sorted(names - pinned) if pinned is not None else sorted(names),
        'detachedReadCovered': all(n in names for n in observed) if observed is not None else None,
        'detachedReadClasses': observed,
        'detachedOwnedObjects': owned,
        'refusedClassCovered': refused_class in names if refused_class else None,
        'managedClasses': [c['name'] for c in result['classes'] if c['classId'] == managed_class_id],
        'classCount': len(names),
    }
    if checks['pinnedReceiversCovered'] is False or checks['detachedReadCovered'] is False \
            or checks['refusedClassCovered'] is False or len(checks['managedClasses']) != 1:
        verdict = 'refused'
    else:
        verdict = 'complete-over-approximation'
    return verdict, checks, result


def census_report(jar, roles, disposal, forms, strong, root, start, inputs, **options):
    verdict, checks, result = run_census(jar, roles, disposal, forms, strong, root, **options)
    return {'format': FORMAT, 'result': verdict, 'jarSha256': jar.sha256, 'jarPath': str(jar.path.resolve()),
            'roles': {k: roles[k] for k in ('object', 'descriptor', 'module', 'module-factory')},
            'disposalRole': disposal, 'relationshipForms': forms, 'strongFilter': strong,
            'inputs': inputs, 'checks': checks, **result,
            'elapsedMs': round((time.perf_counter() - start) * 1000, 3), 'peakRssBytes': rss_bytes(),
            'conditions': CONDITIONS, 'runtimeObserved': False, 'boundedAdmission': False,
            'writeAuthority': False, 'bridgeCalls': 0, 'vendorClassesInitialized': 0}


def census(args):
    start = time.perf_counter()
    raw = {name: Path(getattr(args, name)).read_bytes() for name in ('symbols', 'collector_report', 'module_report', 'read')}
    inputs = {name: json.loads(value) for name, value in raw.items()}
    jar = Jar(args.jar)
    try:
        roles, members = build_for(inputs['symbols'], jar.sha256)
        forms, strong, receivers = collector_for(inputs['collector_report'], jar.sha256)
        if inputs['module_report']['jarSha256'] != jar.sha256:
            raise Refusal('census-module-report-jar')
        if inputs['read']['snapshot'].get('detached') is None:
            raise Refusal('census-read-detached-missing')
        hashes = {name: {'path': str(getattr(args, name)), 'sha256': sha256(value)} for name, value in raw.items()}
        return census_report(jar, roles, members['disposal'], forms, strong, inputs['module_report']['objects']['root'],
                             start, hashes, receivers=receivers, read=inputs['read'],
                             refused_class=args.refused_class, managed_class_id=args.managed_class_id)
    finally:
        jar.close()


def compare(old, new):
    """Compare two census reports by class name and class ID. Runtime names differ by build."""
    def keyed(report):
        return {(c['className'], c['classId']): c for c in report['classes']}
    old_rows, new_rows = keyed(old), keyed(new)
    rows = []
    for key in sorted(set(old_rows) | set(new_rows)):
        o, n = old_rows.get(key), new_rows.get(key)
        row = {'className': key[0], 'classId': key[1], 'old': o['name'] if o else None, 'new': n['name'] if n else None}
        if o and n:
            row['serializedEqual'] = o['serialized'] == n['serialized']
            row['creationSitesEqual'] = len(o['creations']) == len(n['creations'])
            row['strongEqual'] = [(s['name'], s['id'], s['form']) for s in o['strong']] == \
                [(s['name'], s['id'], s['form']) for s in n['strong']]
            old_chain, new_chain = o['disposalChain'], n['disposalChain']
            row['disposalChainLengths'] = [len(old_chain), len(new_chain)]
            row['disposalBodiesEqual'] = [a['bodyDigest'] == b['bodyDigest'] for a, b in zip(old_chain, new_chain)] \
                if len(old_chain) == len(new_chain) else None
            row['disposalInstructions'] = [[a['instructions'] for a in old_chain], [b['instructions'] for b in new_chain]]
        rows.append(row)
    same = all(r['old'] and r['new'] for r in rows)
    return {'format': FORMAT + '-comparison', 'oldJarSha256': old['jarSha256'], 'newJarSha256': new['jarSha256'],
            'classSetsEqual': same, 'oldCount': len(old_rows), 'newCount': len(new_rows), 'rows': rows,
            'changedDisposalBodies': [r for r in rows if r.get('disposalBodiesEqual') is not None
                                      and not all(r['disposalBodiesEqual'])],
            'changedDisposalChains': [r for r in rows if r.get('disposalBodiesEqual') is None and r['old'] and r['new']],
            'boundedAdmission': False, 'writeAuthority': False}


def write_report(path, report):
    encoded = (json.dumps(report, indent=2) + '\n').encode()
    if len(encoded) > MAX_REPORT:
        raise Refusal('census-report-limit')
    with path.open('xb') as stream:
        stream.write(encoded)
    return encoded


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    one = sub.add_parser('census', help='derive the owned-tree class set of one build')
    one.add_argument('--jar', type=Path, required=True)
    one.add_argument('--symbols', type=Path, required=True, help='checkpoint-2 symbols.json')
    one.add_argument('--collector-report', type=Path, required=True, help='checkpoint-17 collection-conditions-17.json')
    one.add_argument('--module-report', type=Path, required=True, help='checkpoint-4 module report for the build')
    one.add_argument('--read', type=Path, required=True, help='a doctor read with the detached capture')
    one.add_argument('--refused-class', default=None, help='the class the runtime guard refused, if any')
    one.add_argument('--managed-class-id', type=int, default=1904)
    one.add_argument('--report', type=Path, required=True)
    two = sub.add_parser('compare', help='compare two census reports')
    two.add_argument('--old', type=Path, required=True)
    two.add_argument('--new', type=Path, required=True)
    two.add_argument('--report', type=Path, required=True)
    args = parser.parse_args(argv)
    if args.report.exists():
        raise Refusal('census-report-exists')
    if args.command == 'census':
        report = census(args)
        encoded = write_report(args.report, report)
        print(json.dumps({'result': report['result'], 'classes': report['checks']['classCount'],
                          'added': report['checks']['added'], 'pinnedMissing': report['checks']['pinnedMissing'],
                          'serializedObjects': report['serialized']['objects'], 'elapsedMs': report['elapsedMs'],
                          'peakRssBytes': report['peakRssBytes'], 'reportBytes': len(encoded)}, indent=2))
    else:
        old, new = (json.loads(path.read_bytes()) for path in (args.old, args.new))
        if old.get('format') != FORMAT or new.get('format') != FORMAT:
            raise Refusal('census-compare-format')
        report = compare(old, new)
        write_report(args.report, report)
        print(json.dumps({'classSetsEqual': report['classSetsEqual'], 'oldCount': report['oldCount'],
                          'newCount': report['newCount'],
                          'changedDisposalBodies': [r['className'] for r in report['changedDisposalBodies']],
                          'changedDisposalChains': [r['className'] for r in report['changedDisposalChains']]}, indent=2))


if __name__ == '__main__':
    main()
