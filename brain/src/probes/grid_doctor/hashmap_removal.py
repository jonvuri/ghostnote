"""Bound one HashMap.remove(Object) call on extracted JDK class bytes.

This check reads class bytes as data. It does not load, link, or initialize
a runtime class. The result is a conditional cost model, not admission.

The bound has two parts. A path analysis gives the maximum instructions and
callee calls in each loop segment of each method. A table of progress
arguments gives the maximum back edges for each loop. The module checks the
bytecode forms that each progress argument uses and refuses on a mismatch.
"""
import hashlib
from pathlib import Path

from grid_symbols.scan import Refusal, parse, instructions
from .assertion_guards import disabled_field
from .ownership import constant

MAP = 'java/util/HashMap'
NODE = 'java/util/HashMap$Node'
TREE = 'java/util/HashMap$TreeNode'
OBJECT = 'java/lang/Object'
DEFAULT_BASE = Path('/tmp/gn-9b6g-runtime-new-arm64-9/java.base')
CLASS_LIMIT = 1024 * 1024
CLASS_SHA256 = {
    MAP: 'd4a69e8224388ad9758c7a76d740b2aefa8b2f6a6f71ded7dc42be0a14d7371d',
    NODE: 'ffc2f06a400ada9d8a8bbfbbf83eae6c7301758c0f2f4648503390b9cd32b443',
    TREE: '19e6f7bced45bba1f39b74eac13c7825b3e82d75745c2afb63e8b595abfbda6a',
    OBJECT: 'a7dd9da566cd7a4a15275c67d286a7d40bfe5c75b0f0d0a60a194a4a1b006839',
}
_O = 'Ljava/lang/Object;'
_N = 'Ljava/util/HashMap$Node;'
_T = 'Ljava/util/HashMap$TreeNode;'
REMOVE = (MAP, 'remove', '(' + _O + ')' + _O)
HASH = (MAP, 'hash', '(' + _O + ')I')
REMOVE_NODE = (MAP, 'removeNode', '(I' + _O + _O + 'ZZ)' + _N)
REPLACEMENT = (MAP, 'replacementNode', '(' + _N + _N + ')' + _N)
AFTER_REMOVAL = (MAP, 'afterNodeRemoval', '(' + _N + ')V')
COMPARABLE = (MAP, 'comparableClassFor', '(' + _O + ')Ljava/lang/Class;')
NODE_INIT = (NODE, '<init>', '(I' + _O + _O + _N + ')V')
ROOT = (TREE, 'root', '()' + _T)
FIND = (TREE, 'find', '(I' + _O + 'Ljava/lang/Class;)' + _T)
GET_TREE = (TREE, 'getTreeNode', '(I' + _O + ')' + _T)
UNTREEIFY = (TREE, 'untreeify', '(Ljava/util/HashMap;)' + _N)
REMOVE_TREE = (TREE, 'removeTreeNode', '(Ljava/util/HashMap;[' + _N + 'Z)V')
BALANCE = (TREE, 'balanceDeletion', '(' + _T + _T + ')' + _T)
ROTATE_LEFT = (TREE, 'rotateLeft', '(' + _T + _T + ')' + _T)
ROTATE_RIGHT = (TREE, 'rotateRight', '(' + _T + _T + ')' + _T)
MOVE_ROOT = (TREE, 'moveRootToFront', '([' + _N + _T + ')V')
EQUALS = (OBJECT, 'equals', '(' + _O + ')Z')
OBJECT_INIT = (OBJECT, '<init>', '()V')
HASH_CODE = (OBJECT, 'hashCode', '()I')

