"""Test local contract evidence and refusal. No vendor code is executed."""
import copy
import json
import os
from pathlib import Path
import unittest

from grid_symbols.scan import Class, Jar, Member, Refusal
from grid_symbols.resolve import unique
from grid_symbols.test_resolve import FakeJar, rename_model
from .contracts import contract, matching_methods
from .migrate import Comparison, bindings, merge, trace


def fixture():
    cp = [None, (1, 'Receiver'), (7, 1), (1, 'a'), (1, 'LDependency;'),
          (12, (3, 4)), (9, (2, 5)), (1, 'b'), (12, (7, 4)), (9, (2, 8))]
    method = Member('method', 'read', '()LDependency;', 1,
                    bytes([42, 180, 0, 6, 87, 42, 180, 0, 6, 176]))
    cls = Class('Receiver', 'java/lang/Object', (), 1,
                [Member('field', 'a', 'LDependency;', 2), Member('field', 'b', 'LDependency;', 2)],
                [method], cp)
    dependency = Class('Dependency', 'java/lang/Object', (), 1, [], [])
    return FakeJar([cls, dependency]), cls, method


class ContractTests(unittest.TestCase):
    def test_renaming_and_enumeration(self):
        jar, cls, method = fixture()
        expected = contract(cls, method, jar.classes)
        jar.code(cls.name)
        model, names, rename = rename_model(jar)
        actual_cls = model.classes[names['Receiver']]
        actual = contract(actual_cls, actual_cls.methods[0], model.classes)
        self.assertEqual(expected['digest'], actual['digest'])
        self.assertEqual(bindings(expected, actual)[0]['Dependency'], names['Dependency'])

    def test_unrelated_members_and_reference_additions(self):
        jar, cls, method = fixture()
        expected = contract(cls, method, jar.classes)['digest']
        for target in jar.classes.values():
            target.fields.append(Member('field', 'extra', 'J', 2))
            target.methods.append(Member('method', 'extra', '(I)I', 1, bytes([27, 172])))
        self.assertEqual(expected, contract(cls, method, jar.classes)['digest'])

    def test_reference_type_replacement_preserves_local_shape_but_conflicts_with_binding(self):
        jar, cls, method = fixture()
        before = contract(cls, method, jar.classes)
        jar.classes['Other'] = Class('Other', 'java/lang/Object', (), 1, [], [])
        cls.cp[4] = (1, 'LOther;')
        method.desc = '()LOther;'
        after = contract(cls, method, jar.classes)
        self.assertEqual(before['digest'], after['digest'])
        with self.assertRaisesRegex(Refusal, 'operation-edge-conflict'):
            merge([{'Dependency': 'Dependency'}, {}], bindings(before, after))

    def test_reference_alias_change_refuses(self):
        jar, cls, method = fixture()
        expected = contract(cls, method, jar.classes)['digest']
        method.code = bytes([42, 180, 0, 6, 87, 42, 180, 0, 9, 176])
        self.assertNotEqual(expected, contract(cls, method, jar.classes)['digest'])

    def test_required_signature_and_access_change_refuse(self):
        jar, cls, method = fixture()
        expected = contract(cls, method, jar.classes)
        method.flags = 0
        changed = contract(cls, method, jar.classes)
        self.assertNotEqual(expected['digest'], changed['digest'])
        self.assertEqual(expected['bodyDigest'], changed['bodyDigest'])
        method.desc = '(I)LDependency;'
        self.assertNotEqual(expected['bodyDigest'], contract(cls, method, jar.classes)['bodyDigest'])

    def test_handlers_change_refuses(self):
        jar, cls, method = fixture()
        expected = contract(cls, method, jar.classes)['digest']
        method.handlers = ((0, 4, 5, 0),)
        self.assertNotEqual(expected, contract(cls, method, jar.classes)['digest'])

    def test_literals_and_branch_changes_refuse(self):
        jar, cls, method = fixture()
        method.desc, method.code = '()I', bytes([3, 153, 0, 5, 4, 172, 5, 172])
        expected = contract(cls, method, jar.classes)['digest']
        method.code = bytes([3, 154, 0, 5, 4, 172, 5, 172])
        self.assertNotEqual(expected, contract(cls, method, jar.classes)['digest'])
        method.code = bytes([3, 153, 0, 5, 4, 172, 6, 172])
        self.assertNotEqual(expected, contract(cls, method, jar.classes)['digest'])

    def test_missing_and_duplicate_candidates_refuse(self):
        jar, cls, method = fixture()
        target = copy.deepcopy(cls)
        target.methods = []
        matches, _ = matching_methods(cls, method, jar.classes, target, jar.classes)
        with self.assertRaisesRegex(Refusal, 'found-0'):
            unique(matches, 'method')
        target.methods = [copy.deepcopy(method), copy.deepcopy(method)]
        target.methods[1].name = 'duplicate'
        matches, _ = matching_methods(cls, method, jar.classes, target, jar.classes)
        with self.assertRaisesRegex(Refusal, 'found-2'):
            unique(matches, 'method')

    def test_operation_edge_and_receiver_alias_conflicts_refuse(self):
        with self.assertRaisesRegex(Refusal, 'operation-edge-conflict'):
            merge([{}, {('method', 'undo'): 'undo'}], [{}, {('method', 'undo'): 'redo'}])
        with self.assertRaisesRegex(Refusal, 'reference-alias-conflict'):
            merge([{'document': 'one'}, {}], [{'journal': 'one'}, {}])

    def test_unchecked_bootstrap_refuses(self):
        jar, cls, method = fixture()
        cls.cp.append((18, (0, 5)))
        method.code = bytes([186, 0, 10, 0, 0, 177])
        with self.assertRaisesRegex(Refusal, 'unsupported-constant:18'):
            contract(cls, method, jar.classes)

    def test_work_limits_refuse(self):
        jar, cls, method = fixture()
        comparison = Comparison(jar, jar)
        comparison.work['methods'] = 1000000
        with self.assertRaisesRegex(Refusal, 'method-limit'):
            comparison.shape(jar, cls, method)
        comparison.work['methods'] = 0
        comparison.work['instructions'] = 16000000
        with self.assertRaisesRegex(Refusal, 'instruction-limit'):
            comparison.shape(jar, cls, method)


