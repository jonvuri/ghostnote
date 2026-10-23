"""Check the HashMap removal bound contract and its path analysis."""
import copy
import shutil
import tempfile
import unittest
from pathlib import Path

from grid_symbols.scan import Class, Member, Refusal, instructions
from . import hashmap_removal as hm
from .assertion_guards import disabled_field
from .read_dataflow import signature
from .test_constructor_variants import pool

PRESENT = all((hm.DEFAULT_BASE / (name + '.class')).is_file() for name in hm.CLASS_SHA256)
ABSENT = 'extracted runtime classes are absent: ' + str(hm.DEFAULT_BASE)


def loop_model():
    """Build a list walk: x = this; while (x != null) x = x.next(); return."""
    cp, _, ref = pool()
    nxt = ref(10, 'Item', 'next', '()LItem;')
    body = bytes([42, 76, 43, 198, 0, 11, 43, 182, 0, nxt, 76, 167, 255, 247, 177])
    method = Member('method', 'walk', '()V', 1, body)
    return Class('Item', 'java/lang/Object', (), 1, [], [method], cp), method


def walk(cls, method, length):
    """Run the list walk with integer identities; None ends the list."""
    raw = instructions(method.code)
    index = {r[0]: i for i, r in enumerate(raw)}
    local, stack, pc, count, calls = {0: 0 if length else None}, [], 0, 0, 0
    while count < 10000:
        i = index[pc]; offset, op, args = raw[i]
        pc = raw[i + 1][0] if i + 1 < len(raw) else None
        count += 1
        if op in (42, 43):
            stack.append(local[op - 42])
        elif op == 76:
            local[1] = stack.pop()
        elif op == 182:
            calls += 1; value = stack.pop()
            stack.append(value + 1 if value + 1 < length else None)
        elif op == 198:
            if stack.pop() is None:
                pc = hm._target(offset, args)
        elif op == 167:
            pc = hm._target(offset, args)
        elif op == 177:
            return count, calls
        else:
            raise AssertionError('unknown inert opcode')
    raise AssertionError('inert step limit')


class PathAnalysisTests(unittest.TestCase):
    def test_loop_segments_match_inert_execution(self):
        cls, method = loop_model()
        result = hm.analyse(hm.Body(cls, method), {})
        self.assertEqual(result['header'], 2)
        self.assertEqual(result['backEdges'], {(11, 2)})
        frame, step = result['frame']['instructions'], result['iteration']['instructions']
        self.assertEqual((frame, step), (5, 6))
        key = ('call', ('Item', 'next', '()LItem;'))
        self.assertEqual((result['frame'].get(key, 0), result['iteration'][key]), (0, 1))
        for length in (0, 1, 2, 7, 64):
            count, calls = walk(cls, method, length)
            self.assertEqual(count, frame + length * step)
            self.assertEqual(calls, length)

    def test_pruned_branch_removes_the_loop(self):
        cls, method = loop_model()
        result = hm.analyse(hm.Body(cls, method), {3: 'taken'})
        self.assertIsNone(result['header'])
        self.assertEqual(result['frame']['instructions'], 5)

    def test_nonlinear_products_are_refused(self):
        with self.assertRaises(Refusal):
            hm._lscale({'H': 1}, {'N': 1})
        self.assertEqual(hm._lscale({'H': 1, '1': 1}, {'1': 2}), {'H': 2, '1': 2})


def mutate(classes, owner, method, offset, data):
    changed = copy.deepcopy(classes)
    target = next(m for m in changed[owner].methods if (m.name, m.desc) == method[1:])
    code = bytearray(target.code)
    code[offset:offset + len(data)] = data
    target.code = bytes(code)
    return changed


