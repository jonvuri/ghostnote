"""Keep diagnostic hypotheses separate from validated build candidates."""
import unittest

from grid_doctor.diagnose import member_census, sample, shape_delta, type_census
from grid_symbols.scan import Class, Member
from grid_symbols.test_resolve import FakeJar, fixture


class DiagnosticTests(unittest.TestCase):
    def test_dependency_change_does_not_promote_shallow_match(self):
        old, rules = fixture()
        new = FakeJar([
            Class('Base2', 'java/lang/Object', (), 1, [], [
                Member('method', 'first', '()I', 1, bytes([4, 172])),
                Member('method', 'second', '()I', 1, bytes([5, 172])),
                Member('method', 'added', '()V', 1, bytes([177]))]),
            Class('Child2', 'Base2', (), 17, [], []),
            Class('Other2', 'java/lang/Object', (), 1, [Member('field', 'flag', 'Z', 2)], [])])
        rows, _, _ = type_census(old, new, rules, {'base': 'Base', 'child': 'Child', 'other': 'Other'})
        child = next(r for r in rows if r['role'] == 'child')
        self.assertEqual(child['rounds'][0]['names'], ['Child2'])
        self.assertEqual(child['strict']['count'], 0)
        member = member_census(rules, rows)[0]
        self.assertEqual(member['unresolvedTypes'], ['base', 'child'])
        self.assertEqual(member['memberValidation'], 'not-run')
        self.assertFalse(member['writeAuthority'])

    def test_ambiguous_names_are_reported_without_selection(self):
        old, rules = fixture()
        new = FakeJar([*old.classes.values(), Class('Other2', 'java/lang/Object', (), 1,
                                                    [Member('field', 'flag', 'Z', 2)], [])])
        rows, _, _ = type_census(old, new, rules, {'base': 'Base', 'child': 'Child', 'other': 'Other'})
        self.assertEqual(next(r for r in rows if r['role'] == 'other')['strict']['count'], 2)

    def test_signature_and_dispatch_dependencies_block_members(self):
        rules = {'members': [{'role': 'command', 'lookupType': 'base', 'declaringType': 'base',
                              'signature': '(@argument;)@result;', 'dispatchType': 'runtime'}]}
        rows = member_census(rules, [{'role': 'base', 'strict': {'count': 1}}])
        self.assertEqual(rows[0]['unresolvedTypes'], ['argument', 'result', 'runtime'])
        self.assertFalse(rows[0]['writeAuthority'])

    def test_name_list_is_bounded_and_count_is_exact(self):
        row = sample([f'class{i}' for i in range(1000)])
        self.assertEqual(row['count'], 1000)
        self.assertEqual(len(row['names']), 128)
        self.assertTrue(row['truncated'])

    def test_shape_delta_retains_multiplicity(self):
        shape = ('method', 1, '()V')
        self.assertEqual(shape_delta([shape], [shape, shape]), {'removed': [], 'added': [shape]})
