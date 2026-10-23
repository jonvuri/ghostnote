"""Check relationship allocation inference on inert class data."""
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

from grid_symbols.scan import Class, Member, Refusal
from grid_symbols.test_resolve import FakeJar
from .property_contracts import captured_relationships, infer_relationship_classes
from .test_descriptor_resolution import ModelCode


def model():
    cp = [None, (1, 'Concrete'), (7, 1), (1, 'children'), (8, 3)]
    method = Member('method', 'get', '()LRelationship;', 1,
                    bytes([187, 0, 2, 89, 18, 4, 16, 42, 176]))
    classes = [Class('Descriptor', 'java/lang/Object', (), 1, [], [method], cp),
               Class('Relationship', 'java/lang/Object', (), 1, [], []),
               Class('Concrete', 'Relationship', (), 1, [], [])]
    jar = FakeJar(classes)
    jar.sha256 = 'inert'
    catalog = {'rows': [{'name': 'node', 'id': 1, 'count': 1,
                         'matches': [{'descriptor': 'Descriptor'}]}]}
    return jar, catalog, {('node', 1): {('children', 42)}}, 'Relationship', ModelCode()


class PropertyContractsTests(unittest.TestCase):
    def test_allocation_subtype_is_used_not_return_type(self):
        result, census = infer_relationship_classes(*model())
        self.assertEqual(result[('node', 1)][('children', 42)], 'Concrete')
        self.assertTrue(census['completeSourceCensus'])
        self.assertFalse(census['boundedAdmission'])

    def test_duplicate_allocation_is_incomplete(self):
        args = model()
        cls = args[0].classes['Descriptor']
        cls.methods.append(Member('method', 'other', '()LRelationship;', 1, cls.methods[0].code))
        result, census = infer_relationship_classes(*args)
        self.assertEqual(result, {})
        self.assertFalse(census['completeSourceCensus'])

    def test_explicit_constructor_path_filters_only_constructors(self):
        args = model()
        cls = args[0].classes['Descriptor']
        body = cls.methods[0].code
        cls.methods = [Member('method', '<init>', '()V', 1, body),
                       Member('method', '<init>', '(I)V', 1, body)]
        self.assertFalse(infer_relationship_classes(*args)[1]['completeSourceCensus'])
        paths = {('node', 1): {'Descriptor': {'(I)V'}}}
        result, census = infer_relationship_classes(*args, constructor_paths=paths)
        self.assertTrue(census['completeSourceCensus'])
        self.assertEqual(result[('node', 1)][('children', 42)], 'Concrete')
        cls.methods.append(Member('method', 'other', '()LRelationship;', 1, body))
        self.assertFalse(infer_relationship_classes(*args, constructor_paths=paths)[1]['completeSourceCensus'])

    def test_missing_and_nonrelationship_allocations_are_incomplete(self):
        for unrelated in (False, True):
            args = model()
            if unrelated:
                args[0].classes['Concrete'].parent = 'java/lang/Object'
            else:
                args[0].classes['Descriptor'].methods.clear()
            with self.subTest(unrelated=unrelated):
                result, census = infer_relationship_classes(*args)
                self.assertEqual(result, {})
                self.assertFalse(census['completeSourceCensus'])

    def test_uncaptured_descriptor_does_not_cover_wanted(self):
        args = model()
        args[2][('absent', 2)] = {('children', 42)}
        self.assertFalse(infer_relationship_classes(*args)[1]['completeSourceCensus'])

    def test_closest_declaration_wins(self):
        args = model()
        cls = args[0].classes['Descriptor']
        parent = Class('Parent', 'java/lang/Object', (), 1, [], list(cls.methods) * 2, cls.cp)
        args[0].classes['Parent'] = parent
        cls.parent = 'Parent'
        self.assertTrue(infer_relationship_classes(*args)[1]['completeSourceCensus'])

    def test_cycle_and_duplicate_descriptor_refuse(self):
        args = model()
        cls = args[0].classes['Descriptor']
        cls.methods.clear()
        cls.parent = 'Descriptor'
        with self.assertRaisesRegex(Refusal, 'parent-cycle-or-depth'):
            infer_relationship_classes(*args)
        args = model()
        args[1]['rows'][0]['count'] = 2
        with self.assertRaisesRegex(Refusal, 'descriptor-count'):
            infer_relationship_classes(*args)

    def test_full_schema_relationships_do_not_need_descriptor_classes(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'capture.zip'
            value = {'className': 'node', 'classId': 1, 'properties': [
                {'name': 'children', 'id': 42, 'relationship': True},
                {'name': 'scalar', 'id': 43, 'relationship': False}]}
            with zipfile.ZipFile(path, 'w') as archive:
                archive.writestr('read.json', json.dumps({'schema': value}))
            self.assertEqual(captured_relationships(path), {('node', 1): {('children', 42)}})


if __name__ == '__main__':
    unittest.main()
