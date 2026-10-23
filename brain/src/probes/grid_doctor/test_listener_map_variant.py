"""Test the narrow listener-map constructor projection and its exclusions."""
import unittest

from grid_symbols.scan import Class, Member, Refusal
from .contracts import contract
from .listener_map_variant import lazy_capacity_one
from .test_constructor_variants import pool


def model(capacity=True):
    cp, typ, ref = pool()
    field = ref(9, 'Owner', 'listeners', 'Ljava/util/HashMap;')
    allocated = typ('java/util/HashMap')
    call = ref(10, 'java/util/HashMap', '<init>', '(I)V' if capacity else '()V')
    body = bytes([178, 0, field, 199, 0, 14 if capacity else 13,
                  187, 0, allocated, 89, *([4] if capacity else []),
                  183, 0, call, 179, 0, field, 178, 0, field, 87, 177])
    method = Member('method', 'register', '(LListener;)V', 1, body)
    cls = Class('Owner', 'java/lang/Object', (), 1,
                [Member('field', 'listeners', 'Ljava/util/HashMap;', 10)], [method], cp)
    return cls, method, {'Owner': cls, 'Listener': None}


class ListenerMapVariantTests(unittest.TestCase):
    def test_only_capacity_input_changes_and_branch_is_rebased(self):
        old = contract(*model(False)); new = lazy_capacity_one(*model())
        self.assertEqual(old['digest'], new['digest'])
        self.assertEqual(old['tokens'], new['tokens'])
        self.assertEqual(new['listenerMapVariant']['addedInstructions'], 1)
        self.assertNotEqual(new['digest'], new['listenerMapVariant']['originalDigest'])

    def test_branch_over_whole_map_block_keeps_destination(self):
        left, right = model(False), model()
        for args in (left, right):
            method = args[1]
            method.code = bytes([43, 198, 0, len(method.code) + 2]) + method.code
        self.assertEqual(contract(*left)['digest'], lazy_capacity_one(*right)['digest'])

    def test_unrelated_effect_is_retained(self):
        args = model(); args[1].code = args[1].code[:-1] + bytes([3, 87, 177])
        self.assertNotEqual(contract(*model(False))['digest'], lazy_capacity_one(*args)['digest'])

    def test_other_capacity_and_duplicate_allocations_refuse(self):
        args = model(); body = bytearray(args[1].code); body[10] = 5; args[1].code = bytes(body)
        with self.assertRaisesRegex(Refusal, 'site-count'):
            lazy_capacity_one(*args)
        args = model(); args[1].code = args[1].code[:-1] + args[1].code
        with self.assertRaisesRegex(Refusal, 'site-count'):
            lazy_capacity_one(*args)

    def test_wrong_field_access_or_type_refuses(self):
        for flags in (2, 9, 26):
            args = model(); args[0].fields[0].flags = flags
            with self.subTest(flags=flags), self.assertRaisesRegex(Refusal, 'private-static-field'):
                lazy_capacity_one(*args)
        args = model()
        args[0].cp = [(1, 'Ljava/util/Map;') if row == (1, 'Ljava/util/HashMap;') else row
                      for row in args[0].cp]
        with self.assertRaises(Refusal):
            lazy_capacity_one(*args)

    def test_changed_null_guard_or_store_refuses(self):
        for offset, value in ((3, 198), (5, 3), (14, 181)):
            args = model(); body = bytearray(args[1].code); body[offset] = value
            args[1].code = bytes(body)
            with self.subTest(offset=offset), self.assertRaisesRegex(Refusal, 'null-guard'):
                lazy_capacity_one(*args)

    def test_entered_allocation_and_back_edge_refuse(self):
        args = model(); args[1].code = bytes([43, 198, 0, 13]) + args[1].code
        with self.assertRaisesRegex(Refusal, 'entered-allocation'):
            lazy_capacity_one(*args)
        args = model(); args[1].code += bytes([167, 255, 234])
        with self.assertRaisesRegex(Refusal, 'back-edge'):
            lazy_capacity_one(*args)

    def test_handlers_and_unsupported_method_shape_refuse(self):
        args = model(); args[1].handlers = ((0, 20, 20, 0),)
        with self.assertRaisesRegex(Refusal, 'method'):
            lazy_capacity_one(*args)
        for flags in (9, 33, 257, 1025):
            args = model(); args[1].flags = flags
            with self.subTest(flags=flags), self.assertRaisesRegex(Refusal, 'method'):
                lazy_capacity_one(*args)


if __name__ == '__main__':
    unittest.main()