# Method: (instructions in the complete body, backward branches as source -> target).
METHODS = {
    REMOVE: (16, {}), HASH: (13, {}), REMOVE_NODE: (142, {168: 115}),
    REPLACEMENT: (11, {}), AFTER_REMOVAL: (1, {}), COMPARABLE: (60, {110: 40}),
    NODE_INIT: (15, {}), ROOT: (12, {15: 2}), FIND: (84, {167: 3}),
    GET_TREE: (12, {}), UNTREEIFY: (29, {47: 7}), REMOVE_TREE: (288, {200: 185}),
    BALANCE: (252, {112: 0, 278: 0, 332: 0, 489: 0}),
    ROTATE_LEFT: (51, {}), ROTATE_RIGHT: (51, {}), MOVE_ROOT: (66, {}),
    EQUALS: (7, {}), OBJECT_INIT: (1, {}),
}
# Per-frame back edges. N is the bucket node count and H is the tree height
# in edges. A valid tree has H <= N - 1.
LOOP_BOUNDS = {
    REMOVE_NODE: {'N': 1}, ROOT: {'H': 1}, UNTREEIFY: {'N': 1, '1': -1},
    REMOVE_TREE: {'H': 1}, BALANCE: {'H': 1, '1': 1},
}
LOOP_PROOFS = {
    'removeNode': 'Back edge 168->115 stores e.next in local 11 (160-166). The list is finite and acyclic with N nodes; the loop starts at the second node, so it takes at most N-2 back edges. The bound uses N.',
    'root': 'Back edge 15->2 stores r.parent in local 1 (3-14). Each step moves one level up, so a frame takes at most depth(this) <= H back edges.',
    'find': 'Each loop visit loads left and right (3-15). Local 4 receives only this, local 8, or local 9. The only recursion is on a non-null right child, and the frame then continues with the left child (144-167). Visits of all frames are distinct nodes of the root subtree, so total visits <= N and frames <= N. Recursion depth <= H + 1.',
    'untreeify': 'Back edge 47->7 stores q.next in local 4 (40-45). removeTreeNode unlinks the removed node first, so the list has N-1 nodes.',
    'removeTreeNode': 'Successor walk 200->185 stores s.left in local 15 (185-198). Each step moves one level down, so it takes at most H back edges.',
    'balanceDeletion': 'Every store to xp (local 2) is x.parent. Every store to x (local 1) is xp before back edge 112, 163->278, 332, or 380->489, or root before back edge 278 or 489. An iteration without a rotation keeps the tree and moves x one level up. A red-sibling rotation sets xp.red=true (77, 299); later paths to an x=xp back edge do not clear xp.red, so the next entry returns at the x.red test. A final rotation assigns x=root, so the next entry returns. Back edges per frame <= depth(x) + 1 <= H + 1.',
}

BRANCHES = {*range(153, 167), 198, 199}
RETURNS = set(range(172, 178))
INVOKES = {182, 183, 184}
UNSUPPORTED = {168, 169, 170, 171, 200, 201}
# Forms that must not be reachable on a pruned path.
FORBIDDEN = {179, 185, 186, 191, 194, 195}
REFS = {178, 179, 180, 181, 182, 183, 184, 187, 192, 193}


def _u16(args):
    return int.from_bytes(bytes(args[:2]), 'big')


def _target(offset, args):
    return offset + int.from_bytes(bytes(args[:2]), 'big', signed=True)


def _name(key):
    return key[1] if key[0] != NODE else 'Node.' + key[1]


def load(base=DEFAULT_BASE):
    """Read and pin the four class files. Refuse on any size or hash change."""
    base = Path(base)
    classes = {}
    for name, digest in CLASS_SHA256.items():
        path = base / (name + '.class')
        if not path.is_file() or path.stat().st_size > CLASS_LIMIT:
            raise Refusal('hashmap-class-missing')
        raw = path.read_bytes()
        if len(raw) > CLASS_LIMIT or hashlib.sha256(raw).hexdigest() != digest:
            raise Refusal('hashmap-class-hash')
        cls = parse(raw, True)
        if cls.name != name:
            raise Refusal('hashmap-class-identity')
        classes[name] = cls
    return classes


class Body:
    """Hold one method body as offset-indexed rows."""

    def __init__(self, cls, method):
        self.cls, self.method = cls, method
        self.raw = instructions(method.code)
        if len(self.raw) > 4096:
            raise Refusal('hashmap-instruction-limit')
        self.rows = {r[0]: r for r in self.raw}
        self.order = [r[0] for r in self.raw]

    def ref(self, offset):
        _, op, args = self.rows[offset]
        if op == 18:
            return constant(self.cls, args[0])
        return constant(self.cls, _u16(args))

    def detail(self, offset):
        _, op, args = self.rows[offset]
        if op in BRANCHES or op == 167:
            return _target(offset, args)
        if op in (21, 25, 54, 58):
            return args[0]
        if op in REFS or op == 18:
            value = self.ref(offset)
            return (value['owner'], value['name']) if 'owner' in value else value['value']
        return None

    def expect(self, spec, code):
        for item in spec:
            offset, op = item[0], item[1]
            row = self.rows.get(offset)
            if row is None or row[1] != op:
                raise Refusal(code)
            if len(item) > 2 and self.detail(offset) != item[2]:
                raise Refusal(code)

    def stores(self, local):
        short = {0: 75, 1: 76, 2: 77, 3: 78}.get(local)
        return {o for o, op, a in self.raw if op == short or (op == 58 and a[0] == local)}

    def invoke(self, offset):
        value = self.ref(offset)
        if value.get('tag') not in (10, 11):
            raise Refusal('hashmap-invoke-reference')
        return value['owner'], value['name'], value['descriptor']


