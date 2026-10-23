"""Test flag provenance without executing a constructor."""
import unittest

from grid_symbols.scan import Class, Member, Refusal
from grid_symbols.test_resolve import FakeJar
from .constructor_flags import flag_origin
from .test_constructor_variants import pool
from .test_descriptor_resolution import ModelCode


def model(argument=(28,), desc='(JI)V'):
    cp, _, ref = pool()
    parent = ref(10, 'Base', '<init>', '(I)V')
    root = Class('Root', 'Base', (), 1, [],
                 [Member('method', '<init>', desc, 1,
                         bytes([42, *argument, 183, 0, parent, 177]))], cp)
    cp, _, ref = pool()
    parent = ref(10, 'java/lang/Object', '<init>', '()V')
    field = ref(9, 'Base', 'flags', 'I')
    base = Class('Base', 'java/lang/Object', (), 1,
                 [Member('field', 'flags', 'I', 20)],
                 [Member('method', '<init>', '(I)V', 4,
                         bytes([42, 183, 0, parent, 42, 27, 181, 0, field, 177]))], cp)
    return FakeJar([root, base]), ModelCode(), 'Root', desc, ('Base', 'flags', 'I')


class ConstructorFlagTests(unittest.TestCase):
    def test_forwarded_argument_accounts_for_wide_local_slots(self):
        args = model(argument=(29,))
        result = flag_origin(*args)
        self.assertEqual(result['origin'], ['argument', 1])
        self.assertEqual(len(result['constructors']), 2)
        self.assertFalse(result['boundedAdmission'])
        with self.assertRaisesRegex(Refusal, 'local'):
            flag_origin(*model())

    def test_literal_is_preserved_through_forwarding(self):
        self.assertEqual(flag_origin(*model((17, 1, 8), '()V'))['origin'], ['integer', 264])
        self.assertEqual(flag_origin(*model((16, 255), '()V'))['origin'], ['integer', -1])

    def test_static_reference_can_be_an_unrelated_prefix_argument(self):
        args = model((27,), '(I)V'); jar = args[0]
        cp, _, ref = pool()
        static = ref(9, 'Config', 'instance', 'Ljava/lang/Object;')
        parent = ref(10, 'Base', '<init>', '(Ljava/lang/Object;I)V')
        jar.classes['Root'].cp = cp
        jar.classes['Root'].methods[0].code = bytes([42, 178, 0, static, 27, 183, 0, parent, 177])
        base = jar.classes['Base'].methods[0]; base.desc = '(Ljava/lang/Object;I)V'
        body = bytearray(base.code); body[5] = 28; base.code = bytes(body)
        self.assertEqual(flag_origin(*args)['origin'], ['argument', 0])

    def test_conditional_or_repeated_store_refuses(self):
        for tail in ('conditional', 'repeat', 'local'):
            args = model((27,), '(I)V'); m = args[0].classes['Base'].methods[0]
            if tail == 'conditional':
                m.code = m.code[:4] + bytes([3, 153, 0, 8]) + m.code[4:]
            elif tail == 'repeat':
                m.code = m.code[:-1] + m.code[4:]
            else:
                m.code = m.code[:4] + bytes([3, 60]) + m.code[4:]
            with self.subTest(tail=tail), self.assertRaises(Refusal):
                flag_origin(*args)

    def test_static_or_mutable_field_and_wrong_load_refuse(self):
        for flags in (2, 24):
            args = model((27,), '(I)V'); args[0].classes['Base'].fields[0].flags = flags
            with self.assertRaisesRegex(Refusal, 'not-final-instance'):
                flag_origin(*args)
        with self.assertRaisesRegex(Refusal, 'load-kind'):
            flag_origin(*model((43,), '(I)V'))

    def test_cycle_effectful_prefix_and_external_parent_refuse(self):
        for change in ('cycle', 'effect', 'external'):
            args = model((27,), '(I)V'); root = args[0].classes['Root']
            if change == 'cycle':
                root.parent = 'Root'
                root.cp = [(1, 'Root') if x == (1, 'Base') else x for x in root.cp]
            elif change == 'effect':
                root.methods[0].code = bytes([0]) + root.methods[0].code
            else:
                base = args[0].classes['Base']; base.parent = 'external/Parent'
                base.cp = [(1, 'external/Parent') if x == (1, 'java/lang/Object') else x for x in base.cp]
            with self.subTest(change=change), self.assertRaises(Refusal):
                flag_origin(*args)

    def test_handler_missing_store_and_unrelated_final_field_refuse(self):
        for change in ('handler', 'store', 'field'):
            args = model((27,), '(I)V'); base = args[0].classes['Base']
            if change == 'handler':
                base.methods[0].handlers = ((0, 9, 9, 0),)
            elif change == 'store':
                base.methods[0].code = base.methods[0].code[:4] + bytes([177])
            else:
                args[0].classes['Other'] = Class('Other', 'java/lang/Object', (), 1,
                                                [Member('field', 'flags', 'I', 20)], [])
                args = (*args[:-1], ('Other', 'flags', 'I'))
            with self.subTest(change=change), self.assertRaises(Refusal):
                flag_origin(*args)

    def test_root_parameter_kind_must_agree_with_integer_field(self):
        args = model((31,), '(J)V')
        with self.assertRaisesRegex(Refusal, 'input-kind'):
            flag_origin(*args)


