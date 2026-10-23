"""Test initialized listener disposal and partial failure on inert objects."""
import unittest

from grid_symbols.scan import Class, Member, Refusal, instructions
from .disposal_wrappers import listener_flags_delegate
from .ownership import constant
from .test_constructor_variants import pool


def model():
    cp, _, ref = pool(); fields, body = [], []
    for n in range(2):
        flag = ref(9, 'Atom', 'active' + str(n), 'Z')
        listener = ref(9, 'Atom', 'listener' + str(n), 'LListener;')
        getter = ref(10, 'Atom', 'owner' + str(n), '()LOwner;')
        remove = ref(10, 'Owner', 'remove', '(LListener;)V')
        fields.extend([Member('field', 'active' + str(n), 'Z', 2),
                       Member('field', 'listener' + str(n), 'LListener;', 18)])
        body.extend([42, 180, 0, flag, 153, 0, 19, 42, 182, 0, getter,
                     42, 180, 0, listener, 182, 0, remove, 42, 3, 181, 0, flag])
    delegate = ref(10, 'Base', 'dispose', '()V')
    body.extend([42, 183, 0, delegate, 177])
    method = Member('method', 'dispose', '()V', 1, bytes(body))
    cls = Class('Atom', 'Base', (), 1, fields, [method], cp)
    return cls, method


def execute(cls, method, state, fail_owner=None):
    raw = instructions(method.code); indexed = {r[0]: i for i, r in enumerate(raw)}
    stack, pc, steps, calls, removed = [], 0, 0, 0, []
    while steps < 100:
        i = indexed[pc]; _, op, args = raw[i]; steps += 1
        following = raw[i + 1][0] if i + 1 < len(raw) else None
        if op == 42:
            stack.append('self')
        elif op == 3:
            stack.append(False)
        elif op == 180:
            name = constant(cls, int.from_bytes(bytes(args), 'big'))['name']
            stack.pop(); stack.append(state[name])
        elif op == 153:
            if not stack.pop():
                following = pc + int.from_bytes(bytes(args), 'big', signed=True)
        elif op == 181:
            name = constant(cls, int.from_bytes(bytes(args), 'big'))['name']
            value = stack.pop(); stack.pop(); state[name] = value
        elif op == 182:
            name = constant(cls, int.from_bytes(bytes(args), 'big'))['name']; calls += 1
            if name.startswith('owner'):
                stack.pop(); stack.append(name)
            elif name == 'remove':
                listener = stack.pop(); owner = stack.pop()
                if owner == fail_owner:
                    return {'failed': True, 'removed': removed, 'steps': steps, 'calls': calls}
                removed.append(listener)
            else:
                raise AssertionError('inert callee')
        elif op == 183:
            calls += 1; stack.pop()
        elif op == 177:
            return {'failed': False, 'removed': removed, 'steps': steps, 'calls': calls}
        else:
            raise AssertionError('inert opcode')
        pc = following
    raise AssertionError('inert step limit')


class DisposalListenerTests(unittest.TestCase):
    def test_all_flag_combinations_match_bounds_and_clear_owned_flags(self):
        cls, method = model(); bound = listener_flags_delegate(cls, method)
        for first in (False, True):
            for second in (False, True):
                state = {'active0': first, 'active1': second, 'listener0': 'a', 'listener1': 'b'}
                result = execute(cls, method, state); enabled = int(first) + int(second)
                self.assertEqual(result['steps'], 9 + 8 * enabled)
                self.assertEqual(result['calls'], 1 + 2 * enabled)
                self.assertLessEqual(result['steps'], bound['ownInstructionBound'])
                self.assertLessEqual(result['calls'], bound['ownVendorCallBound'])
                self.assertEqual(result['removed'], (['a'] if first else []) + (['b'] if second else []))
                self.assertFalse(state['active0'] or state['active1'])
        self.assertFalse(bound['boundedAdmission'])

    def test_failure_keeps_later_flag_and_prior_removal(self):
        cls, method = model(); listener_flags_delegate(cls, method)
        state = {'active0': True, 'active1': True, 'listener0': 'a', 'listener1': 'b'}
        result = execute(cls, method, state, 'owner1')
        self.assertTrue(result['failed'])
        self.assertEqual(result['removed'], ['a'])
        self.assertFalse(state['active0']); self.assertTrue(state['active1'])

    def test_changed_flag_branch_or_clear_refuses(self):
        for offset, value in ((4, 154), (6, 18), (19, 4)):
            cls, method = model(); body = bytearray(method.code); body[offset] = value
            method.code = bytes(body)
            with self.subTest(offset=offset), self.assertRaises(Refusal):
                listener_flags_delegate(cls, method)

    def test_static_flag_or_mutable_listener_refuses(self):
        for index, flags in ((0, 10), (1, 2), (1, 26)):
            cls, method = model(); cls.fields[index].flags = flags
            with self.subTest(index=index, flags=flags), self.assertRaisesRegex(Refusal, 'field'):
                listener_flags_delegate(cls, method)

    def test_wrong_owner_getter_signature_or_delegate_refuses(self):
        for before, after in (('()LOwner;', '()LOther;'), ('(LListener;)V', '(Ljava/lang/Object;)V'),
                              ('Base', 'Other')):
            cls, method = model()
            cls.cp = [(1, after) if row == (1, before) else row for row in cls.cp]
            with self.subTest(before=before), self.assertRaises(Refusal):
                listener_flags_delegate(cls, method)

    def test_duplicate_listener_and_extra_work_refuse(self):
        cls, method = model(); body = bytearray(method.code); body[37] = body[14]
        method.code = bytes(body)
        with self.assertRaisesRegex(Refusal, 'duplicate'):
            listener_flags_delegate(cls, method)
        cls, method = model(); method.code = bytes([0]) + method.code
        with self.assertRaisesRegex(Refusal, 'delegate'):
            listener_flags_delegate(cls, method)

    def test_handler_and_method_access_refuse(self):
        cls, method = model(); method.handlers = ((0, 50, 50, 0),)
        with self.assertRaisesRegex(Refusal, 'method'):
            listener_flags_delegate(cls, method)
        cls, method = model(); method.flags = 33
        with self.assertRaisesRegex(Refusal, 'method'):
            listener_flags_delegate(cls, method)


if __name__ == '__main__':
    unittest.main()