def bodies(classes):
    found = {}
    for key, (count, _) in METHODS.items():
        cls = classes[key[0]]
        matches = [m for m in cls.methods if (m.name, m.desc) == key[1:]]
        if len(matches) != 1 or not matches[0].code:
            raise Refusal('hashmap-method-missing:' + _name(key))
        body = Body(cls, matches[0])
        if len(body.raw) != count:
            raise Refusal('hashmap-instruction-count:' + _name(key))
        if body.method.handlers:
            raise Refusal('hashmap-exception-handler:' + _name(key))
        found[key] = body
    native = [m for m in classes[OBJECT].methods if (m.name, m.desc) == HASH_CODE[1:]]
    if len(native) != 1 or native[0].flags != 0x101 or native[0].code:
        raise Refusal('hashmap-native-hash')
    return found


def edges(body):
    """Return (source, target, kind) for every control edge."""
    result = []
    for i, (offset, op, args) in enumerate(body.raw):
        if op in UNSUPPORTED:
            raise Refusal('hashmap-unsupported-opcode')
        following = body.order[i + 1] if i + 1 < len(body.order) else None
        if op in RETURNS or op == 191:
            continue
        if op == 167:
            result.append((offset, _target(offset, args), 'taken'))
            continue
        if following is None:
            raise Refusal('hashmap-falls-off-code')
        result.append((offset, following, 'fall'))
        if op in BRANCHES:
            result.append((offset, _target(offset, args), 'taken'))
    for _, target, _ in result:
        if target not in body.rows:
            raise Refusal('hashmap-branch-target')
    return result


# Pruned conditional edges. Each entry keeps one direction of one branch.
def _comparable_prune(body):
    body.expect([(0, 42), (1, 193, 'java/lang/Comparable'), (4, 153, 113), (113, 1), (114, 176)],
                'hashmap-comparable-path')
    return {4: 'taken'}


def _find_prune(body):
    body.expect([(101, 45), (102, 199, 114), (105, 44), (106, 184, COMPARABLE[:2]),
                 (109, 89), (110, 78), (111, 198, 144)], 'hashmap-find-comparable')
    if body.stores(3) != {110}:
        raise Refusal('hashmap-find-class-local')
    return {102: 'fall', 111: 'taken'}


def _move_root_prune(body):
    body.expect([(102, 178, (TREE, '$assertionsDisabled')), (105, 154, 123), (123, 177)],
                'hashmap-move-root-assertion')
    if body.ref(102)['descriptor'] != 'Z':
        raise Refusal('hashmap-move-root-assertion')
    return {105: 'taken'}


def _remove_node_prune(body, tree):
    body.expect([(92, 25, 7), (94, 193, TREE), (97, 153, 115),
                 (206, 25, 10), (208, 193, TREE), (211, 153, 230)], 'hashmap-node-mode')
    kept = 'fall' if tree else 'taken'
    return {97: kept, 211: kept}


def analyse(body, prune):
    """Return reachable offsets and segment maxima for one method."""
    all_edges = edges(body)
    backward = {(s, t) for s, t, _ in all_edges if t <= s}
    kept = [(s, t) for s, t, kind in all_edges if prune.get(s, kind) == kind]
    successors = {}
    for s, t in kept:
        successors.setdefault(s, []).append(t)
    reachable, work = {0}, [0]
    while work:
        for t in successors.get(work.pop(), ()):
            if t not in reachable:
                reachable.add(t); work.append(t)
    active = {(s, t) for s, t in kept if (s, t) in backward and s in reachable}
    headers = {t for _, t in active}
    if len(headers) > 1:
        raise Refusal('hashmap-loop-headers')
    dag = [(s, t) for s, t in kept if (s, t) not in backward and s in reachable]
    if any(t <= s for s, t in dag):
        raise Refusal('hashmap-cycle')
    weights = {o: weight(body, o) for o in reachable}
    exits = {o for o in reachable if body.rows[o][1] in RETURNS}
    if any(body.rows[o][1] in FORBIDDEN for o in reachable):
        raise Refusal('hashmap-reachable-form')

    successors_dag = {}
    for s, t in dag:
        successors_dag.setdefault(s, []).append(t)

    def longest(start, targets, skip=None):
        # DAG edges go forward, so increasing offsets are a topological order.
        incoming, best = {start: {}}, {}
        for node in sorted(reachable):
            if node not in incoming or node == skip:
                continue
            best[node] = _add(incoming[node], weights[node])
            for t in successors_dag.get(node, ()):
                if t != skip:
                    incoming[t] = _max([incoming.get(t, {}), best[node]])
        return _max([best[t] for t in targets if t in best])

    if not headers:
        whole = longest(0, exits)
        return {'reachable': reachable, 'backEdges': set(), 'header': None,
                'frame': whole, 'iteration': {}, 'weights': weights}
    header = headers.pop()
    sources = {s for s, _ in active}
    if header == 0:
        skip, before = {}, {}
    else:
        skip = longest(0, exits, header) if exits - {header} else {}
        before = _sub(longest(0, {header}), weights[header])
    iteration = longest(header, sources)
    after = longest(header, exits)
    frame = _max([skip, _add(before, after)])
    return {'reachable': reachable, 'backEdges': active, 'header': header,
            'frame': frame, 'iteration': iteration, 'weights': weights}


