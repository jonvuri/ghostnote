"""Test wrapper allocation bounds on inert class data."""
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from grid_symbols.scan import Class, Member, Refusal
from grid_symbols.test_resolve import FakeJar
from .test_descriptor_resolution import ModelCode
from .wrapper_bounds import wrapper_bound


def model():
    cp = [None, (1, 'Wrapper'), (7, 1), (1, '<init>'), (1, '(LObject;LFactory;)V'),
          (12, (3, 4)), (10, (2, 5))]
    ctor_cp = [None, (1, 'java/lang/Object'), (7, 1), (1, '<init>'), (1, '()V'),
               (12, (3, 4)), (10, (2, 5))]
    factory = Class('Factory', 'java/lang/Object', (), 1, [],
                    [Member('method', 'make', '(LObject;)LWrapper;', 1,
                            bytes([187, 0, 2, 89, 43, 42, 183, 0, 6, 176]))], cp)
    wrapper = Class('Wrapper', 'java/lang/Object', (), 1, [],
                    [Member('method', '<init>', '(LObject;LFactory;)V', 1,
                            bytes([42, 183, 0, 6, 177]))], ctor_cp)
    jar = FakeJar([factory, wrapper]); jar.sha256 = 'model'
    jar.zip = SimpleNamespace(read=lambda _: b'')
    return jar


def run(jar):
    with patch('grid_doctor.wrapper_bounds.requirements',
               return_value={'fields': [], 'initializers': []}), \
         patch('grid_doctor.wrapper_bounds.bootstraps', return_value=[]), \
         patch('grid_doctor.wrapper_bounds.method_trace', return_value={}):
        return wrapper_bound(jar, ModelCode(), 'Factory', 'make', '(LObject;)LWrapper;')


class WrapperBoundTests(unittest.TestCase):
    def test_single_allocation_and_external_constructor_remain_conditional(self):
        result = run(model())
        self.assertEqual(result['objectAllocations'], 1)
        self.assertEqual(result['constructorInstructionBound'], 9)
        self.assertEqual(result['vendorConstructorCalls'], 1)
        self.assertFalse(result['boundedAdmission'])
        self.assertFalse(result['writeAuthority'])

    def test_changed_factory_refuses(self):
        jar = model(); jar.classes['Factory'].methods[0].code = bytes([1, 176])
        with self.assertRaisesRegex(Refusal, 'factory-shape'):
            run(jar)

    def test_constructor_allocation_loop_and_other_call_refuse(self):
        for body, reason in [([187, 0, 2, 177], 'opcode'),
                             ([167, 0, 0], 'back-edge'),
                             ([42, 184, 0, 6, 177], 'opcode')]:
            with self.subTest(body=body):
                jar = model(); jar.classes['Wrapper'].methods[0].code = bytes(body)
                with self.assertRaisesRegex(Refusal, reason):
                    run(jar)

    def test_missing_super_constructor_refuses(self):
        jar = model(); jar.classes['Wrapper'].methods[0].code = bytes([177])
        with self.assertRaisesRegex(Refusal, 'super-constructor-count'):
            run(jar)

    def test_constructor_handler_refuses(self):
        jar = model(); jar.classes['Wrapper'].methods[0].handlers = ((0, 4, 4, 0),)
        with self.assertRaisesRegex(Refusal, 'constructor-handler'):
            run(jar)


if __name__ == '__main__':
    unittest.main()
