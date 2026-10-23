"""Test conservative branch selection. These tests do not run vendor code."""
import struct
import unittest
from grid_symbols.scan import Class, Member, Refusal
from .dispatch_paths import reachable


class DispatchPathsTests(unittest.TestCase):
    def fixture(self, code, desc='(LObject;I)I', handlers=()):
        cp = [None, (1, 'Owner'), (7, 1), (1, 'disabled'), (1, 'Z'), (12, (3, 4)), (9, (2, 5))]
        cls = Class('Owner', 'java/lang/Object', (), 1, [], [], cp)
        return cls, Member('method', 'read', desc, 1, bytes(code), handlers)

    def test_lookup_switch_selects_id_and_default(self):
        code = bytes([28, 171, 0, 0]) + struct.pack('>iiii', 21, 1, 7, 19) + bytes([4, 172, 3, 172])
        cls, method = self.fixture(code)
        self.assertEqual(reachable(cls, method, 7), {0, 1, 20, 21})
        self.assertEqual(reachable(cls, method, 8), {0, 1, 22, 23})
        self.assertEqual(reachable(cls, method, None), {0, 1, 20, 21, 22, 23})

    def test_table_switch_selects_id(self):
        code = bytes([28, 170, 0, 0]) + struct.pack('>iiii', 21, 7, 7, 19) + bytes([4, 172, 3, 172])
        cls, method = self.fixture(code)
        self.assertEqual(reachable(cls, method, 7), {0, 1, 20, 21})

    def test_overwritten_or_wrong_argument_keeps_all_branches(self):
        cls, method = self.fixture([4, 61, 28, 16, 7, 160, 0, 5, 4, 172, 3, 172])
        self.assertEqual(reachable(cls, method, 7), {0, 1, 2, 3, 5, 8, 9, 10, 11})
        cls, method = self.fixture([28, 16, 7, 160, 0, 5, 4, 172, 3, 172], '(LObject;LObject;I)I')
        self.assertEqual(reachable(cls, method, 7), {0, 1, 3, 6, 7, 8, 9})

    def test_explicit_flag_condition_only(self):
        cls, method = self.fixture([178, 0, 6, 154, 0, 5, 3, 172, 4, 172])
        self.assertEqual(reachable(cls, method, None), {0, 3, 6, 7, 8, 9})
        self.assertEqual(reachable(cls, method, None, {('Owner', 'disabled', 'Z')}), {0, 3, 8, 9})
        self.assertEqual(reachable(cls, method, None, {('Other', 'disabled', 'Z')}), {0, 3, 6, 7, 8, 9})

    def test_handlers_remain_reachable(self):
        cls, method = self.fixture([178, 0, 6, 154, 0, 5, 3, 172, 4, 172, 87, 3, 172], handlers=((0, 6, 10, 0),))
        self.assertEqual(reachable(cls, method, None, {('Owner', 'disabled', 'Z')}), {0, 3, 8, 9, 10, 11, 12})

    def test_bad_branch_and_subroutine_refuse(self):
        for code in ([167, 0, 1], [168, 0, 3, 177]):
            cls, method = self.fixture(code)
            with self.assertRaises(Refusal):
                reachable(cls, method, 7)


if __name__ == '__main__':
    unittest.main()
