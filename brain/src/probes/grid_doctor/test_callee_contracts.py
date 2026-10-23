"""Test callee changes separately from complete symbolic role identities."""
import copy
import unittest
from grid_symbols.scan import Class, Member
from grid_symbols.test_resolve import rename_model
from .test_contracts import fixture
from .test_descriptor_resolution import ModelCode
from .callee_contracts import compare_callees
from .contracts import contract


class CalleeTests(unittest.TestCase):
    def run_pair(self, old, target, names=None):
        old.sha256, target.sha256 = 'old', 'target'
        names = names or {n: n for n in old.classes}
        cls = target.classes[names['Receiver']]
        method = cls.methods[0]
        return compare_callees(old, target, [{'owner': cls.name, 'name': method.name, 'descriptor': method.desc}],
                               {'typeBindings': names, 'memberBindings': []}, ModelCode())

    def test_exact_renamed_contract_without_admission(self):
        old, cls, _ = fixture(); old.code(cls.name)
        target, names, _ = rename_model(copy.deepcopy(old))
        result = self.run_pair(old, target, names)
        self.assertEqual(len(result['matched']), 1)
        self.assertEqual(result['unmatched'], [])
        self.assertFalse(result['boundedAdmission'])

    def test_required_body_change_stays_unmatched(self):
        old, _, _ = fixture(); target = copy.deepcopy(old)
        target.classes['Receiver'].methods[0].code = bytes([42, 180, 0, 9, 176])
        result = self.run_pair(old, target)
        self.assertEqual(result['matched'], [])
        self.assertEqual(result['unmatched'][0]['count'], 0)

    def test_unrelated_members_do_not_invalidate_contract(self):
        old, _, _ = fixture(); target = copy.deepcopy(old)
        for cls in target.classes.values():
            cls.methods.append(Member('method', 'extra', '()V', 2, bytes([177])))
        self.assertEqual(len(self.run_pair(old, target)['matched']), 1)

    def test_ambiguous_source_body_is_not_selected(self):
        old, cls, method = fixture(); target = copy.deepcopy(old)
        duplicate = copy.deepcopy(method); duplicate.name = 'another'; cls.methods.append(duplicate)
        result = self.run_pair(old, target)
        self.assertEqual(result['matched'], [])
        self.assertEqual(result['unmatched'][0]['count'], 2)

    def test_conflicting_inherited_field_candidate_is_not_selected(self):
        old, cls, _ = fixture()
        old.classes['Parent'] = Class('Parent', 'java/lang/Object', (), 1, [], [])
        cls.parent = 'Parent'
        target = copy.deepcopy(old)
        moved = target.classes['Receiver'].fields.pop(0)
        target.classes['Parent'].fields.append(moved)
        result = self.run_pair(old, target)
        self.assertEqual(result['matched'], [])
        self.assertEqual(result['unmatched'][0]['count'], 0)

    def test_explicit_provider_is_scoped_and_reported(self):
        old, cls, method = fixture()
        target = copy.deepcopy(old)
        old.sha256, target.sha256 = 'old', 'target'
        trace = [{'owner': cls.name, 'name': method.name, 'descriptor': method.desc}]
        seed = {'typeBindings': {n: n for n in old.classes}, 'memberBindings': []}
        seen = []

        def provider(jar, owner, member):
            seen.append(jar.sha256)
            return contract(owner, member, jar.classes)

        result = compare_callees(old, target, trace, seed, ModelCode(), local_contract=provider)
        self.assertEqual(result['matched'][0]['contract'], 'explicit-local-contract')
        self.assertEqual(set(seen), {'old', 'target'})
        self.assertEqual(self.run_pair(old, target)['matched'][0]['contract'], 'exact-local-contract')
        refused = compare_callees(old, target, trace, seed, ModelCode(),
                                  local_contract=lambda *_: None)
        self.assertEqual(refused['matched'], [])
        self.assertFalse(refused['boundedAdmission'])


if __name__ == '__main__':
    unittest.main()
