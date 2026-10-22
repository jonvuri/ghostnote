"""Test operation binding and incomplete-result refusal without vendor execution."""
import copy
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from grid_symbols.scan import Jar, Member, Refusal
from grid_symbols.test_resolve import rename_model
from .test_contracts import fixture
from .test_role_contracts import candidate, run_model
from .role_bindings import bind_roles, main
from .role_variants import trace_variants

DATA = Path(__file__).resolve().parents[4] / 'context/evidence/data/phase9b-doctor'


def table():
    value = candidate()
    value['members'].append({'role': 'field', 'kind': 'field', 'declaring': 'Receiver',
                             'lookup': 'Receiver', 'name': 'a', 'descriptor': 'LDependency;', 'flags': 2})
    return value


def run(source, target, model=None, scanned=None):
    model = model or table()
    scanned = scanned or run_model(source, target, model)
    with patch('grid_doctor.role_bindings.code', lambda jar, name: jar.classes[name]), \
            patch('grid_doctor.role_bindings.snapshot', lambda jar, cls, method: {}):
        return bind_roles(source, target, model, scanned)


class BindingTests(unittest.TestCase):
    def setUp(self):
        self.source, _, _ = fixture()
        self.target = copy.deepcopy(self.source)

    def test_exact_operation_and_field_do_not_admit_table(self):
        result = run(self.source, self.target)
        self.assertEqual([r['status'] for r in result['members']],
                         ['exact-operation-contract', 'field-operation-bound'])
        self.assertGreater(result['work']['instructions'], 0)
        for key in ('completeTable', 'boundedAdmission', 'writeAuthority'):
            self.assertFalse(result[key])

    def test_rename_and_enumeration(self):
        self.target.code('Receiver')
        target, names, _ = rename_model(self.target)
        result = run(self.source, target)
        self.assertEqual(result['typeBindings']['Receiver'], names['Receiver'])
        self.assertEqual(result['members'][1]['status'], 'field-operation-bound')
        target.classes = dict(reversed(list(target.classes.items())))
        self.assertEqual(result, run(self.source, target))

    def test_unrelated_receiver_and_dependency_members(self):
        for cls in self.target.classes.values():
            cls.fields.append(Member('field', 'extra', 'J', 1))
            cls.methods.append(Member('method', 'extra', '(I)I', 1, bytes([27, 172])))
        self.assertEqual(run(self.source, self.target)['members'],
                         run(self.source, copy.deepcopy(self.source))['members'])

    def test_duplicate_candidates_remain_ambiguous(self):
        m = copy.deepcopy(self.target.classes['Receiver'].methods[0])
        m.name = 'duplicate'
        self.target.classes['Receiver'].methods.append(m)
        result = run(self.source, self.target)
        self.assertEqual(result['members'][0]['status'], 'ambiguous')
        self.assertEqual(result['members'][1]['status'], 'requires-operation-binding')

    def test_conflicting_unique_anchors_refuse_as_a_round(self):
        model = table()
        for jar in (self.source, self.target):
            second = copy.deepcopy(jar.classes['Receiver'])
            second.name = 'Second'
            second.cp[1] = (1, 'Second')
            second.methods[0].flags = 17
            jar.classes['Second'] = second
        other = copy.deepcopy(self.target.classes['Dependency'])
        other.name = 'Other'
        self.target.classes['Other'] = other
        self.target.classes['Second'].cp[4] = (1, 'LOther;')
        self.target.classes['Second'].methods[0].desc = '()LOther;'
        row = copy.deepcopy(model['members'][0])
        row.update(role='second', declaring='Second', lookup='Second', flags=17)
        model['members'].append(row)
        with self.assertRaisesRegex(Refusal, 'operation-edge-conflict'):
            run(self.source, self.target, model)
        model['members'].reverse()
        with self.assertRaisesRegex(Refusal, 'operation-edge-conflict'):
            run(self.source, self.target, model)

    def test_missing_candidate(self):
        self.target.classes['Receiver'].methods.clear()
        self.assertEqual(run(self.source, self.target)['members'][0]['status'], 'missing-or-conflicting')

    def test_changed_required_signature_and_operation(self):
        for attr, value in [('desc', '()I'), ('flags', 0),
                             ('code', bytes([42, 180, 0, 6, 87, 42, 180, 0, 9, 176]))]:
            target = copy.deepcopy(self.target)
            setattr(target.classes['Receiver'].methods[0], attr, value)
            with self.subTest(attr=attr):
                self.assertEqual(run(self.source, target)['members'][0]['status'], 'missing-or-conflicting')

    def test_field_access_change_does_not_bind_field(self):
        self.target.classes['Receiver'].fields[0].flags = 1
        self.assertEqual(run(self.source, self.target)['members'][1]['status'], 'field-access-changed')

    def test_field_lookup_receiver_must_reach_declaration(self):
        model = table()
        model['members'][1]['lookup'] = 'Dependency'
        result = run(self.source, self.target, model)
        self.assertEqual(result['members'][1]['status'], 'operation-edge-only')

    def test_truncated_pool_cannot_choose_retained_candidate(self):
        scanned = run_model(self.source, self.target, table())
        row = scanned['members'][0]
        row.update(matchCount=129, matchesTruncated=True, status='ambiguous')
        self.assertEqual(run(self.source, self.target, scanned=scanned)['members'][0]['status'],
                         'unbound-truncated-pool')

    def test_abstract_reference_does_not_prove_runtime_dispatch(self):
        model = table()
        self.source.classes['Receiver'].methods.append(Member('method', 'abstract', '()I', 0x401))
        self.target = copy.deepcopy(self.source)
        model['members'].append({'role': 'abstract', 'kind': 'method', 'declaring': 'Receiver',
            'lookup': 'Receiver', 'name': 'abstract', 'descriptor': '()I', 'flags': 0x401})
        result = run(self.source, self.target, model)
        self.assertEqual(result['members'][-1]['status'], 'requires-dispatch-binding')
        self.assertFalse(result['members'][-1]['runtimeReceiverProved'])

    def test_census_hash_coverage_and_source_checked(self):
        scanned = run_model(self.source, self.target, table())
        for mutate in (lambda s: s.update(sha256='wrong'),
                       lambda s: s['members'].pop(),
                       lambda s: s['members'][0]['source'].update(flags=0)):
            value = copy.deepcopy(scanned)
            mutate(value)
            with self.assertRaisesRegex(Refusal, 'binding-census'):
                run(self.source, self.target, scanned=value)

    def test_work_limits(self):
        for name in ('MAX_COMPARISONS', 'MAX_INSTRUCTIONS', 'MAX_ROUNDS'):
            with self.subTest(name=name), patch('grid_doctor.role_bindings.' + name, 0):
                with self.assertRaisesRegex(Refusal, 'binding-.*limit'):
                    run(self.source, self.target)

    def test_existing_report_is_not_overwritten(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'report.json'
            path.write_text('keep')
            with patch('sys.argv', ['role_bindings', '--old-jar', 'old', '--new-jar', 'new',
                                    '--report', str(path)]):
                with self.assertRaisesRegex(Refusal, 'binding-report-exists'):
                    main()
            self.assertEqual(path.read_text(), 'keep')


@unittest.skipUnless(os.environ.get('GRID_SYMBOL_JAR') and os.environ.get('GRID_NEW_SYMBOL_JAR'),
                     'Set both jar paths for offline integration.')
class BindingIntegration(unittest.TestCase):
    def test_both_jar_bindings_and_variants_reproduce(self):
        expected = json.loads((DATA / '614-bindings/bindings.json').read_text())
        census = json.loads((DATA / '614-fixtures/role-contracts.json').read_text())
        candidate = json.loads((DATA / 'v20-preparation/candidate.json').read_text())
        migration = json.loads((DATA / '614-structural/migration.json').read_text())
        old = Jar(Path(os.environ['GRID_SYMBOL_JAR']))
        new = Jar(Path(os.environ['GRID_NEW_SYMBOL_JAR']))
        try:
            for i, jar in enumerate((old, new)):
                result = bind_roles(old, jar, candidate, census['censuses'][i])
                self.assertEqual(result, expected['builds'][i])
                self.assertEqual(result['summary']['field-operation-bound'], 9)
                self.assertEqual(len(result['members']), 76)
                self.assertEqual(len(result['types']), 55)
                variant = trace_variants(old, jar, candidate, result, migration, census['membershipEdges'][i])
                self.assertEqual(variant, expected['variantTraces'][i])
                managed = variant['variants']['managed-id']
                self.assertEqual(len(managed['targetSignaturePool']), 1)
                bootstrap = next(r['bootstrap'] for r in managed['targetSignaturePool'][0]['instructions']
                                 if 'bootstrap' in r)
                self.assertEqual(bootstrap['handle']['target']['owner'], 'java/lang/invoke/LambdaMetafactory')
                self.assertFalse(managed['admitted'])
                if not i:
                    self.assertTrue(all(k == v for k, v in result['typeBindings'].items()))
                    for row in result['members']:
                        if row['status'] == 'exact-operation-contract':
                            self.assertEqual(row['target']['name'], row['source']['name'])
                            self.assertEqual(row['target']['owner'], row['source']['declaring'])
                            self.assertEqual(row['target']['descriptor'], row['source']['descriptor'])
                self.assertTrue(variant['unclosedCalls'])
                self.assertTrue(any(x['bootstrap']['handle']['target']['owner'] ==
                                    'java/lang/invoke/StringConcatFactory' for x in variant['dynamicSites']))
                if i:
                    recording = variant['variants']['journal-recording-edit']
                    self.assertEqual(recording['source']['flags'], 2)
                    self.assertEqual(recording['target']['flags'], 0)
                    self.assertFalse(variant['membership']['terminalContractEqual'])
            changed = copy.deepcopy(migration)
            changed['disposal']['new']['codeBytes'] += 1
            with self.assertRaisesRegex(Refusal, 'variant-seed-trace'):
                trace_variants(old, new, candidate, expected['builds'][1], changed, census['membershipEdges'][1])
        finally:
            old.close()
            new.close()


if __name__ == '__main__':
    unittest.main()
