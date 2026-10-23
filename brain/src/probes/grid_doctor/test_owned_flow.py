"""Test owned-collector inputs without loading vendor classes."""
import copy
import unittest
from grid_symbols.scan import Class, Member, Refusal
from grid_symbols.test_resolve import FakeJar
from .owned_flow import getter_field, runtime_parent_bindings
from .test_read_dataflow import pool


def catalogs():
    classes = [Class('Child', 'Parent', (), 1, [], []),
               Class('Parent', 'java/lang/Object', (), 1, [], [])]
    jar = FakeJar(classes)
    rows = {'rows': [{'name': 'fixed', 'id': 17, 'count': 1,
                     'matches': [{'runtimeClass': 'Child'}]}]}
    return jar, rows


class OwnedFlowTests(unittest.TestCase):
    def test_parent_inputs_follow_classes_and_ignore_interfaces(self):
        old, catalog = catalogs()
        new = copy.deepcopy(old)
        new.classes['Child'].interfaces = ('UnrelatedInterface',)
        mapped, rows = runtime_parent_bindings(old, new, catalog, catalog)
        self.assertEqual(mapped, {'Child': 'Child', 'Parent': 'Parent'})
        self.assertEqual(rows[0]['source'], ['Child', 'Parent'])

    def test_changed_parent_depth_and_external_parent_refuse(self):
        old, catalog = catalogs()
        for parent in ('java/lang/Object', 'external/Parent'):
            new = copy.deepcopy(old)
            new.classes['Child'].parent = parent
            with self.subTest(parent=parent), self.assertRaisesRegex(Refusal, 'parent-shape'):
                runtime_parent_bindings(old, new, catalog, catalog)

    def test_duplicate_or_ambiguous_anchor_refuses(self):
        jar, catalog = catalogs()
        duplicate = copy.deepcopy(catalog)
        duplicate['rows'] *= 2
        with self.assertRaisesRegex(Refusal, 'duplicate'):
            runtime_parent_bindings(jar, jar, catalog, duplicate)
        ambiguous = copy.deepcopy(catalog)
        ambiguous['rows'][0]['count'] = 2
        with self.assertRaisesRegex(Refusal, 'anchor-count'):
            runtime_parent_bindings(jar, jar, catalog, ambiguous)

    def test_parent_cycle_refuses(self):
        jar, catalog = catalogs()
        jar.classes['Parent'].parent = 'Child'
        with self.assertRaisesRegex(Refusal, 'inheritance-cycle'):
            runtime_parent_bindings(jar, jar, catalog, catalog)

    def test_getter_requires_exact_field_and_operation(self):
        cls = Class('Property', 'java/lang/Object', (), 1, [], [],
                    pool('Property', 'parent', 'LDescriptor;', 9))
        method = Member('method', 'parent', '()LDescriptor;', 17, bytes([42, 180, 0, 6, 176]))
        self.assertEqual(getter_field(cls, method, 'LDescriptor;'),
                         ('Property', 'parent', 'LDescriptor;'))
        method.code = bytes([1, 176])
        with self.assertRaisesRegex(Refusal, 'getter-body'):
            getter_field(cls, method, 'LDescriptor;')


if __name__ == '__main__':
    unittest.main()