def weight(body, offset):
    _, op, _ = body.rows[offset]
    value = {'instructions': 1}
    if op in INVOKES:
        value['call', body.invoke(offset)] = 1
    elif op == 187:
        value['new', body.ref(offset)['value']] = 1
    elif op in (188, 189, 197):
        value['new', 'array'] = 1
    return value


def _max(items):
    out = {}
    for item in items:
        for key, value in item.items():
            out[key] = max(out.get(key, 0), value)
    return out


def _add(a, b):
    return {k: a.get(k, 0) + b.get(k, 0) for k in set(a) | set(b)}


def _sub(a, b):
    return {k: a.get(k, 0) - b.get(k, 0) for k in set(a) | set(b)}


def _lin(**terms):
    return {k: v for k, v in terms.items() if v}


def _ladd(a, b, scale=1):
    out = dict(a)
    for k, v in b.items():
        out[k] = out.get(k, 0) + scale * v
    return {k: v for k, v in out.items() if v}


def _lscale(a, factor):
    if not isinstance(factor, dict):
        return {k: v * factor for k, v in a.items() if v * factor}
    if set(factor) - {'1'} and set(a) - {'1'}:
        raise Refusal('hashmap-nonlinear')
    if set(factor) - {'1'}:
        return _lscale(factor, a.get('1', 0))
    return _lscale(a, factor.get('1', 0))


def text(expr):
    parts = [str(expr.get('1', 0))] if expr.get('1', 0) or not expr else []
    for name in ('N', 'H'):
        if expr.get(name):
            parts.append(f'{expr[name]}*{name}')
    return ' + '.join(parts).replace('+ -', '- ')


def evaluate(expr, n, h=None):
    h = n - 1 if h is None else h
    return expr.get('1', 0) + expr.get('N', 0) * n + expr.get('H', 0) * h


