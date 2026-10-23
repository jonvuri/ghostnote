"""Test exact instance-field conditions without loading vendor classes."""
import unittest

from grid_symbols.scan import Class, Member, Refusal
from .read_dataflow import ReadFlow, NULL, integer
from .test_descriptor_resolution import ModelCode
from .test_read_dataflow import model, pool


def guarded(flow, values, **extra):
    return ReadFlow(flow.jar, ModelCode(), [], ('Receiver', 'id', 'I'), 17,
                    'Descriptor', instance_values=values, **extra)


class InstanceReadTests(unittest.TestCase):
    def test_reference_condition_is_scoped_to_one_receiver(self):
        flow, receiver = model([42, 180, 0, 6, 176], '()LReceiver;',
                               cp=pool('Receiver', 'child', 'LReceiver;', 9))
        flow.jar.classes['Receiver'].fields.append(Member('field', 'child', 'LReceiver;', 2))
        field = ('Receiver', 'child', 'LReceiver;')
        value = ('ref', 'Receiver', 'child')
        flow = guarded(flow, {(receiver, field): value})
        self.assertEqual(flow.evaluate('Receiver', 'read', '()LReceiver;', receiver), {value})
        self.assertEqual(flow.evaluate('Receiver', 'read', '()LReceiver;', value),
                         {('unknown', 'LReceiver;', None)})
        self.assertEqual(flow.instance_fields, {(receiver, field)})

    def test_inherited_reference_uses_the_declared_field(self):
        base = Class('Base', 'java/lang/Object', (), 1,
                     [Member('field', 'child', 'LBase;', 4)], [])
        flow, receiver = model([42, 180, 0, 6, 176], '()LBase;', parent='Base',
                               cp=pool('Receiver', 'child', 'LBase;', 9), others=[base])
        field = ('Base', 'child', 'LBase;')
        flow = guarded(flow, {(receiver, field): NULL})
        self.assertEqual(flow.evaluate('Receiver', 'read', '()LBase;', receiver), {NULL})
        self.assertEqual(flow.instance_fields, {(receiver, field)})

    def test_null_instance_test_excludes_the_reference_call(self):
        cp = pool('java/lang/ref/SoftReference', 'get', '()Ljava/lang/Object;')
        flow, receiver = model([43, 193, 0, 2, 153, 0, 8, 43, 182, 0, 6, 176, 43, 176],
                               '(Ljava/lang/Object;)Ljava/lang/Object;', cp=cp)
        self.assertEqual(flow.evaluate('Receiver', 'read', '(Ljava/lang/Object;)Ljava/lang/Object;',
                                       receiver, (NULL,)), {NULL})
        self.assertFalse(flow.external)
        self.assertEqual(flow.type_tests, {'java/lang/ref/SoftReference'})
        flow, receiver = model([43, 193, 0, 2, 153, 0, 8, 43, 182, 0, 6, 176, 43, 176],
                               '(Ljava/lang/Object;)Ljava/lang/Object;', cp=cp)
        flow.evaluate('Receiver', 'read', '(Ljava/lang/Object;)Ljava/lang/Object;',
                      receiver, (('unknown', 'Ljava/lang/Object;', None),))
        self.assertTrue(flow.external)

    def test_integer_and_boolean_values_require_exact_types(self):
        for desc, value in [('I', integer(-2**31)), ('Z', integer(0))]:
            flow, receiver = model([42, 180, 0, 6, 172], cp=pool('Receiver', 'value', desc, 9))
            flow.jar.classes['Receiver'].fields.append(Member('field', 'value', desc, 2))
            flow = guarded(flow, {(receiver, ('Receiver', 'value', desc)): value})
            self.assertEqual(flow.evaluate('Receiver', 'read', '()I', receiver), {value})
        for desc, value in [('I', NULL), ('I', integer(2**31)), ('Z', integer(2)),
                             ('I', integer(True)), ('I', None)]:
            flow, receiver = model([3, 172])
            flow.jar.classes['Receiver'].fields.append(Member('field', 'value', desc, 2))
            with self.assertRaisesRegex(Refusal, 'instance-guard-value'):
                guarded(flow, {(receiver, ('Receiver', 'value', desc)): value})

    def test_wrong_field_receiver_and_reference_type_refuse(self):
        for change in ('static', 'missing', 'receiver', 'type'):
            flow, receiver = model([3, 172])
            flow.jar.classes['Receiver'].fields.append(Member('field', 'child', 'LReceiver;',
                                                              8 if change == 'static' else 2))
            flow.jar.classes['Other'] = Class('Other', 'java/lang/Object', (), 1, [], [])
            field = ('Receiver', 'missing' if change == 'missing' else 'child', 'LReceiver;')
            owner = ('ref', 'Other', 'object') if change == 'receiver' else receiver
            value = ('ref', 'Other', 'child') if change == 'type' else NULL
            with self.assertRaisesRegex(Refusal, 'instance-guard'):
                guarded(flow, {(owner, field): value})
        flow, receiver = model([3, 172])
        for key in [None, (None, ('Receiver', 'child', 'I')),
                    (receiver, None), (receiver, ('Receiver', 'child', None))]:
            with self.subTest(key=key), self.assertRaisesRegex(Refusal, 'instance-guard'):
                guarded(flow, {key: NULL})

    def test_property_inputs_and_guard_limit_cannot_be_overridden(self):
        flow, receiver = model([3, 172])
        flow.jar.classes['Receiver'].fields.extend([
            Member('field', 'id', 'I', 2), Member('field', 'parent', 'LReceiver;', 2)])
        for field, value, extra in [(('Receiver', 'id', 'I'), integer(3), {}),
                                    (('Receiver', 'parent', 'LReceiver;'), NULL,
                                     {'property_descriptor': (('Receiver', 'parent', 'LReceiver;'),
                                                              'Receiver')})]:
            with self.assertRaisesRegex(Refusal, 'property-input'):
                guarded(flow, {(receiver, field): value}, **extra)
        with self.assertRaisesRegex(Refusal, 'instance-guard-limit'):
            guarded(flow, {(('ref', 'Receiver', str(i)), ('Receiver', 'id', 'I')): integer(0)
                           for i in range(129)})
        base = Class('Base', 'java/lang/Object', (), 1,
                     [Member('field', 'id', 'I', 4)], [])
        flow, receiver = model([3, 172], parent='Base', others=[base])
        with self.assertRaisesRegex(Refusal, 'property-input'):
            guarded(flow, {(receiver, ('Base', 'id', 'I')): integer(3)})


if __name__ == '__main__':
    unittest.main()
