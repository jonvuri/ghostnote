"""Test exclusion of one read behind an initialized assertion flag."""
import copy
import unittest

from grid_symbols.scan import Member, Refusal
from .assertion_variants import field_to_getter
from .test_assertion_guards import fixture as flag_fixture


def fixture():
    source = flag_fixture()
    source.cp += [(1, 'value'), (1, 'Ljava/lang/Object;'), (12, (13, 14)), (9, (2, 15))]
    source.fields.append(Member('field', 'value', 'Ljava/lang/Object;', 2))
    a = Member('method', 'check', '()V', 1,
               bytes([178, 0, 12, 154, 0, 9, 42, 180, 0, 16, 87, 177, 177]))
    source.methods.append(a)
    target = copy.deepcopy(source)
    target.cp[14] = (1, '()Ljava/lang/Object;')
    target.cp[16] = (10, (2, 15))
    target.fields.pop()
    b = target.methods[-1]
    b.code = b.code[:7] + bytes([182]) + b.code[8:]
    target.methods.append(Member('method', 'value', '()Ljava/lang/Object;', 2, bytes([1, 176])))
    return source, a, target, b


def check(row):
    a, am, b, bm = row
    return field_to_getter(a, am, {a.name: a}, b, bm, {b.name: b})


class AssertionVariantTests(unittest.TestCase):
    def test_read_change_is_conditional(self):
        result = check(fixture())
        self.assertEqual(result['guardRange'], (0, 6))
        self.assertFalse(result['runtimeValuesObserved'])
        self.assertFalse(result['boundedAdmission'])

    def test_other_body_change_refuses(self):
        row = fixture()
        row[3].code = row[3].code[:-1] + bytes([191])
        with self.assertRaisesRegex(Refusal, 'difference-count'):
            check(row)

    def test_mutable_or_reassigned_guard_refuses(self):
        for change in ('mutable', 'reassigned'):
            row = fixture()
            if change == 'mutable':
                row[2].fields[0].flags = 8
            else:
                init = row[2].methods[0]
                init.code = init.code[:-1] + bytes([3, 179, 0, 12, 177])
            with self.subTest(change=change), self.assertRaises(Refusal):
                check(row)

    def test_jump_to_condition_without_flag_read_refuses(self):
        row = fixture()
        for method in (row[1], row[3]):
            method.code = bytes([3, 167, 0, 6]) + method.code
        with self.assertRaisesRegex(Refusal, 'entered-block'):
            check(row)

    def test_unprotected_change_refuses(self):
        row = fixture()
        for method in (row[1], row[3]):
            method.code = method.code[:4] + bytes([0, 3]) + method.code[6:]
        with self.assertRaisesRegex(Refusal, 'guard-count'):
            check(row)

    def test_handler_and_nonprivate_getter_refuse(self):
        row = fixture()
        row[3].handlers = ((0, 12, 12, 0),)
        with self.assertRaisesRegex(Refusal, 'handlers'):
            check(row)
        row = fixture()
        row[2].methods[-1].flags = 1
        with self.assertRaisesRegex(Refusal, 'getter-declaration'):
            check(row)

    def test_changed_signature_refuses(self):
        row = fixture()
        row[3].desc = '(I)V'
        with self.assertRaisesRegex(Refusal, 'signature'):
            check(row)

    def test_duplicate_getter_refuses(self):
        row = fixture()
        row[2].methods.append(copy.deepcopy(row[2].methods[-1]))
        with self.assertRaisesRegex(Refusal, 'getter-declaration'):
            check(row)


if __name__ == '__main__':
    unittest.main()