def structure(found, classes):
    """Check the bytecode facts that the progress arguments use."""
    for key, (_, expected) in METHODS.items():
        actual = {s: t for s, t, _ in edges(found[key]) if t <= s}
        if actual != expected:
            raise Refusal('hashmap-back-edges:' + _name(key))
    if not classes[TREE].flags & 0x10 or classes[MAP].flags & 0x10:
        raise Refusal('hashmap-class-flags')
    if found[REMOVE_NODE].method.flags & 0x10 == 0 or found[HASH].method.flags != 0x18:
        raise Refusal('hashmap-method-flags')
    found[REMOVE].expect([(0, 42), (1, 43), (2, 184, HASH[:2]), (5, 43), (6, 1), (7, 3), (8, 4),
                          (9, 182, REMOVE_NODE[:2])], 'hashmap-remove-arguments')
    rn = found[REMOVE_NODE]
    rn.expect([(81, 25, 7), (83, 180, (NODE, 'next')), (86, 89), (87, 58, 11), (89, 198, 171),
               (115, 25, 11), (160, 25, 11), (162, 180, (NODE, 'next')), (165, 89), (166, 58, 11),
               (168, 199, 115)], 'hashmap-linked-progress')
    if rn.stores(11) != {87, 166}:
        raise Refusal('hashmap-linked-progress')
    found[ROOT].expect([(0, 42), (1, 76), (2, 43), (3, 180, (TREE, 'parent')), (6, 89), (7, 77),
                        (8, 199, 13), (11, 43), (12, 176), (13, 44), (14, 76), (15, 167, 2)],
                       'hashmap-root-progress')
    fd = found[FIND]
    fd.expect([(0, 42), (1, 58, 4), (3, 25, 4), (5, 180, (TREE, 'left')), (8, 58, 8), (10, 25, 4),
               (12, 180, (TREE, 'right')), (15, 58, 9), (77, 25, 8), (79, 199, 89), (82, 25, 9),
               (84, 58, 4), (89, 25, 9), (91, 199, 101), (94, 25, 8), (96, 58, 4),
               (144, 25, 9), (146, 27), (147, 44), (148, 45), (149, 182, FIND[:2]), (152, 89),
               (153, 58, 10), (155, 198, 161), (158, 25, 10), (160, 176), (161, 25, 8),
               (163, 58, 4), (165, 25, 4), (167, 199, 3)], 'hashmap-find-progress')
    if fd.stores(8) != {8} or fd.stores(9) != {15}:
        raise Refusal('hashmap-find-progress')
    for offset in fd.stores(4) - {1}:
        previous = fd.order[fd.order.index(offset) - 1]
        if fd.rows[previous][1] != 25 or fd.rows[previous][2][0] not in (8, 9):
            raise Refusal('hashmap-find-progress')
    found[GET_TREE].expect([(14, 42), (15, 27), (16, 44), (17, 1), (18, 182, FIND[:2])],
                           'hashmap-find-class-argument')
    ut = found[UNTREEIFY]
    ut.expect([(4, 42), (5, 58, 4), (7, 25, 4), (9, 198, 50), (16, 182, REPLACEMENT[:2]),
               (40, 25, 4), (42, 180, (NODE, 'next')), (45, 58, 4), (47, 167, 7)],
              'hashmap-untreeify-progress')
    if ut.stores(4) != {5, 45}:
        raise Refusal('hashmap-untreeify-progress')
    rt = found[REMOVE_TREE]
    rt.expect([(181, 25, 13), (183, 58, 15), (185, 25, 15), (187, 180, (TREE, 'left')), (190, 89),
               (191, 58, 16), (193, 198, 203), (196, 25, 16), (198, 58, 15), (200, 167, 185),
               (151, 182, UNTREEIFY[:2]), (561, 184, BALANCE[:2]), (633, 184, MOVE_ROOT[:2])],
              'hashmap-successor-progress')
    if {o for o in rt.stores(15) if 185 <= o <= 200} != {198}:
        raise Refusal('hashmap-successor-progress')
    _balance(found[BALANCE])
    _allocation_and_statics(found)
    return _assertion_initializer(classes[TREE])


def _balance(bd):
    bd.expect([(0, 43), (1, 198, 9), (4, 43), (5, 42), (6, 166, 11), (9, 42), (10, 176),
               (11, 43), (12, 180, (TREE, 'parent')), (15, 89), (16, 77), (17, 199, 27),
               (25, 43), (26, 176), (27, 43), (28, 180, (TREE, 'red')), (31, 153, 41),
               (39, 42), (40, 176),
               (61, 25, 4), (63, 180, (TREE, 'red')), (66, 153, 105), (75, 44), (76, 4),
               (77, 181, (TREE, 'red')), (82, 184, ROTATE_LEFT[:2]), (85, 75),
               (285, 45), (286, 180, (TREE, 'red')), (289, 153, 326), (297, 44), (298, 4),
               (299, 181, (TREE, 'red')), (304, 184, ROTATE_RIGHT[:2]), (307, 75),
               (110, 44), (111, 76), (112, 167, 0), (161, 44), (162, 76), (163, 167, 278),
               (276, 42), (277, 76), (278, 167, 0), (330, 44), (331, 76), (332, 167, 0),
               (378, 44), (379, 76), (380, 167, 489), (487, 42), (488, 76), (489, 167, 0)],
              'hashmap-balance-progress')
    if bd.stores(1) != {111, 162, 277, 331, 379, 488}:
        raise Refusal('hashmap-balance-progress')
    xp = bd.stores(2)
    if xp != {16, 91, 208, 313, 423}:
        raise Refusal('hashmap-balance-parent')
    for offset in xp:
        i = bd.order.index(offset)
        ops = [bd.rows[o][1] for o in bd.order[i - 3:i]]
        if ops != [43, 180, 89] or bd.detail(bd.order[i - 2]) != (TREE, 'parent'):
            raise Refusal('hashmap-balance-parent')
    for offset in bd.stores(0):
        previous = bd.order[bd.order.index(offset) - 1]
        if bd.rows[previous][1] != 184 or bd.invoke(previous) not in (ROTATE_LEFT, ROTATE_RIGHT):
            raise Refusal('hashmap-balance-root')
    clears = set()
    for i, offset in enumerate(bd.order):
        if bd.rows[offset][1] == 181 and bd.detail(offset) == (TREE, 'red'):
            if [bd.rows[o][1] for o in bd.order[i - 2:i]] == [44, 3]:
                clears.add(offset)
    # xp.red=false occurs only before a final rotation and x=root.
    if clears != {267, 478}:
        raise Refusal('hashmap-balance-recolor')
    bd.expect([(272, 184, ROTATE_LEFT[:2]), (483, 184, ROTATE_RIGHT[:2])], 'hashmap-balance-recolor')


