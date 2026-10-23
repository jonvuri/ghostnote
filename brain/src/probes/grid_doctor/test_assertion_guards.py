"""Test assertion-field provenance. No test establishes a live flag value."""
import copy
import unittest
from grid_symbols.scan import Class, Member, Refusal
from .assertion_guards import disabled_field


def fixture():
    cp = [None, (1, 'Owner'), (7, 1), (1, 'java/lang/Class'), (7, 3),
          (1, 'desiredAssertionStatus'), (1, '()Z'), (12, (5, 6)), (10, (4, 7)),
          (1, 'disabled'), (1, 'Z'), (12, (9, 10)), (9, (2, 11))]
    code = bytes([18, 2, 182, 0, 8, 154, 0, 7, 4, 167, 0, 4, 3, 179, 0, 12, 177])
    return Class('Owner', 'java/lang/Object', (), 1, [Member('field', 'disabled', 'Z', 4120)],
                 [Member('method', '<clinit>', '()V', 8, code)], cp)


class AssertionGuardTests(unittest.TestCase):
    def test_exact_provenance_and_renaming(self):
        cls = fixture()
        self.assertEqual(disabled_field(cls), ('Owner', 'disabled', 'Z'))
        cls.name = 'Renamed'; cls.cp[1] = (1, 'Renamed'); cls.cp[9] = (1, 'flag'); cls.fields[0].name = 'flag'
        self.assertEqual(disabled_field(cls), ('Renamed', 'flag', 'Z'))

    def test_mutable_flag_wrong_method_and_branch_are_not_guards(self):
        for change in ('flags', 'method', 'branch'):
            cls = fixture()
            if change == 'flags':
                cls.fields[0].flags = 8
            elif change == 'method':
                cls.cp[5] = (1, 'otherStatus')
            else:
                cls.methods[0].code = cls.methods[0].code[:7] + bytes([8]) + cls.methods[0].code[8:]
            self.assertIsNone(disabled_field(cls))

    def test_second_write_and_handler_refuse(self):
        cls = fixture()
        cls.methods[0].code = cls.methods[0].code[:-1] + bytes([3, 179, 0, 12, 177])
        with self.assertRaisesRegex(Refusal, 'reassigned'):
            disabled_field(cls)
        cls = fixture(); cls.methods[0].handlers = ((0, 16, 16, 0),)
        with self.assertRaisesRegex(Refusal, 'handler'):
            disabled_field(cls)

    def test_duplicate_initializer_refuses(self):
        cls = fixture(); cls.methods.append(copy.deepcopy(cls.methods[0]))
        with self.assertRaisesRegex(Refusal, 'count'):
            disabled_field(cls)


if __name__ == '__main__':
    unittest.main()
