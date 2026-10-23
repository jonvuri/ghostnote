"""Test descriptor loop bounds with an inert array-loop execution model."""
import unittest

from grid_symbols.scan import Class, Member, Refusal, instructions
from .invariant_root import invariant_root
from .test_constructor_variants import pool


def model():
    cp, _, ref = pool()
    values = ref(9, 'Descriptor', 'values', '[LValue;')
    locks = ref(9, 'Descriptor', 'locks', '[LLock;')
    empty = ref(9, 'Descriptor', 'expressions', 'Ljava/util/List;')
    value_call = ref(10, 'Value', 'check', '(LObject;)V')
    lock_call = ref(10, 'Lock', 'read', '(LObject;)LWrapper;')
    lock_check = ref(10, 'Wrapper', 'check', '()V')
    query = ref(11, 'java/util/List', 'isEmpty', '()Z')
    body = bytes([
        42, 180, 0, values, 198, 0, 38, 42, 180, 0, values, 77, 44, 190,
        62, 3, 54, 4, 21, 4, 29, 162, 0, 21, 44, 21, 4, 50, 58, 5,
        25, 5, 43, 182, 0, value_call, 132, 4, 1, 167, 255, 235,
        42, 180, 0, locks, 198, 0, 45, 42, 180, 0, locks, 77, 44, 190,
        62, 3, 54, 4, 21, 4, 29, 162, 0, 28, 44, 21, 4, 50, 58, 5,
        25, 5, 43, 182, 0, lock_call, 58, 6, 25, 6, 182, 0, lock_check,
        132, 4, 1, 167, 255, 228, 42, 180, 0, empty,
        185, 0, query, 1, 0, 154, 0, 5, 1, 191, 177])
    method = Member('method', 'check', '(LObject;)V', 1, body)
    cls = Class('Descriptor', 'java/lang/Object', (), 1,
                [Member('field', 'values', '[LValue;', 2),
                 Member('field', 'locks', '[LLock;', 2),
                 Member('field', 'expressions', 'Ljava/util/List;', 18)], [method], cp)
    return cls, method, ('Descriptor', 'expressions', 'Ljava/util/List;')


def execute(method, value_count, lock_count):
    """Count JVM instructions; callees are separate terminal stubs."""
    raw = instructions(method.code)
    rows = {x[0]: (i, x[1], x[2]) for i, x in enumerate(raw)}
    stack, local, pc, count, calls = [], {0: 'descriptor', 1: 'object'}, 0, 0, 0
    while True:
        count += 1
        if count > 10000:
            raise AssertionError('inert execution limit')
        i, op, args = rows[pc]
        following = raw[i + 1][0] if i + 1 < len(raw) else None
        if op in (42, 43, 44, 29):
            stack.append(local[{42: 0, 43: 1, 44: 2, 29: 3}[op]])
        elif op in (21, 25):
            stack.append(local[args[0]])
        elif op in (54, 58, 62, 77):
            local[{62: 3, 77: 2}.get(op, args[0] if args else None)] = stack.pop()
        elif op == 3:
            stack.append(0)
        elif op == 180:
            stack.pop()
            stack.append(([None] * value_count if value_count is not None else None)
                         if pc < 42 else ([None] * lock_count if lock_count is not None else None)
                         if pc < 91 else [])
        elif op == 190:
            stack.append(len(stack.pop()))
        elif op == 50:
            index, array = stack.pop(), stack.pop()
            stack.append(array[index])
        elif op == 132:
            local[args[0]] += args[1]
        elif op in (198, 162, 154, 167):
            take = True
            if op == 198:
                take = stack.pop() is None
            elif op == 162:
                right, left = stack.pop(), stack.pop()
                take = left >= right
            elif op == 154:
                take = stack.pop() != 0
            if take:
                following = pc + int.from_bytes(bytes(args), 'big', signed=True)
        elif op == 182:
            calls += 1
            if pc != 82:
                stack.pop()
            stack.pop()
            if pc == 75:
                stack.append('wrapper')
        elif op == 185:
            stack.append(int(not stack.pop()))
        elif op == 177:
            return count, calls
        else:
            raise AssertionError(('unexpected inert instruction', pc, op))
        pc = following


class InvariantRootTests(unittest.TestCase):
    def test_formula_bounds_actual_iterations_and_null_arrays(self):
        cls, method, field = model()
        result = invariant_root(cls, method, field)
        for values in (None, 0, 1, 7):
            for locks in (None, 0, 1, 3):
                count, calls = execute(method, values, locks)
                p, l = values or 0, locks or 0
                self.assertLessEqual(count, 33 + 12 * p + 15 * l)
                self.assertEqual(calls, p + 2 * l)
                if values is not None and locks is not None:
                    self.assertEqual(count, 33 + 12 * p + 15 * l)
        self.assertFalse(result['boundedAdmission'])
        self.assertEqual(result['emptyListCondition'], list(field))

    def test_changed_back_edge_or_exit_refuses(self):
        for offset in (6, 23, 41, 48, 65, 90, 102):
            cls, method, field = model()
            body = bytearray(method.code); body[offset] ^= 1; method.code = bytes(body)
            with self.subTest(offset=offset), self.assertRaisesRegex(Refusal, 'branch'):
                invariant_root(cls, method, field)

    def test_changed_increment_or_index_refuses(self):
        for offset in (17, 38, 60, 87):
            cls, method, field = model()
            body = bytearray(method.code); body[offset] = 2; method.code = bytes(body)
            with self.subTest(offset=offset), self.assertRaises(Refusal):
                invariant_root(cls, method, field)

    def test_call_and_field_types_cannot_be_substituted(self):
        for original, replacement in [('(LObject;)V', '(LOther;)V'),
                                      ('(LObject;)LWrapper;', '(LObject;)LOther;'),
                                      ('isEmpty', 'clear'), ('[LValue;', '[LOther;')]:
            cls, method, field = model()
            index = next(i for i, row in enumerate(cls.cp) if row == (1, original))
            cls.cp[index] = (1, replacement)
            with self.subTest(original=original), self.assertRaises(Refusal):
                invariant_root(cls, method, field)

    def test_empty_condition_and_field_access_are_required(self):
        cls, method, field = model()
        with self.assertRaisesRegex(Refusal, 'reference-shape'):
            invariant_root(cls, method, ('Descriptor', 'other', 'Ljava/util/List;'))
        for index in range(3):
            cls, method, field = model(); cls.fields[index].flags = 9
            with self.assertRaisesRegex(Refusal, 'field'):
                invariant_root(cls, method, field)

    def test_selected_handlers_refuse_but_excluded_tail_is_separate(self):
        cls, method, field = model()
        method.handlers = ((103, 105, 103, 0),)
        self.assertFalse(invariant_root(cls, method, field)['boundedAdmission'])
        for start, end in ((0, 42), (95, 100), (105, 106)):
            method.handlers = ((start, end, 103, 0),)
            with self.assertRaisesRegex(Refusal, 'handler'):
                invariant_root(cls, method, field)

    def test_extra_work_flags_and_size_refuse(self):
        for change in ('prefix', 'flags', 'size'):
            cls, method, field = model()
            if change == 'prefix':
                method.code = bytes([0]) + method.code
            elif change == 'flags':
                method.flags |= 32
            else:
                method.code += bytes([0] * 4096)
            with self.assertRaises(Refusal):
                invariant_root(cls, method, field)


if __name__ == '__main__':
    unittest.main()
