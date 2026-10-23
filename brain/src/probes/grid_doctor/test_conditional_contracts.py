"""Test conditional projection and retained control flow."""
import unittest

from grid_symbols.scan import Refusal
from .conditional_contracts import assertion_ranges
from .dynamic_contracts import dynamic_contract
from .test_assertion_variants import fixture


def value(cls, method, enabled=True):
    return dynamic_contract(cls, method, {cls.name: cls}, [], exclude_assertions=enabled)


class ConditionalTests(unittest.TestCase):
    def test_excluded_members_do_not_create_bindings(self):
        a, am, b, bm = fixture()
        av, bv = value(a, am), value(b, bm)
        self.assertEqual(av['digest'], bv['digest'])
        self.assertEqual(av['members'], {})
        self.assertEqual(av['instructions'], 1)
        self.assertEqual(av['assertionProjection']['field'], ('Owner', 'disabled', 'Z'))
        self.assertNotEqual(value(a, am, False)['digest'], value(b, bm, False)['digest'])

    def test_branch_to_guard_start_maps_to_exit(self):
        a, am, _, _ = fixture()
        am.code = bytes([167, 0, 3]) + am.code
        result = value(a, am)
        self.assertEqual(result['tokens'], [[167, 1], [177, []]])

    def test_branch_to_condition_refuses(self):
        a, am, _, _ = fixture()
        am.code = bytes([3, 167, 0, 6]) + am.code
        with self.assertRaisesRegex(Refusal, 'entered-block'):
            value(a, am)

    def test_adjacent_guards_map_to_shared_exit(self):
        a, am, _, _ = fixture()
        am.code = am.code[:-1] + am.code
        result = value(a, am)
        self.assertEqual(result['instructions'], 1)
        self.assertEqual(result['assertionProjection']['ranges'], [(0, 12), (12, 24)])

    def test_handler_refuses_projection(self):
        a, am, _, _ = fixture()
        am.handlers = ((0, 12, 12, 0),)
        with self.assertRaisesRegex(Refusal, 'handler'):
            assertion_ranges(a, am)

    def test_mutable_flag_is_not_projected(self):
        a, am, _, _ = fixture()
        a.fields[0].flags = 8
        result = value(a, am)
        self.assertEqual(result['assertionProjection'], {'field': None, 'ranges': []})
        self.assertEqual(result['instructions'], 7)

    def test_change_after_guard_still_changes_contract(self):
        a, am, b, bm = fixture()
        bm.code = bm.code[:-1] + bytes([0, 177])
        self.assertNotEqual(value(a, am)['digest'], value(b, bm)['digest'])

    def test_bad_target_and_subroutine_refuse(self):
        a, am, _, _ = fixture()
        am.code = am.code[:4] + bytes([0, 5]) + am.code[6:]
        with self.assertRaisesRegex(Refusal, 'guard-target'):
            value(a, am)
        a, am, _, _ = fixture()
        am.code = bytes([168, 0, 3]) + am.code
        with self.assertRaisesRegex(Refusal, 'subroutine'):
            value(a, am)


if __name__ == '__main__':
    unittest.main()