def allocation_model(flag=(17, 1, 8)):
    from .constructor_flags import allocation_flags
    args = model((27,), '(I)V'); jar, code = args[:2]
    cp, typ, ref = pool(); allocated = typ('Root'); ctor = ref(10, 'Root', '<init>', '(I)V')
    method = Member('method', 'make', '()LRoot;', 9,
                    bytes([187, 0, allocated, 89, *flag, 183, 0, ctor, 176]))
    cls = Class('Factory', 'java/lang/Object', (), 1, [], [method], cp)
    jar.classes['Factory'] = cls
    return allocation_flags, [jar, code, cls, method, 0, args[-1]]


class AllocationFlagTests(unittest.TestCase):
    def test_literal_and_field_provenance_remain_together(self):
        run, args = allocation_model(); result = run(*args)
        self.assertEqual(result['flags'], 264)
        self.assertEqual(result['fieldProvenance']['origin'], ['argument', 0])
        self.assertFalse(result['boundedAdmission'])

    def test_unknown_flag_and_nested_allocation_refuse(self):
        for change in ('unknown', 'nested'):
            run, args = allocation_model((26,))
            if change == 'nested':
                args[3].code = args[3].code[:4] + args[3].code
            with self.subTest(change=change), self.assertRaises(Refusal):
                run(*args)

    def test_branch_into_constructor_and_handler_refuse(self):
        run, args = allocation_model(); method = args[3]
        # The suffix can enter the constructor without its literal argument.
        method.code += bytes([167, 255, 252])
        with self.assertRaisesRegex(Refusal, 'entered-prefix'):
            run(*args)
        run, args = allocation_model(); args[3].handlers = ((0, 10, 10, 0),)
        with self.assertRaisesRegex(Refusal, 'handler'):
            run(*args)

    def test_only_last_integer_parameter_is_admitted(self):
        run, args = allocation_model(); root = args[0].classes['Root']
        root.methods[0].desc = '(II)V'
        args[2].cp = [(1, '(II)V') if x == (1, '(I)V') else x for x in args[2].cp]
        method = args[3]; method.code = method.code[:4] + bytes([3]) + method.code[4:]
        with self.assertRaisesRegex(Refusal, 'argument-position'):
            run(*args)

    def test_wrong_allocation_offset_and_oversize_body_refuse(self):
        run, args = allocation_model(); args[4] = 3
        with self.assertRaisesRegex(Refusal, 'witness'):
            run(*args)
        run, args = allocation_model(); args[3].code += bytes([0] * 4096)
        with self.assertRaisesRegex(Refusal, 'body-limit'):
            run(*args)


if __name__ == '__main__':
    unittest.main()