def _allocation_and_statics(found):
    news, statics = [], []
    for key, body in found.items():
        for offset, op, _ in body.raw:
            if op in (187, 188, 189, 197):
                news.append((key[1], offset, body.ref(offset)['value'] if op == 187 else 'array'))
            elif op in (178, 179):
                value = body.ref(offset)
                statics.append((key[1], offset, op, value['owner'], value['name'], value['descriptor']))
    if sorted(news) != [('moveRootToFront', 115, 'java/lang/AssertionError'),
                        ('replacementNode', 0, NODE)]:
        raise Refusal('hashmap-allocation-sites')
    if statics != [('moveRootToFront', 102, 178, TREE, '$assertionsDisabled', 'Z')]:
        raise Refusal('hashmap-static-access')
    found[REPLACEMENT].expect([(0, 187, NODE), (17, 183, NODE_INIT[:2]), (20, 176)],
                              'hashmap-replacement-node')
    found[AFTER_REMOVAL].expect([(0, 177)], 'hashmap-after-removal')
    found[NODE_INIT].expect([(1, 183, OBJECT_INIT[:2])], 'hashmap-node-init')
    found[OBJECT_INIT].expect([(0, 177)], 'hashmap-object-init')


def _assertion_initializer(tree):
    """Check the TreeNode flag initializer, which asks HashMap.class.

    The generic recognizer requires the class's own literal. This contract
    accepts only this exact nested-class form and keeps the generic rule.
    """
    methods = [m for m in tree.methods if (m.name, m.desc) == ('<clinit>', '()V')]
    if len(methods) != 1 or methods[0].handlers:
        raise Refusal('hashmap-assertion-initializer')
    body = Body(tree, methods[0])
    if len(body.raw) != 8 or not tree.name.startswith(MAP + '$'):
        raise Refusal('hashmap-assertion-initializer')
    body.expect([(0, 18, MAP), (2, 182, ('java/lang/Class', 'desiredAssertionStatus')),
                 (5, 154, 12), (8, 4), (9, 167, 13), (12, 3),
                 (13, 179, (TREE, '$assertionsDisabled')), (16, 177)], 'hashmap-assertion-initializer')
    if body.ref(0).get('tag') != 7 or body.ref(2)['descriptor'] != '()Z' or body.ref(13)['descriptor'] != 'Z':
        raise Refusal('hashmap-assertion-initializer')
    fields = [f for f in tree.fields if (f.name, f.desc) == ('$assertionsDisabled', 'Z')]
    if len(fields) != 1 or fields[0].flags != 0x1018:
        raise Refusal('hashmap-assertion-field')
    for method in tree.methods:
        if method is methods[0] or not method.code:
            continue
        other = Body(tree, method)
        for offset, op, _ in other.raw:
            if op == 179 and other.detail(offset) == (TREE, '$assertionsDisabled'):
                raise Refusal('hashmap-assertion-reassigned')
    return {'field': [TREE, '$assertionsDisabled', 'Z'], 'initializerClassLiteral': MAP,
            'genericRecognizer': disabled_field(tree),
            'requiredValue': True,
            'condition': 'TreeNode must be initialized and HashMap.class.desiredAssertionStatus() must have been false. Do not change assertion mode.'}


EXPECTED = {
    'linked': ({REMOVE, HASH, REMOVE_NODE, EQUALS, AFTER_REMOVAL}, {REMOVE_NODE}),
    'tree': ({REMOVE, HASH, REMOVE_NODE, EQUALS, AFTER_REMOVAL, GET_TREE, ROOT, FIND, COMPARABLE,
              REMOVE_TREE, UNTREEIFY, REPLACEMENT, NODE_INIT, OBJECT_INIT, BALANCE, ROTATE_LEFT,
              ROTATE_RIGHT, MOVE_ROOT}, {ROOT, FIND, UNTREEIFY, REMOVE_TREE, BALANCE}),
}