@unittest.skipUnless(PRESENT, ABSENT)
class ExtractedContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.classes = hm.load()
        cls.result = hm.bound(cls.classes)

    def test_contract_returns_conditional_formulas(self):
        r = self.result
        linked, tree = r['linkedBucket']['bounds'], r['treeBucket']['bounds']
        self.assertEqual(linked['instructions']['expression'], {'1': 160, 'N': 29})
        self.assertEqual(tree['instructions']['expression'], {'1': 719, 'N': 110, 'H': 308})
        self.assertEqual(tree['instructions']['nOnlyExpression'], {'1': 411, 'N': 418})
        self.assertEqual(linked['jdkFrames']['expression'], {'1': 7, 'N': 1})
        self.assertEqual(tree['jdkFrames']['expression'], {'1': 14, 'N': 6, 'H': 4})
        for bounds in (linked, tree):
            self.assertEqual(bounds['nativeIdentityHash']['expression'], {'1': 1})
        self.assertEqual(linked['allocations']['expression'], {})
        self.assertEqual(tree['allocations']['expression'], {'1': -1, 'N': 1})
        self.assertEqual(r['perIterationOwnInstructions']['balanceDeletion iteration (0->112/278/332/489)'], 116)
        self.assertFalse(r['boundedAdmission'])
        self.assertEqual(r['runtimeClassesInitialized'], 0)
        self.assertTrue(r['conditions'])

    def test_tree_node_assertion_form_is_specific(self):
        assertion = self.result['assertion']
        self.assertEqual(assertion['initializerClassLiteral'], hm.MAP)
        self.assertIsNone(assertion['genericRecognizer'])
        changed = copy.deepcopy(self.classes)
        init = next(m for m in changed[hm.TREE].methods if m.name == '<clinit>')
        index = next(i for i, e in enumerate(changed[hm.TREE].cp)
                     if e and e[0] == 7 and changed[hm.TREE].cp[e[1]][1] == hm.TREE)
        self.assertLess(index, 256)
        init.code = init.code[:1] + bytes([index]) + init.code[2:]
        with self.assertRaisesRegex(Refusal, 'hashmap-assertion-initializer'):
            hm.bound(changed)
        # The generic rule accepts the own-class form; the specific contract does not.
        self.assertIsNotNone(disabled_field(changed[hm.TREE]))

    def test_flipped_branch_target_is_refused(self):
        # removeNode 168: ifnonnull -53 -> 115. Point it at 120 instead.
        changed = mutate(self.classes, hm.MAP, hm.REMOVE_NODE, 169, (-48).to_bytes(2, 'big', signed=True))
        with self.assertRaisesRegex(Refusal, 'hashmap-back-edges'):
            hm.bound(changed)
        # balanceDeletion 163: goto 278. Send the recolor arm to 0 directly.
        changed = mutate(self.classes, hm.TREE, hm.BALANCE, 164, (-163).to_bytes(2, 'big', signed=True))
        with self.assertRaisesRegex(Refusal, 'hashmap-back-edges'):
            hm.bound(changed)

    def test_extra_allocation_is_refused(self):
        # removeTreeNode 28: checkcast TreeNode becomes new TreeNode.
        changed = mutate(self.classes, hm.TREE, hm.REMOVE_TREE, 28, bytes([187]))
        with self.assertRaisesRegex(Refusal, 'hashmap-allocation-sites'):
            hm.bound(changed)

    def test_after_removal_and_assertion_guard_are_required(self):
        changed = mutate(self.classes, hm.MAP, hm.AFTER_REMOVAL, 0, bytes([176]))
        with self.assertRaises(Refusal):
            hm.bound(changed)
        # moveRootToFront 105: ifne becomes ifeq, so the assertion block is live.
        changed = mutate(self.classes, hm.TREE, hm.MOVE_ROOT, 105, bytes([153]))
        with self.assertRaisesRegex(Refusal, 'hashmap-move-root-assertion'):
            hm.bound(changed)

    def test_changed_class_bytes_are_refused(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            for name in hm.CLASS_SHA256:
                target = root / (name + '.class')
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(hm.DEFAULT_BASE / (name + '.class'), target)
            self.assertEqual(hm.contract(root)['classSha256'], hm.CLASS_SHA256)
            path = root / (hm.NODE + '.class')
            raw = bytearray(path.read_bytes()); raw[-1] ^= 1; path.write_bytes(bytes(raw))
            with self.assertRaisesRegex(Refusal, 'hashmap-class-hash'):
                hm.contract(root)

    def test_bound_holds_on_small_inert_maps(self):
        runner = Interpreter(self.classes)
        bounds = {'linked': self.result['linkedBucket']['bounds'], 'tree': self.result['treeBucket']['bounds']}
        for tree in (False, True):
            for n in ((1, 3, 7) if tree else (0, 1, 2, 5)):
                for same_hash in (False, True):
                    for pos in range(-1, n):
                        table, keys, nodes, height = small_map(n, tree, same_hash)
                        query = keys[pos] if pos >= 0 else Obj('Key', hash=512)
                        value, counts = runner.remove(table, query)
                        self.assertIs(value, nodes[pos].fields['value'] if pos >= 0 else None)
                        self.assertEqual(table.fields['size'], n - (pos >= 0))
                        b = bounds['tree' if tree else 'linked']
                        for metric, actual in (('instructions', counts['instructions']),
                                               ('jdkFrames', counts['frames']),
                                               ('nativeIdentityHash', counts['native']),
                                               ('allocations', counts['allocations'])):
                            self.assertLessEqual(actual, hm.evaluate(b[metric]['expression'], n, height))
                        self.assertEqual(counts['native'], 1)


class Obj:
    def __init__(self, typ, **fields):
        self.typ, self.fields = typ, fields


def small_map(n, tree, same_hash):
    """Build one bucket: a key-ordered list and, for a tree, a perfect black tree."""
    keys, nodes = [], []
    for i in range(n):
        h = 512 if same_hash else (i + 1) * 512
        keys.append(Obj('Key', hash=h))
        nodes.append(Obj(hm.TREE if tree else hm.NODE, hash=h, key=keys[-1], value=object(),
                         next=None, prev=None, parent=None, left=None, right=None, red=False))
    for i, node in enumerate(nodes):
        node.fields['next'] = nodes[i + 1] if i + 1 < n else None
        node.fields['prev'] = nodes[i - 1] if i else None

    def subtree(lo, hi, parent, depth):
        if lo >= hi:
            return depth - 1
        mid = (lo + hi) // 2; node = nodes[mid]; node.fields['parent'] = parent
        a = subtree(lo, mid, node, depth + 1); node.fields['left'] = nodes[(lo + mid) // 2] if lo < mid else None
        b = subtree(mid + 1, hi, node, depth + 1); node.fields['right'] = nodes[(mid + 1 + hi) // 2] if mid + 1 < hi else None
        return max(a, b)
    height = max(0, subtree(0, n, None, 0)) if tree else 0
    table = [None] * 512
    table[0] = nodes[0] if nodes else None
    return Obj(hm.MAP, table=table, size=n, modCount=0), keys, nodes, height


class Interpreter:
    """Run the pinned bytecode as data with an inert identity-hash stub."""

    def __init__(self, classes):
        self.bodies = hm.bodies(classes)

    def remove(self, table, key):
        self.counts = {'instructions': 0, 'frames': 0, 'native': 0, 'allocations': 0}
        return self.run(hm.REMOVE, [table, key], 0), self.counts

    def run(self, key, args, depth):
        if depth > 64:
            raise AssertionError('inert depth limit')
        if key == hm.HASH_CODE:
            self.counts['native'] += 1
            return args[0].fields['hash']
        body = self.bodies[key]; raw = body.raw; index = {r[0]: i for i, r in enumerate(raw)}
        local, stack, pc = dict(enumerate(args)), [], 0
        self.counts['frames'] += 1
        while True:
            self.counts['instructions'] += 1
            if self.counts['instructions'] > 100000:
                raise AssertionError('inert step limit')
            i = index[pc]; offset, op, a = raw[i]
            following = raw[i + 1][0] if i + 1 < len(raw) else None
            ref = body.ref(offset) if op in hm.REFS else None
            if op == 1: stack.append(None)
            elif 2 <= op <= 8: stack.append(op - 3)
            elif op == 16: stack.append(int.from_bytes(bytes(a), 'big', signed=True))
            elif 26 <= op <= 29: stack.append(local[op - 26])
            elif 42 <= op <= 45: stack.append(local[op - 42])
            elif op in (21, 25): stack.append(local[a[0]])
            elif op in (54, 58): local[a[0]] = stack.pop()
            elif 59 <= op <= 62: local[op - 59] = stack.pop()
            elif 75 <= op <= 78: local[op - 75] = stack.pop()
            elif op == 87: stack.pop()
            elif op == 89: stack.append(stack[-1])
            elif op == 90:
                v, u = stack.pop(), stack.pop(); stack.extend([v, u, v])
            elif op == 91:
                v, u, w = stack.pop(), stack.pop(), stack.pop(); stack.extend([v, w, u, v])
            elif op == 178: stack.append(1)
            elif op == 180: stack.append(stack.pop().fields[ref['name']])
            elif op == 181:
                v = stack.pop(); stack.pop().fields[ref['name']] = v
            elif op == 187:
                self.counts['allocations'] += 1; stack.append(Obj(hm.NODE, next=None))
            elif op == 192: pass
            elif op == 193:
                v = stack.pop()
                stack.append(int(ref['value'] == hm.TREE and isinstance(v, Obj) and v.typ == hm.TREE))
            elif op == 50:
                k = stack.pop(); stack.append(stack.pop()[k])
            elif op == 83:
                v, k = stack.pop(), stack.pop(); stack.pop()[k] = v
            elif op == 190: stack.append(len(stack.pop()))
            elif op in (96, 100, 124, 126, 130):
                b, v = stack.pop(), stack.pop()
                out = {96: v + b, 100: v - b, 124: (v & 0xffffffff) >> (b & 31), 126: v & b, 130: v ^ b}[op]
                stack.append(((out + 2**31) % 2**32) - 2**31)
            elif op in hm.BRANCHES or op == 167:
                take = True
                if op in (198, 199):
                    take = (stack.pop() is None) == (op == 198)
                elif 153 <= op <= 158:
                    v = stack.pop(); take = (v == 0, v != 0, v < 0, v >= 0, v > 0, v <= 0)[op - 153]
                elif 159 <= op <= 166:
                    b, v = stack.pop(), stack.pop()
                    take = (v is b) == (op == 165) if op >= 165 else (v == b, v != b, v < b, v >= b, v > b, v <= b)[op - 159]
                if take:
                    following = hm._target(offset, a)
            elif op in hm.INVOKES:
                target = body.invoke(offset); count = len(signature(target[2])[0]) + (op != 184)
                values = stack[-count:] if count else []
                if count:
                    del stack[-count:]
                out = self.run(target, values, depth + 1)
                if signature(target[2])[1] != 'V':
                    stack.append(out)
            elif op in (172, 176): return stack.pop()
            elif op == 177: return None
            else:
                raise AssertionError(('inert opcode', op))
            pc = following


if __name__ == '__main__':
    unittest.main()
