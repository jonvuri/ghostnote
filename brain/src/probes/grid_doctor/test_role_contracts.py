"""Check the bounded local census. A local match must not admit a table."""
import copy
import json
import os
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from grid_symbols.scan import Jar, Member, Refusal
from grid_symbols.test_resolve import rename_model
from .role_contracts import census, member_edge, sources
from .test_contracts import fixture

ROOT = Path(__file__).resolve().parents[4]
DATA = ROOT / 'context/evidence/data/phase9b-doctor'


def candidate():
    return {'types': {'receiver': 'Receiver', 'dependency': 'Dependency'}, 'members': [
        {'role': 'read', 'kind': 'method', 'declaring': 'Receiver', 'lookup': 'Receiver',
         'name': 'read', 'descriptor': '()LDependency;', 'flags': 1}]}


def run_model(source, target, rows=None, budget=None):
    target.sha256 = 'inert'
    target.zip = SimpleNamespace(read=lambda name: target.classes[name[:-6]])
    with patch('grid_doctor.role_contracts.parse', lambda cls, _: cls):
        return census(source, target, rows or candidate(), budget)


class CensusTests(unittest.TestCase):
    def setUp(self):
        self.source, _, _ = fixture()
        self.target = copy.deepcopy(self.source)

    def test_unique_body_does_not_select_a_receiver(self):
        report = run_model(self.source, self.target)
        self.assertEqual(report['members'][0]['status'], 'unique-local-contract')
        self.assertFalse(report['completeTable'])
        self.assertFalse(report['writeAuthority'])
        self.assertTrue(all(r['status'] == 'receiver-binding-unproved' for r in report['types']))

    def test_full_model_renaming_and_enumeration(self):
        model = copy.deepcopy(self.source)
        model.code('Receiver')
        renamed, names, _ = rename_model(model)
        report = run_model(self.source, renamed)
        self.assertEqual(report['members'][0]['matches'][0]['owner'], names['Receiver'])

    def test_unrelated_receiver_and_dependency_members(self):
        for cls in self.target.classes.values():
            cls.fields.append(Member('field', 'extra', 'J', 1))
            cls.methods.append(Member('method', 'extra', '(I)I', 1, bytes([27, 172])))
        self.target.classes = dict(reversed(list(self.target.classes.items())))
        self.assertEqual(run_model(self.source, self.target)['members'][0]['matchCount'], 1)

    def test_signature_flags_and_operation_changes_are_missing(self):
        for key, value in [('desc', '(I)LDependency;'), ('flags', 0),
                           ('code', bytes([42, 180, 0, 6, 87, 42, 180, 0, 9, 176]))]:
            target = copy.deepcopy(self.target)
            setattr(target.classes['Receiver'].methods[0], key, value)
            with self.subTest(key=key):
                self.assertEqual(run_model(self.source, target)['members'][0]['status'], 'missing')

    def test_missing_candidate(self):
        self.target.classes['Receiver'].methods.clear()
        self.assertEqual(run_model(self.source, self.target)['members'][0]['status'], 'missing')

    def test_duplicate_pool_is_counted_and_bounded(self):
        cls = self.target.classes['Receiver']
        for i in range(140):
            m = copy.deepcopy(cls.methods[0])
            m.name = 'duplicate' + str(i)
            cls.methods.append(m)
        row = run_model(self.source, self.target)['members'][0]
        self.assertEqual(row['status'], 'ambiguous')
        self.assertEqual(row['matchCount'], 141)
        self.assertEqual(len(row['matches']), 128)
        self.assertTrue(row['matchesTruncated'])
        cls.methods.reverse()
        self.assertEqual(row, run_model(self.source, self.target)['members'][0])

    def test_field_and_abstract_roles_need_bindings(self):
        model = candidate()
        model['members'].append({'role': 'field', 'kind': 'field'})
        abstract = copy.deepcopy(model['members'][0])
        abstract.update(role='abstract', name='abstract', flags=0x401)
        model['members'].append(abstract)
        self.source.classes['Receiver'].methods.append(Member('method', 'abstract', '()LDependency;', 0x401))
        rows, _ = sources(self.source, model)
        self.assertEqual(rows[1]['status'], 'requires-operation-binding')
        self.assertEqual(rows[2]['status'], 'requires-dispatch-binding')

    def test_unsupported_source_is_not_missing_or_equal(self):
        cls = self.source.classes['Receiver']
        cls.cp.append((18, (0, 5)))
        cls.methods[0].code = bytes([186, 0, 10, 0, 0, 177])
        row = run_model(self.source, self.target)['members'][0]
        self.assertEqual(row['status'], 'unsupported-source-contract')

    def test_source_missing_or_duplicate_refuses(self):
        for methods in ([], self.source.classes['Receiver'].methods * 2):
            with self.subTest(count=len(methods)):
                src = copy.deepcopy(self.source)
                src.classes['Receiver'].methods = methods
                with self.assertRaisesRegex(Refusal, 'source-missing-or-duplicate'):
                    run_model(src, self.target)

    def test_combined_work_limits_refuse(self):
        for budget in ({'methods': 1000000, 'instructions': 0},
                       {'methods': 0, 'instructions': 16000000}):
            with self.assertRaisesRegex(Refusal, 'work-limit'):
                run_model(self.source, self.target, budget=budget)


@unittest.skipUnless(os.environ.get('GRID_SYMBOL_JAR') and os.environ.get('GRID_NEW_SYMBOL_JAR'),
                     'Set both jar paths for offline integration.')
class CensusIntegration(unittest.TestCase):
    def test_both_complete_role_censuses_reproduce(self):
        source = Jar(Path(os.environ['GRID_SYMBOL_JAR']))
        target = Jar(Path(os.environ['GRID_NEW_SYMBOL_JAR']))
        try:
            expected = json.loads((DATA / '614-fixtures/role-contracts.json').read_text())
            table = json.loads((DATA / 'v20-preparation/candidate.json').read_text())
            budget = {'methods': 0, 'instructions': 0}
            for jar, saved in zip((source, target), expected['censuses']):
                actual = census(source, jar, table, budget)
                self.assertEqual(actual, saved)
                self.assertEqual(len(actual['members']), 76)
                self.assertEqual(len(actual['types']), 55)
                self.assertEqual(actual['work']['classes'], jar.stats['classes'])
            self.assertEqual(budget, expected['work'])
            for jar, scanned, saved in zip((source, target), expected['censuses'], expected['membershipEdges']):
                self.assertEqual(member_edge(source, jar, table, scanned, 'insert-body', 'members'), saved)
            self.assertTrue(expected['membershipEdges'][0]['terminalContractEqual'])
            self.assertFalse(expected['membershipEdges'][1]['terminalContractEqual'])
            changed = copy.deepcopy(expected['censuses'][1])
            anchor = next(r for r in changed['members'] if r['role'] == 'insert-body')
            anchor['matchCount'] = 2
            with self.assertRaisesRegex(Refusal, 'anchor-not-unique'):
                member_edge(source, target, table, changed, 'insert-body', 'members')
            with self.assertRaisesRegex(Refusal, 'edge-missing-or-duplicate'):
                member_edge(source, target, table, expected['censuses'][1], 'insert-body', 'disposal')
        finally:
            source.close()
            target.close()


if __name__ == '__main__':
    unittest.main()