def mode(found, name):
    tree = name == 'tree'
    prunes = {COMPARABLE: _comparable_prune(found[COMPARABLE]), FIND: _find_prune(found[FIND]),
              MOVE_ROOT: _move_root_prune(found[MOVE_ROOT]),
              REMOVE_NODE: _remove_node_prune(found[REMOVE_NODE], tree)}
    result, work = {}, [REMOVE]
    while work:
        key = work.pop()
        if key in result:
            continue
        if key not in found:
            raise Refusal('hashmap-unmodeled-callee:' + '#'.join(key))
        result[key] = analyse(found[key], prunes.get(key, {}))
        for offset in result[key]['reachable']:
            if found[key].rows[offset][1] in INVOKES:
                callee = found[key].invoke(offset)
                if callee != HASH_CODE:
                    work.append(callee)
    loops = {k for k, v in result.items() if v['header'] is not None}
    if (set(result), loops) != EXPECTED[name]:
        raise Refusal('hashmap-mode-shape:' + name)
    reachable_new = {(k[1], o) for k, v in result.items() for o in v['reachable']
                     if found[k].rows[o][1] in (187, 188, 189, 197)}
    if reachable_new != ({('replacementNode', 0)} if tree else set()):
        raise Refusal('hashmap-reachable-allocation')
    return compose(result, tree)


def _callees(segment):
    return {k[1]: v for k, v in segment.items() if isinstance(k, tuple) and k[0] == 'call'}


def compose(result, tree):
    """Combine per-method maxima with the per-loop back-edge bounds."""
    graph = {k: {c for c in _callees(_max([v['frame'], v['iteration']])) if c != HASH_CODE}
             for k, v in result.items()}
    if tree:
        if FIND not in graph[FIND]:
            raise Refusal('hashmap-find-recursion')
        graph[FIND].discard(FIND)
    order, state = [], {}

    def visit(key):
        if state.get(key) == 1:
            raise Refusal('hashmap-call-cycle')
        if state.get(key) == 2:
            return
        state[key] = 1
        for callee in sorted(graph[key]):
            visit(callee)
        state[key] = 2
        order.append(key)
    visit(REMOVE)
    order.reverse()
    frames = {key: {} for key in result}
    frames[REMOVE] = {'1': 1}
    totals = {'instructions': {}, 'jdkFrames': {}, 'nativeIdentityHash': {}, 'allocations': {}}
    methods = {}
    for key in order:
        seg = result[key]
        if key == FIND:
            if frames[FIND] != {'1': 1}:
                raise Refusal('hashmap-find-callers')
            # Total visits <= N; each visit costs at most one frame or one iteration.
            per_visit = _max([seg['frame'], seg['iteration']])
            frame_count, own = {'N': 1}, {}
            contributions = {k: _lin(N=v) for k, v in per_visit.items()}
            back = {'N': 1}
        else:
            frame_count = frames[key]
            if seg['header'] is not None and key not in LOOP_BOUNDS:
                raise Refusal('hashmap-loop-without-bound:' + _name(key))
            back = _lscale(LOOP_BOUNDS[key], frame_count) if seg['header'] is not None else {}
            contributions = {}
            for item in set(seg['frame']) | set(seg['iteration']):
                contributions[item] = _ladd(_lscale({'1': seg['frame'].get(item, 0)}, frame_count),
                                            _lscale({'1': seg['iteration'].get(item, 0)}, back))
        for item, expr in contributions.items():
            if item == 'instructions':
                totals['instructions'] = _ladd(totals['instructions'], expr)
            elif item == ('call', HASH_CODE):
                totals['nativeIdentityHash'] = _ladd(totals['nativeIdentityHash'], expr)
            elif isinstance(item, tuple) and item[0] == 'call':
                if not (key == FIND and item[1] == FIND):
                    frames[item[1]] = _ladd(frames[item[1]], expr)
            elif isinstance(item, tuple) and item[0] == 'new':
                if item[1] != NODE:
                    raise Refusal('hashmap-allocation-type')
                totals['allocations'] = _ladd(totals['allocations'], expr)
        totals['jdkFrames'] = _ladd(totals['jdkFrames'], frame_count)
        methods['#'.join(key)] = {
            'frames': text(frame_count), 'backEdgesTotal': text(back) if back else '0',
            'framesExpression': frame_count, 'backEdgesExpression': back,
            'frameMaximum': {'ownInstructions': seg['frame'].get('instructions', 0),
                             'calls': {c[1] if c[0] != NODE else 'Node.<init>': n for c, n in _callees(seg['frame']).items()}},
            'iterationMaximum': {'ownInstructions': seg['iteration'].get('instructions', 0),
                                 'calls': {c[1] if c[0] != NODE else 'Node.<init>': n for c, n in _callees(seg['iteration']).items()}}
            if seg['header'] is not None else None,
            'loopHeader': seg['header'],
            'activeBackEdges': sorted(s for s, _ in seg['backEdges']),
            'reachableInstructions': len(seg['reachable']),
        }
    forms = {}
    for item, expr in totals.items():
        forms[item] = {'expression': expr, 'withHeight': text(expr) if expr else '0'}
        if 'H' in expr:
            n_form = _ladd({k: v for k, v in expr.items() if k != 'H'}, {'N': expr['H'], '1': -expr['H']})
            forms[item]['nOnly'] = text(n_form)
            forms[item]['nOnlyExpression'] = n_form
        else:
            forms[item]['nOnly'] = forms[item]['withHeight']
            forms[item]['nOnlyExpression'] = expr
    return {'bounds': forms, 'methods': methods}