@unittest.skipUnless(os.environ.get('GRID_SYMBOL_JAR') and os.environ.get('GRID_NEW_SYMBOL_JAR'),
                     'Set both jar paths for the offline integration checks.')
class MigrationIntegration(unittest.TestCase):
    def test_shared_trace_procedure_on_both_jars(self):
        evidence = Path(__file__).resolve().parents[4] / 'context/evidence/data/phase9b-doctor/v20-preparation'
        candidate = json.loads((evidence / 'candidate.json').read_text())
        caller = json.loads((evidence / 'undo-caller-trace.json').read_text())
        for path, expected in ((os.environ['GRID_SYMBOL_JAR'], 'traced-subset'),
                               (os.environ['GRID_NEW_SYMBOL_JAR'], 'refused')):
            with self.subTest(path=path):
                old = Jar(Path(os.environ['GRID_SYMBOL_JAR']))
                new = Jar(Path(path))
                try:
                    result = trace(old, new, candidate, caller)
                    self.assertEqual(result['result'], expected)
                    self.assertEqual(result['unmatchedCallerMethods'], [])
                    self.assertTrue(result['projectRefresh']['equalContract'])
                    self.assertEqual(result['recordingEdit']['equalAccess'], expected == 'traced-subset')
                    self.assertEqual(result['disposal']['equalContract'], expected == 'traced-subset')
                    self.assertTrue(all(r['equalContract'] == (expected == 'traced-subset')
                                        for r in result['relationshipHooks']))
                finally:
                    old.close()
                    new.close()


if __name__ == '__main__':
    unittest.main()
