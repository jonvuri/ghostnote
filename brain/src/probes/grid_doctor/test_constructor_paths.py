"""Test constructor selection through a literal parent-call prefix."""
import copy
import unittest

from grid_symbols.scan import Class, Member, Refusal
from grid_symbols.test_resolve import FakeJar
from .constructor_paths import constructor_path
from .test_descriptor_resolution import ModelCode


def model():
    def cls(name, parent, own_desc, parent_desc, argument):
        cp = [None, (1, parent), (7, 1), (1, '<init>'), (1, parent_desc),
              (12, (3, 4)), (10, (2, 5))]
        code = bytes([42, *argument, 183, 0, 6, 177])
        return Class(name, parent, (), 1, [], [Member('method', '<init>', own_desc, 1, code)], cp)
    return FakeJar([cls('Child', 'Parent', '()V', '(I)V', [3]),
                    cls('Parent', 'java/lang/Object', '(I)V', '()V', [])]), ModelCode()


class ConstructorPathTests(unittest.TestCase):
    def test_parent_signature_selects_the_constructor(self):
        jar, code = model()
        parent = jar.classes['Parent']
        parent.methods.insert(0, Member('method', '<init>', '()V', 1, bytes([177])))
        result = constructor_path(jar, code, 'Child')
        self.assertEqual([(r['owner'], r['descriptor']) for r in result],
                         [('Child', '()V'), ('Parent', '(I)V')])
        parent.methods.reverse()
        self.assertEqual(result, constructor_path(jar, code, 'Child'))

    def test_nonthis_receiver_refuses(self):
        jar, code = model()
        jar.classes['Child'].methods[0].code = bytes([43, 3, 183, 0, 6, 177])
        with self.assertRaisesRegex(Refusal, 'body'):
            constructor_path(jar, code, 'Child')

    def test_extra_receiver_value_refuses(self):
        jar, code = model()
        jar.classes['Child'].methods[0].code = bytes([42, 42, 3, 183, 0, 6, 177])
        with self.assertRaisesRegex(Refusal, 'receiver'):
            constructor_path(jar, code, 'Child')

    def test_effectful_argument_prefix_refuses(self):
        jar, code = model()
        jar.classes['Child'].methods[0].code = bytes([42, 184, 0, 6, 183, 0, 6, 177])
        with self.assertRaisesRegex(Refusal, 'prefix'):
            constructor_path(jar, code, 'Child')

    def test_cycle_and_external_parent_refuse(self):
        jar, code = model()
        child = jar.classes['Child']
        child.parent = 'Child'
        child.cp[1] = (1, 'Child')
        child.cp[4] = (1, '()V')
        child.methods[0].code = bytes([42, 183, 0, 6, 177])
        with self.assertRaisesRegex(Refusal, 'cycle'):
            constructor_path(jar, code, 'Child')
        jar, code = model()
        parent = jar.classes['Parent']
        parent.parent = 'external/Base'
        parent.cp[1] = (1, 'external/Base')
        with self.assertRaisesRegex(Refusal, 'external-parent'):
            constructor_path(jar, code, 'Child')

    def test_handler_and_duplicate_constructor_refuse(self):
        jar, code = model()
        jar.classes['Child'].methods[0].handlers = ((0, 5, 5, 0),)
        with self.assertRaisesRegex(Refusal, 'body'):
            constructor_path(jar, code, 'Child')
        jar, code = model()
        cls = jar.classes['Child']
        cls.methods.append(copy.deepcopy(cls.methods[0]))
        with self.assertRaises(Refusal):
            constructor_path(jar, code, 'Child')


if __name__ == '__main__':
    unittest.main()