def bound(classes):
    """Check structure and return the conditional per-call bound."""
    found = bodies(classes)
    assertion = structure(found, classes)
    linked, tree = mode(found, 'linked'), mode(found, 'tree')
    per_iteration = {
        'removeNode linked step (115->168)': linked['methods']['#'.join(REMOVE_NODE)]['iterationMaximum']['ownInstructions'],
        'root parent step (2->15)': tree['methods']['#'.join(ROOT)]['iterationMaximum']['ownInstructions'],
        'find visit (3->167, or frame entry and exit)': max(
            tree['methods']['#'.join(FIND)]['iterationMaximum']['ownInstructions'],
            tree['methods']['#'.join(FIND)]['frameMaximum']['ownInstructions']),
        'untreeify step (7->47)': tree['methods']['#'.join(UNTREEIFY)]['iterationMaximum']['ownInstructions'],
        'removeTreeNode successor step (185->200)': tree['methods']['#'.join(REMOVE_TREE)]['iterationMaximum']['ownInstructions'],
        'balanceDeletion iteration (0->112/278/332/489)': tree['methods']['#'.join(BALANCE)]['iterationMaximum']['ownInstructions'],
    }
    return {
        'classSha256': dict(CLASS_SHA256),
        'linkedBucket': linked, 'treeBucket': tree,
        'perIterationOwnInstructions': per_iteration,
        'loopProofs': LOOP_PROOFS,
        'loopBounds': {_name(k): text(v) for k, v in LOOP_BOUNDS.items()} | {'find': 'total visits N, frames N'},
        'assertion': assertion,
        'assertionExclusion': {'method': '#'.join(MOVE_ROOT), 'guard': 102, 'branch': 105, 'excluded': [108, 122],
                               'reason': 'checkInvariants and AssertionError run only when $assertionsDisabled is false.'},
        'prunedPaths': [
            'comparableClassFor keeps branch 4->113: the key does not implement Comparable.',
            'find keeps 102 fallthrough and 111->144: the class local stays null.',
            'moveRootToFront keeps 105->123: assertions are disabled.',
            'removeNode 97 and 211 follow the bucket node type of the mode.'],
        'domain': {'linkedBucket': 'N >= 0 Node entries in the bucket list',
                   'treeBucket': 'N >= 1 TreeNode entries; H is the tree height in edges, 0 <= H <= N-1'},
        'boundedAdmission': False, 'runtimeClassesInitialized': 0, 'runtimeObserved': False,
        'conditions': [
            'The receiver class is exactly java.util.HashMap; replacementNode and afterNodeRemoval are overridable.',
            'The table, bucket list, and tree links are stable and valid: finite acyclic next lists, consistent parent, left, right, and prev links, and one node type per bucket.',
            'Keys are non-null, do not implement Comparable, and use Object.hashCode and Object.equals (identity).',
            'TreeNode is initialized and TreeNode.$assertionsDisabled is true.',
            'No other thread modifies the map during the call.',
            'Capacity does not add work to one removal; only one bucket is read.',
            'Native identity hash latency is separate from the instruction bound.',
            'The class bytes match the pinned SHA-256 values; the live runtime identity is a separate check.',
            'The bound counts bytecode instructions and JDK frames, not time.',
        ],
    }


def contract(base=DEFAULT_BASE):
    return bound(load(base))
