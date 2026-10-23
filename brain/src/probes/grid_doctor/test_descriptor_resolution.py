"""Test source anchors, lookup relationships, and closed refusal boundaries."""
import copy
import unittest
from unittest.mock import patch

from grid_symbols.scan import Class, Member, Refusal
from grid_symbols.test_resolve import rename_model
from .contracts import contract
from .test_contracts import fixture
from .test_role_bindings import table
from .descriptor_resolution import (anchor_census, source_contracts, extend,
                                     abstract_interface_slot, hierarchy_edges, override_edges)
from .admission import Work
from .receiver_trace import ReceiverLimits


class ModelCode:
    def get(self, jar, name):
        jar.check()
        return jar.classes[name]


def run(old, target, plan=None):
    old.sha256 = 'source-model'
    target.sha256 = 'target-model'
    cls = old.classes['Receiver']
    method = cls.methods[0]
    plan = plan or {'anchors': [{'source': ['Receiver', method.name, method.desc],
                                'digest': contract(cls, method, old.classes)['digest']}], 'roleWitnesses': []}
    code = ModelCode()
    expected = source_contracts(old, plan, code)
    census = anchor_census(old, target, plan, expected, code)
    seed = {'sha256': target.sha256, 'typeBindings': {}, 'memberBindings': []}
    return extend(old, target, table(), seed, plan, census, code)


class DescriptorResolutionTests(unittest.TestCase):
    def setUp(self):
        self.old, _, _ = fixture()
        self.target = copy.deepcopy(self.old)

    def test_roles_and_fields_do_not_grant_runtime_admission(self):
        result = run(self.old, self.target)
        self.assertEqual(result['summary'], {'exact-operation-contract': 1, 'field-operation-bound': 1})
        for key in ('completeTable', 'boundedAdmission', 'writeAuthority'):
            self.assertFalse(result[key])

    def test_rename_and_enumeration(self):
        self.target.code('Receiver')
        target, names, _ = rename_model(self.target)
        actual = run(self.old, target)
        self.assertEqual(actual['typeBindings']['Receiver'], names['Receiver'])
        target.classes = dict(reversed(list(target.classes.items())))
        self.assertEqual(actual, run(self.old, target))

    def test_unrelated_receiver_and_dependency_additions(self):
        before = run(self.old, self.target)
        for cls in self.target.classes.values():
            cls.fields.append(Member('field', 'extra', 'J', 1))
            cls.methods.append(Member('method', 'extra', '(I)I', 1, bytes([27, 172])))
        self.assertEqual(before['members'], run(self.old, self.target)['members'])

    def test_missing_duplicate_signature_access_and_operation_refuse(self):
        for change in ('missing', 'duplicate', 'signature', 'access', 'operation'):
            target = copy.deepcopy(self.target)
            method = target.classes['Receiver'].methods[0]
            if change == 'missing':
                target.classes['Receiver'].methods.clear()
            elif change == 'duplicate':
                other = copy.deepcopy(method); other.name = 'duplicate'
                target.classes['Receiver'].methods.append(other)
            elif change == 'signature':
                method.desc = '()I'
            elif change == 'access':
                method.flags = 17
            else:
                method.code = bytes([42, 180, 0, 6, 87, 42, 180, 0, 9, 176])
            with self.subTest(change=change), self.assertRaisesRegex(Refusal, 'anchor-count'):
                run(self.old, target)

    def test_field_access_change_remains_refused(self):
        self.target.classes['Receiver'].fields[0].flags = 1
        result = run(self.old, self.target)
        self.assertEqual(result['members'][1]['status'], 'lookup-or-access-difference')

    def test_parent_change_refuses(self):
        self.target.classes['Receiver'].parent = 'java/lang/Number'
        with self.assertRaisesRegex(Refusal, 'external-parent-change'):
            run(self.old, self.target)

    def test_conflicting_source_contract_refuses(self):
        plan = {'anchors': [{'source': ['Receiver', 'read', '()LDependency;'], 'digest': 'wrong'}],
                'roleWitnesses': []}
        with self.assertRaisesRegex(Refusal, 'source-contract'):
            run(self.old, self.target, plan)

    def test_limits_do_not_disappear_in_candidate_refusal(self):
        for key in ('MAX_METHODS', 'MAX_SCAN_INSTRUCTIONS', 'MAX_COMPARISONS', 'MAX_BIND_INSTRUCTIONS', 'MAX_TRACES'):
            with self.subTest(key=key), patch('grid_doctor.descriptor_resolution.' + key, 0):
                with self.assertRaises(Refusal):
                    run(self.old, self.target)

    def test_abstract_interface_slot_does_not_select_implementation(self):
        self.target.classes['Iface'] = Class('Iface', 'java/lang/Object', (), 1537, [],
                                             [Member('method', 'extent', '()D', 1025)])
        self.target.classes['Dependency'].interfaces = ('Iface',)
        work = Work(ReceiverLimits())
        result = abstract_interface_slot(self.target, 'Dependency', 'Iface', 'extent', '()D', work)
        self.assertEqual(result, {'status': 'declaration', 'owner': 'Iface', 'flags': 1025})
        self.target.classes['Dependency'].methods.append(Member('method', 'extent', '()D', 1, bytes([14, 175])))
        with self.assertRaisesRegex(Refusal, 'implementation-required'):
            abstract_interface_slot(self.target, 'Dependency', 'Iface', 'extent', '()D', work)

    def test_ambiguous_interfaces_refuse(self):
        for name in ('One', 'Two'):
            self.target.classes[name] = Class(name, 'java/lang/Object', (), 1537, [],
                                              [Member('method', 'extent', '()D', 1025)])
        self.target.classes['Dependency'].interfaces = ('One', 'Two')
        with self.assertRaisesRegex(Refusal, 'slot-ambiguous'):
            abstract_interface_slot(self.target, 'Dependency', 'One', 'extent', '()D', Work(ReceiverLimits()))


if __name__ == '__main__':
    unittest.main()
