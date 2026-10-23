"""Check the ancestor cost against inert JVM loop execution."""
import unittest

from grid_symbols.scan import Class, Member, Refusal, instructions
from .history_ancestor import history_ancestor
from .ownership import constant
from .test_constructor_variants import pool


def model():
    cp, _, ref = pool()
    wrapper = ref(10, 'Object', 'wrapper', '()LWrapper;')
    prop = ref(10, 'Wrapper', 'property', '()LProperty;')
    predicate = ref(10, 'Property', 'history', '()Z')
    parent = ref(10, 'Wrapper', 'parent', '()LObject;')
    body = bytes([42, 182, 0, wrapper, 76, 43, 198, 0, 26, 43,
                  182, 0, prop, 182, 0, predicate, 153, 0, 5, 4, 172,
                  43, 182, 0, parent, 182, 0, wrapper, 76,
                  167, 255, 232, 3, 172])
    method = Member('method', 'ancestorHistory', '(LObject;)Z', 9, body)
    cls = Class('History', 'java/lang/Object', (), 1, [], [method], cp)
    return cls, method


def execute(cls, method, values):
    """Use integer object identities and separate terminal getter stubs."""
    raw = instructions(method.code)
    indexed = {r[0]: i for i, r in enumerate(raw)}
    local, stack, pc, count, calls = {0: 0}, [], 0, 0, 0
    while count < 10000:
        i = indexed[pc]; _, op, args = raw[i]
        pc = raw[i + 1][0] if i + 1 < len(raw) else None
        count += 1
        if op in (42, 43):
            stack.append(local[op - 42])
        elif op == 76:
            local[1] = stack.pop()
        elif op == 182:
            calls += 1
            target = constant(cls, int.from_bytes(bytes(args), 'big'))
            value = stack.pop()
            if target['name'] == 'wrapper':
                stack.append(value if value < len(values) else None)
            elif target['name'] == 'property':
                stack.append(values[value])
            elif target['name'] == 'history':
                stack.append(int(value))
            elif target['name'] == 'parent':
                stack.append(value + 1)
            else:
                raise AssertionError('unknown inert callee')
        elif op in (198, 153, 167):
            take = True if op == 167 else stack.pop() is None if op == 198 else stack.pop() == 0
            if take:
                pc = raw[i][0] + int.from_bytes(bytes(args), 'big', signed=True)
        elif op in (3, 4):
            stack.append(op - 3)
        elif op == 172:
            return stack.pop(), count, calls
        else:
            raise AssertionError('unknown inert opcode')
    raise AssertionError('inert step limit')


class HistoryAncestorTests(unittest.TestCase):
    def test_empty_and_false_chains_have_exact_formula(self):
        cls, method = model(); result = history_ancestor(cls, method)
        for depth in (0, 1, 2, 7, 64):
            value, steps, calls = execute(cls, method, [False] * depth)
            self.assertEqual(value, 0)
            self.assertEqual(steps, result['ownInstructions']['constant']
                             + depth * result['ownInstructions']['perAncestor'])
            self.assertEqual(calls, result['vendorCalls']['constant']
                             + depth * result['vendorCalls']['perAncestor'])
        self.assertFalse(result['boundedAdmission'])

    def test_every_true_exit_stays_within_depth_bound(self):
        cls, method = model(); result = history_ancestor(cls, method)['trueExit']
        for depth in (1, 2, 7, 64):
            for at in range(depth):
                values = [False] * depth; values[at] = True
                value, steps, calls = execute(cls, method, values)
                self.assertEqual(value, 1)
                self.assertEqual(steps, (at + 1) * result['ownInstructionsPerVisitedAncestor'])
                self.assertEqual(calls, (at + 1) * result['vendorCallsPerVisitedAncestor']
                                 + result['vendorCallConstant'])
                self.assertLessEqual(steps, 7 + 11 * depth)
                self.assertLessEqual(calls, 1 + 4 * depth)

    def test_each_changed_branch_refuses(self):
        for offset in (6, 16, 29):
            cls, method = model(); body = bytearray(method.code); body[offset + 2] ^= 1
            method.code = bytes(body)
            with self.subTest(offset=offset), self.assertRaisesRegex(Refusal, 'branch'):
                history_ancestor(cls, method)

    def test_handler_and_method_flags_refuse(self):
        for flags in (1, 41, 265, 1033):
            cls, method = model(); method.flags = flags
            with self.subTest(flags=flags), self.assertRaisesRegex(Refusal, 'method'):
                history_ancestor(cls, method)
        cls, method = model(); method.handlers = ((0, 32, 32, 0),)
        with self.assertRaisesRegex(Refusal, 'method'):
            history_ancestor(cls, method)

    def test_extra_work_local_return_and_loop_changes_refuse(self):
        for offset, op in ((4, 77), (19, 3), (28, 77), (29, 153)):
            cls, method = model(); body = bytearray(method.code); body[offset] = op
            method.code = bytes(body)
            with self.subTest(offset=offset), self.assertRaisesRegex(Refusal, 'body'):
                history_ancestor(cls, method)
        cls, method = model(); method.code += bytes([177])
        with self.assertRaisesRegex(Refusal, 'body'):
            history_ancestor(cls, method)

    def test_getter_and_predicate_types_must_connect(self):
        for before, after in [('()LWrapper;', '()LOther;'), ('()LProperty;', '()LOther;'),
                              ('()LObject;', '()LOther;'), ('()Z', '()I')]:
            cls, method = model()
            cls.cp = [(1, after) if row == (1, before) else row for row in cls.cp]
            with self.subTest(before=before), self.assertRaisesRegex(Refusal, 'call-shape'):
                history_ancestor(cls, method)

    def test_both_wrapper_reads_must_use_same_method(self):
        cls, method = model(); body = bytearray(method.code)
        body[27] = body[24]; method.code = bytes(body)
        with self.assertRaisesRegex(Refusal, 'call-shape'):
            history_ancestor(cls, method)


if __name__ == '__main__':
    unittest.main()
